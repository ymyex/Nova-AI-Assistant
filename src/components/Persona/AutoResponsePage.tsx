import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Sliders, Power, Clock, ShieldAlert, RefreshCw, AlertCircle, ChevronRight } from 'lucide-react';
import { GlassCard } from '../Shared/GlassCard';
import { Button } from '../Shared/Button';
import { ToggleSwitch } from '../Shared/ToggleSwitch';
import { SearchInput } from '../Shared/SearchInput';
import { Modal } from '../Shared/Modal';
import { ContactAvatar } from '../Shared/ContactAvatar';
import { ConfidenceMeter } from '../Shared/ConfidenceBadge';
import { usePersonaApi } from '../../hooks/usePersonaApi';
import type { GlobalAutoResponseSettings, ChatAutoResponseConfig } from '../../types/persona';
import './AutoResponsePage.css';

export const AutoResponsePage: React.FC = () => {
    const [globalSettings, setGlobalSettings] = useState<GlobalAutoResponseSettings | null>(null);
    const [chatConfigs, setChatConfigs] = useState<ChatAutoResponseConfig[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedChat, setSelectedChat] = useState<ChatAutoResponseConfig | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const api = usePersonaApi();
    // Use ref to avoid infinite loop - api object changes on every render
    const apiRef = useRef(api);
    apiRef.current = api;

    // Load settings on mount
    const loadSettings = useCallback(async () => {
        try {
            const [settings, configs] = await Promise.all([
                apiRef.current.fetchGlobalSettings(),
                apiRef.current.fetchChatConfigs()
            ]);
            setGlobalSettings(settings);
            setChatConfigs(configs.configs);
        } catch {
            // Error handled by hook
        }
    }, []);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    const handleGlobalToggle = async (enabled: boolean) => {
        if (!globalSettings) return;
        setIsSaving(true);
        try {
            const updated = await apiRef.current.updateGlobalSettings({ enabled });
            setGlobalSettings(updated);
        } finally {
            setIsSaving(false);
        }
    };

    const handleThresholdChange = async (defaultThreshold: number) => {
        if (!globalSettings) return;
        setIsSaving(true);
        try {
            const updated = await apiRef.current.updateGlobalSettings({ defaultThreshold });
            setGlobalSettings(updated);
        } finally {
            setIsSaving(false);
        }
    };

    const handleQuietHoursToggle = async (enabled: boolean) => {
        if (!globalSettings) return;
        setIsSaving(true);
        try {
            const currentQuietHours = globalSettings.quietHours ?? { enabled: false, start: '22:00', end: '08:00' };
            const updated = await apiRef.current.updateGlobalSettings({
                quietHours: { ...currentQuietHours, enabled }
            });
            setGlobalSettings(updated);
        } finally {
            setIsSaving(false);
        }
    };

    const handleChatToggle = async (chatJid: string, enabled: boolean) => {
        try {
            const updated = await apiRef.current.updateChatConfig(chatJid, { enabled });
            setChatConfigs(prev => prev.map(c =>
                c.chatJid === chatJid ? { ...c, enabled: updated.enabled } : c
            ));
        } catch {
            // Error handled by hook
        }
    };

    const handleChatThresholdChange = async (chatJid: string, threshold: number | null) => {
        try {
            const updated = await api.updateChatConfig(chatJid, {
                confidenceThreshold: threshold ?? undefined
            });
            setChatConfigs(prev => prev.map(c =>
                c.chatJid === chatJid ? updated : c
            ));
            if (selectedChat?.chatJid === chatJid) {
                setSelectedChat(updated);
            }
        } catch {
            // Error handled by hook
        }
    };

    // Filter chats by search
    const filteredChats = chatConfigs.filter(c =>
        (c.contactName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.chatJid || '').includes(searchQuery)
    );

    // Separate enabled and disabled chats
    const enabledChats = filteredChats.filter(c => c.enabled);
    const disabledChats = filteredChats.filter(c => !c.enabled);

    return (
        <div className="persona-page auto-response-page">
            {/* Header */}
            <header className="persona-page__header">
                <div className="persona-page__title">
                    <Sliders size={28} className="persona-page__icon" />
                    <div>
                        <h2 className="text-gradient">Auto-Response Settings</h2>
                        <p>Configure automatic WhatsApp message responses</p>
                    </div>
                </div>
            </header>

            {/* Error State */}
            {api.error && (
                <div className="persona-page__error">
                    <AlertCircle size={20} />
                    <span>{api.error}</span>
                    <Button variant="ghost" onClick={api.clearError}>Dismiss</Button>
                </div>
            )}

            {api.isLoading && !globalSettings ? (
                <div className="settings-loading">
                    <RefreshCw size={24} className="animate-spin" />
                    <span>Loading settings...</span>
                </div>
            ) : globalSettings && (
                <>
                    {/* Global Settings */}
                    <div className="settings-grid">
                        <GlassCard className="settings-card master-toggle">
                            <div className="settings-card__header">
                                <Power size={20} className={globalSettings.enabled ? 'active' : ''} />
                                <div>
                                    <h3>Auto-Response</h3>
                                    <p>Master switch for all automatic responses</p>
                                </div>
                                <ToggleSwitch
                                    checked={globalSettings.enabled}
                                    onChange={handleGlobalToggle}
                                    disabled={isSaving}
                                />
                            </div>
                            {!globalSettings.enabled && (
                                <div className="settings-card__warning">
                                    Auto-responses are currently disabled for all chats
                                </div>
                            )}
                        </GlassCard>

                        <GlassCard className="settings-card">
                            <div className="settings-card__header">
                                <ShieldAlert size={20} />
                                <div>
                                    <h3>Default Confidence Threshold</h3>
                                    <p>Minimum confidence required to auto-send</p>
                                </div>
                            </div>
                            <div className="threshold-slider">
                                <ConfidenceMeter score={globalSettings.defaultThreshold} />
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={globalSettings.defaultThreshold * 100}
                                    onChange={(e) => handleThresholdChange(Number(e.target.value) / 100)}
                                    className="range-input"
                                />
                                <div className="threshold-labels">
                                    <span>More Responses</span>
                                    <span>Fewer Responses</span>
                                </div>
                            </div>
                        </GlassCard>

                        <GlassCard className="settings-card">
                            <div className="settings-card__header">
                                <Clock size={20} />
                                <div>
                                    <h3>Quiet Hours</h3>
                                    <p>Disable auto-responses during certain hours</p>
                                </div>
                                <ToggleSwitch
                                    checked={globalSettings.quietHours?.enabled ?? false}
                                    onChange={handleQuietHoursToggle}
                                    disabled={isSaving}
                                    size="sm"
                                />
                            </div>
                            {globalSettings.quietHours?.enabled && (
                                <div className="quiet-hours-config">
                                    <div className="time-range">
                                        <span>From</span>
                                        <input
                                            type="time"
                                            value={globalSettings.quietHours?.start ?? '22:00'}
                                            className="time-input"
                                            onChange={() => {/* TODO: Implement */}}
                                        />
                                        <span>to</span>
                                        <input
                                            type="time"
                                            value={globalSettings.quietHours?.end ?? '08:00'}
                                            className="time-input"
                                            onChange={() => {/* TODO: Implement */}}
                                        />
                                    </div>
                                </div>
                            )}
                        </GlassCard>

                        <GlassCard className="settings-card">
                            <div className="settings-card__header">
                                <RefreshCw size={20} />
                                <div>
                                    <h3>Rate Limit</h3>
                                    <p>Maximum responses per hour</p>
                                </div>
                                <span className="rate-value">{globalSettings.maxResponsesPerHour ?? 60}/hr</span>
                            </div>
                        </GlassCard>
                    </div>

                    {/* Per-Chat Settings */}
                    <section className="chat-settings-section">
                        <div className="section-header">
                            <h3>Per-Chat Configuration</h3>
                            <SearchInput
                                value={searchQuery}
                                onChange={setSearchQuery}
                                placeholder="Search contacts..."
                            />
                        </div>

                        {/* Enabled Chats */}
                        {enabledChats.length > 0 && (
                            <div className="chat-group">
                                <h4>Enabled ({enabledChats.length})</h4>
                                <div className="chat-list">
                                    {enabledChats.map(chat => (
                                        <ChatConfigCard
                                            key={chat.chatJid}
                                            config={chat}
                                            onToggle={(enabled) => handleChatToggle(chat.chatJid, enabled)}
                                            onSelect={() => setSelectedChat(chat)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Disabled Chats */}
                        {disabledChats.length > 0 && (
                            <div className="chat-group">
                                <h4>Disabled ({disabledChats.length})</h4>
                                <div className="chat-list">
                                    {disabledChats.map(chat => (
                                        <ChatConfigCard
                                            key={chat.chatJid}
                                            config={chat}
                                            onToggle={(enabled) => handleChatToggle(chat.chatJid, enabled)}
                                            onSelect={() => setSelectedChat(chat)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {filteredChats.length === 0 && (
                            <div className="no-chats">
                                {searchQuery
                                    ? 'No chats match your search'
                                    : 'No chats configured yet'
                                }
                            </div>
                        )}
                    </section>
                </>
            )}

            {/* Chat Config Detail Modal */}
            <Modal
                isOpen={!!selectedChat}
                onClose={() => setSelectedChat(null)}
                title="Chat Configuration"
                size="md"
            >
                {selectedChat && (
                    <ChatConfigDetail
                        config={selectedChat}
                        defaultThreshold={globalSettings?.defaultThreshold || 0.85}
                        onThresholdChange={(t) => handleChatThresholdChange(selectedChat.chatJid, t)}
                    />
                )}
            </Modal>
        </div>
    );
};

// Chat Config Card Component
interface ChatConfigCardProps {
    config: ChatAutoResponseConfig;
    onToggle: (enabled: boolean) => void;
    onSelect: () => void;
}

const ChatConfigCard: React.FC<ChatConfigCardProps> = ({ config, onToggle, onSelect }) => {
    return (
        <motion.div
            className={`chat-config-card ${config.enabled ? 'enabled' : 'disabled'}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <ContactAvatar name={config.contactName} jid={config.chatJid} size="sm" />
            <div className="chat-config-card__info" onClick={onSelect}>
                <span className="chat-config-card__name">{config.contactName}</span>
                <span className="chat-config-card__stats">
                    {config.totalResponses} responses
                    {config.lastResponseAt && (
                        <span> • Last: {new Date(config.lastResponseAt).toLocaleDateString()}</span>
                    )}
                </span>
            </div>
            <div className="chat-config-card__threshold">
                <span className={config.usesDefaultThreshold ? 'default' : ''}>
                    {Math.round(config.confidenceThreshold * 100)}%
                </span>
                {config.usesDefaultThreshold && <span className="default-label">default</span>}
            </div>
            <ToggleSwitch
                checked={config.enabled}
                onChange={onToggle}
                size="sm"
            />
            <button className="chat-config-card__expand" onClick={onSelect}>
                <ChevronRight size={18} />
            </button>
        </motion.div>
    );
};

// Chat Config Detail Component
interface ChatConfigDetailProps {
    config: ChatAutoResponseConfig;
    defaultThreshold: number;
    onThresholdChange: (threshold: number | null) => void;
}

const ChatConfigDetail: React.FC<ChatConfigDetailProps> = ({
    config,
    defaultThreshold,
    onThresholdChange
}) => {
    const [useCustom, setUseCustom] = useState(!config.usesDefaultThreshold);
    const [threshold, setThreshold] = useState(config.confidenceThreshold);

    const handleToggleCustom = (custom: boolean) => {
        setUseCustom(custom);
        if (!custom) {
            onThresholdChange(null);
            setThreshold(defaultThreshold);
        }
    };

    const handleThresholdChange = (value: number) => {
        setThreshold(value);
        if (useCustom) {
            onThresholdChange(value);
        }
    };

    return (
        <div className="chat-config-detail">
            <div className="chat-config-detail__header">
                <ContactAvatar name={config.contactName} jid={config.chatJid} size="lg" />
                <div>
                    <h3>{config.contactName}</h3>
                    <p>{config.chatJid}</p>
                </div>
            </div>

            <div className="detail-section">
                <h4>Response Statistics</h4>
                <div className="stats-grid">
                    <div className="stat">
                        <span className="stat-value">{config.totalResponses}</span>
                        <span className="stat-label">Total Responses</span>
                    </div>
                    <div className="stat">
                        <span className="stat-value success">{config.approvedResponses || 0}</span>
                        <span className="stat-label">Approved</span>
                    </div>
                    <div className="stat">
                        <span className="stat-value danger">{config.rejectedResponses || 0}</span>
                        <span className="stat-label">Rejected</span>
                    </div>
                </div>
            </div>

            <div className="detail-section">
                <h4>Confidence Threshold</h4>
                <div className="threshold-toggle">
                    <ToggleSwitch
                        checked={useCustom}
                        onChange={handleToggleCustom}
                        label="Use custom threshold"
                        size="sm"
                    />
                </div>
                <div className={`threshold-config ${!useCustom ? 'disabled' : ''}`}>
                    <ConfidenceMeter score={threshold} />
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={threshold * 100}
                        onChange={(e) => handleThresholdChange(Number(e.target.value) / 100)}
                        className="range-input"
                        disabled={!useCustom}
                    />
                </div>
                {!useCustom && (
                    <p className="using-default">
                        Using global default: {Math.round(defaultThreshold * 100)}%
                    </p>
                )}
            </div>
        </div>
    );
};

export default AutoResponsePage;
