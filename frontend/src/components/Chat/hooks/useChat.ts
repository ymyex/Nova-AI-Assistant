import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import type { Message, StreamItem, StoredMessage, ProcessStep, AgentEvent } from '../types';
import type { ConversationListItem } from '../../../types/chat';

interface UseChatOptions {
    activeConversationId: string | null;
    pendingNewChat: boolean;
    onConversationCreated?: (conv: ConversationListItem) => void;
    onConversationsChanged?: () => void;
    onSetActiveConversation?: (id: string | null) => void;
    onSetPendingNewChat?: (pending: boolean) => void;
    onUpdateConversation?: (id: string, updates: Partial<ConversationListItem>) => void;
    scrollToBottom: (animated?: boolean, force?: boolean) => void;
}

interface UseChatReturn {
    messages: Message[];
    streamItems: StreamItem[];
    isProcessing: boolean;
    hasStreamingMessage: boolean;
    input: string;
    setInput: (value: string) => void;
    handleSend: (modelOverride?: string | null) => Promise<void>;
    loadConversation: (conversationId: string, isPolling?: boolean) => Promise<void>;
    inputRef: React.RefObject<HTMLTextAreaElement | null>;
}

// Convert stored message from API to UI message format
function storedToUIMessage(stored: StoredMessage): Message {
    // If we have a high-fidelity trace log, use it to reconstruct exact history
    if (stored.trace_log && stored.trace_log.length > 0) {
        const steps: ProcessStep[] = [];

        // De-duplicate consecutive entries with identical content
        const deduplicatedLog = stored.trace_log.filter((entry, index, arr) => {
            if (index === 0) return true;
            const prev = arr[index - 1];
            if (entry.type !== prev.type) return true;

            if (entry.type === 'text' || entry.type === 'thinking') {
                return entry.content !== prev.content;
            }

            if (entry.type === 'tool_call_start' || entry.type === 'tool_call_result') {
                if (entry.name !== prev.name) return true;
                const argsMatch = JSON.stringify(entry.args) === JSON.stringify(prev.args);
                const resultMatch = entry.result === prev.result;
                return !(argsMatch && resultMatch);
            }

            return true;
        });

        for (let i = 0; i < deduplicatedLog.length; i++) {
            const event = deduplicatedLog[i];
            if (event.type === 'text') {
                steps.push({
                    id: `${stored.id}-text-${i}`,
                    type: 'text',
                    content: event.content
                });
            } else if (event.type === 'thinking') {
                steps.push({
                    id: `${stored.id}-think-${i}`,
                    type: 'thinking',
                    content: event.content
                });
            } else if (event.type === 'tool_call_start') {
                steps.push({
                    id: `${stored.id}-tool-${event.name}-${i}`,
                    type: 'tool_call',
                    toolName: event.name,
                    toolArgs: event.args,
                    toolResult: undefined
                });
            } else if (event.type === 'tool_call_result') {
                for (let j = steps.length - 1; j >= 0; j--) {
                    if (steps[j].type === 'tool_call' &&
                        steps[j].toolName === event.name &&
                        !steps[j].toolResult) {
                        steps[j].toolResult = event.result;
                        break;
                    }
                }
            }
        }

        // For streaming messages, keep all steps together for inline rendering
        if (stored.status === 'streaming') {
            return {
                id: stored.id,
                role: stored.role === 'assistant' ? 'agent' : 'user',
                content: '',
                processSteps: steps.length > 0 ? steps : undefined,
                status: stored.status
            };
        }

        // For complete messages, extract the last text as the main content
        const lastTextIndex = steps.map(s => s.type).lastIndexOf('text');
        const lastTextStep = lastTextIndex >= 0 ? steps[lastTextIndex] : null;
        const content = lastTextStep?.content || '';
        const processSteps = lastTextIndex >= 0
            ? [...steps.slice(0, lastTextIndex), ...steps.slice(lastTextIndex + 1)]
            : steps;

        return {
            id: stored.id,
            role: stored.role === 'assistant' ? 'agent' : 'user',
            content: content,
            processSteps: processSteps.length > 0 ? processSteps : undefined,
            status: stored.status
        };
    }

    // Fallback: Legacy reconstruction for old messages
    const processSteps: ProcessStep[] = [];

    if (stored.tool_calls) {
        for (let i = 0; i < stored.tool_calls.length; i++) {
            const tc = stored.tool_calls[i];
            processSteps.push({
                id: `${stored.id}-tool-${tc.name}-${i}`,
                type: 'tool_call',
                toolName: tc.name,
                toolArgs: tc.args as Record<string, unknown>,
                toolResult: tc.result
            });
        }
    }

    if (stored.thinking) {
        for (let i = 0; i < stored.thinking.length; i++) {
            processSteps.push({
                id: `${stored.id}-think-${i}`,
                type: 'thinking',
                content: stored.thinking[i]
            });
        }
    }

    return {
        id: stored.id,
        role: stored.role === 'assistant' ? 'agent' : 'user',
        content: stored.content,
        processSteps: processSteps.length > 0 ? processSteps : undefined,
        status: stored.status
    };
}

