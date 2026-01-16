import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';

type ButtonProps = Omit<HTMLMotionProps<"button">, 'children'> & {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    isLoading?: boolean;
    icon?: React.ReactNode;
    children?: React.ReactNode;
};

const variantClasses = {
    primary: 'bg-gradient-to-br from-primary to-secondary text-white border-none shadow-[0_4px_15px_var(--color-primary-glow)]',
    secondary: 'bg-bg-tertiary text-text-main border border-glass-border',
    danger: 'bg-danger/15 text-danger border border-danger/30',
    ghost: 'bg-transparent text-text-secondary border border-transparent',
};

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    isLoading,
    icon,
    className = '',
    disabled,
    ...props
}) => {
    const isDisabled = disabled || isLoading;

    return (
        <motion.button
            className={`
                py-3 px-6 rounded-md font-semibold
                inline-flex items-center justify-center gap-2
                transition-all duration-200
                ${variantClasses[variant]}
                ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                ${className}
            `}
            whileHover={{ scale: isDisabled ? 1 : 1.02 }}
            whileTap={{ scale: isDisabled ? 1 : 0.98 }}
            disabled={isDisabled}
            {...props}
        >
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : icon}
            {children}
        </motion.button>
    );
};
