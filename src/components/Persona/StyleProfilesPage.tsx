import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Users, RefreshCw, Grid, List, Sparkles, Trash2, ChevronRight, AlertCircle, UserPlus, MessageSquare, Check } from 'lucide-react';
import { GlassCard } from '../Shared/GlassCard';
import { Button } from '../Shared/Button';
import { SearchInput } from '../Shared/SearchInput';
import { Modal } from '../Shared/Modal';
import { ContactAvatar } from '../Shared/ContactAvatar';
import { usePersonaApi } from '../../hooks/usePersonaApi';
import type { StyleProfile, BatchJob, ViewMode, AvailableChat } from '../../types/persona';
import './StyleProfilesPage.css';

interface StyleProfilesPageProps {
    onSelectProfile?: (chatJid: string) => void;
    onViewProfile?: (chatJid: string) => void;
}

export const StyleProfilesPage: React.FC<StyleProfilesPageProps> = ({ onSelectProfile, onViewProfile }) => {
    const [profiles, setProfiles] = useState<StyleProfile[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProfile, setSelectedProfile] = useState<StyleProfile | null>(null);
    const [batchStatus, setBatchStatus] = useState<BatchJob | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showBatchModal, setShowBatchModal] = useState(false);

    // New state for contact selection
    const [showSelectContactModal, setShowSelectContactModal] = useState(false);
    const [availableChats, setAvailableChats] = useState<AvailableChat[]>([]);
    const [contactSearchQuery, setContactSearchQuery] = useState('');
    const [generatingContactJid, setGeneratingContactJid] = useState<string | null>(null);

    const api = usePersonaApi();
    // Use ref to avoid infinite loop - api object changes on every render
    const apiRef = useRef(api);
    apiRef.current = api;

    // Fetch profiles on mount and when search changes
    const loadProfiles = useCallback(async () => {
        try {
            const response = await apiRef.current.fetchProfiles(searchQuery || undefined);
            setProfiles(response.profiles);
        } catch {
            // Error is handled in the hook
        }
    }, [searchQuery]);

    useEffect(() => {
        loadProfiles();
    }, [loadProfiles]);

    // Poll batch status while generating
    useEffect(() => {
        if (!isGenerating) return;

        const pollInterval = setInterval(async () => {
            try {
                const status = await apiRef.current.getBatchStatus();
                setBatchStatus(status);
                if (status.status === 'completed' || status.status === 'failed') {
                    setIsGenerating(false);
                    loadProfiles(); // Refresh profiles
                }
            } catch {
                // Ignore polling errors
            }
        }, 2000);

        return () => clearInterval(pollInterval);
    }, [isGenerating, loadProfiles]);

    const handleGenerateAll = async () => {
        setShowBatchModal(false);
        setIsGenerating(true);
        try {
            const response = await apiRef.current.generateAllProfiles(false, 50);
            setBatchStatus({
                jobId: response.jobId,
                status: 'started',
                processed: 0,
                total: response.totalChats,
                successful: 0,
                failed: 0,
                errors: [],
                estimatedDurationSeconds: response.estimatedDurationSeconds
            });
        } catch {
            setIsGenerating(false);
        }
    };

    const handleDeleteProfile = async (chatJid: string) => {
        try {
            await apiRef.current.deleteProfile(chatJid);
            setProfiles(prev => prev.filter(p => p.chatJid !== chatJid));
            if (selectedProfile?.chatJid === chatJid) {
                setSelectedProfile(null);
            }
        } catch {
            // Error handled by hook
        }
    };

    const handleRegenerateProfile = async (chatJid: string) => {
        try {
            const profile = await apiRef.current.generateProfile(chatJid);
            setProfiles(prev => prev.map(p => p.chatJid === chatJid ? profile : p));
            if (selectedProfile?.chatJid === chatJid) {
                setSelectedProfile(profile);
            }
        } catch {
            // Error handled by hook
        }
    };

    // Load available chats when opening the select contact modal
    const loadAvailableChats = useCallback(async () => {
        try {
            const response = await apiRef.current.fetchAvailableChats(contactSearchQuery || undefined);
            setAvailableChats(response.chats);
        } catch {
            // Error handled by hook
        }
    }, [contactSearchQuery]);

    useEffect(() => {
        if (showSelectContactModal) {
            loadAvailableChats();
        }
    }, [showSelectContactModal, loadAvailableChats]);

    const handleGenerateContactProfile = async (chat: AvailableChat) => {
        setGeneratingContactJid(chat.chatJid);
        try {
            const profile = await apiRef.current.generateProfile(chat.chatJid);
            // Add or update the profile in the list
            setProfiles(prev => {
                const existingIndex = prev.findIndex(p => p.chatJid === chat.chatJid);
                if (existingIndex >= 0) {
                    const updated = [...prev];
                    updated[existingIndex] = profile;
                    return updated;
                }
                return [profile, ...prev];
            });
            // Update the chat in available chats to show it now has a profile
            setAvailableChats(prev => prev.map(c =>
                c.chatJid === chat.chatJid ? { ...c, hasProfile: true } : c
            ));
        } catch {
            // Error handled by hook
        } finally {
            setGeneratingContactJid(null);
        }
    };

    const handleOpenSelectContact = () => {
        setContactSearchQuery('');
        setShowSelectContactModal(true);
    };

    // Filter profiles by search
    const filteredProfiles = profiles.filter(p =>
        (p.contactName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.chatJid || '').includes(searchQuery)
    );

    return (
        <div className="persona-page">
            {/* Header */}
            <header className="persona-page__header">
                <div className="persona-page__title">
                    <Users size={28} className="persona-page__icon" />
                    <div>
                        <h2 className="text-gradient">Style Profiles</h2>
                        <p>Manage communication style profiles for each contact</p>
                    </div>
                </div>
                <div className="persona-page__actions">
                    <Button
                        variant="secondary"
                        icon={<UserPlus size={18} />}
                        onClick={handleOpenSelectContact}
                        disabled={isGenerating}
                    >
                        Select Contact
                    </Button>
                    <Button
                        variant="primary"
                        icon={<Sparkles size={18} />}
                        onClick={() => setShowBatchModal(true)}
                        disabled={isGenerating}
                        isLoading={isGenerating}
                    >
                        {isGenerating ? 'Generating...' : 'Generate All'}
                    </Button>
                </div>
            </header>

            {/* Batch Progress */}
            {batchStatus && isGenerating && (
                <GlassCard className="batch-progress">
                    <div className="batch-progress__header">
                        <Sparkles size={18} className="batch-progress__icon" />
                        <span>Generating Style Profiles</span>
                        <span className="batch-progress__count">
                            {batchStatus.processed} / {batchStatus.total}
                        </span>
                    </div>
                    <div className="batch-progress__bar">
                        <motion.div
                            className="batch-progress__fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${(batchStatus.processed / batchStatus.total) * 100}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>
                    <div className="batch-progress__stats">
                        <span className="batch-progress__success">
                            {batchStatus.successful} successful
                        </span>
                        {batchStatus.failed > 0 && (
                            <span className="batch-progress__failed">
                                {batchStatus.failed} failed
                            </span>
                        )}
                    </div>
                </GlassCard>
            )}

            {/* Toolbar */}
            <div className="persona-page__toolbar">
                <SearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search contacts..."
                />
                <div className="persona-page__view-toggle">
                    <button
                        className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                        onClick={() => setViewMode('grid')}
                        aria-label="Grid view"
                    >
                        <Grid size={18} />
                    </button>
                    <button
                        className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                        onClick={() => setViewMode('list')}
                        aria-label="List view"
                    >
                        <List size={18} />
                    </button>
                </div>
            </div>

            {/* Error State */}
            {api.error && (
                <div className="persona-page__error">
                    <AlertCircle size={20} />
                    <span>{api.error}</span>
                    <Button variant="ghost" onClick={api.clearError}>Dismiss</Button>
                </div>
            )}

            {/* Profiles Grid/List */}
            <div className={`profiles-container profiles-container--${viewMode}`}>
                {api.isLoading && profiles.length === 0 ? (
                    <div className="profiles-loading">
                        <RefreshCw size={24} className="animate-spin" />
                        <span>Loading profiles...</span>
                    </div>
                ) : filteredProfiles.length === 0 ? (
                    <div className="profiles-empty">
                        <Users size={48} />
                        <h3>No Style Profiles</h3>
                        <p>
                            {searchQuery
                                ? 'No profiles match your search'
                                : 'Generate style profiles from your WhatsApp chat history'
                            }
                        </p>
                        {!searchQuery && (
                            <Button
                                variant="primary"
                                icon={<Sparkles size={18} />}
                                onClick={() => setShowBatchModal(true)}
                            >
                                Generate All Profiles
                            </Button>
                        )}
                    </div>
                ) : (
                    filteredProfiles.map(profile => (
                        <ProfileCard
                            key={profile.chatJid}
                            profile={profile}
                            viewMode={viewMode}
                            onSelect={() => {
                                if (onViewProfile) {
                                    // Navigate to detail page if handler is provided
                                    onViewProfile(profile.chatJid);
                                } else {
                                    // Fall back to modal view
                                    setSelectedProfile(profile);
                                    onSelectProfile?.(profile.chatJid);
                                }
                            }}
                            onRegenerate={() => handleRegenerateProfile(profile.chatJid)}
                            onDelete={() => handleDeleteProfile(profile.chatJid)}
                        />
                    ))
                )}
            </div>

            {/* Profile Detail Modal */}
            <Modal
                isOpen={!!selectedProfile}
                onClose={() => setSelectedProfile(null)}
                title="Style Profile Details"
                size="lg"
            >
                {selectedProfile && (
                    <ProfileDetail
                        profile={selectedProfile}
                        onRegenerate={() => handleRegenerateProfile(selectedProfile.chatJid)}
                        onClose={() => setSelectedProfile(null)}
                    />
                )}
            </Modal>

            {/* Batch Generate Confirmation Modal */}
            <Modal
                isOpen={showBatchModal}
                onClose={() => setShowBatchModal(false)}
                title="Generate All Style Profiles"
                size="sm"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setShowBatchModal(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={handleGenerateAll}>
                            Generate
                        </Button>
                    </>
                }
            >
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    This will analyze your WhatsApp chat history and generate personalized
                    style profiles for each contact.
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    Only chats with 50+ messages will be analyzed. Existing profiles will be preserved.
                </p>
            </Modal>

            {/* Select Contact Modal */}
            <Modal
                isOpen={showSelectContactModal}
                onClose={() => setShowSelectContactModal(false)}
                title="Select Contact for Profile"
                size="lg"
            >
                <div className="select-contact-modal">
                    <SearchInput
                        value={contactSearchQuery}
                        onChange={setContactSearchQuery}
                        placeholder="Search contacts..."
                    />

                    <div className="available-chats-list">
                        {api.isLoading && availableChats.length === 0 ? (
                            <div className="chats-loading">
                                <RefreshCw size={24} className="animate-spin" />
                                <span>Loading contacts...</span>
                            </div>
                        ) : availableChats.length === 0 ? (
                            <div className="chats-empty">
                                <Users size={48} />
                                <h4>No Contacts Found</h4>
                                <p>No contacts with 10+ messages found in your WhatsApp history.</p>
                            </div>
                        ) : (
                            availableChats.map(chat => (
                                <div
                                    key={chat.chatJid}
                                    className={`available-chat-item ${chat.hasProfile ? 'has-profile' : ''}`}
                                >
                                    <ContactAvatar name={chat.contactName} jid={chat.chatJid} size="sm" />
                                    <div className="available-chat-item__info">
                                        <span className="available-chat-item__name">{chat.contactName}</span>
                                        <span className="available-chat-item__meta">
                                            <MessageSquare size={14} />
                                            {chat.messageCount} messages
                                            {chat.hasProfile && (
                                                <span className="has-profile-badge">
                                                    <Check size={12} /> Has Profile
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    <Button
                                        variant={chat.hasProfile ? 'ghost' : 'primary'}
                                        icon={generatingContactJid === chat.chatJid ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                        onClick={() => handleGenerateContactProfile(chat)}
                                        disabled={generatingContactJid !== null}
                                    >
                                        {chat.hasProfile ? 'Regenerate' : 'Generate'}
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="select-contact-modal__footer">
                        <p className="text-muted">
                            {availableChats.length} contacts available • {availableChats.filter(c => c.hasProfile).length} with profiles
                        </p>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

// Profile Card Component
interface ProfileCardProps {
    profile: StyleProfile;
    viewMode: ViewMode;
    onSelect: () => void;
    onRegenerate: () => void;
    onDelete: () => void;
}

const ProfileCard: React.FC<ProfileCardProps> = ({
    profile,
    viewMode,
    onSelect,
    onRegenerate,
    onDelete
}) => {
    const formalityLabel = profile.formalityLevel < 0.3 ? 'Casual' :
        profile.formalityLevel < 0.7 ? 'Balanced' : 'Formal';

    const emojiLabel = profile.emojiFrequency < 0.3 ? 'Minimal' :
        profile.emojiFrequency < 0.7 ? 'Moderate' : 'Frequent';

    if (viewMode === 'list') {
        return (
            <motion.div
                className="profile-card profile-card--list"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={onSelect}
            >
                <ContactAvatar name={profile.contactName} jid={profile.chatJid} size="sm" />
                <div className="profile-card__info">
                    <span className="profile-card__name">{profile.contactName}</span>
                    <span className="profile-card__meta">
                        {formalityLabel} • {emojiLabel} Emojis • {profile.messageCountAnalyzed} msgs
                    </span>
                </div>
                <div className="profile-card__languages">
                    {(profile.languagePreferences ?? []).slice(0, 2).map(lang => (
                        <span key={lang} className="lang-tag">{lang.toUpperCase()}</span>
                    ))}
                </div>
                <div className="profile-card__actions">
                    <button onClick={(e) => { e.stopPropagation(); onRegenerate(); }} title="Regenerate">
                        <RefreshCw size={16} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete" className="delete">
                        <Trash2 size={16} />
                    </button>
                    <ChevronRight size={16} className="chevron" />
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            className="profile-card profile-card--grid"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -4 }}
            onClick={onSelect}
        >
            <div className="profile-card__header">
                <ContactAvatar name={profile.contactName} jid={profile.chatJid} size="md" />
                <div className="profile-card__name-wrap">
                    <span className="profile-card__name">{profile.contactName}</span>
                    <span className="profile-card__messages">{profile.messageCountAnalyzed} messages</span>
                </div>
            </div>

            <div className="profile-card__metrics">
                <div className="metric">
                    <span className="metric__label">Formality</span>
                    <div className="metric__bar">
                        <div className="metric__fill" style={{ width: `${profile.formalityLevel * 100}%` }} />
                    </div>
                    <span className="metric__value">{formalityLabel}</span>
                </div>
                <div className="metric">
                    <span className="metric__label">Emojis</span>
                    <div className="metric__bar">
                        <div className="metric__fill emoji" style={{ width: `${profile.emojiFrequency * 100}%` }} />
                    </div>
                    <span className="metric__value">{emojiLabel}</span>
                </div>
            </div>

            <div className="profile-card__tags">
                {(profile.languagePreferences ?? []).slice(0, 3).map(lang => (
                    <span key={lang} className="lang-tag">{lang.toUpperCase()}</span>
                ))}
                <span className="response-tag">{profile.responseTimePattern ?? 'variable'}</span>
            </div>

            <div className="profile-card__actions">
                <button onClick={(e) => { e.stopPropagation(); onRegenerate(); }} title="Regenerate">
                    <RefreshCw size={16} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete" className="delete">
                    <Trash2 size={16} />
                </button>
            </div>
        </motion.div>
    );
};

// Profile Detail Component
interface ProfileDetailProps {
    profile: StyleProfile;
    onRegenerate: () => void;
    onClose: () => void;
}

const ProfileDetail: React.FC<ProfileDetailProps> = ({ profile, onRegenerate }) => {
    return (
        <div className="profile-detail">
            <div className="profile-detail__header">
                <ContactAvatar name={profile.contactName} jid={profile.chatJid} size="lg" />
                <div>
                    <h3>{profile.contactName}</h3>
                    <p className="profile-detail__jid">{profile.chatJid}</p>
                    <p className="profile-detail__analyzed">
                        Based on {profile.messageCountAnalyzed} messages
                    </p>
                </div>
            </div>

            <div className="profile-detail__grid">
                <div className="detail-section">
                    <h4>Communication Style</h4>
                    <div className="detail-metric">
                        <span>Formality Level</span>
                        <div className="detail-bar">
                            <div style={{ width: `${profile.formalityLevel * 100}%` }} />
                        </div>
                        <span>{Math.round(profile.formalityLevel * 100)}%</span>
                    </div>
                    <div className="detail-metric">
                        <span>Emoji Usage</span>
                        <div className="detail-bar emoji">
                            <div style={{ width: `${profile.emojiFrequency * 100}%` }} />
                        </div>
                        <span>{Math.round(profile.emojiFrequency * 100)}%</span>
                    </div>
                    <div className="detail-stat">
                        <span>Avg Message Length</span>
                        <span>{profile.avgMessageLength} chars</span>
                    </div>
                    <div className="detail-stat">
                        <span>Response Pattern</span>
                        <span className="capitalize">{profile.responseTimePattern}</span>
                    </div>
                </div>

                <div className="detail-section">
                    <h4>Languages</h4>
                    <div className="detail-tags">
                        {(profile.languagePreferences ?? []).map(lang => (
                            <span key={lang} className="lang-tag large">{lang.toUpperCase()}</span>
                        ))}
                    </div>
                </div>

                <div className="detail-section">
                    <h4>Common Greetings</h4>
                    <div className="detail-tags">
                        {(profile.commonGreetings ?? []).map((g, i) => (
                            <span key={i} className="phrase-tag">{g}</span>
                        ))}
                    </div>
                </div>

                <div className="detail-section">
                    <h4>Common Closings</h4>
                    <div className="detail-tags">
                        {(profile.commonClosings ?? []).map((c, i) => (
                            <span key={i} className="phrase-tag">{c}</span>
                        ))}
                    </div>
                </div>

                <div className="detail-section full-width">
                    <h4>Vocabulary Patterns</h4>
                    <div className="detail-tags wrap">
                        {(profile.vocabularyPatterns ?? []).map((v, i) => (
                            <span key={i} className="vocab-tag">{v}</span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="profile-detail__footer">
                <span className="profile-detail__updated">
                    Last updated: {new Date(profile.updatedAt).toLocaleDateString()}
                </span>
                <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={onRegenerate}>
                    Regenerate Profile
                </Button>
            </div>
        </div>
    );
};

export default StyleProfilesPage;
