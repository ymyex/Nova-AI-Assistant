import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LockKeyhole, ShieldCheck, KeyRound } from 'lucide-react';

interface AccessGateProps {
    onUnlock: () => void;
}

const ACCESS_PASSWORD = 'daadfceb';

export const AccessGate: React.FC<AccessGateProps> = ({ onUnlock }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (password === ACCESS_PASSWORD) {
            setError('');
            onUnlock();
            return;
        }
        setError('Access denied. Incorrect passphrase.');
    };

    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'grid',
                placeItems: 'center',
                padding: '2rem',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <motion.div
                aria-hidden
                animate={{ rotate: [0, 8, 0], scale: [1, 1.08, 1] }}
                transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                    position: 'absolute',
                    top: '-22%',
                    right: '-15%',
                    width: '42rem',
                    height: '42rem',
                    borderRadius: '9999px',
                    background: 'radial-gradient(circle at center, rgba(14, 165, 233, 0.35) 0%, transparent 70%)',
                    filter: 'blur(30px)',
                    pointerEvents: 'none',
                }}
            />
            <motion.div
                aria-hidden
                animate={{ rotate: [0, -6, 0], scale: [1, 1.06, 1] }}
                transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
                style={{
                    position: 'absolute',
                    bottom: '-28%',
                    left: '-18%',
                    width: '48rem',
                    height: '48rem',
                    borderRadius: '9999px',
                    background: 'radial-gradient(circle at center, rgba(99, 102, 241, 0.28) 0%, transparent 72%)',
                    filter: 'blur(36px)',
                    pointerEvents: 'none',
                }}
            />

            <motion.section
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                style={{
                    width: '100%',
                    maxWidth: '34rem',
                    border: '1px solid var(--glass-border-light)',
                    borderRadius: '1rem',
                    background: 'linear-gradient(165deg, rgba(15, 23, 42, 0.82) 0%, rgba(2, 6, 23, 0.9) 100%)',
                    backdropFilter: 'blur(12px)',
                    padding: '2rem',
                    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
                    position: 'relative',
                    zIndex: 2,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div
                        style={{
                            width: '2.5rem',
                            height: '2.5rem',
                            borderRadius: '0.75rem',
                            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.95) 0%, rgba(99, 102, 241, 0.95) 100%)',
                            display: 'grid',
                            placeItems: 'center',
                            boxShadow: '0 8px 20px rgba(14, 165, 233, 0.35)',
                        }}
                    >
                        <ShieldCheck size={18} color="white" />
                    </div>
                    <p
                        style={{
                            margin: 0,
                            color: 'var(--text-secondary)',
                            fontSize: '0.75rem',
                            letterSpacing: '0.16em',
                            textTransform: 'uppercase',
                            fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
                        }}
                    >
                        Neural Link Secure Access
                    </p>
                </div>

                <h1
                    style={{
                        margin: 0,
                        fontSize: 'clamp(1.75rem, 5vw, 2.5rem)',
                        lineHeight: 1.08,
                        letterSpacing: '-0.03em',
                        color: 'var(--text-highlight)',
                    }}
                >
                    Welcome, Master.
                </h1>
                <p
                    style={{
                        margin: '0.75rem 0 1.5rem 0',
                        color: 'var(--text-secondary)',
                        fontSize: '0.95rem',
                        lineHeight: 1.5,
                    }}
                >
                    Authenticate to enter the Coda dashboard and establish your OpenClaw neural chat link.
                </p>

                <form onSubmit={handleSubmit}>
                    <label
                        htmlFor="gate-password"
                        style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
                        }}
                    >
                        Master Passphrase
                    </label>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            border: '1px solid rgba(148, 163, 184, 0.26)',
                            borderRadius: '0.8rem',
                            padding: '0.72rem 0.85rem',
                            background: 'rgba(2, 6, 23, 0.55)',
                        }}
                    >
                        <KeyRound size={16} color="var(--text-secondary)" />
                        <input
                            id="gate-password"
                            type="password"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                if (error) setError('');
                            }}
                            placeholder="Enter access key"
                            autoFocus
                            style={{
                                flex: 1,
                                border: 'none',
                                outline: 'none',
                                background: 'transparent',
                                color: 'var(--text-main)',
                                fontSize: '0.95rem',
                                fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
                            }}
                        />
                    </div>

                    {error && (
                        <p
                            style={{
                                margin: '0.75rem 0 0 0',
                                color: '#fda4af',
                                fontSize: '0.82rem',
                                fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
                            }}
                        >
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        style={{
                            marginTop: '1.1rem',
                            width: '100%',
                            border: 'none',
                            borderRadius: '0.8rem',
                            background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
                            color: 'white',
                            padding: '0.8rem 1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            fontSize: '0.92rem',
                            fontWeight: 700,
                            letterSpacing: '0.02em',
                            cursor: 'pointer',
                            boxShadow: '0 12px 26px rgba(14, 165, 233, 0.35)',
                        }}
                    >
                        <LockKeyhole size={16} />
                        Enter Dashboard
                    </button>
                </form>
            </motion.section>
        </div>
    );
};
