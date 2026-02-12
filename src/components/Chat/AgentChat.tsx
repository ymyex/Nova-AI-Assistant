import React, { useEffect, useCallback } from 'react';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { useAutoScroll } from './hooks/useAutoScroll';
import { useChat } from './hooks/useChat';
import type { AgentChatProps } from './types';

export const AgentChat: React.FC<AgentChatProps> = ({
    activeConversationId,
    sessions,
    onSetActiveConversation,
    onSetHasMessages,
    onConversationsChanged,
    connectionState,
    connectionError,
    gatewayUrl,
    gatewayToken,
    gatewayPassword,
    onGatewayUrlChange,
    onGatewayTokenChange,
    onGatewayPasswordChange,
    onConnectGateway,
    onRefreshSessions,
    loadSessionHistory,
    sendSessionMessage
}) => {
    const { containerRef, scrollToBottom } = useAutoScroll({ threshold: 150 });

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
        onConversationsChanged,
        scrollToBottom,
        loadSessionHistory,
        sendSessionMessage
    });

    useEffect(() => {
        const hasMessages = messages.length > 0 || isProcessing;
        onSetHasMessages?.(hasMessages);
    }, [messages.length, isProcessing, onSetHasMessages]);

    const handleSuggestionClick = useCallback((command: string) => {
        setInput(command);
        inputRef.current?.focus();
    }, [setInput, inputRef]);

    const handleSendMessage = useCallback(() => {
        void handleSend();
    }, [handleSend]);

    return (
        <div
            style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                background: 'transparent',
                minHeight: 0
            }}
        >
            <ChatHeader
                sessions={sessions}
                activeSessionKey={activeConversationId}
                onSessionChange={onSetActiveConversation}
                connectionState={connectionState}
                connectionError={connectionError}
                gatewayUrl={gatewayUrl}
                gatewayToken={gatewayToken}
                gatewayPassword={gatewayPassword}
                onGatewayUrlChange={onGatewayUrlChange}
                onGatewayTokenChange={onGatewayTokenChange}
                onGatewayPasswordChange={onGatewayPasswordChange}
                onConnectGateway={onConnectGateway}
                onRefreshSessions={onRefreshSessions}
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
