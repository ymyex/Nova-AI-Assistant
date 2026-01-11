import React, { useEffect, useState } from 'react';
import { MainLayout } from './components/Layout/MainLayout';
import { Sidebar } from './components/Layout/Sidebar';
import { StatusGrid } from './components/Dashboard/StatusGrid';
import { ActivityLogList } from './components/Dashboard/ActivityLog';
import { ConfigForm } from './components/Settings/ConfigForm';
import { motion, AnimatePresence } from 'framer-motion';

// Types
// Types
interface SessionStatus {
  connected: boolean;
  paired: boolean;
  connecting: boolean;
  qr?: string;
}

interface SystemStatus {
  uptime_seconds: number;
  gemini_connected: boolean;
  monitoring: SessionStatus;
  replying: SessionStatus;
  total_suggestions: number;
  failed_suggestions: number;
}

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'setup'>('dashboard');
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [config, setConfig] = useState<SystemConfig>({
    gemini_api_key: 'AIzaSyCNSz2D22xyC-Jq5b9S6ZEB90EJPM6na6o',
    gemini_model: 'gemini-3-flash-preview',
    whatsapp_group_name: 'Nova',
    whatsapp_bridge_url: 'http://localhost'
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

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

  // DEBUG: Monitor logs state changes
  useEffect(() => {
    console.log('[DEBUG] Logs state updated:', logs);
  }, [logs]);

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
      const response = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
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
      />

      <main style={{ flex: 1, padding: '2.5rem', overflowY: 'auto', position: 'relative' }}>
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.2 }}
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <header style={{ marginBottom: '2rem' }}>
                <h2 className="text-gradient" style={{ fontSize: '2rem', fontWeight: 800 }}>System Overview</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Real-time performance and activity monitoring</p>
              </header>

              <StatusGrid status={status} />
              <ActivityLogList logs={logs} />
            </motion.div>
          ) : (
            <motion.div
              key="setup"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.2 }}
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
      </main>
    </MainLayout>
  );
};

export default App;
