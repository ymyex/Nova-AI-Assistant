import React from 'react';
import { GlassCard } from '../Shared/GlassCard';
import { motion } from 'framer-motion';

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
        <GlassCard style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: '1.5rem', fontWeight: 600, fontSize: '1.25rem' }}>Live Logic Feed</h3>

            <div style={{ overflowX: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0.5rem', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            <th style={{ padding: '0.75rem', fontWeight: 500 }}>Timestamp</th>
                            <th style={{ padding: '0.75rem', fontWeight: 500 }}>Sender</th>
                            <th style={{ padding: '0.75rem', fontWeight: 500 }}>Input Message</th>
                            <th style={{ padding: '0.75rem', fontWeight: 500 }}>AI Response</th>
                            <th style={{ padding: '0.75rem', fontWeight: 500 }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((log, i) => (
                            <motion.tr
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}
                            >
                                <td style={{ padding: '1rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </td>
                                <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--primary)' }}>
                                    {log.sender}
                                </td>
                                <td style={{ padding: '1rem', maxWidth: '250px' }}>
                                    <div style={{
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        color: 'var(--text-main)'
                                    }}>
                                        {log.message_text}
                                    </div>
                                </td>
                                <td style={{ padding: '1rem', maxWidth: '250px' }}>
                                    <div style={{
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        color: log.status === 'command' ? 'var(--warning)' : 'var(--text-secondary)',
                                        fontFamily: log.status === 'command' ? 'monospace' : 'inherit'
                                    }}>
                                        {log.suggestion || '---'}
                                    </div>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    <span style={{
                                        padding: '0.25rem 0.75rem',
                                        borderRadius: '999px',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        background: log.status === 'success' || log.status === 'command'
                                            ? 'rgba(74, 222, 128, 0.1)'
                                            : 'rgba(248, 113, 113, 0.1)',
                                        color: log.status === 'success' || log.status === 'command'
                                            ? 'var(--success)'
                                            : 'var(--danger)',
                                        border: `1px solid ${log.status === 'success' || log.status === 'command' ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)'}`
                                    }}>
                                        {log.status.toUpperCase()}
                                    </span>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
                {logs.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No activity recorded yet... (Debug: Received 0 logs)
                    </div>
                )}
                {/* Debug Info */}
                <div style={{ padding: '1rem', color: '#666', fontSize: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    Debug Status: Received {logs.length} logs. Last update: {new Date().toLocaleTimeString()}
                </div>
            </div>
        </GlassCard>
    );
};
