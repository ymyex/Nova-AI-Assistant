import React from 'react';
import { LayoutDashboard, Settings, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

interface SidebarProps {
    activeTab: 'dashboard' | 'setup';
    setActiveTab: (tab: 'dashboard' | 'setup') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
        { id: 'setup', label: 'Device Setup', icon: <Settings size={20} /> },
    ];

    return (
        <motion.aside
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            style={{
                width: '280px',
                background: 'rgba(15, 23, 42, 0.6)',
                backdropFilter: 'blur(20px)',
                borderRight: '1px solid var(--glass-border)',
                display: 'flex',
                flexDirection: 'column',
                padding: '2rem',
                zIndex: 50
            }}
        >
            <div style={{ marginBottom: '3rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <img src="./logo.png" alt="Nova Logo" style={{ width: '64px', height: '64px', objectFit: 'contain' }} />
                <div>
                    <h1 className="text-gradient" style={{ fontSize: '1.75rem', fontWeight: 800, lineHeight: 1 }}>Nova AI</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>Web Console</p>
                </div>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                {navItems.map((item) => (
                    <motion.button
                        key={item.id}
                        onClick={() => setActiveTab(item.id as 'dashboard' | 'setup')}
                        whileHover={{ x: 5 }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            padding: '1rem',
                            borderRadius: 'var(--radius-md)',
                            background: activeTab === item.id ? 'var(--primary-glow)' : 'transparent',
                            border: activeTab === item.id ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
                            color: activeTab === item.id ? 'var(--primary)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontWeight: 500,
                            transition: 'all 0.2s',
                            textAlign: 'left'
                        }}
                    >
                        {item.icon}
                        {item.label}
                    </motion.button>
                ))}
            </nav>

            <div style={{ marginTop: 'auto' }}>
                <div style={{
                    padding: '1rem',
                    background: 'rgba(56, 189, 248, 0.05)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1rem',
                    border: '1px solid rgba(56, 189, 248, 0.1)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--primary)', fontSize: '0.875rem' }}>
                        <Zap size={16} />
                        <span>System Online</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', paddingLeft: '1.75rem' }}>
                        All systems nominal.
                    </p>
                </div>
            </div>
        </motion.aside>
    );
};

