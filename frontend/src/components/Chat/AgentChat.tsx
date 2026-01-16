import React, { useState, useEffect, useCallback } from 'react';
import { MODEL_OPTIONS } from '../../constants/ModelOptions';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { useAutoScroll } from './hooks/useAutoScroll';
import { useChat } from './hooks/useChat';
import type { AgentChatProps } from './types';

export const AgentChat: React.FC<AgentChatProps> = ({
    configModel,
    activeConversationId,
    pendingNewChat,
    onConversationCreated,
    onConversationsChanged,
    onSetActiveConversation,
    onSetHasMessages,
    onSetPendingNewChat,
    onUpdateConversation
}) => {
    // Determine the effective default model (from config or fallback to first option)
    const effectiveDefaultModel = configModel || MODEL_OPTIONS[0].id;

    // Session-level model override (null = use default from config)
    const [sessionModel, setSessionModel] = useState<string | null>(null);

    // Auto-scroll hook
    const { containerRef, scrollToBottom } = useAutoScroll({ threshold: 150 });

    // Chat state and logic hook
    const {
        messages,
        streamItems,
        isProcessing,
        input,
        setInput,
        handleSend,
        inputRef
    } = useChat({
        activeConversationId,
        pendingNewChat,
        onConversationCreated,
        onConversationsChanged,
        onSetActiveConversation,
        onSetPendingNewChat,
        onUpdateConversation,
        scrollToBottom
    });

    // Update parent with hasMessages state
    useEffect(() => {
        const hasMessages = messages.length > 0 || isProcessing;
        onSetHasMessages?.(hasMessages);
    }, [messages.length, isProcessing, onSetHasMessages]);

    // Handle suggestion click from empty state
    const handleSuggestionClick = useCallback((command: string) => {
        setInput(command);
        inputRef.current?.focus();
    }, [setInput, inputRef]);

    // Handle send with session model
    const handleSendMessage = useCallback(() => {
        handleSend(sessionModel);
    }, [handleSend, sessionModel]);

    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'transparent',
            minHeight: 0
        }}>
            <ChatHeader
                effectiveDefaultModel={effectiveDefaultModel}
                sessionModel={sessionModel}
                onSessionModelChange={setSessionModel}
            />

            <MessageList
                messages={messages}
                streamItems={streamItems}
                isProcessing={isProcessing}
                onSuggestionClick={handleSuggestionClick}
                containerRef={containerRef}
            />

            <InputArea
                value={input}
                onChange={setInput}
                onSend={handleSendMessage}
                isProcessing={isProcessing}
                inputRef={inputRef}
            />
        </div>
    );
};
