import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronDown, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { compactMarkdownComponents } from './MarkdownComponents';

interface ThinkingBlockProps {
    content: string;
    isFinished?: boolean;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ content, isFinished = false }) => {
    const [isExpanded, setIsExpanded] = useState(!isFinished);

    React.useEffect(() => {
        if (isFinished) {
            setIsExpanded(false);
        }
    }, [isFinished]);

    return (
        <div className="thinking-block" style={{
            marginBottom: '0.5rem',
            maxWidth: '90%' // Align with other messages
        }}>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    padding: '0.25rem 0',
                    width: '100%',
                    textAlign: 'left'
                }}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '20px',
                    height: '20px',
                    borderRadius: '4px',
                    background: isFinished ? 'rgba(56, 189, 248, 0.1)' : 'rgba(56, 189, 248, 0.05)'
                }}>
                    <Brain size={12} className={isFinished ? "text-primary" : "text-muted"} />
                </div>
                <span style={{ fontWeight: 500 }}>
                    {isFinished ? 'Thought Process' : 'Thinking...'}
                </span>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{
                            marginLeft: '0.25rem',
                            paddingLeft: '0.75rem',
                            borderLeft: '2px solid var(--glass-border)',
                            marginTop: '0.25rem',
                            marginBottom: '0.5rem'
                        }}>
                            <div style={{
                                color: 'var(--text-secondary)',
                                fontSize: '0.875rem',
                                lineHeight: 1.5,
                                padding: '0.25rem 0.5rem' // Reduced padding, no background
                            }}>
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={compactMarkdownComponents}
                                >
                                    {content}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
