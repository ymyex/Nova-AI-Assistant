import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Sparkles,
    ChevronDown,
    CheckCircle,
    Activity,
    Link2,
    RefreshCw
} from 'lucide-react';
import type { NeuralLinkConnectionState, NeuralLinkSession } from '../../types/neuralLink';

interface ChatHeaderProps {
    sessions: NeuralLinkSession[];
    activeSessionKey: string | null;
    onSessionChange: (sessionKey: string) => void;
    connectionState: NeuralLinkConnectionState;
    connectionError: string;
    gatewayUrl: string;
    gatewayToken: string;
    gatewayPassword: string;
    onGatewayUrlChange: (value: string) => void;
    onGatewayTokenChange: (value: string) => void;
    onGatewayPasswordChange: (value: string) => void;
    onConnectGateway: () => Promise<void> | void;
    onRefreshSessions: () => Promise<void> | void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
    sessions,
    activeSessionKey,
    onSessionChange,
    connectionState,
    connectionError,
    gatewayUrl,
    gatewayToken,
    gatewayPassword,
    onGatewayUrlChange,
    onGatewayTokenChange,
    onGatewayPasswordChange,
    onConnectGateway,
    onRefreshSessions
}) => {
    const [showSessionDropdown, setShowSessionDropdown] = useState(false);
    const [showConnectionPanel, setShowConnectionPanel] = useState(false);
    const sessionDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sessionDropdownRef.current && !sessionDropdownRef.current.contains(event.target as Node)) {
                setShowSessionDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const activeSession = useMemo(
        () => sessions.find((session) => session.key === activeSessionKey) || null,
        [sessions, activeSessionKey]
    );

    const sessionLabel =
        activeSession?.derivedTitle ||
        activeSession?.displayName ||
        activeSession?.label ||
        activeSession?.key ||
        'Select Session';

    const connectionTone =
        connectionState === 'connected'
            ? '#67e8a5'
            : connectionState === 'connecting'
                ? '#fbbf24'
                : '#fca5a5';

    return (
        <header
            style={{
                marginBottom: '1rem',
                flexShrink: 0,
                padding: '0 0.5rem',
                borderBottom: '1px solid var(--glass-border)',
                paddingBottom: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.8rem'
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    flexWrap: 'wrap'
                }}
            >
                <div>
                    <h2
                        style={{
                            fontSize: '1.25rem',
                            fontWeight: 600,
                            letterSpacing: '-0.02em',
                            color: 'var(--text-main)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <Sparkles size={18} className="text-primary" />
                        CODA INTELLIGENCE
                    </h2>
                    <p
                        style={{
                            color: 'var(--text-secondary)',
                            fontSize: '0.8125rem',
                            marginTop: '0.125rem',
                            fontFamily: 'monospace',
                            opacity: 0.7
                        }}
                    >
                        NEURAL LINK ONLINE
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => void onRefreshSessions()}
                        disabled={connectionState !== 'connected'}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.45rem 0.6rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--glass-border)',
                            background: 'rgba(255, 255, 255, 0.03)',
                            color: 'var(--text-main)',
                            fontSize: '0.75rem',
                            cursor: connectionState === 'connected' ? 'pointer' : 'not-allowed',
                            opacity: connectionState === 'connected' ? 1 : 0.55
                        }}
                    >
                        <RefreshCw size={13} />
                        Refresh
                    </button>

                    <button
                        onClick={() => setShowConnectionPanel((prev) => !prev)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.45rem 0.65rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--glass-border)',
                            background: 'rgba(255, 255, 255, 0.03)',
                            color: 'var(--text-main)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                        }}
                    >
                        <Link2 size={13} />
                        Neural Link
                    </button>

                    <div ref={sessionDropdownRef} style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowSessionDropdown((prev) => !prev)}
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
                                transition: 'all 0.2s',
                                minWidth: '250px',
                                maxWidth: '360px'
                            }}
                        >
                            <Activity size={13} color={connectionTone} />
                            <span
                                style={{
                                    fontWeight: 500,
                                    overflow: 'hidden',
                                    whiteSpace: 'nowrap',
                                    textOverflow: 'ellipsis',
                                    flex: 1,
                                    textAlign: 'left'
                                }}
                                title={sessionLabel}
                            >
                                {sessionLabel}
                            </span>
                            <span
                                style={{
                                    fontSize: '0.625rem',
                                    padding: '0.125rem 0.375rem',
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    color: 'var(--text-secondary)',
                                    borderRadius: '4px',
                                    fontWeight: 600
                                }}
                            >
                                SESSION
                            </span>
                            <ChevronDown
                                size={14}
                                color="var(--text-secondary)"
                                style={{
                                    transition: 'transform 0.2s',
                                    transform: showSessionDropdown ? 'rotate(180deg)' : 'rotate(0deg)'
                                }}
                            />
                        </button>

                        {showSessionDropdown && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 8px)',
                                    right: 0,
                                    minWidth: '320px',
                                    maxWidth: '420px',
                                    maxHeight: '360px',
                                    overflowY: 'auto',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: 'var(--radius-md)',
                                    overflowX: 'hidden',
                                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
                                    zIndex: 100,
                                }}
                            >
                                <div
                                    style={{
                                        padding: '0.5rem 0.75rem',
                                        borderBottom: '1px solid var(--glass-border)',
                                        fontSize: '0.6875rem',
                                        color: 'var(--text-muted)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}
                                >
                                    Session Switcher ({sessions.length})
                                </div>
                                {sessions.map((session) => {
                                    const isSelected = session.key === activeSessionKey;
                                    const display =
                                        session.derivedTitle ||
                                        session.displayName ||
                                        session.label ||
                                        session.key;

                                    return (
                                        <button
                                            key={session.key}
                                            onClick={() => {
                                                onSessionChange(session.key);
                                                setShowSessionDropdown(false);
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
                                                gap: '0.65rem',
                                                textAlign: 'left'
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: '28px',
                                                    height: '28px',
                                                    borderRadius: '6px',
                                                    background:
                                                        session.channel === 'whatsapp'
                                                            ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                                                            : 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                <Activity size={13} color="white" />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div
                                                    style={{
                                                        fontWeight: 600,
                                                        fontSize: '0.8125rem',
                                                        color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.375rem',
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                        title={display}
                                                    >
                                                        {display}
                                                    </span>
                                                    {isSelected && <CheckCircle size={12} color="var(--primary)" />}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: '0.6875rem',
                                                        color: 'var(--text-secondary)',
                                                        marginTop: '2px',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                    title={session.key}
                                                >
                                                    {session.channel || 'session'} - {session.key}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                                {sessions.length === 0 && (
                                    <div style={{ padding: '0.8rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        No sessions available.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showConnectionPanel && (
                <div
                    style={{
                        border: '1px solid var(--glass-border)',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(0, 0, 0, 0.2)',
                        padding: '0.7rem',
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr auto',
                        gap: '0.5rem',
                    }}
                >
                    <input
                        value={gatewayUrl}
                        onChange={(event) => onGatewayUrlChange(event.target.value)}
                        placeholder="wss://gateway-host"
                        style={{
                            padding: '0.55rem 0.7rem',
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: 'rgba(0,0,0,0.25)',
                            color: 'white',
                            fontSize: '0.78rem'
                        }}
                    />
                    <input
                        value={gatewayToken}
                        onChange={(event) => onGatewayTokenChange(event.target.value)}
                        placeholder="Token"
                        style={{
                            padding: '0.55rem 0.7rem',
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: 'rgba(0,0,0,0.25)',
                            color: 'white',
                            fontSize: '0.78rem'
                        }}
                    />
                    <input
                        type="password"
                        value={gatewayPassword}
                        onChange={(event) => onGatewayPasswordChange(event.target.value)}
                        placeholder="Password"
                        style={{
                            padding: '0.55rem 0.7rem',
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: 'rgba(0,0,0,0.25)',
                            color: 'white',
                            fontSize: '0.78rem'
                        }}
                    />
                    <button
                        onClick={() => void onConnectGateway()}
                        style={{
                            padding: '0.55rem 0.8rem',
                            borderRadius: 8,
                            border: 'none',
                            background: 'var(--primary)',
                            color: 'black',
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                        }}
                    >
                        Connect
                    </button>

                    <div
                        style={{
                            gridColumn: '1 / -1',
                            fontSize: '0.72rem',
                            color: connectionError ? '#fca5a5' : 'var(--text-secondary)',
                            fontFamily: 'monospace'
                        }}
                    >
                        Status: {connectionState.toUpperCase()}
                        {connectionError ? ` - ${connectionError}` : ''}
                    </div>
                </div>
            )}
        </header>
    );
};
