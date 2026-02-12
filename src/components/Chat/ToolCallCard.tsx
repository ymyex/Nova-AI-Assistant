import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown,
    ChevronUp,
    Mail,
    Terminal,
    Code,
    Loader
} from 'lucide-react';

interface ToolCallCardProps {
    name: string;
    args?: Record<string, unknown>;
    result?: string;
    isExecuting?: boolean;
}

// Map tool prefixes to icons and colors
const getToolStyle = (name: string) => {
    if (name.startsWith('gmail_')) {
        return { icon: Mail, color: '#4285F4', bgColor: 'rgba(66, 133, 244, 0.1)' };
    }
    if (name.startsWith('opencode_')) {
        return { icon: Code, color: '#818cf8', bgColor: 'rgba(129, 140, 248, 0.1)' };
    }
    if (name === 'run_system_command') {
        return { icon: Terminal, color: '#fbbf24', bgColor: 'rgba(251, 191, 36, 0.1)' };
    }
    return { icon: Terminal, color: 'var(--primary)', bgColor: 'rgba(56, 189, 248, 0.1)' };
};

export const ToolCallCard: React.FC<ToolCallCardProps> = ({
    name,
    args,
    result,
    isExecuting = false
}) => {
    const [expanded, setExpanded] = useState(false);
    const [showFullOutput, setShowFullOutput] = useState(false);
    const style = getToolStyle(name);
    const IconComponent = style.icon;

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            style={{
                background: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid var(--glass-border)',
                borderRadius: '0.375rem',
                marginBottom: '0.5rem',
                overflow: 'hidden',
                fontFamily: 'monospace'
            }}
        >
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: 'var(--text-secondary)'
                }}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '16px',
                    height: '16px'
                }}>
                    {isExecuting ? (
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                            <Loader size={14} color="var(--primary)" />
                        </motion.div>
                    ) : (
                        <IconComponent size={14} color={style.color} />
                    )}
                </div>

                <span style={{
                    flex: 1,
                    fontSize: '0.75rem',
                    letterSpacing: '-0.02em',
                    color: isExecuting ? 'var(--primary)' : 'var(--text-main)',
                    fontWeight: 500
                }}>
                    {name}
                </span>

                {/* Return code / status */}
                {result && !expanded && (
                    <span style={{
                        fontSize: '0.7rem',
                        color: 'var(--success)',
                        marginRight: '0.5rem'
                    }}>
                        [OK]
                    </span>
                )}

                {/* Expand toggle */}
                {(args || result) && (
                    <div style={{ opacity: 0.5 }}>
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                )}
            </button>

            {/* Expanded content */}
            <AnimatePresence>
                {expanded && (args || result) && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{
                            padding: '0 0.75rem 0.75rem',
                            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                            fontSize: '0.75rem'
                        }}>
                            {/* Arguments */}
                            {args && Object.keys(args).length > 0 && (
                                <div style={{ marginTop: '0.5rem' }}>
                                    <div style={{
                                        color: 'var(--text-muted)',
                                        marginBottom: '0.25rem',
                                        fontSize: '0.7rem'
                                    }}>
                                        $ input
                                    </div>
                                    <pre style={{
                                        padding: '0.5rem',
                                        background: 'rgba(0, 0, 0, 0.3)',
                                        borderRadius: '0.25rem',
                                        color: 'var(--text-secondary)',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        maxHeight: '150px',
                                        overflow: 'auto',
                                        margin: 0
                                    }}>
                                        {JSON.stringify(args, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {/* Result */}
                            {result && (
                                <div style={{ marginTop: '0.5rem' }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginBottom: '0.25rem'
                                    }}>
                                        <div style={{
                                            color: 'var(--text-muted)',
                                            fontSize: '0.7rem'
                                        }}>
                                            {'>'} output
                                        </div>
                                        {result && result.length > 200 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowFullOutput(!showFullOutput);
                                                }}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: 'var(--text-secondary)',
                                                    fontSize: '0.65rem',
                                                    cursor: 'pointer',
                                                    padding: '0 0.25rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem'
                                                }}
                                            >
                                                {showFullOutput ? 'Show Less' : 'Show All'}
                                                {showFullOutput ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                            </button>
                                        )}
                                    </div>
                                    <pre style={{
                                        padding: '0.5rem',
                                        background: 'rgba(0, 0, 0, 0.3)',
                                        borderRadius: '0.25rem',
                                        color: 'var(--success)',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        maxHeight: showFullOutput ? 'none' : '200px',
                                        overflow: 'auto',
                                        margin: 0
                                    }}>
                                        {result}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence >
        </motion.div >
    );
};
