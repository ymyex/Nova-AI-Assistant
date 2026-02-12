import React from 'react';
import type { ResponseStatus } from '../../types/persona';

interface StatusBadgeProps {
    status: ResponseStatus;
    size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<ResponseStatus, { bg: string; text: string; label: string }> = {
    sent: {
        bg: 'rgba(16, 185, 129, 0.15)',
        text: 'var(--success)',
        label: 'SENT'
    },
    pending: {
        bg: 'rgba(245, 158, 11, 0.15)',
        text: 'var(--warning)',
        label: 'PENDING'
    },
    rejected: {
        bg: 'rgba(239, 68, 68, 0.15)',
        text: 'var(--danger)',
        label: 'REJECTED'
    },
    expired: {
        bg: 'rgba(100, 116, 139, 0.15)',
        text: 'var(--text-muted)',
        label: 'EXPIRED'
    }
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
    const config = statusConfig[status];

    const getFontSize = () => {
        switch (size) {
            case 'sm': return '0.625rem';
            case 'lg': return '0.8125rem';
            default: return '0.6875rem';
        }
    };

    const getPadding = () => {
        switch (size) {
            case 'sm': return '0.2rem 0.4rem';
            case 'lg': return '0.4rem 0.75rem';
            default: return '0.3rem 0.6rem';
        }
    };

    return (
        <span
            role="status"
            aria-label={`Status: ${config.label}`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: getPadding(),
                background: config.bg,
                color: config.text,
                fontSize: getFontSize(),
                fontWeight: 600,
                letterSpacing: '0.05em',
                borderRadius: 'var(--radius-sm)',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap'
            }}
        >
            {config.label}
        </span>
    );
};
