import React from 'react';
import { GlassCard } from '../Shared/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Terminal, Clock, ArrowRight } from 'lucide-react';

interface ActivityLog {
    timestamp: string;
    message_text: string;
    sender: string;
    suggestion?: string;
    status: string;
}

interface ActivityLogProps {
    logs: ActivityLog[];
}

export const ActivityLogList: React.FC<ActivityLogProps> = ({ logs }) => {
    return (
        <GlassCard style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '400px', overflow: 'hidden' }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.5rem',
                borderBottom: '1px solid var(--glass-border)',
                paddingBottom: '1rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        padding: '0.5rem',
                        background: 'rgba(56, 189, 248, 0.1)',
                        borderRadius: '8px',
                        color: 'var(--primary)'
                    }}>
                        <Terminal size={18} />
                    </div>
                    <h3 style={{ fontWeight: 600, fontSize: '1.1rem' }}>Live Neural Feed</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <div style={{ width: '6px', height: '6px', background: 'var(--success)', borderRadius: '50%', boxShadow: '0 0 10px var(--success)' }} />
                    REALTIME
                </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }} className="custom-scrollbar">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <AnimatePresence initial={false}>
                        {logs.map((log, i) => (
                            <motion.div
                                key={`${log.timestamp}-${i}`}
                                initial={{ opacity: 0, x: -20, height: 0 }}
                                animate={{ opacity: 1, x: 0, height: 'auto' }}
                                exit={{ opacity: 0, x: 20, height: 0 }}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.02)',
                                    border: '1px solid rgba(255, 255, 255, 0.03)',
                                    borderRadius: '12px',
                                    padding: '1rem',
                                    display: 'grid',
                                    gridTemplateColumns: 'min-content 1fr auto',
                                    gap: '1rem',
                                    alignItems: 'start'
                                }}
                            >
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    paddingTop: '0.25rem'
                                }}>
                                    <Clock size={14} color="var(--text-muted)" />
                                    <div style={{ width: '1px', flex: 1, background: 'var(--glass-border)' }} />
                                </div>

                                <div style={{ minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            fontFamily: 'monospace',
                                            color: 'var(--text-muted)'
                                        }}>
                                            {new Date(log.timestamp).toLocaleTimeString()}
                                        </span>
                                        <span style={{
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            color: 'var(--primary)',
                                            background: 'rgba(56, 189, 248, 0.1)',
                                            padding: '0.1rem 0.5rem',
                                            borderRadius: '4px'
                                        }}>
                                            {log.sender}
                                        </span>
                                    </div>

                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                                        {log.message_text}
                                    </div>

                                    {log.suggestion && (
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '0.5rem',
                                            background: 'rgba(0, 0, 0, 0.2)',
                                            padding: '0.75rem',
                                            borderRadius: '8px',
                                            borderLeft: '2px solid var(--secondary)'
                                        }}>
                                            <ArrowRight size={14} color="var(--secondary)" style={{ marginTop: '0.25rem' }} />
                                            <code style={{
                                                fontSize: '0.85rem',
                                                color: 'var(--text-secondary)',
                                                fontFamily: 'monospace',
                                                wordBreak: 'break-word'
                                            }}>
                                                {log.suggestion}
                                            </code>
                                        </div>
                                    )}
                                </div>

                                <div style={{ paddingTop: '0.25rem' }}>
                                    <span style={{
                                        padding: '0.25rem 0.75rem',
                                        borderRadius: '6px',
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        letterSpacing: '0.05em',
                                        background: log.status === 'success' || log.status === 'command'
                                            ? 'rgba(74, 222, 128, 0.1)'
                                            : 'rgba(239, 68, 68, 0.1)',
                                        color: log.status === 'success' || log.status === 'command'
                                            ? 'var(--success)'
                                            : 'var(--danger)',
                                        border: `1px solid ${log.status === 'success' || log.status === 'command'
                                            ? 'rgba(74, 222, 128, 0.2)'
                                            : 'rgba(239, 68, 68, 0.2)'}`
                                    }}>
                                        {log.status.toUpperCase()}
                                    </span>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {logs.length === 0 && (
                        <div style={{
                            textAlign: 'center',
                            padding: '4rem 2rem',
                            color: 'var(--text-muted)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '1rem'
                        }}>
                            <Activity size={48} style={{ opacity: 0.2 }} />
                            <p>No neural activity detected based on current sensors.</p>
                        </div>
                    )}
                </div>
            </div>
        </GlassCard>
    );
};
