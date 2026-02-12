import React from 'react';
import { GlassCard } from '../Shared/GlassCard';
import { Brain, MessageSquare, Activity, CheckCircle2, Wifi, Zap } from 'lucide-react';
import type { SystemStatus } from '../../types';

interface StatusGridProps {
    status: SystemStatus | null;
}

interface StatusItemProps {
    label: string;
    value: string | number;
    icon: React.ElementType;
    color: string;
    subtext?: string;
}

const StatusItem: React.FC<StatusItemProps> = ({ label, value, icon: Icon, color, subtext }) => (
    <GlassCard hoverEffect style={{ height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div style={{
                padding: '0.75rem',
                borderRadius: '12px',
                background: `rgba(${color}, 0.1)`,
                color: `rgb(${color})`
            }}>
                <Icon size={24} />
            </div>
            {subtext && (
                <span style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '99px',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--glass-border)'
                }}>
                    {subtext}
                </span>
            )}
        </div>
        <div>
            <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>{label}</h4>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                {value || '---'}
            </div>
        </div>
    </GlassCard>
);

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
        <div className="dashboard-grid">
            <StatusItem
                label="System Uptime"
                value={status ? formatUptime(status.uptime_seconds) : '---'}
                icon={Activity}
                color="56, 189, 248" // Sky
                subtext="Session Active"
            />

            <StatusItem
                label="Neural Core Status"
                value={status?.gemini_connected ? 'ONLINE' : 'OFFLINE'}
                icon={Brain}
                color={status?.gemini_connected ? '74, 222, 128' : '239, 68, 68'} // Green or Red
                subtext="Gemini"
            />

            <StatusItem
                label="WhatsApp Monitoring"
                value={status?.monitoring?.connected ? 'ACTIVE' : 'DISCONNECTED'}
                icon={Wifi}
                color={status?.monitoring?.connected ? '99, 102, 241' : '245, 158, 11'} // Indigo or Amber
            />

            <StatusItem
                label="Agent Response"
                value={status?.replying?.connected ? 'ACTIVE' : 'PAUSED'}
                icon={Zap}
                color={status?.replying?.connected ? '74, 222, 128' : '245, 158, 11'}
            />

            <StatusItem
                label="Total Interactions"
                value={status?.total_suggestions ?? 0}
                icon={MessageSquare}
                color="168, 85, 247" // Purple
            />

            <StatusItem
                label="Response Accuracy"
                value={`${accuracy}%`}
                icon={CheckCircle2}
                color="74, 222, 128"
            />
        </div>
    );
};
