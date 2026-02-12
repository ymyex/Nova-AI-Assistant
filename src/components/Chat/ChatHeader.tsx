import React from 'react';
import {
    Sparkles,
    Activity,
    RefreshCw
} from 'lucide-react';
import type { NeuralLinkConnectionState, NeuralLinkSession } from '../../types/neuralLink';

interface ChatHeaderProps {
    sessions: NeuralLinkSession[];
    activeSessionKey: string | null;
    connectionState: NeuralLinkConnectionState;
    connectionError: string;
    onRefreshSessions: () => Promise<void> | void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
    sessions,
    activeSessionKey,
    connectionState,
    connectionError,
    onRefreshSessions
}) => {
    const activeSession = sessions.find((session) => session.key === activeSessionKey) || null;

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

    const connectionLabel =
        connectionState === 'connected'
            ? 'NEURAL LINK CONNECTED'
            : connectionState === 'connecting'
                ? 'NEURAL LINK RECONNECTING'
                : 'NEURAL LINK OFFLINE';

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
                        {connectionLabel}
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

                    <div
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
                            ACTIVE
                        </span>
                    </div>
                </div>
            </div>
            <div
                style={{
                    fontSize: '0.72rem',
                    color: connectionError ? '#fca5a5' : 'var(--text-secondary)',
                    fontFamily: 'monospace',
                    padding: '0 0.2rem'
                }}
            >
                Status: {connectionState.toUpperCase()}
                {connectionError ? ` - ${connectionError}` : ''}
            </div>
        </header>
    );
};
