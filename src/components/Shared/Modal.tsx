import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from './Button';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg';
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    size = 'md'
}) => {
    const getWidth = () => {
        switch (size) {
            case 'sm': return '400px';
            case 'lg': return '700px';
            default: return '550px';
        }
    };

    // Handle escape key
    React.useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Prevent body scroll when modal is open
    React.useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0, 0, 0, 0.6)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 100
                        }}
                    />

                    {/* Modal Container - flex centering to avoid transform conflicts */}
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 101,
                            pointerEvents: 'none',
                            padding: '2rem'
                        }}
                    >
                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            style={{
                                background: 'var(--glass-bg)',
                                backdropFilter: 'blur(16px)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '1rem',
                                padding: '1.5rem',
                                width: getWidth(),
                                maxWidth: '90vw',
                                maxHeight: '85vh',
                                overflow: 'auto',
                                boxShadow: '0 24px 48px rgba(0, 0, 0, 0.4)',
                                pointerEvents: 'auto'
                            }}
                        >
                        {/* Header */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '1.5rem'
                        }}>
                            <h3 style={{
                                fontSize: '1.25rem',
                                fontWeight: 600,
                                color: 'var(--text-main)'
                            }}>
                                {title}
                            </h3>
                            <Button
                                variant="ghost"
                                onClick={onClose}
                                style={{ padding: '0.5rem' }}
                                aria-label="Close modal"
                            >
                                <X size={20} />
                            </Button>
                        </div>

                        {/* Content */}
                        <div>{children}</div>

                        {/* Footer */}
                        {footer && (
                            <div style={{
                                marginTop: '1.5rem',
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: '0.75rem'
                            }}>
                                {footer}
                            </div>
                        )}
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
};
