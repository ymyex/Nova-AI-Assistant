import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends HTMLMotionProps<"button"> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    isLoading?: boolean;
    icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    isLoading,
    icon,
    style,
    disabled,
    ...props
}) => {
    const getBaseStyles = () => {
        switch (variant) {
            case 'primary':
                return {
                    background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                    color: '#fff',
                    border: 'none',
                    boxShadow: '0 4px 15px var(--primary-glow)'
                };
            case 'danger':
                return {
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: 'var(--danger)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                };
            case 'ghost':
                return {
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    border: '1px solid transparent',
                };
            default: // secondary
                return {
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--glass-border)',
                };
        }
    };

    return (
        <motion.button
            whileHover={{ scale: disabled ? 1 : 1.02 }}
            whileTap={{ scale: disabled ? 1 : 0.98 }}
            disabled={disabled || isLoading}
            style={{
                padding: '0.75rem 1.5rem',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                opacity: disabled ? 0.6 : 1,
                transition: 'all 0.2s',
                ...getBaseStyles(),
                ...style
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            {...(props as any)}
        >
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : icon}
            {children}
        </motion.button>
    );
};
