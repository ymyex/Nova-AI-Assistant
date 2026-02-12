import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, ChevronDown, CheckCircle } from 'lucide-react';
import { MODEL_OPTIONS, getModelById } from '../../constants/ModelOptions';

interface ChatHeaderProps {
    /** The default model from config */
    effectiveDefaultModel: string;
    /** Current session model override (null = use default) */
    sessionModel: string | null;
    /** Callback to set the session model */
    onSessionModelChange: (model: string | null) => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
    effectiveDefaultModel,
    sessionModel,
    onSessionModelChange
}) => {
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const modelDropdownRef = useRef<HTMLDivElement>(null);

    // Close model dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
                setShowModelDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const currentModel = sessionModel ? getModelById(sessionModel) : getModelById(effectiveDefaultModel) || MODEL_OPTIONS[0];
    const Icon = currentModel?.icon || Sparkles;

    return (
        <header style={{
            marginBottom: '1rem',
            flexShrink: 0,
            padding: '0 0.5rem',
            borderBottom: '1px solid var(--glass-border)',
            paddingBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
        }}>
            <div>
                <h2 style={{
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                    color: 'var(--text-main)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <Sparkles size={18} className="text-primary" />
                    CODA INTELLIGENCE
                </h2>
                <p style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.8125rem',
                    marginTop: '0.125rem',
                    fontFamily: 'monospace',
                    opacity: 0.7
                }}>
                    SYSTEM ONLINE
                </p>
            </div>

            {/* Model Switcher */}
            <div
                ref={modelDropdownRef}
                style={{ position: 'relative' }}
            >
                <button
                    onClick={() => setShowModelDropdown(!showModelDropdown)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-main)',
                        fontSize: '0.8125rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                        e.currentTarget.style.borderColor = 'var(--primary)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                        e.currentTarget.style.borderColor = 'var(--glass-border)';
                    }}
                >
                    <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        background: currentModel?.gradient || 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Icon size={12} color="white" />
                    </div>
                    <span style={{ fontWeight: 500 }}>{currentModel?.name || 'Select Model'}</span>
                    {sessionModel ? (
                        <span style={{
                            fontSize: '0.625rem',
                            padding: '0.125rem 0.375rem',
                            background: 'var(--primary)',
                            color: '#000',
                            borderRadius: '4px',
                            fontWeight: 600
                        }}>SESSION</span>
                    ) : (
                        <span style={{
                            fontSize: '0.625rem',
                            padding: '0.125rem 0.375rem',
                            background: 'rgba(255, 255, 255, 0.1)',
                            color: 'var(--text-secondary)',
                            borderRadius: '4px',
                            fontWeight: 500
                        }}>DEFAULT</span>
                    )}
                    <ChevronDown
                        size={14}
                        color="var(--text-secondary)"
                        style={{
                            transition: 'transform 0.2s',
                            transform: showModelDropdown ? 'rotate(180deg)' : 'rotate(0deg)'
                        }}
                    />
                </button>

                {/* Model Dropdown */}
                {showModelDropdown && (
                    <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        right: 0,
                        minWidth: '240px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
                        zIndex: 100,
                        animation: 'fadeIn 0.15s ease-out'
                    }}>
                        <div style={{
                            padding: '0.5rem 0.75rem',
                            borderBottom: '1px solid var(--glass-border)',
                            fontSize: '0.6875rem',
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            Session Model Override
                        </div>
                        {MODEL_OPTIONS.map((model) => {
                            const isSelected = sessionModel
                                ? sessionModel === model.id
                                : model.id === effectiveDefaultModel;
                            const ModelIcon = model.icon;
                            return (
                                <button
                                    key={model.id}
                                    onClick={() => {
                                        onSessionModelChange(model.id === effectiveDefaultModel ? null : model.id);
                                        setShowModelDropdown(false);
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        background: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                                        border: 'none',
                                        borderTop: '1px solid var(--glass-border)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        transition: 'background 0.15s',
                                        textAlign: 'left'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = isSelected ? 'rgba(56, 189, 248, 0.08)' : 'transparent';
                                    }}
                                >
                                    <div style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '6px',
                                        background: model.gradient,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: `0 2px 8px ${model.color}33`
                                    }}>
                                        <ModelIcon size={14} color="white" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            fontWeight: 600,
                                            fontSize: '0.8125rem',
                                            color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.375rem'
                                        }}>
                                            {model.name}
                                            {model.id === effectiveDefaultModel && (
                                                <span style={{
                                                    fontSize: '0.5625rem',
                                                    padding: '0.0625rem 0.25rem',
                                                    background: 'rgba(255, 255, 255, 0.1)',
                                                    color: 'var(--text-muted)',
                                                    borderRadius: '3px',
                                                    fontWeight: 500,
                                                    textTransform: 'uppercase'
                                                }}>Config</span>
                                            )}
                                            {isSelected && <CheckCircle size={12} color="var(--primary)" />}
                                        </div>
                                        <div style={{
                                            fontSize: '0.6875rem',
                                            color: 'var(--text-secondary)',
                                            marginTop: '2px'
                                        }}>
                                            {model.description}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </header>
    );
};


