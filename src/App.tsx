import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MainLayout } from './components/Layout/MainLayout';
import { Sidebar, type TabId } from './components/Layout/Sidebar';
import { StatusGrid } from './components/Dashboard/StatusGrid';
import { ActivityLogList } from './components/Dashboard/ActivityLog';
import { ConfigForm } from './components/Settings/ConfigForm';
import { AgentChat } from './components/Chat/AgentChat';
import { AccessGate } from './components/Auth/AccessGate';
import {
    StyleProfilesPage,
    StyleProfileDetailPage,
    PersonalInfoPage,
    AutoResponsePage,
    ResponseHistoryPage,
    PendingApprovalsWidget
} from './components/Persona';
import { usePendingApprovals } from './hooks/usePendingApprovals';
import { useNeuralLinkGateway } from './hooks/useNeuralLinkGateway';
import type { ConversationListItem, SystemStatus } from './types';

interface ActivityLog {
    timestamp: string;
    message_text: string;
    sender: string;
    suggestion?: string;
    status: string;
}

interface SystemConfig {
    gemini_api_key?: string;
    gemini_model: string;
    whatsapp_group_name: string;
    whatsapp_bridge_url: string;
}

const AUTH_KEY = 'CODA-master-authenticated';
const ACTIVE_SESSION_KEY = 'CODA-active-session';

