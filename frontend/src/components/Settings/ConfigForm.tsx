import React, { useState, useEffect, useRef } from 'react';
import { GlassCard } from '../Shared/GlassCard';
import { Button } from '../Shared/Button';
import { Save, RefreshCw, LogOut, Check, Key, Smartphone, Mail, Upload, ExternalLink, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface SystemConfig {
    gemini_api_key?: string;
    gemini_model: string;
    whatsapp_group_name: string;
    whatsapp_bridge_url: string;
}

interface SessionStatus {
    connected: boolean;
    paired: boolean;
    connecting: boolean;
    qr?: string;
}

interface GmailStatus {
    connected: boolean;
    email: string | null;
    needs_auth: boolean;
    credentials_found: boolean;
}

interface SetupStep {
    step: number;
    title: string;
    description: string;
    link?: string;
}

interface SystemStatus {
    monitoring: SessionStatus;
    replying: SessionStatus;
}

interface ConfigFormProps {
    config: SystemConfig;
    status: SystemStatus | null;
    onConfigChange: (field: keyof SystemConfig, value: string) => void;
    onSave: () => void;
    onReconnect: (session: string) => void;
    onUnpair: (session: string) => void;
    onRestartBridge: () => void;
    saveStatus: 'idle' | 'saving' | 'success' | 'error';
}

const ConnectionCard: React.FC<{
    title: string;
    iconColor: string;
    status: SessionStatus | undefined;
    onReconnect: () => void;
    onUnpair: () => void;
}> = ({ title, iconColor, status, onReconnect, onUnpair }) => {
    return (
        <GlassCard>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <Smartphone size={18} color={status?.connected ? 'var(--success)' : iconColor} />
                {title}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '2rem', borderRadius: 'var(--radius-lg)' }}>

                {!status?.paired && status?.qr && (
                    <div style={{ background: 'white', padding: '1rem', borderRadius: '1rem' }}>
                        <QRCodeSVG value={status.qr} size={220} />
                    </div>
                )}

                <div style={{ textAlign: 'center' }}>
                    <h4 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: status?.connected ? 'var(--success)' : 'var(--text-main)' }}>
                        {!status
                            ? 'Connecting to System...'
                            : status.connected
                                ? 'System Connected'
                                : status.paired
                                    ? 'Disconnected'
                                    : 'Scan via WhatsApp'}
                    </h4>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        {status?.connected
                            ? 'Session is active.'
                            : status?.paired
                                ? 'Session is paired but currently offline.'
                                : 'Open WhatsApp > Linked Devices > Link a Device'}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    {status?.paired && !status.connected && (
                        <Button onClick={onReconnect} icon={<RefreshCw size={18} />}>Reconnect</Button>
                    )}
                    {status?.paired && (
                        <Button onClick={onUnpair} variant="danger" icon={<LogOut size={18} />}>Unpair Device</Button>
                    )}
                </div>
            </div>
        </GlassCard>
    );
};

