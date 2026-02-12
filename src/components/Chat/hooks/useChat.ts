import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import type { Message, StreamItem, StoredMessage, ProcessStep } from '../types';
import type { SendSessionMessageParams } from '../../../types/neuralLink';

interface UseChatOptions {
    activeConversationId: string | null;
    onConversationsChanged?: () => void;
    scrollToBottom: (animated?: boolean, force?: boolean) => void;
    loadSessionHistory: (sessionKey: string) => Promise<unknown[]>;
    sendSessionMessage: (params: SendSessionMessageParams) => Promise<string>;
}

interface UseChatReturn {
    messages: Message[];
    streamItems: StreamItem[];
    isProcessing: boolean;
    hasStreamingMessage: boolean;
    input: string;
    setInput: (value: string) => void;
    handleSend: () => Promise<void>;
    loadConversation: (sessionKey: string, isPolling?: boolean) => Promise<void>;
    inputRef: React.RefObject<HTMLTextAreaElement | null>;
}

function extractTextFromContent(content: unknown): string {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';

    const textParts = content
        .map((part) => {
            if (!part || typeof part !== 'object') return '';
            const entry = part as Record<string, unknown>;
            if (typeof entry.text === 'string') return entry.text;
            if (typeof entry.content === 'string') return entry.content;
            return '';
        })
        .filter(Boolean);

    return textParts.join('\n\n').trim();
}

function storedToUIMessage(stored: StoredMessage): Message {
    const processSteps: ProcessStep[] = [];

    if (Array.isArray(stored.thinking)) {
        for (let i = 0; i < stored.thinking.length; i += 1) {
            processSteps.push({
                id: `${stored.id}-thinking-${i}`,
                type: 'thinking',
                content: stored.thinking[i],
            });
        }
    }

    if (Array.isArray(stored.tool_calls)) {
        for (let i = 0; i < stored.tool_calls.length; i += 1) {
            const toolCall = stored.tool_calls[i];
            processSteps.push({
                id: `${stored.id}-tool-${i}`,
                type: 'tool_call',
                toolName: toolCall.name,
                toolArgs: toolCall.args,
                toolResult: toolCall.result,
            });
        }
    }

    return {
        id: stored.id,
        role: stored.role === 'assistant' ? 'agent' : 'user',
        content: stored.content,
        processSteps: processSteps.length > 0 ? processSteps : undefined,
        status: stored.status,
    };
}

function gatewayHistoryToUIMessage(raw: unknown, index: number): Message | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }

    const entry = raw as Record<string, unknown>;
    const roleRaw = typeof entry.role === 'string' ? entry.role : 'assistant';
    if (roleRaw !== 'assistant' && roleRaw !== 'user') {
        return null;
    }

    const content = entry.content;
    const processSteps: ProcessStep[] = [];
    let finalText = '';

    if (typeof content === 'string') {
        finalText = content;
    } else if (Array.isArray(content)) {
        const textParts: string[] = [];
        for (let i = 0; i < content.length; i += 1) {
            const block = content[i];
            if (!block || typeof block !== 'object') continue;
            const node = block as Record<string, unknown>;
            const type = String(node.type ?? '');

            if (typeof node.text === 'string') {
                textParts.push(node.text);
                continue;
            }

            if (typeof node.thinking === 'string') {
                processSteps.push({
                    id: `history-thinking-${index}-${i}`,
                    type: 'thinking',
                    content: node.thinking,
                });
                continue;
            }

            if (
                type.toLowerCase().includes('tool') ||
                typeof node.name === 'string' ||
                typeof node.toolName === 'string'
            ) {
                processSteps.push({
                    id: `history-tool-${index}-${i}`,
                    type: 'tool_call',
                    toolName:
                        typeof node.name === 'string'
                            ? node.name
                            : typeof node.toolName === 'string'
                                ? node.toolName
                                : 'tool',
                    toolArgs:
                        node.args && typeof node.args === 'object'
                            ? (node.args as Record<string, unknown>)
                            : node.arguments && typeof node.arguments === 'object'
                                ? (node.arguments as Record<string, unknown>)
                                : undefined,
                    toolResult:
                        typeof node.result === 'string'
                            ? node.result
                            : typeof node.output === 'string'
                                ? node.output
                                : undefined,
                });
            }
        }
        finalText = textParts.join('\n\n').trim();
    } else {
        finalText = extractTextFromContent(content);
    }

    return {
        id: String(entry.id ?? `history-${index}`),
        role: roleRaw === 'assistant' ? 'agent' : 'user',
        content: finalText || (roleRaw === 'assistant' && processSteps.length > 0 ? 'Done.' : ''),
        processSteps: processSteps.length > 0 ? processSteps : undefined,
        status:
            entry.status === 'streaming' || entry.status === 'error'
                ? (entry.status as 'streaming' | 'error')
                : 'complete',
    };
}

/**
 * Hook for managing chat state and message handling.
 * Uses OpenClaw Gateway sessions as the source of truth.
 */