const App: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return localStorage.getItem(AUTH_KEY) === 'true';
    });
    const [activeTab, setActiveTab] = useState<TabId>('chat');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [status, setStatus] = useState<SystemStatus | null>(null);
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [config, setConfig] = useState<SystemConfig>({
        gemini_api_key: '',
        gemini_model: 'gemini-3-flash-preview',
        whatsapp_group_name: 'CODA',
        whatsapp_bridge_url: 'http://localhost'
    });
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

    const [selectedProfileJid, setSelectedProfileJid] = useState<string | null>(null);
    const { count: pendingApprovalsCount } = usePendingApprovals();

    const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
        return localStorage.getItem(ACTIVE_SESSION_KEY);
    });
    const [hasActiveMessages, setHasActiveMessages] = useState(false);

    const {
        connectionState,
        error: gatewayError,
        sessions,
        isLoadingSessions,
        refreshSessions,
        loadSessionHistory,
        sendSessionMessage,
        renameSession,
        deleteSession,
    } = useNeuralLinkGateway();

    const conversations = useMemo<ConversationListItem[]>(() => {
        return sessions.map((session) => ({
            id: session.key,
            title: session.derivedTitle || session.displayName || session.label || session.key,
            updated_at: new Date(session.updatedAt || Date.now()).toISOString(),
            source: session.channel === 'whatsapp' ? 'whatsapp' : 'dashboard'
        }));
    }, [sessions]);

    useEffect(() => {
        if (activeConversationId) {
            localStorage.setItem(ACTIVE_SESSION_KEY, activeConversationId);
        }
    }, [activeConversationId]);

    useEffect(() => {
        if (sessions.length === 0) {
            if (isLoadingSessions || connectionState !== 'connected') {
                return;
            }
            setActiveConversationId(null);
            localStorage.removeItem(ACTIVE_SESSION_KEY);
            return;
        }

        if (!activeConversationId || !sessions.some((session) => session.key === activeConversationId)) {
            const first = sessions[0]?.key ?? null;
            setActiveConversationId(first);
        }
    }, [sessions, activeConversationId, isLoadingSessions, connectionState]);

    const handleUnlock = useCallback(() => {
        localStorage.setItem(AUTH_KEY, 'true');
        setIsAuthenticated(true);
        setActiveTab('chat');
    }, []);

    const handleSelectConversation = useCallback((id: string) => {
        setActiveConversationId(id);
        localStorage.setItem(ACTIVE_SESSION_KEY, id);
    }, []);

    const handleRenameChat = useCallback(async (id: string, title: string) => {
        try {
            await renameSession(id, title);
        } catch (error) {
            console.error('Failed to rename session:', error);
        }
    }, [renameSession]);

    const handleDeleteChat = useCallback(async (id: string) => {
        try {
            await deleteSession(id);
            if (activeConversationId === id) {
                setActiveConversationId(null);
            }
        } catch (error) {
            console.error('Failed to delete session:', error);
        }
    }, [deleteSession, activeConversationId]);

    const fetchStatusAndLogs = async () => {
        try {
            const [statusRes, logsRes] = await Promise.all([
                fetch('/api/status'),
                fetch('/api/logs')
            ]);

            if (statusRes.ok) {
                setStatus(await statusRes.json());
            }
            if (logsRes.ok) {
                setLogs(await logsRes.json());
            }
        } catch (err) {
            console.error('Failed to fetch system data:', err);
        }
    };

    const fetchConfig = async () => {
        try {
            const configRes = await fetch('/api/config');
            if (!configRes.ok) return;
            const currentConfig = await configRes.json();
            setConfig(prev => ({ ...prev, ...currentConfig } as SystemConfig));
        } catch (err) {
            console.error('Failed to fetch config:', err);
        }
    };

    useEffect(() => {
        fetchConfig();
        fetchStatusAndLogs();
        const interval = setInterval(fetchStatusAndLogs, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleInputChange = (field: keyof SystemConfig, value: string) => {
        setConfig(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setSaveStatus('saving');
        try {
            const payload = { ...config };
            if (!payload.gemini_api_key) {
                delete payload.gemini_api_key;
            }

            const response = await fetch('/api/config', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error('Failed to update config');

            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 3000);
            fetchConfig();
            fetchStatusAndLogs();
        } catch (err) {
            console.error(err);
            setSaveStatus('error');
        }
    };

    const handleReconnect = async (session: string) => {
        try {
            await fetch(`/api/whatsapp/reconnect?session=${session}`, { method: 'POST' });
            fetchStatusAndLogs();
        } catch (err) {
            console.error('Failed to trigger reconnect:', err);
        }
    };

    const handleUnpair = async (session: string) => {
        if (!confirm(`Are you sure you want to log out from ${session} WhatsApp? You will need to scan the QR code again.`)) return;
        try {
            await fetch(`/api/whatsapp/unpair?session=${session}`, { method: 'POST' });
            fetchStatusAndLogs();
        } catch (err) {
            console.error('Failed to trigger unpair:', err);
        }
    };

    const handleRestartBridge = async () => {
        if (!confirm('Are you sure you want to restart the WhatsApp Bridge service? This will temporarily disconnect sessions.')) return;
        try {
            await fetch('/api/bridge/restart', { method: 'POST' });
            setTimeout(fetchStatusAndLogs, 2000);
        } catch (err) {
            console.error('Failed to trigger bridge restart:', err);
        }
    };

    const pageTransition = {
        initial: { opacity: 0, scale: 0.95 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 1.05 },
        transition: { duration: 0.2 }
    };

    if (!isAuthenticated) {
        return <AccessGate onUnlock={handleUnlock} />;
    }

    return (
        <MainLayout>
            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                isCollapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
                conversations={conversations}
                activeConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
                onNewChat={() => {}}
                onDeleteChat={handleDeleteChat}
                onRenameChat={handleRenameChat}
                isLoadingConversations={isLoadingSessions}
                pendingNewChat={false}
                hasActiveMessages={hasActiveMessages}
                pendingApprovalsCount={pendingApprovalsCount}
            />

            <main style={{ flex: 1, overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                <AnimatePresence mode="wait">
                    {activeTab === 'dashboard' && (
                        <motion.div
                            key="dashboard"
                            {...pageTransition}
                            style={{ flex: 1, padding: '2.5rem', display: 'flex', flexDirection: 'column' }}
                        >
                            <header style={{ marginBottom: '2rem' }}>
                                <h2 className="text-gradient" style={{ fontSize: '2rem', fontWeight: 800 }}>System Overview</h2>
                                <p style={{ color: 'var(--text-secondary)' }}>Real-time performance and activity monitoring</p>
                            </header>

                            <PendingApprovalsWidget onNavigateToHistory={() => setActiveTab('persona-history')} />
                            <StatusGrid status={status} />
                            <ActivityLogList logs={logs} />
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                    {activeTab === 'setup' && (
                        <motion.div key="setup" {...pageTransition} style={{ flex: 1, padding: '2.5rem' }}>
                            <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
                                <h2 className="text-gradient" style={{ fontSize: '2rem', fontWeight: 800 }}>Device Setup</h2>
                                <p style={{ color: 'var(--text-secondary)' }}>Configure your environment and service integrations</p>
                            </header>

                            <ConfigForm
                                config={config}
                                status={status}
                                onConfigChange={handleInputChange}
                                onSave={handleSave}
                                onReconnect={handleReconnect}
                                onUnpair={handleUnpair}
                                onRestartBridge={handleRestartBridge}
                                saveStatus={saveStatus}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                    {activeTab === 'persona-profiles' && (
                        <motion.div key="persona-profiles" {...pageTransition} style={{ flex: 1 }}>
                            {selectedProfileJid ? (
                                <StyleProfileDetailPage chatJid={selectedProfileJid} onBack={() => setSelectedProfileJid(null)} />
                            ) : (
                                <StyleProfilesPage onViewProfile={(jid) => setSelectedProfileJid(jid)} />
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                    {activeTab === 'persona-info' && (
                        <motion.div key="persona-info" {...pageTransition} style={{ flex: 1 }}>
                            <PersonalInfoPage />
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                    {activeTab === 'persona-settings' && (
                        <motion.div key="persona-settings" {...pageTransition} style={{ flex: 1 }}>
                            <AutoResponsePage />
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                    {activeTab === 'persona-history' && (
                        <motion.div key="persona-history" {...pageTransition} style={{ flex: 1 }}>
                            <ResponseHistoryPage />
                        </motion.div>
                    )}
                </AnimatePresence>

                <div
                    style={{
                        flex: 1,
                        padding: '1.5rem',
                        display: activeTab === 'chat' ? 'flex' : 'none',
                        flexDirection: 'column',
                        height: '100%'
                    }}
                >
                    <AgentChat
                        activeConversationId={activeConversationId}
                        sessions={sessions}
                        onSetActiveConversation={(id) => setActiveConversationId(id)}
                        onSetHasMessages={setHasActiveMessages}
                        onConversationsChanged={() => { void refreshSessions(); }}
                        connectionState={connectionState}
                        connectionError={gatewayError}
                        onRefreshSessions={async () => { await refreshSessions(); }}
                        loadSessionHistory={loadSessionHistory}
                        sendSessionMessage={sendSessionMessage}
                    />
                </div>
            </main>
        </MainLayout>
    );
};

export default App;
