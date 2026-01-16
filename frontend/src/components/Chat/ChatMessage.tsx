import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Bot, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ToolCallCard } from './ToolCallCard';
import { ThinkingBlock } from './ThinkingBlock';
import { markdownComponents, compactMarkdownComponents } from './MarkdownComponents';

// Process step type (matches AgentChat)
interface ProcessStep {
    id: string;
    type: 'tool_call' | 'text' | 'thinking';
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    toolResult?: string;
    content?: string;
}

interface ChatMessageProps {
    role: 'user' | 'agent';
    content: string;
    processSteps?: ProcessStep[];
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ role, content, processSteps }) => {
    const isUser = role === 'user';
    const [showSteps, setShowSteps] = useState(false);

    const hasProcessSteps = processSteps && processSteps.length > 0;
    const toolCallCount = processSteps?.filter(s => s.type === 'tool_call').length || 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{
                display: 'flex',
                flexDirection: isUser ? 'row-reverse' : 'row',
                gap: '0.75rem',
                marginBottom: '1.25rem',
                alignItems: 'flex-start',
                paddingRight: isUser ? '0.5rem' : '0'
            }}
        >
            {/* Avatar */}
            <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: isUser
                    ? 'var(--primary)'
                    : 'rgba(255, 255, 255, 0.1)',
                color: isUser ? 'white' : 'var(--primary)',
                marginTop: '0.25rem'
            }}>
                {isUser ? (
                    <User size={16} />
                ) : (
                    <Bot size={16} />
                )}
            </div>

            {/* Message bubble */}
            <div style={{
                maxWidth: '85%',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                alignItems: isUser ? 'flex-end' : 'flex-start'
            }}>
                {/* Process Steps Toggle Button */}
                {!isUser && hasProcessSteps && (
                    <button
                        onClick={() => setShowSteps(!showSteps)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            padding: '0.25rem',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            opacity: 0.8,
                            marginBottom: '0.25rem',
                            fontFamily: 'monospace'
                        }}
                    >
                        <span>[{showSteps ? '-' : '+'}]</span>
                        <span>{toolCallCount} SYSTEM PROCESS{toolCallCount !== 1 ? 'ES' : ''}</span>
                    </button>
                )}

                {/* Collapsible Process Steps */}
                <AnimatePresence>
                    {showSteps && hasProcessSteps && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{
                                overflow: 'hidden',
                                width: '100%',
                                marginBottom: '0.5rem'
                            }}
                        >
                            <div style={{
                                padding: '0.5rem',
                                borderLeft: '2px solid var(--glass-border)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                                marginLeft: '0.25rem'
                            }}>
                                {processSteps!.map((step) => (
                                    <div
                                        key={step.id}
                                        style={{
                                            fontSize: '0.8125rem'
                                        }}
                                    >
                                        {step.type === 'tool_call' ? (
                                            <ToolCallCard
                                                name={step.toolName || ''}
                                                args={step.toolArgs}
                                                result={step.toolResult}
                                                isExecuting={false}
                                            />
                                        ) : step.type === 'thinking' ? (
                                            <ThinkingBlock
                                                content={step.content || ''}
                                                isFinished={true}
                                            />
                                        ) : (
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: '0.5rem',
                                                color: 'var(--text-secondary)',
                                                padding: '0.5rem 0'
                                            }}>
                                                <FileText size={12} style={{ marginTop: '6px', flexShrink: 0 }} />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                        components={compactMarkdownComponents}
                                                    >
                                                        {step.content || ''}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Main message content */}
                <div style={{
                    padding: isUser ? '0.75rem 1rem' : '0',
                    borderRadius: isUser ? '0.5rem' : '0',
                    background: isUser ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    border: isUser ? '1px solid rgba(56, 189, 248, 0.2)' : 'none',
                    color: isUser ? 'var(--text-main)' : 'var(--text-main)',
                    width: isUser ? 'auto' : '100%'
                }}>
                    {isUser ? (
                        <p style={{
                            fontSize: '0.9375rem',
                            lineHeight: 1.5,
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                        }}>
                            {content}
                        </p>
                    ) : (
                        <div className="markdown-content" style={{
                            fontSize: '0.9375rem',
                            lineHeight: 1.6,
                            color: 'var(--text-main)',
                            wordBreak: 'break-word'
                        }}>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={markdownComponents}
                            >
                                {content}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};
