import React from 'react';

interface MainLayoutProps {
    children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    return (
        <div style={{
            display: 'flex',
            height: '100vh',
            background: 'radial-gradient(circle at 50% -20%, #1e293b, #020617)',
            position: 'relative'
        }}>
            {/* Ambient background glows */}
            <div style={{
                position: 'absolute',
                top: '-10%',
                left: '20%',
                width: '500px',
                height: '500px',
                background: 'var(--primary)',
                filter: 'blur(150px)',
                opacity: 0.1,
                borderRadius: '50%',
                pointerEvents: 'none'
            }} />
            <div style={{
                position: 'absolute',
                bottom: '-10%',
                right: '10%',
                width: '600px',
                height: '600px',
                background: 'var(--secondary)',
                filter: 'blur(180px)',
                opacity: 0.08,
                borderRadius: '50%',
                pointerEvents: 'none'
            }} />

            {children}
        </div>
    );
};
