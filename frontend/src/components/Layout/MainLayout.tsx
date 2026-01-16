import React from 'react';
import { motion } from 'framer-motion';

interface MainLayoutProps {
    children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    return (
        <div style={{
            display: 'flex',
            height: '100vh',
            width: '100vw',
            overflow: 'hidden',
            position: 'relative',
        }}>
            {/* Ambient Cosmic Glows */}
            <motion.div 
                animate={{ 
                    scale: [1, 1.1, 1],
                    opacity: [0.3, 0.5, 0.3],
                }}
                transition={{ 
                    duration: 10, 
                    repeat: Infinity,
                    ease: "easeInOut" 
                }}
                style={{
                    position: 'absolute',
                    top: '-20%',
                    left: '10%',
                    width: '800px',
                    height: '800px',
                    background: 'radial-gradient(circle, var(--primary-glow) 0%, transparent 70%)',
                    filter: 'blur(100px)',
                    zIndex: 0,
                    pointerEvents: 'none'
            }} />
            
            <motion.div 
                animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [0.2, 0.4, 0.2],
                }}
                transition={{ 
                    duration: 15, 
                    repeat: Infinity, 
                    ease: "easeInOut",
                    delay: 2
                }}
                style={{
                    position: 'absolute',
                    bottom: '-20%',
                    right: '-10%',
                    width: '900px',
                    height: '900px',
                    background: 'radial-gradient(circle, var(--secondary-glow) 0%, transparent 70%)',
                    filter: 'blur(120px)',
                    zIndex: 0,
                    pointerEvents: 'none'
            }} />

            {/* Content Wrapper */}
            <div style={{ 
                display: 'flex', 
                width: '100%', 
                height: '100%', 
                zIndex: 10,
                background: 'rgba(2, 6, 23, 0.4)', // Slight overlay for readability
                backdropFilter: 'blur(10px)'
            }}>
                {children}
            </div>
        </div>
    );
};