export function useChat(options: UseChatOptions): UseChatReturn {
    const {
        activeConversationId,
        onConversationsChanged,
        scrollToBottom,
        loadSessionHistory,
        sendSessionMessage
    } = options;

    const [messagesCache, setMessagesCache] = useState<Map<string, Message[]>>(new Map());
    const [input, setInput] = useState('');
    const [processingConversations, setProcessingConversations] = useState<Set<string>>(new Set());
    const [streamItemsMap, setStreamItemsMap] = useState<Map<string, StreamItem[]>>(new Map());

    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const activeConversationIdRef = useRef<string | null>(activeConversationId);

    const messages = useMemo(() => {
        if (!activeConversationId) return [];
        return messagesCache.get(activeConversationId) || [];
    }, [messagesCache, activeConversationId]);

    const streamItems = useMemo(() => {
        if (!activeConversationId) return [];
        return streamItemsMap.get(activeConversationId) || [];
    }, [activeConversationId, streamItemsMap]);

    const isProcessing = activeConversationId !== null && processingConversations.has(activeConversationId);
    const hasStreamingMessage = streamItems.length > 0 || isProcessing;

    useEffect(() => {
        activeConversationIdRef.current = activeConversationId;
    }, [activeConversationId]);

    const loadConversation = useCallback(async (sessionKey: string, isPolling: boolean = false) => {
        if (!sessionKey) return;
        try {
            const history = await loadSessionHistory(sessionKey);
            const uiMessages: Message[] = history
                .map((message, index) => {
                    if (
                        message &&
                        typeof message === 'object' &&
                        ('conversation_id' in (message as Record<string, unknown>) ||
                            'trace_log' in (message as Record<string, unknown>) ||
                            'tool_calls' in (message as Record<string, unknown>))
                    ) {
                        return storedToUIMessage(message as StoredMessage);
                    }
                    return gatewayHistoryToUIMessage(message, index);
                })
                .filter((message): message is Message => message !== null);

            setMessagesCache((prev) => {
                const next = new Map(prev);
                next.set(sessionKey, uiMessages);
                return next;
            });

            if (!isPolling) {
                setTimeout(() => scrollToBottom(true, true), 60);
            }
        } catch (error) {
            console.error('Failed to load conversation history:', error);
        }
    }, [loadSessionHistory, scrollToBottom]);

    useEffect(() => {
        if (!activeConversationId) return;
        void loadConversation(activeConversationId);
    }, [activeConversationId, loadConversation]);

    useEffect(() => {
        if (!activeConversationId) return;
        const intervalId = setInterval(() => {
            const current = activeConversationIdRef.current;
            if (!current) return;
            if (processingConversations.has(current)) return;
            void loadConversation(current, true);
        }, 10000);
        return () => clearInterval(intervalId);
    }, [activeConversationId, loadConversation, processingConversations]);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSend = useCallback(async () => {
        if (!input.trim() || isProcessing) return;

        const sessionKey = activeConversationId;
        if (!sessionKey) {
            const warning: Message = {
                id: `warn-${Date.now()}`,
                role: 'agent',
                content: 'Select a session before sending a message.'
            };
            setMessagesCache((prev) => {
                const next = new Map(prev);
                const existing = next.get('unsorted') || [];
                next.set('unsorted', [...existing, warning]);
                return next;
            });
            return;
        }

        const text = input.trim();
        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: text,
        };

        setMessagesCache((prev) => {
            const next = new Map(prev);
            const existing = next.get(sessionKey) || [];
            next.set(sessionKey, [...existing, userMessage]);
            return next;
        });
        setInput('');

        setProcessingConversations((prev) => new Set(prev).add(sessionKey));
        setStreamItemsMap((prev) => new Map(prev).set(sessionKey, []));

        try {
            const finalText = await sendSessionMessage({
                sessionKey,
                message: text,
                onDelta: (deltaText) => {
                    const liveText: StreamItem = {
                        id: `live-text-${sessionKey}`,
                        type: 'text',
                        content: deltaText,
                    };
                    setStreamItemsMap((prev) => new Map(prev).set(sessionKey, [liveText]));
                    setTimeout(() => scrollToBottom(true, true), 20);
                },
                onError: (message) => {
                    console.error('[NeuralLink] sendSessionMessage error:', message);
                }
            });

            const agentMessage: Message = {
                id: `assistant-${Date.now()}`,
                role: 'agent',
                content: finalText || 'Done.',
            };

            setMessagesCache((prev) => {
                const next = new Map(prev);
                const existing = next.get(sessionKey) || [];
                next.set(sessionKey, [...existing, agentMessage]);
                return next;
            });
            onConversationsChanged?.();
        } catch (error) {
            const agentError: Message = {
                id: `assistant-error-${Date.now()}`,
                role: 'agent',
                content: `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
            setMessagesCache((prev) => {
                const next = new Map(prev);
                const existing = next.get(sessionKey) || [];
                next.set(sessionKey, [...existing, agentError]);
                return next;
            });
        } finally {
            setProcessingConversations((prev) => {
                const next = new Set(prev);
                next.delete(sessionKey);
                return next;
            });

            setStreamItemsMap((prev) => {
                const next = new Map(prev);
                next.delete(sessionKey);
                return next;
            });

            inputRef.current?.focus();
            setTimeout(() => scrollToBottom(true, true), 60);
        }
    }, [
        input,
        isProcessing,
        activeConversationId,
        sendSessionMessage,
        scrollToBottom,
        onConversationsChanged
    ]);

    return {
        messages,
        streamItems,
        isProcessing,
        hasStreamingMessage,
        input,
        setInput,
        handleSend,
        loadConversation,
        inputRef,
    };
}
