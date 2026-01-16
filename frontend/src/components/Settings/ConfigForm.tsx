import React, { useState, useEffect, useRef } from 'react';
import { GlassCard } from '../Shared/GlassCard';
import { Button } from '../Shared/Button';
import { Save, RefreshCw, LogOut, Check, Key, Smartphone, Mail, Upload, ExternalLink, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Cpu, Server } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { SessionStatus, SystemStatus } from '../../types';

interface SystemConfig {
    gemini_api_key?: string;
    gemini_model: string;
    whatsapp_group_name: string;
    whatsapp_bridge_url: string;
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

// Import shared model options
import { MODEL_OPTIONS } from '../../constants/ModelOptions';


// Custom Model Selector Component
const ModelSelector: React.FC<{
    value: string;
    onChange: (value: string) => void;
}> = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedModel = MODEL_OPTIONS.find(m => m.id === value) || MODEL_OPTIONS[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
            {/* Selected Value Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    background: 'var(--bg-tertiary)',
                    border: isOpen ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s ease',
                    boxShadow: isOpen ? '0 0 0 3px rgba(56, 189, 248, 0.1)' : 'none'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: selectedModel.gradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: `0 4px 12px ${selectedModel.color}33`
                    }}>
                        <selectedModel.icon size={16} color="white" />
                    </div>
                    <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedModel.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {selectedModel.description}
                        </div>
                    </div>
                </div>
                <ChevronDown
                    size={18}
                    color="var(--text-secondary)"
                    style={{
                        transition: 'transform 0.2s ease',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                    }}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    right: 0,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
                    zIndex: 50,
                    animation: 'dropdownFadeIn 0.15s ease-out'
                }}>
                    <style>
                        {`
                            @keyframes dropdownFadeIn {
                                from { opacity: 0; transform: translateY(-8px); }
                                to { opacity: 1; transform: translateY(0); }
                            }
                        `}
                    </style>
                    {MODEL_OPTIONS.map((model, index) => {
                        const isSelected = model.id === value;
                        const Icon = model.icon;
                        return (
                            <button
                                key={model.id}
                                type="button"
                                onClick={() => {
                                    onChange(model.id);
                                    setIsOpen(false);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    background: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                                    border: 'none',
                                    borderTop: index > 0 ? '1px solid var(--glass-border)' : 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    transition: 'all 0.15s ease',
                                    textAlign: 'left'
                                }}
                                onMouseEnter={(e) => {
                                    if (!isSelected) {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = isSelected ? 'rgba(56, 189, 248, 0.08)' : 'transparent';
                                }}
                            >
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '10px',
                                    background: model.gradient,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: `0 4px 12px ${model.color}33`,
                                    flexShrink: 0
                                }}>
                                    <Icon size={20} color="white" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{
                                        fontWeight: 600,
                                        fontSize: '0.95rem',
                                        color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}>
                                        {model.name}
                                        {isSelected && <CheckCircle size={14} color="var(--primary)" />}
                                    </div>
                                    <div style={{
                                        fontSize: '0.8rem',
                                        color: 'var(--text-secondary)',
                                        marginTop: '4px'
                                    }}>
                                        {model.description}
                                    </div>
                                    <div style={{
                                        fontSize: '0.7rem',
                                        color: 'var(--text-muted)',
                                        marginTop: '4px',
                                        fontFamily: 'monospace',
                                        opacity: 0.7
                                    }}>
                                        {model.id}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const ConnectionCard: React.FC<{
    title: string;
    description: string;
    iconColor: string;
    status: SessionStatus | undefined;
    onReconnect: () => void;
    onUnpair: () => void;
}> = ({ title, description, iconColor, status, onReconnect, onUnpair }) => {
    return (
        <GlassCard>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', fontSize: '1.25rem' }}>
                        <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }}>
                            <Smartphone size={20} color={status?.connected ? 'var(--success)' : iconColor} />
                        </div>
                        {title}
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{description}</p>
                </div>
                {status?.connected && (
                    <span style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '999px',
                        background: 'rgba(74, 222, 128, 0.15)',
                        color: 'var(--success)',
                        border: '1px solid rgba(74, 222, 128, 0.2)',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                    }}>
                        <CheckCircle size={12} /> ONLINE
                    </span>
                )}
            </div>

            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1.5rem',
                background: 'rgba(0,0,0,0.2)',
                padding: '2rem',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(255,255,255,0.03)'
            }}>

                {!status?.paired && status?.qr && (
                    <div style={{
                        background: 'white',
                        padding: '1rem',
                        borderRadius: '1rem',
                        boxShadow: '0 0 30px rgba(255,255,255,0.1)'
                    }}>
                        <QRCodeSVG value={status.qr} size={200} />
                    </div>
                )}

                <div style={{ textAlign: 'center' }}>
                    <h4 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: status?.connected ? 'var(--success)' : 'var(--text-main)', fontWeight: 600 }}>
                        {!status
                            ? 'Connecting to System...'
                            : status.connected
                                ? 'Device Paired & Logic Active'
                                : status.paired
                                    ? 'Disconnected - Retrying...'
                                    : 'Awaiting Connection'}
                    </h4>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        {status?.connected
                            ? 'Session is fully active and processing messages.'
                            : status?.paired
                                ? 'Session is paired but currently offline.'
                                : 'Scan the QR code to link your WhatsApp account.'}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    {status?.paired && !status.connected && (
                        <Button onClick={onReconnect} icon={<RefreshCw size={18} />}>Reconnect Session</Button>
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
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to upload credentials';
            setUploadMessage({ type: 'error', text: message });
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
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', fontSize: '1.25rem' }}>
                        <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }}>
                            <Mail size={20} color={isConnected ? 'var(--success)' : 'var(--primary)'} />
                        </div>
                        Gmail Integration
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Connect Nova to your Gmail to enable email management capabilities.</p>
                </div>
                {isConnected && (
                    <span style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '999px',
                        background: 'rgba(74, 222, 128, 0.15)',
                        color: 'var(--success)',
                        border: '1px solid rgba(74, 222, 128, 0.2)',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                    }}>
                        <CheckCircle size={12} /> CONNECTED
                    </span>
                )}
            </div>

            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                background: 'rgba(0,0,0,0.2)',
                padding: '2rem',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(255,255,255,0.03)'
            }}>

                {/* Status Display */}
                {isConnected ? (
                    <div style={{ textAlign: 'center', padding: '1rem' }}>
                        <div style={{
                            width: '72px',
                            height: '72px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #EA4335, #FBBC04, #34A853, #4285F4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1.5rem',
                            boxShadow: '0 0 30px rgba(66, 133, 244, 0.2)'
                        }}>
                            <Mail size={32} color="white" />
                        </div>
                        <h4 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--success)', fontWeight: 600 }}>
                            Gmail Account Active
                        </h4>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Connected as <strong style={{ color: 'var(--text-main)' }}>{gmailStatus?.email}</strong>
                        </p>
                        <Button onClick={handleDisconnect} variant="danger" icon={<LogOut size={18} />}>
                            Disconnect Account
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
                                padding: '1rem 1.25rem',
                                background: 'rgba(56, 189, 248, 0.05)',
                                border: '1px solid rgba(56, 189, 248, 0.15)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--primary)',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                transition: 'all 0.2s'
                            }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <AlertCircle size={18} />
                                Configuration Guide: Obtaining Credentials
                            </span>
                            {showSetup ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>

                        {/* Setup Steps */}
                        {showSetup && (
                            <div style={{
                                background: 'rgba(15, 23, 42, 0.5)',
                                borderRadius: 'var(--radius-md)',
                                padding: '1.25rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1rem',
                                border: '1px solid var(--glass-border)'
                            }}>
                                {setupSteps.map((step) => (
                                    <div
                                        key={step.step}
                                        style={{
                                            display: 'flex',
                                            gap: '1rem',
                                            padding: '0.75rem',
                                            borderRadius: 'var(--radius-sm)',
                                            alignItems: 'flex-start'
                                        }}
                                    >
                                        <div style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            background: 'var(--primary)',
                                            color: '#000',
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
                                            <div style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                                                {step.title}
                                                {step.link && (
                                                    <a
                                                        href={step.link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', opacity: 0.8 }}
                                                    >
                                                        <ExternalLink size={14} />
                                                    </a>
                                                )}
                                            </div>
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
                                                {step.description}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Upload Section */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ position: 'relative' }}>
                                <label style={{ display: 'block', marginBottom: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>
                                    Step 1: Upload Credentials JSON
                                </label>
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".json"
                                        onChange={handleFileUpload}
                                        style={{ display: 'none' }}
                                    />
                                    <Button
                                        onClick={() => fileInputRef.current?.click()}
                                        variant={hasCredentials ? 'secondary' : 'primary'}
                                        icon={hasCredentials ? <Check size={18} /> : <Upload size={18} />}
                                        isLoading={uploading}
                                        style={{ flex: 1 }}
                                    >
                                        {hasCredentials ? 'Credentials Installed' : 'Select JSON File'}
                                    </Button>
                                </div>
                                {uploadMessage && (
                                    <p style={{
                                        marginTop: '0.5rem',
                                        fontSize: '0.85rem',
                                        color: uploadMessage.type === 'success' ? 'var(--success)' : 'var(--danger)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}>
                                        {uploadMessage.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                        {uploadMessage.text}
                                    </p>
                                )}
                            </div>

                            <div style={{ opacity: hasCredentials ? 1 : 0.5, pointerEvents: hasCredentials ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
                                <label style={{ display: 'block', marginBottom: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>
                                    Step 2: Authorize Application
                                </label>
                                <Button
                                    onClick={handleConnect}
                                    disabled={!hasCredentials}
                                    icon={<Mail size={18} />}
                                    isLoading={connecting}
                                    style={{ width: '100%' }}
                                >
                                    Login with Google
                                </Button>
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
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem' }}>

            {/* AI Settings */}
            <GlassCard style={{ overflow: 'visible', zIndex: 10 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <div>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', fontSize: '1.25rem' }}>
                            <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }}>
                                <Cpu size={20} color="var(--primary)" />
                            </div>
                            Core Intelligence
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Configure the LLM model and credentials powering Nova.</p>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>
                            Gemini API Key
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="password"
                                value={config.gemini_api_key || ''}
                                onChange={(e) => onConfigChange('gemini_api_key', e.target.value)}
                                placeholder="AIza..."
                                style={{
                                    width: '100%',
                                    padding: '0.875rem 1rem',
                                    paddingLeft: '2.5rem',
                                    background: 'var(--bg-tertiary)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--text-main)',
                                    fontFamily: 'monospace',
                                    fontSize: '0.9rem',
                                    transition: 'all 0.2s'
                                }}
                            />
                            <Key size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>
                            Target Model
                        </label>
                        <ModelSelector
                            value={config.gemini_model}
                            onChange={(value) => onConfigChange('gemini_model', value)}
                        />
                    </div>
                </div>
            </GlassCard>

            {/* Gmail Integration */}
            <GmailCard />

            {/* Monitoring Session */}
            <ConnectionCard
                title="Input Monitor"
                description="This session reads messages from the WhatsApp group."
                iconColor="var(--warning)"
                status={status?.monitoring}
                onReconnect={() => onReconnect('monitoring')}
                onUnpair={() => onUnpair('monitoring')}
            />

            {/* Replying Session */}
            <ConnectionCard
                title="Response Agent"
                description="This session sends replies to the WhatsApp group."
                iconColor="var(--success)"
                status={status?.replying}
                onReconnect={() => onReconnect('replying')}
                onUnpair={() => onUnpair('replying')}
            />

            {/* System Controls */}
            <GlassCard>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(255,255,255,0.05)' }}>
                            <Server size={24} color="var(--text-secondary)" />
                        </div>
                        <div>
                            <h4 style={{ margin: 0, marginBottom: '0.25rem', fontSize: '1rem' }}>Bridge Service Control</h4>
                            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                Restart the bridge if connection issues persist.
                            </p>
                        </div>
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

            {/* Save Action - Floating Bar */}
            <div style={{
                position: 'sticky',
                bottom: '2rem',
                zIndex: 100,
                display: 'flex',
                justifyContent: 'center'
            }}>
                <div style={{
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(20px)',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--glass-border)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                    display: 'flex',
                    gap: '1rem'
                }}>
                    <Button
                        onClick={onSave}
                        isLoading={saveStatus === 'saving'}
                        variant="primary"
                        style={{ width: '200px', borderRadius: 'var(--radius-full)' }}
                        icon={saveStatus === 'success' ? <Check size={18} /> : <Save size={18} />}
                    >
                        {saveStatus === 'success' ? 'Changes Saved' : 'Save Configuration'}
                    </Button>
                </div>
            </div>
        </div>
    );
};
