import React from 'react';

interface ConfidenceBadgeProps {
    score: number;           // 0.0 to 1.0
    showLabel?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

const getConfidenceColor = (score: number): { bg: string; text: string; glow: string } => {
    if (score >= 0.8) {
        return {
            bg: 'rgba(16, 185, 129, 0.15)',
            text: 'var(--success)',
            glow: 'var(--success-glow)'
        };
    }
    if (score >= 0.6) {
        return {
            bg: 'rgba(245, 158, 11, 0.15)',
            text: 'var(--warning)',
            glow: 'var(--warning-glow)'
        };
    }
    return {
        bg: 'rgba(239, 68, 68, 0.15)',
        text: 'var(--danger)',
        glow: 'var(--danger-glow)'
    };
};

const getConfidenceLabel = (score: number): string => {
    if (score >= 0.9) return 'Very High';
    if (score >= 0.8) return 'High';
    if (score >= 0.6) return 'Medium';
    if (score >= 0.4) return 'Low';
    return 'Very Low';
};

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
    score,
    showLabel = false,
    size = 'md'
}) => {
    const colors = getConfidenceColor(score);
    const percentage = Math.round(score * 100);

    const getFontSize = () => {
        switch (size) {
            case 'sm': return '0.6875rem';
            case 'lg': return '0.875rem';
            default: return '0.75rem';
        }
    };

    const getPadding = () => {
        switch (size) {
            case 'sm': return '0.2rem 0.5rem';
            case 'lg': return '0.4rem 0.875rem';
            default: return '0.3rem 0.625rem';
        }
    };

    return (
        <span
            role="meter"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Confidence: ${percentage}%`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: getPadding(),
                background: colors.bg,
                color: colors.text,
                fontSize: getFontSize(),
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                whiteSpace: 'nowrap'
            }}
        >
            <span>{percentage}%</span>
            {showLabel && (
                <span style={{
                    fontSize: '0.85em',
                    opacity: 0.85,
                    textTransform: 'capitalize'
                }}>
                    {getConfidenceLabel(score)}
                </span>
            )}
        </span>
    );
};

// Progress bar style confidence meter
interface ConfidenceMeterProps {
    score: number;
    height?: number;
    showPercentage?: boolean;
}

export const ConfidenceMeter: React.FC<ConfidenceMeterProps> = ({
    score,
    height = 8,
    showPercentage = true
}) => {
    const colors = getConfidenceColor(score);
    const percentage = Math.round(score * 100);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            width: '100%'
        }}>
            <div
                role="progressbar"
                aria-valuenow={percentage}
                aria-valuemin={0}
                aria-valuemax={100}
                style={{
                    flex: 1,
                    height,
                    background: 'var(--bg-tertiary)',
                    borderRadius: height / 2,
                    overflow: 'hidden'
                }}
            >
                <div style={{
                    width: `${percentage}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${colors.text}, ${colors.glow})`,
                    borderRadius: height / 2,
                    transition: 'width 0.3s ease'
                }} />
            </div>
            {showPercentage && (
                <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: colors.text,
                    minWidth: '35px',
                    textAlign: 'right'
                }}>
                    {percentage}%
                </span>
            )}
        </div>
    );
};
