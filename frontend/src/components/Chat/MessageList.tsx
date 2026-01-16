import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage } from './ChatMessage';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolCallCard } from './ToolCallCard';
import { EmptyState } from './EmptyState';
import { markdownComponents } from './MarkdownComponents';
import type { Message, StreamItem, ProcessStep } from './types';

interface MessageListProps {
    /** List of completed messages */
    messages: Message[];
    /** Currently streaming items */
    streamItems: StreamItem[];
    /** Whether the chat is processing */
    isProcessing: boolean;
    /** Callback when a suggestion is clicked (for empty state) */
    onSuggestionClick: (command: string) => void;
    /** Ref to attach to the container for scroll management */
    containerRef: React.RefObject<HTMLDivElement | null>;
}

// Merge consecutive stream items of the same type
function mergeStreamItems(items: StreamItem[]): StreamItem[] {
    const merged: StreamItem[] = [];
    for (const item of items) {
        const last = merged[merged.length - 1];
        if (item.type === 'text' && last?.type === 'text') {
            merged[merged.length - 1] = {
                ...last,
                content: (last.content || '') + (item.content || '')
            };
        } else if (item.type === 'thinking' && last?.type === 'thinking') {
            merged[merged.length - 1] = {
                ...last,
                content: (last.content || '') + (item.content || '')
            };
        } else {
            merged.push({ ...item });
        }
    }
    return merged;
}

// Component for rendering streaming process steps inline
const StreamingMessageContent: React.FC<{ processSteps: ProcessStep[] }> = ({ processSteps }) => {
    return (
        <>
            {processSteps.map((step, index, array) => (
                <div key={step.id}>
                    {step.type === 'text' ? (
                        <div className="markdown-content" style={{
                            padding: '0.5rem 0',
                            marginBottom: '0.5rem',
                            marginLeft: '3rem',
                            maxWidth: '90%',
                            color: 'var(--text-main)',
                            fontSize: '0.9375rem',
                            lineHeight: 1.6
                        }}>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={markdownComponents}
                            >
                                {step.content || ''}
                            </ReactMarkdown>
                        </div>
                    ) : step.type === 'thinking' ? (
                        <div style={{ marginLeft: '3rem', maxWidth: '90%' }}>
                            <ThinkingBlock
                                content={step.content || ''}
                                isFinished={index !== array.length - 1}
                            />
                        </div>
                    ) : (
                        <div style={{ marginLeft: '3rem', marginBottom: '0.5rem', maxWidth: '90%' }}>
                            <ToolCallCard
                                name={step.toolName || ''}
                                args={step.toolArgs}
                                result={step.toolResult}
                                isExecuting={!step.toolResult}
                            />
                        </div>
                    )}
                </div>
            ))}
            {/* Show "Processing..." indicator if no steps yet */}
            {processSteps.length === 0 && (
                <div style={{
                    marginLeft: '3rem',
                    color: 'var(--text-secondary)',
                    fontStyle: 'italic'
                }}>
                    Processing...
                </div>
            )}
        </>
    );
};

// Component for rendering live stream items
const LiveStreamContent: React.FC<{ streamItems: StreamItem[] }> = ({ streamItems }) => {
    const merged = mergeStreamItems(streamItems);

    return (
        <AnimatePresence>
            {merged.map((item, index, array) => (
                <motion.div
                    key={item.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    {item.type === 'text' ? (
                        <div className="markdown-content" style={{
                            padding: '0.5rem 0',
                            marginBottom: '0.5rem',
                            marginLeft: '3rem',
                            maxWidth: '90%',
                            color: 'var(--text-main)',
                            fontSize: '0.9375rem',
                            lineHeight: 1.6
                        }}>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={markdownComponents}
                            >
                                {item.content || ''}
                            </ReactMarkdown>
                        </div>
                    ) : item.type === 'thinking' ? (
                        <div style={{ marginLeft: '3rem', maxWidth: '90%' }}>
                            <ThinkingBlock
                                content={item.content || ''}
                                isFinished={index !== array.length - 1}
                            />
                        </div>
                    ) : (
                        <div style={{ marginLeft: '3rem', marginBottom: '0.5rem', maxWidth: '90%' }}>
                            <ToolCallCard
                                name={item.toolName || ''}
                                args={item.toolArgs}
                                result={item.toolResult}
                                isExecuting={item.isExecuting}
                            />
                        </div>
                    )}
                </motion.div>
            ))}
        </AnimatePresence>
    );
};

export const MessageList: React.FC<MessageListProps> = ({
    messages,
    streamItems,
    isProcessing,
    onSuggestionClick,
    containerRef
}) => {
    const hasStreamingMessage = messages.some(m => m.status === 'streaming');

    return (
        <div
            ref={containerRef}
            className="custom-scrollbar"
            style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0 0.5rem 1rem 0.5rem',
                marginBottom: '1rem',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {/* Empty State */}
            {messages.length === 0 && !isProcessing && (
                <EmptyState onSuggestionClick={onSuggestionClick} />
            )}

            {/* Completed and Streaming Messages */}
            {messages.map((msg) => {
                // For streaming messages loaded from DB, render all processSteps inline
                if (msg.status === 'streaming' && msg.role === 'agent') {
                    return (
                        <div key={msg.id}>
                            <StreamingMessageContent processSteps={msg.processSteps || []} />
                        </div>
                    );
                }
                // Normal completed message
                return (
                    <ChatMessage
                        key={msg.id}
                        role={msg.role}
                        content={msg.content}
                        processSteps={msg.processSteps}
                    />
                );
            })}

            {/* Current streaming items - only show if NOT viewing a DB-loaded streaming message */}
            {!hasStreamingMessage && streamItems.length > 0 && (
                <LiveStreamContent streamItems={streamItems} />
            )}
        </div>
    );
};
