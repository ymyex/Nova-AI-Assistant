import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Command } from 'lucide-react';

interface Suggestion {
    label: string;
    cmd: string;
}

interface EmptyStateProps {
    /** Callback when a suggestion is clicked */
    onSuggestionClick: (command: string) => void;
}

const DEFAULT_SUGGESTIONS: Suggestion[] = [
    { label: 'System Diagnostic', cmd: 'Run a full system diagnostic' },
    { label: 'Check Email', cmd: 'Check my latest unread emails' },
    { label: 'Process List', cmd: 'List memory consuming processes' },
    { label: 'Network Scan', cmd: 'Scan for open ports on localhost' }
];

export const EmptyState: React.FC<EmptyStateProps> = ({ onSuggestionClick }) => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: '1.5rem',
                color: 'var(--text-muted)'
            }}
        >
            <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '12px',
                background: 'rgba(56, 189, 248, 0.05)',
                border: '1px solid rgba(56, 189, 248, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <Sparkles size={24} color="var(--primary)" />
            </div>

            <div style={{ textAlign: 'center' }}>
                <h3 style={{
                    fontSize: '1.125rem',
                    color: 'var(--text-main)',
                    marginBottom: '0.25rem',
                    fontWeight: 500
                }}>System Ready</h3>
                <p style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    maxWidth: '300px',
                    lineHeight: 1.5
                }}>
                    Awaiting command input for system analysis or execution.
                </p>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.5rem',
                maxWidth: '500px',
                width: '100%'
            }}>
                {DEFAULT_SUGGESTIONS.map((suggestion) => (
                    <button
                        key={suggestion.label}
                        onClick={() => onSuggestionClick(suggestion.cmd)}
                        style={{
                            padding: '0.75rem 1rem',
                            background: 'transparent',
                            border: '1px solid var(--glass-border)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.8125rem',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--primary)';
                            e.currentTarget.style.color = 'var(--text-main)';
                            e.currentTarget.style.background = 'rgba(56, 189, 248, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--glass-border)';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                            e.currentTarget.style.background = 'transparent';
                        }}
                    >
                        <Command size={14} />
                        {suggestion.label}
                    </button>
                ))}
            </div>
        </motion.div>
    );
};
