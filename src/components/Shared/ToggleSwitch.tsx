import React from 'react';
import { motion } from 'framer-motion';

interface ToggleSwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
    size?: 'sm' | 'md';
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
    checked,
    onChange,
    label,
    disabled = false,
    size = 'md'
}) => {
    const width = size === 'sm' ? 36 : 48;
    const height = size === 'sm' ? 20 : 24;
    const knobSize = size === 'sm' ? 16 : 20;

    return (
        <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1
        }}>
            <motion.div
                onClick={(e) => {
                    e.preventDefault();
                    if (!disabled) onChange(!checked);
                }}
                role="switch"
                aria-checked={checked}
                tabIndex={disabled ? -1 : 0}
                onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
                        e.preventDefault();
                        onChange(!checked);
                    }
                }}
                style={{
                    width,
                    height,
                    borderRadius: height / 2,
                    background: checked
                        ? 'linear-gradient(135deg, var(--primary), var(--secondary))'
                        : 'var(--bg-tertiary)',
                    border: `1px solid ${checked ? 'transparent' : 'var(--glass-border)'}`,
                    padding: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: checked ? 'flex-end' : 'flex-start',
                    boxShadow: checked ? '0 0 10px var(--primary-glow)' : 'none',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    outline: 'none'
                }}
                whileTap={disabled ? {} : { scale: 0.95 }}
            >
                <motion.div
                    layout
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    style={{
                        width: knobSize,
                        height: knobSize,
                        borderRadius: '50%',
                        background: 'white',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                />
            </motion.div>
            {label && (
                <span style={{
                    fontSize: size === 'sm' ? '0.8125rem' : '0.875rem',
                    color: 'var(--text-main)'
                }}>
                    {label}
                </span>
            )}
        </label>
    );
};
