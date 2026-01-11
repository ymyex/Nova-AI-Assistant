import React from 'react';
import { GlassCard } from '../Shared/GlassCard';
import { Brain, MessageSquare, Activity, CheckCircle2 } from 'lucide-react';

interface SessionStatus {
    connected: boolean;
}

interface SystemStatus {
    uptime_seconds: number;
    gemini_connected: boolean;
    monitoring: SessionStatus;
    replying: SessionStatus;
    total_suggestions: number;
    failed_suggestions: number;
}

interface StatusGridProps {
    status: SystemStatus | null;
}

export const StatusGrid: React.FC<StatusGridProps> = ({ status }) => {
    const formatUptime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h}h ${m}m ${s}s`;
    };

    const accuracy = status && status.total_suggestions > 0
        ? Math.round(((status.total_suggestions - status.failed_suggestions) / status.total_suggestions) * 100)
        : 100;

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <GlassCard hoverEffect>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span className="metric-label">System Uptime</span>
                    <Activity size={20} color="var(--primary)" />
                </div>
                <div className="metric-value">{status ? formatUptime(status.uptime_seconds) : '---'}</div>
            </GlassCard>

            <GlassCard hoverEffect>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span className="metric-label">AI Status</span>
                    <Brain size={20} color={status?.gemini_connected ? 'var(--success)' : 'var(--danger)'} />
                </div>
                <div className="metric-value" style={{ color: status?.gemini_connected ? 'var(--success)' : 'var(--danger)' }}>
                    {status?.gemini_connected ? 'ONLINE' : 'OFFLINE'}
                </div>
            </GlassCard>

            <GlassCard hoverEffect>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span className="metric-label">WhatsApp (Monitor)</span>
                    <MessageSquare size={20} color={status?.monitoring?.connected ? 'var(--secondary)' : 'var(--warning)'} />
                </div>
                <div className="metric-value" style={{ color: status?.monitoring?.connected ? 'var(--secondary)' : 'var(--text-muted)' }}>
                    {status?.monitoring?.connected ? 'CONNECTED' : 'OFFLINE'}
                </div>
            </GlassCard>

            <GlassCard hoverEffect>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span className="metric-label">WhatsApp (Agent)</span>
                    <MessageSquare size={20} color={status?.replying?.connected ? 'var(--success)' : 'var(--warning)'} />
                </div>
                <div className="metric-value" style={{ color: status?.replying?.connected ? 'var(--success)' : 'var(--text-muted)' }}>
                    {status?.replying?.connected ? 'CONNECTED' : 'OFFLINE'}
                </div>
            </GlassCard>

            <GlassCard hoverEffect>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span className="metric-label">Total Suggestions</span>
                    <MessageSquare size={20} color="var(--secondary)" />
                </div>
                <div className="metric-value">{status?.total_suggestions ?? 0}</div>
            </GlassCard>

            <GlassCard hoverEffect>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span className="metric-label">Success Rate</span>
                    <CheckCircle2 size={20} color="var(--success)" />
                </div>
                <div className="metric-value">
                    {accuracy}%
                </div>
            </GlassCard>
        </div>
    );
};