/**
 * Hook for managing chat state and message handling.
 */
export function useChat(options: UseChatOptions): UseChatReturn {
    const {
        activeConversationId,
        pendingNewChat,
        onConversationCreated,
        onConversationsChanged,
        onSetActiveConversation,
        onSetPendingNewChat,
        onUpdateConversation,
        scrollToBottom
    } = options;

    // Chat UI state - PER-CONVERSATION message cache
    const [messagesCache, setMessagesCache] = useState<Map<string, Message[]>>(new Map());
    const [input, setInput] = useState('');
    const [processingConversations, setProcessingConversations] = useState<Set<string>>(new Set());
    const [streamItemsMap, setStreamItemsMap] = useState<Map<string, StreamItem[]>>(new Map());

    // Refs
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const activeConversationIdRef = useRef<string | null>(activeConversationId);
    const streamItemsRefsMap = useRef<Map<string, StreamItem[]>>(new Map());
    const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Derived: current conversation's messages
    const messages = useMemo(() => {
        if (!activeConversationId) return [];
        return messagesCache.get(activeConversationId) || [];
    }, [messagesCache, activeConversationId]);

    // Get stream items for the current conversation
    const streamItems = useMemo(() => {
        if (!activeConversationId) return [];
        return streamItemsMap.get(activeConversationId) || [];
    }, [activeConversationId, streamItemsMap]);

    // Check if the CURRENT conversation is processing
    const isProcessing = activeConversationId !== null && processingConversations.has(activeConversationId);

    // Track if we should be polling based on streaming status
    const hasStreamingMessage = useMemo(() => {
        return messages.some(msg => msg.role === 'agent' && msg.status === 'streaming');
    }, [messages]);

    // Keep ref in sync
    useEffect(() => {
        activeConversationIdRef.current = activeConversationId;
    }, [activeConversationId]);

    // Load a specific conversation's messages into the cache
    const loadConversation = useCallback(async (conversationId: string, isPolling: boolean = false) => {
        try {
            const response = await fetch(`/api/chats/${conversationId}`);
            if (response.ok) {
                const data = await response.json();
                const uiMessages = (data.messages || []).map(storedToUIMessage);

                setMessagesCache(prev => {
                    const newCache = new Map(prev);
                    newCache.set(conversationId, uiMessages);
                    return newCache;
                });

                const hasStreamingMsg = uiMessages.some(
                    (msg: Message) => msg.role === 'agent' && msg.status === 'streaming'
                );

                if (hasStreamingMsg) {
                    setProcessingConversations(prev => {
                        if (prev.has(conversationId)) return prev;
                        const next = new Set(prev);
                        next.add(conversationId);
                        return next;
                    });
                } else {
                    setProcessingConversations(prev => {
                        if (!prev.has(conversationId)) return prev;
                        const next = new Set(prev);
                        next.delete(conversationId);
                        return next;
                    });
                }

                if (!isPolling) {
                    setTimeout(() => scrollToBottom(true, true), 100);
                }
            } else if (response.status === 404) {
                onSetActiveConversation?.(null);
            }
        } catch (error) {
            console.error('Failed to load conversation:', error);
        }
    }, [scrollToBottom, onSetActiveConversation]);

    // Load active conversation when it changes
    useEffect(() => {
        if (activeConversationId) {
            const hasActiveStream = streamItemsMap.has(activeConversationId) &&
                (streamItemsMap.get(activeConversationId)?.length ?? 0) > 0;

            if (!hasActiveStream) {
                loadConversation(activeConversationId);
            }
        }
    }, [activeConversationId, loadConversation, streamItemsMap]);

    // Polling for updates when there are streaming messages
    useEffect(() => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }

        if (!activeConversationId || !hasStreamingMessage) {
            return;
        }

        const pollFn = () => {
            const currentConvId = activeConversationIdRef.current;
            if (currentConvId) {
                loadConversation(currentConvId, true);
            }
        };

        pollFn();
        pollingRef.current = setInterval(pollFn, 1000);

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [activeConversationId, hasStreamingMessage, loadConversation]);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSend = useCallback(async (modelOverride?: string | null) => {
        if (!input.trim() || isProcessing) return;

        let conversationId = activeConversationId;
        let isNewConversation = false;

        if (!conversationId || pendingNewChat) {
            try {
                const response = await fetch('/api/chats', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                if (response.ok) {
                    const newConv = await response.json();
                    conversationId = newConv.id;
                    onConversationCreated?.(newConv);
                    onSetPendingNewChat?.(false);
                    isNewConversation = true;
                } else {
                    throw new Error('Failed to create conversation');
                }
            } catch (error) {
                console.error('Failed to create conversation:', error);
                return;
            }
        }

        const thisConversationId = conversationId!;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim()
        };

        // Add user message to cache immediately
        setMessagesCache(prev => {
            const newCache = new Map(prev);
            const existing = newCache.get(thisConversationId) || [];
            newCache.set(thisConversationId, [...existing, userMessage]);
            return newCache;
        });
        setInput('');

        // Mark as processing
        setProcessingConversations(prev => new Set(prev).add(thisConversationId));

        // Initialize stream items
        streamItemsRefsMap.current.set(thisConversationId, []);
        setStreamItemsMap(prev => new Map(prev).set(thisConversationId, []));

        const getStreamItems = () => streamItemsRefsMap.current.get(thisConversationId) || [];
        const updateStreamItems = (items: StreamItem[]) => {
            streamItemsRefsMap.current.set(thisConversationId, items);
            setStreamItemsMap(prev => new Map(prev).set(thisConversationId, items));
        };

        // Create AbortController
        const existingController = abortControllersRef.current.get(thisConversationId);
        if (existingController) {
            existingController.abort();
        }
        const abortController = new AbortController();
        abortControllersRef.current.set(thisConversationId, abortController);

        try {
            // Generate title for new conversation in parallel
            if (isNewConversation) {
                fetch(`/api/chats/${thisConversationId}/generate-title`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: userMessage.content })
                }).then(async (res) => {
                    if (res.ok) {
                        const data = await res.json();
                        if (data.title) {
                            onUpdateConversation?.(thisConversationId, { title: data.title });
                        }
                    }
                }).catch(() => {
                    // Silently ignore errors
                });
            }

            const response = await fetch(`/api/chats/${thisConversationId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage.content,
                    model_override: modelOverride || undefined
                }),
                signal: abortController.signal
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');

            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const event: AgentEvent = JSON.parse(line.slice(6));

                            switch (event.type) {
                                case 'thinking':
                                    if (event.content) {
                                        const currentItems = getStreamItems();
                                        const lastItem = currentItems[currentItems.length - 1];

                                        if (lastItem && lastItem.type === 'thinking') {
                                            const updatedItem: StreamItem = {
                                                ...lastItem,
                                                content: (lastItem.content || '') + event.content
                                            };
                                            updateStreamItems([...currentItems.slice(0, -1), updatedItem]);
                                        } else {
                                            const thinkItem: StreamItem = {
                                                id: `think-${Date.now()}-${Math.random()}`,
                                                type: 'thinking',
                                                content: event.content
                                            };
                                            updateStreamItems([...currentItems, thinkItem]);
                                        }
                                    }
                                    break;

                                case 'text':
                                    if (event.content) {
                                        const currentItems = getStreamItems();
                                        const lastItem = currentItems[currentItems.length - 1];

                                        if (lastItem && lastItem.type === 'text') {
                                            const updatedItem: StreamItem = {
                                                ...lastItem,
                                                content: (lastItem.content || '') + event.content
                                            };
                                            updateStreamItems([...currentItems.slice(0, -1), updatedItem]);
                                        } else {
                                            const textItem: StreamItem = {
                                                id: `text-${Date.now()}-${Math.random()}`,
                                                type: 'text',
                                                content: event.content
                                            };
                                            updateStreamItems([...currentItems, textItem]);
                                        }
                                    }
                                    break;

                                case 'tool_call_start':
                                    if (event.name) {
                                        const toolItem: StreamItem = {
                                            id: `tool-${event.name}-${Date.now()}`,
                                            type: 'tool_call',
                                            toolName: event.name,
                                            toolArgs: event.args,
                                            isExecuting: true
                                        };
                                        updateStreamItems([...getStreamItems(), toolItem]);
                                    }
                                    break;

                                case 'tool_call_result':
                                    if (event.name) {
                                        const items = [...getStreamItems()];
                                        for (let i = items.length - 1; i >= 0; i--) {
                                            if (items[i].type === 'tool_call' &&
                                                items[i].toolName === event.name &&
                                                items[i].isExecuting) {
                                                items[i] = {
                                                    ...items[i],
                                                    toolResult: event.result,
                                                    isExecuting: false
                                                };
                                                break;
                                            }
                                        }
                                        updateStreamItems(items);
                                    }
                                    break;

                                case 'error':
                                    const errorItem: StreamItem = {
                                        id: `error-${Date.now()}`,
                                        type: 'text',
                                        content: `Error: ${event.content || 'An error occurred'}`
                                    };
                                    updateStreamItems([...getStreamItems(), errorItem]);
                                    break;

                                case 'done':
                                    break;
                            }
                        } catch {
                            // Ignore parse errors for incomplete chunks
                        }
                    }
                }
            }

            // Convert stream items to a single agent message for history
            const finalStreamItems = getStreamItems();
            if (finalStreamItems.length > 0) {
                const merged: ProcessStep[] = [];
                for (const item of finalStreamItems) {
                    const last = merged[merged.length - 1];
                    if (item.type === 'text' && last?.type === 'text') {
                        merged[merged.length - 1] = {
                            ...last,
                            content: (last.content || '') + (item.content || '')
                        };
                    } else {
                        merged.push({
                            id: item.id,
                            type: item.type,
                            toolName: item.toolName,
                            toolArgs: item.toolArgs,
                            toolResult: item.toolResult,
                            content: item.content
                        });
                    }
                }

                const lastTextIndex = merged.map(m => m.type).lastIndexOf('text');
                const lastTextItem = lastTextIndex >= 0 ? merged[lastTextIndex] : null;
                const messageContent = lastTextItem?.content || 'Task completed.';

                const processSteps = lastTextIndex >= 0
                    ? [...merged.slice(0, lastTextIndex), ...merged.slice(lastTextIndex + 1)]
                    : merged;

                const agentMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'agent',
                    content: messageContent,
                    processSteps: processSteps.length > 0 ? processSteps : undefined
                };

                setMessagesCache(prev => {
                    const newCache = new Map(prev);
                    const existing = newCache.get(thisConversationId) || [];
                    newCache.set(thisConversationId, [...existing, agentMessage]);
                    return newCache;
                });
            }

            onConversationsChanged?.();

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.log(`[handleSend] Request aborted for conversation ${thisConversationId}`);
                return;
            }

            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'agent',
                content: `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`
            };

            setMessagesCache(prev => {
                const newCache = new Map(prev);
                const existing = newCache.get(thisConversationId) || [];
                newCache.set(thisConversationId, [...existing, errorMessage]);
                return newCache;
            });
        } finally {
            setProcessingConversations(prev => {
                const next = new Set(prev);
                next.delete(thisConversationId);
                return next;
            });

            streamItemsRefsMap.current.delete(thisConversationId);
            setStreamItemsMap(prev => {
                const next = new Map(prev);
                next.delete(thisConversationId);
                return next;
            });

            inputRef.current?.focus();
        }
    }, [
        input,
        isProcessing,
        activeConversationId,
        pendingNewChat,
        onConversationCreated,
        onSetPendingNewChat,
        onUpdateConversation,
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
        inputRef
    };
}