// Gmail Integration Card
const GmailCard: React.FC = () => {
    const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
    const [setupSteps, setSetupSteps] = useState<SetupStep[]>([]);
    const [showSetup, setShowSetup] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [connecting, setConnecting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchGmailStatus = async () => {
        try {
            const res = await fetch('/api/gmail/status');
            const data = await res.json();
            setGmailStatus(data);
        } catch (err) {
            console.error('Failed to fetch Gmail status:', err);
        }
    };

    const fetchSetupGuide = async () => {
        try {
            const res = await fetch('/api/gmail/setup-guide');
            const data = await res.json();
            setSetupSteps(data.steps);
        } catch (err) {
            console.error('Failed to fetch setup guide:', err);
        }
    };

    useEffect(() => {
        fetchGmailStatus();
        fetchSetupGuide();
        const interval = setInterval(fetchGmailStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setUploadMessage(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/gmail/upload-credentials', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.detail || 'Upload failed');
            }

            setUploadMessage({ type: 'success', text: 'Credentials uploaded successfully!' });
            fetchGmailStatus();
        } catch (err: any) {
            setUploadMessage({ type: 'error', text: err.message || 'Failed to upload credentials' });
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleConnect = async () => {
        setConnecting(true);
        try {
            const res = await fetch('/api/gmail/auth');
            const data = await res.json();
            if (data.auth_url) {
                window.open(data.auth_url, '_blank');
            }
        } catch (err) {
            console.error('Failed to get auth URL:', err);
        } finally {
            setConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('Are you sure you want to disconnect Gmail?')) return;
        try {
            await fetch('/api/gmail/logout', { method: 'POST' });
            fetchGmailStatus();
        } catch (err) {
            console.error('Failed to disconnect Gmail:', err);
        }
    };

    const isConnected = gmailStatus?.connected;
    const hasCredentials = gmailStatus?.credentials_found;

    return (
        <GlassCard>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <Mail size={18} color={isConnected ? 'var(--success)' : 'var(--primary)'} />
                Gmail Integration
                {isConnected && (
                    <span style={{
                        marginLeft: 'auto',
                        fontSize: '0.75rem',
                        background: 'rgba(34, 197, 94, 0.2)',
                        color: 'var(--success)',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '999px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                    }}>
                        <CheckCircle size={12} /> Connected
                    </span>
                )}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>

                {/* Status Display */}
                {isConnected ? (
                    <div style={{ textAlign: 'center', padding: '1rem' }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #EA4335, #FBBC04, #34A853, #4285F4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1rem'
                        }}>
                            <Mail size={28} color="white" />
                        </div>
                        <h4 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--success)' }}>
                            Gmail Connected
                        </h4>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                            {gmailStatus?.email || 'Email connected'}
                        </p>
                        <Button onClick={handleDisconnect} variant="danger" icon={<LogOut size={18} />}>
                            Disconnect Gmail
                        </Button>
                    </div>
                ) : (
                    <>
                        {/* Setup Guide Toggle */}
                        <button
                            onClick={() => setShowSetup(!showSetup)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                width: '100%',
                                padding: '1rem',
                                background: 'rgba(56, 189, 248, 0.1)',
                                border: '1px solid rgba(56, 189, 248, 0.2)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-main)',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: 500
                            }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <AlertCircle size={16} color="var(--primary)" />
                                Setup Guide - How to get Gmail credentials
                            </span>
                            {showSetup ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>

                        {/* Setup Steps */}
                        {showSetup && (
                            <div style={{
                                background: 'rgba(0,0,0,0.2)',
                                borderRadius: 'var(--radius-md)',
                                padding: '1rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem'
                            }}>
                                {setupSteps.map((step) => (
                                    <div
                                        key={step.step}
                                        style={{
                                            display: 'flex',
                                            gap: '1rem',
                                            padding: '0.75rem',
                                            background: 'rgba(255,255,255,0.03)',
                                            borderRadius: 'var(--radius-sm)',
                                            alignItems: 'flex-start'
                                        }}
                                    >
                                        <div style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            flexShrink: 0
                                        }}>
                                            {step.step}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {step.title}
                                                {step.link && (
                                                    <a
                                                        href={step.link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}
                                                    >
                                                        <ExternalLink size={14} />
                                                    </a>
                                                )}
                                            </div>
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                                                {step.description}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Upload Section */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                    Step 1: Upload OAuth Credentials (JSON file from Google Cloud Console)
                                </label>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".json"
                                        onChange={handleFileUpload}
                                        style={{ display: 'none' }}
                                        id="gmail-credentials-upload"
                                    />
                                    <Button
                                        onClick={() => fileInputRef.current?.click()}
                                        variant={hasCredentials ? 'secondary' : 'primary'}
                                        icon={hasCredentials ? <Check size={18} /> : <Upload size={18} />}
                                        isLoading={uploading}
                                        style={{ flex: 1 }}
                                    >
                                        {hasCredentials ? 'Credentials Uploaded ✓' : 'Upload Credentials JSON'}
                                    </Button>
                                </div>
                                {uploadMessage && (
                                    <p style={{
                                        marginTop: '0.5rem',
                                        fontSize: '0.85rem',
                                        color: uploadMessage.type === 'success' ? 'var(--success)' : 'var(--danger)'
                                    }}>
                                        {uploadMessage.text}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                    Step 2: Connect your Gmail account
                                </label>
                                <Button
                                    onClick={handleConnect}
                                    disabled={!hasCredentials}
                                    icon={<Mail size={18} />}
                                    isLoading={connecting}
                                    style={{ width: '100%' }}
                                >
                                    Connect Gmail Account
                                </Button>
                                {!hasCredentials && (
                                    <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Upload credentials first to enable this button
                                    </p>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </GlassCard>
    );
};

export const ConfigForm: React.FC<ConfigFormProps> = ({
    config,
    status,
    onConfigChange,
    onSave,
    onReconnect,
    onUnpair,
    onRestartBridge,
    saveStatus
}) => {
    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            {/* AI Settings */}
            <GlassCard title="AI Intelligence">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <Key size={18} color="var(--primary)" /> AI Configuration
                    </h3>

                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            Gemini API Key
                        </label>
                        <input
                            type="password"
                            value={config.gemini_api_key || ''}
                            onChange={(e) => onConfigChange('gemini_api_key', e.target.value)}
                            placeholder="••••••••••••••••"
                            style={{
                                width: '100%',
                                padding: '1rem',
                                background: 'var(--bg-main)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-main)',
                                fontFamily: 'monospace'
                            }}
                        />
                    </div>

                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            Target Model
                        </label>
                        <input
                            type="text"
                            value={config.gemini_model}
                            onChange={(e) => onConfigChange('gemini_model', e.target.value)}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                background: 'var(--bg-main)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-main)'
                            }}
                        />
                    </div>
                </div>
            </GlassCard>


            {/* Gmail Integration */}
            <GmailCard />

            {/* Monitoring Session */}
            <ConnectionCard
                title="Monitoring WhatsApp (No Reply)"
                iconColor="var(--warning)"
                status={status?.monitoring}
                onReconnect={() => onReconnect('monitoring')}
                onUnpair={() => onUnpair('monitoring')}
            />

            {/* Replying Session */}
            <ConnectionCard
                title="Replying WhatsApp (Agent)"
                iconColor="var(--success)"
                status={status?.replying}
                onReconnect={() => onReconnect('replying')}
                onUnpair={() => onUnpair('replying')}
            />

            {/* System Controls */}
            <GlassCard title="System Controls">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h4 style={{ margin: 0, marginBottom: '0.5rem' }}>WhatsApp Bridge Service</h4>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            If sessions are disconnected or not appearing, try restarting the bridge service.
                        </p>
                    </div>
                    <Button
                        onClick={onRestartBridge}
                        variant="secondary"
                        icon={<RefreshCw size={18} />}
                    >
                        Restart Bridge
                    </Button>
                </div>
            </GlassCard>

            {/* Save Action */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '2rem' }}>
                <Button
                    onClick={onSave}
                    isLoading={saveStatus === 'saving'}
                    variant={saveStatus === 'success' ? 'primary' : 'primary'}
                    style={{ width: '200px' }}
                    icon={saveStatus === 'success' ? <Check size={18} /> : <Save size={18} />}
                >
                    {saveStatus === 'success' ? 'Saved!' : 'Save Changes'}
                </Button>
            </div>
        </div>
    );
};

