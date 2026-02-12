import React from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    hoverEffect?: boolean;
    style?: React.CSSProperties;
    onClick?: () => void;
    title?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({
    children,
    className = '',
    hoverEffect = false,
    style,
    onClick,
    title
}) => {
    return (
        <motion.div
            className={`glass-card ${className}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={hoverEffect ? {
                y: -4,
                boxShadow: '0 12px 40px 0 rgba(0,0,0,0.4)',
                borderColor: 'rgba(56, 189, 248, 0.3)'
            } : {}}
            transition={{ duration: 0.3 }}
            onClick={onClick}
            style={{
                background: 'var(--color-glass-bg)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--color-glass-border)',
                borderRadius: '1rem',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
                padding: '1.5rem',
                cursor: onClick ? 'pointer' : 'default',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                ...style
            }}
        >
            {/* Glossy highlight effect */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                pointerEvents: 'none'
            }} />

            {title && (
                <h3 style={{ marginBottom: '1.5rem', fontWeight: 600, fontSize: '1.25rem' }}>{title}</h3>
            )}

            {children}
        </motion.div>
    );
};
