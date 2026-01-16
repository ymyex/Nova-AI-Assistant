import React from 'react';
import { Send } from 'lucide-react';

interface InputAreaProps {
    /** Current input value */
    value: string;
    /** Callback when input changes */
    onChange: (value: string) => void;
    /** Callback when send button is clicked or Enter is pressed */
    onSend: () => void;
    /** Whether the chat is currently processing */
    isProcessing: boolean;
    /** Ref to attach to the textarea */
    inputRef: React.RefObject<HTMLTextAreaElement | null>;
}

export const InputArea: React.FC<InputAreaProps> = ({
    value,
    onChange,
    onSend,
    isProcessing,
    inputRef
}) => {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };

    const canSend = !isProcessing && value.trim().length > 0;

    return (
        <div style={{
            position: 'relative',
            zIndex: 10,
            paddingTop: '1rem',
            borderTop: '1px solid var(--glass-border)'
        }}>
            <div style={{
                display: 'flex',
                gap: '0.75rem',
                background: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-md)',
                transition: 'border-color 0.2s',
                padding: '0.25rem'
            }}>
                <textarea
                    ref={inputRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isProcessing ? 'System busy...' : 'Execute command...'}
                    disabled={isProcessing}
                    rows={1}
                    style={{
                        flex: 1,
                        padding: '0.75rem 1rem',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-main)',
                        fontSize: '0.9375rem',
                        outline: 'none',
                        fontFamily: 'monospace',
                        resize: 'none',
                        minHeight: '44px',
                        maxHeight: '200px',
                        overflowY: 'auto'
                    }}
                />
                <button
                    onClick={onSend}
                    disabled={!canSend}
                    style={{
                        padding: '0 1rem',
                        background: 'transparent',
                        border: 'none',
                        color: canSend ? 'var(--primary)' : 'var(--text-muted)',
                        cursor: canSend ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'color 0.2s',
                        opacity: canSend ? 1 : 0.5
                    }}
                >
                    <Send size={18} strokeWidth={2} />
                </button>
            </div>
        </div>
    );
};
