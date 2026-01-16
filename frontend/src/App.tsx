import React, { useEffect, useState, useCallback } from 'react';
import { MainLayout } from './components/Layout/MainLayout';
import { Sidebar } from './components/Layout/Sidebar';
import { StatusGrid } from './components/Dashboard/StatusGrid';
import { ActivityLogList } from './components/Dashboard/ActivityLog';
import { ConfigForm } from './components/Settings/ConfigForm';
import { AgentChat } from './components/Chat/AgentChat';
import { motion, AnimatePresence } from 'framer-motion';
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

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'setup' | 'chat'>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [config, setConfig] = useState<SystemConfig>({
    gemini_api_key: '',
    gemini_model: 'gemini-3-flash-preview',
    whatsapp_group_name: 'Nova',
    whatsapp_bridge_url: 'http://localhost'
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // ============================================
  // CONVERSATION STATE (lifted from AgentChat)
  // ============================================
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
    return localStorage.getItem('nova-active-chat');
  });
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [pendingNewChat, setPendingNewChat] = useState(false);
  const [hasActiveMessages, setHasActiveMessages] = useState(false);

  // Fetch all conversations
  const fetchConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    try {
      const response = await fetch('/api/chats');
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  // Handle selecting a conversation
  const handleSelectConversation = useCallback((id: string) => {
    setPendingNewChat(false);
    setActiveConversationId(id);
    localStorage.setItem('nova-active-chat', id);
  }, []);

  // Handle starting a new chat
  const handleNewChat = useCallback(() => {
    setPendingNewChat(true);
    setActiveConversationId(null);
    setHasActiveMessages(false);
    localStorage.removeItem('nova-active-chat');
  }, []);

  // Handle conversation created (called by AgentChat when deferred creation completes)
  const handleConversationCreated = useCallback((newConv: ConversationListItem) => {
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    setPendingNewChat(false);
    localStorage.setItem('nova-active-chat', newConv.id);
  }, []);

  // Delete a conversation
  const handleDeleteChat = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/chats/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setConversations(prev => prev.filter(c => c.id !== id));
        if (activeConversationId === id) {
          const remaining = conversations.filter(c => c.id !== id);
          if (remaining.length > 0) {
            setActiveConversationId(remaining[0].id);
            localStorage.setItem('nova-active-chat', remaining[0].id);
          } else {
            setActiveConversationId(null);
            localStorage.removeItem('nova-active-chat');
          }
        }
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  }, [activeConversationId, conversations]);

  // Rename a conversation
  const handleRenameChat = useCallback(async (id: string, title: string) => {
    try {
      const response = await fetch(`/api/chats/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      if (response.ok) {
        setConversations(prev => prev.map(c =>
          c.id === id ? { ...c, title } : c
        ));
      }
    } catch (error) {
      console.error('Failed to rename conversation:', error);
    }
  }, []);

  // Delete all conversations
  const handleDeleteAllChats = useCallback(async () => {
    try {
      const response = await fetch('/api/chats', { method: 'DELETE' });
      if (response.ok) {
        setConversations([]);
        setActiveConversationId(null);
        setPendingNewChat(false);
        setHasActiveMessages(false);
        localStorage.removeItem('nova-active-chat');
      }
    } catch (error) {
      console.error('Failed to delete all conversations:', error);
    }
  }, []);

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Persist active conversation to localStorage
  useEffect(() => {
    if (activeConversationId) {
      localStorage.setItem('nova-active-chat', activeConversationId);
    }
  }, [activeConversationId]);

  // ============================================
  // EXISTING STATUS/CONFIG LOGIC
  // ============================================

  const fetchStatusAndLogs = async () => {
    try {
      const [statusRes, logsRes] = await Promise.all([
        fetch('/api/status'),
        fetch('/api/logs')
      ]);
      setStatus(await statusRes.json());
      setLogs(await logsRes.json());
    } catch (err) {
      console.error('Failed to fetch system data:', err);
    }
  };

  const fetchConfig = async () => {
    try {
      const configRes = await fetch('/api/config');
      const currentConfig = await configRes.json();
      setConfig(prev => ({ ...prev, ...currentConfig } as SystemConfig));
    } catch (err) {
      console.error('Failed to fetch config:', err);
    }
  };

  useEffect(() => {
    // Fetch config only once on mount
    fetchConfig();
    // Fetch status and logs immediately and then poll every 3 seconds
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
      // Don't send empty API key to avoid overwriting existing env var
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
      fetchConfig(); // Refresh config
      fetchStatusAndLogs(); // Refresh status
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
      // Wait a bit before refreshing status
      setTimeout(fetchStatusAndLogs, 2000);
    } catch (err) {
      console.error('Failed to trigger bridge restart:', err);
    }
  };

  return (
    <MainLayout>
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        // Conversation props
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        onDeleteAllChats={handleDeleteAllChats}
        isLoadingConversations={isLoadingConversations}
        pendingNewChat={pendingNewChat}
        hasActiveMessages={hasActiveMessages}
      />

      <main style={{ flex: 1, overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {/* Dashboard Tab */}
        <AnimatePresence>
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.2 }}
              style={{ flex: 1, padding: '2.5rem', display: 'flex', flexDirection: 'column' }}
            >
              <header style={{ marginBottom: '2rem' }}>
                <h2 className="text-gradient" style={{ fontSize: '2rem', fontWeight: 800 }}>System Overview</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Real-time performance and activity monitoring</p>
              </header>

              <StatusGrid status={status} />
              <ActivityLogList logs={logs} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Setup Tab */}
        <AnimatePresence>
          {activeTab === 'setup' && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.2 }}
              style={{ flex: 1, padding: '2.5rem' }}
            >
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

        {/*
          Chat Tab - ALWAYS MOUNTED to preserve streaming state.
          Hidden via CSS when not active to maintain streaming connections
          and state across tab navigation.
        */}
        <div style={{
          flex: 1,
          padding: '1.5rem',
          display: activeTab === 'chat' ? 'flex' : 'none',
          flexDirection: 'column',
          height: '100%'
        }}>
          <AgentChat
            configModel={config.gemini_model}
            activeConversationId={activeConversationId}
            pendingNewChat={pendingNewChat}
            onConversationCreated={handleConversationCreated}
            onConversationsChanged={fetchConversations}
            onSetActiveConversation={setActiveConversationId}
            onSetHasMessages={setHasActiveMessages}
            onSetPendingNewChat={setPendingNewChat}
            onUpdateConversation={(id, updates) => {
              setConversations(prev => prev.map(c =>
                c.id === id ? { ...c, ...updates } : c
              ));
            }}
          />
        </div>
      </main>
    </MainLayout>
  );
};

export default App;
