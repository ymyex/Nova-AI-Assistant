import React from 'react';

interface CategoryTagProps {
    name: string;
    isSensitive?: boolean;
    size?: 'sm' | 'md';
    onClick?: () => void;
    onRemove?: () => void;
}

export const CategoryTag: React.FC<CategoryTagProps> = ({
    name,
    isSensitive = false,
    size = 'md',
    onClick,
    onRemove
}) => {
    const getFontSize = () => size === 'sm' ? '0.6875rem' : '0.75rem';
    const getPadding = () => size === 'sm' ? '0.2rem 0.5rem' : '0.25rem 0.625rem';

    return (
        <span
            onClick={onClick}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: getPadding(),
                background: isSensitive
                    ? 'rgba(239, 68, 68, 0.1)'
                    : 'rgba(14, 165, 233, 0.1)',
                color: isSensitive
                    ? 'var(--danger)'
                    : 'var(--primary)',
                fontSize: getFontSize(),
                fontWeight: 500,
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${isSensitive
                    ? 'rgba(239, 68, 68, 0.2)'
                    : 'rgba(14, 165, 233, 0.2)'}`,
                cursor: onClick ? 'pointer' : 'default',
                transition: 'all 0.15s ease',
                textTransform: 'capitalize'
            }}
            onMouseEnter={(e) => {
                if (onClick) {
                    e.currentTarget.style.transform = 'scale(1.02)';
                }
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
            }}
        >
            {isSensitive && (
                <span style={{ fontSize: '0.85em' }}>*</span>
            )}
            {name}
            {onRemove && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    aria-label={`Remove ${name}`}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '14px',
                        height: '14px',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '50%',
                        color: 'inherit',
                        cursor: 'pointer',
                        opacity: 0.7,
                        marginLeft: '0.125rem'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '0.7';
                        e.currentTarget.style.background = 'transparent';
                    }}
                >
                    ×
                </button>
            )}
        </span>
    );
};
