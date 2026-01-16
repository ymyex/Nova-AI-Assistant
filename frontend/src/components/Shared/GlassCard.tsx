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
            className={`
                relative flex flex-col overflow-hidden
                bg-gradient-to-br from-bg-secondary/60 to-[rgba(10,15,30,0.7)]
                backdrop-blur-[20px] rounded-3xl p-6
                border border-white/5 border-t-white/10
                shadow-[0_4px_30px_rgba(0,0,0,0.1)]
                ${onClick ? 'cursor-pointer' : 'cursor-default'}
                ${className}
            `}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={hoverEffect ? {
                y: -5,
                boxShadow: '0 20px 40px -5px rgba(0,0,0,0.4)',
                borderColor: 'var(--color-primary-glow)'
            } : {}}
            transition={{ duration: 0.4, type: 'spring', bounce: 0.3 }}
            onClick={onClick}
            style={style}
        >
            {/* Ambient Glow */}
            {hoverEffect && (
                <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.03)_0%,transparent_50%)] pointer-events-none z-0" />
            )}

            {title && (
                <div className="mb-6 relative z-[1]">
                    <h3 className="font-semibold text-xl tracking-tight">{title}</h3>
                </div>
            )}

            <div className="relative z-[1] w-full">
                {children}
            </div>
        </motion.div>
    );
};
