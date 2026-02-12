import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    RefreshCw,
    MessageSquare,
    Mic,
    Image,
    Video,
    FileText,
    Globe,
    Smile,
    Type,
    Heart,
    Zap,
    Users,
    Calendar,
    Hash,
    Quote,
    Volume2,
    Send,
    MessageCircle
} from 'lucide-react';
import { GlassCard } from '../Shared/GlassCard';
import { ContactAvatar } from '../Shared/ContactAvatar';
import { usePersonaApi } from '../../hooks/usePersonaApi';
import type { StyleProfileFull } from '../../types/persona';
import './StyleProfileDetailPage.css';

interface StyleProfileDetailPageProps {
    chatJid: string;
    onBack: () => void;
}

export const StyleProfileDetailPage: React.FC<StyleProfileDetailPageProps> = ({ chatJid, onBack }) => {
    const { fetchProfile, generateProfile, isLoading } = usePersonaApi();
    const [profile, setProfile] = useState<StyleProfileFull | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isRegenerating, setIsRegenerating] = useState(false);

    useEffect(() => {
        loadProfile();
    }, [chatJid]);

    const loadProfile = async () => {
        try {
            setError(null);
            const data = await fetchProfile(chatJid);
            setProfile(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load profile');
        }
    };

    const handleRegenerate = async () => {
        setIsRegenerating(true);
        try {
            await generateProfile(chatJid, true);
            await loadProfile();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to regenerate profile');
        } finally {
            setIsRegenerating(false);
        }
    };

    if (isLoading && !profile) {
        return (
            <div className="profile-detail-page">
                <div className="profile-detail-loading">
                    <RefreshCw className="spin" size={32} />
                    <p>Loading profile...</p>
                </div>
            </div>
        );
    }

    if (error && !profile) {
        return (
            <div className="profile-detail-page">
                <div className="profile-detail-error">
                    <p>{error}</p>
                    <button onClick={loadProfile}>Retry</button>
                </div>
            </div>
        );
    }

    if (!profile) return null;

    const pd = profile.profileData || {};

    return (
        <div className="profile-detail-page">
            {/* Header */}
            <motion.div
                className="profile-detail-header"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <button className="back-button" onClick={onBack}>
                    <ArrowLeft size={20} />
                    <span>Back to Profiles</span>
                </button>
                <button
                    className="regenerate-button"
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                >
                    <RefreshCw size={16} className={isRegenerating ? 'spin' : ''} />
                    <span>{isRegenerating ? 'Regenerating...' : 'Regenerate'}</span>
                </button>
            </motion.div>

            {/* Profile Hero */}
            <motion.div
                className="profile-hero"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <ContactAvatar name={profile.contactName} size="lg" />
                <div className="hero-info">
                    <h1>{profile.contactName}</h1>
                    <p className="hero-jid">{chatJid}</p>
                    <div className="hero-stats">
                        <div className="stat">
                            <MessageSquare size={16} />
                            <span>{profile.messageCountAnalyzed} messages analyzed</span>
                        </div>
                        <div className="stat">
                            <Calendar size={16} />
                            <span>Last updated: {new Date(profile.updatedAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Media Stats */}
            {pd.metadata?.media_analyzed && (
                <motion.div
                    className="media-stats-bar"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 }}
                >
                    <div className="media-stat">
                        <Type size={16} />
                        <span>{pd.metadata.media_analyzed.text_count || 0} texts</span>
                    </div>
                    <div className="media-stat">
                        <Mic size={16} />
                        <span>{pd.metadata.media_analyzed.voice_count || 0} voice</span>
                    </div>
                    <div className="media-stat">
                        <Image size={16} />
                        <span>{pd.metadata.media_analyzed.image_count || 0} images</span>
                    </div>
                    <div className="media-stat">
                        <Video size={16} />
                        <span>{pd.metadata.media_analyzed.video_count || 0} videos</span>
                    </div>
                    <div className="media-stat">
                        <FileText size={16} />
                        <span>{pd.metadata.media_analyzed.document_count || 0} docs</span>
                    </div>
                </motion.div>
            )}

            <div className="profile-sections">
                {/* Languages & Dialect */}
                <Section title="Languages & Dialect" icon={<Globe size={20} />} delay={0.2}>
                    <div className="section-grid">
                        <InfoItem label="Primary Language" value={pd.languages?.primary} />
                        <InfoItem label="Secondary Languages" value={pd.languages?.secondary?.join(', ')} />
                        <InfoItem label="Code Switching" value={pd.languages?.code_switching ? 'Yes' : 'No'} />
                    </div>
                    {pd.languages?.code_switching_pattern && (
                        <div className="section-note">
                            <strong>Pattern:</strong> {pd.languages.code_switching_pattern}
                        </div>
                    )}
                    {pd.dialect && (
                        <div className="subsection">
                            <h4>Dialect Details</h4>
                            <div className="section-grid">
                                <InfoItem label="Region" value={pd.dialect.region} />
                                <InfoItem label="Specific" value={pd.dialect.specific} />
                                <InfoItem label="Transliteration Style" value={pd.dialect.transliteration_style} />
                            </div>
                            {(pd.dialect?.examples?.length ?? 0) > 0 && (
                                <TagList label="Examples" tags={pd.dialect?.examples} />
                            )}
                        </div>
                    )}
                </Section>

                {/* Tone & Formality */}
                <Section title="Tone & Formality" icon={<Zap size={20} />} delay={0.25}>
                    <div className="section-grid">
                        <InfoItem label="Overall Tone" value={pd.tone?.overall} highlight />
                        <InfoItem label="Formality Level" value={pd.tone?.formality_level ? `${pd.tone.formality_level}/5` : undefined} />
                        <InfoItem label="Emotional Expression" value={pd.tone?.emotional_expression} />
                        <InfoItem label="Directness" value={pd.tone?.directness} />
                    </div>
                    {pd.tone?.humor_style && (
                        <div className="section-note">
                            <strong>Humor Style:</strong> {pd.tone.humor_style}
                        </div>
                    )}
                </Section>

                {/* Emoji & Sticker Usage */}
                <Section title="Emoji & Sticker Usage" icon={<Smile size={20} />} delay={0.3}>
                    <div className="section-grid">
                        <InfoItem label="Frequency" value={pd.emoji_usage?.frequency} highlight />
                        <InfoItem label="Sticker Usage" value={pd.emoji_usage?.sticker_usage} />
                    </div>
                    {(pd.emoji_usage?.favorites?.length ?? 0) > 0 && (
                        <div className="emoji-favorites">
                            <strong>Favorites:</strong>
                            <span className="emoji-list">{pd.emoji_usage?.favorites?.join(' ')}</span>
                        </div>
                    )}
                    {pd.emoji_usage?.patterns && (
                        <div className="subsection">
                            <h4>Emoji Patterns</h4>
                            <div className="section-grid">
                                <InfoItem label="For Laughing" value={pd.emoji_usage.patterns.laughing} />
                                <InfoItem label="For Affection" value={pd.emoji_usage.patterns.affection} />
                                <InfoItem label="For Emphasis" value={pd.emoji_usage.patterns.emphasis} />
                            </div>
                        </div>
                    )}
                </Section>

                {/* Vocabulary Patterns */}
                <Section title="Vocabulary Patterns" icon={<Hash size={20} />} delay={0.35}>
                    <TagList label="Frequent Words" tags={pd.vocabulary?.frequent_words} variant="primary" />
                    <TagList label="Filler Words" tags={pd.vocabulary?.filler_words} />
                    <TagList label="Intensifiers" tags={pd.vocabulary?.intensifiers} variant="accent" />
                    <TagList label="Unique Expressions" tags={pd.vocabulary?.unique_expressions} variant="special" />
                </Section>

                {/* Greetings & Closings */}
                <Section title="Greetings & Closings" icon={<Send size={20} />} delay={0.4}>
                    <TagList label="Opening Lines" tags={pd.greetings?.openers} variant="primary" />
                    <TagList label="Closing Lines" tags={pd.greetings?.closers} />
                    {pd.greetings?.time_based && (
                        <div className="subsection">
                            <h4>Time-Based Greetings</h4>
                            <div className="section-grid">
                                <InfoItem label="Morning" value={pd.greetings.time_based.morning} />
                                <InfoItem label="Evening" value={pd.greetings.time_based.evening} />
                            </div>
                        </div>
                    )}
                </Section>

                {/* Message Patterns */}
                <Section title="Message Patterns" icon={<MessageCircle size={20} />} delay={0.45}>
                    <div className="section-grid">
                        <InfoItem label="Average Length" value={pd.message_patterns?.average_length} highlight />
                        <InfoItem label="Length Range" value={pd.message_patterns?.length_range} />
                    </div>
                    {pd.message_patterns?.sentence_structure && (
                        <div className="section-note">
                            <strong>Sentence Structure:</strong> {pd.message_patterns.sentence_structure}
                        </div>
                    )}
                    {pd.message_patterns?.punctuation && (
                        <div className="section-note">
                            <strong>Punctuation:</strong> {pd.message_patterns.punctuation}
                        </div>
                    )}
                    {pd.message_patterns?.capitalization && (
                        <div className="section-note">
                            <strong>Capitalization:</strong> {pd.message_patterns.capitalization}
                        </div>
                    )}
                </Section>

                {/* Response Patterns */}
                {pd.response_patterns && (
                    <Section title="Response Patterns" icon={<MessageSquare size={20} />} delay={0.5}>
                        <TagList label="Acknowledgments" tags={pd.response_patterns.acknowledgments} />
                        <TagList label="Agreements" tags={pd.response_patterns.agreements} variant="primary" />
                        <TagList label="Disagreements" tags={pd.response_patterns.disagreements} variant="accent" />
                    </Section>
                )}

                {/* Voice Patterns */}
                {pd.voice_patterns && (
                    <Section title="Voice Message Patterns" icon={<Volume2 size={20} />} delay={0.55}>
                        <div className="section-grid">
                            <InfoItem label="Uses Voice Messages" value={pd.voice_patterns.uses_voice_messages ? 'Yes' : 'No'} />
                            <InfoItem label="Voice Frequency" value={pd.voice_patterns.voice_frequency} highlight />
                        </div>
                        {pd.voice_patterns.voice_characteristics && (
                            <div className="section-note">
                                <strong>Characteristics:</strong> {pd.voice_patterns.voice_characteristics}
                            </div>
                        )}
                        {pd.voice_patterns.typical_voice_content && (
                            <div className="section-note">
                                <strong>Typical Content:</strong> {pd.voice_patterns.typical_voice_content}
                            </div>
                        )}
                    </Section>
                )}

                {/* Media Sharing */}
                {pd.media_sharing && (
                    <Section title="Media Sharing Habits" icon={<Image size={20} />} delay={0.6}>
                        <div className="section-grid">
                            <InfoItem label="Shares Images" value={pd.media_sharing.shares_images ? 'Yes' : 'No'} />
                            <InfoItem label="Shares Videos" value={pd.media_sharing.shares_videos ? 'Yes' : 'No'} />
                            <InfoItem label="Shares Documents" value={pd.media_sharing.shares_documents ? 'Yes' : 'No'} />
                            <InfoItem label="Media with Captions" value={pd.media_sharing.media_with_captions} />
                        </div>
                        <TagList label="Image Types" tags={pd.media_sharing.image_types} />
                    </Section>
                )}

                {/* Abbreviations */}
                {pd.abbreviations && (Object.keys(pd.abbreviations.common || {}).length > 0 || Object.keys(pd.abbreviations.contact_specific || {}).length > 0) && (
                    <Section title="Abbreviations" icon={<Type size={20} />} delay={0.65}>
                        {pd.abbreviations.common && Object.keys(pd.abbreviations.common).length > 0 && (
                            <div className="abbrev-list">
                                <h4>Common</h4>
                                <div className="abbrev-items">
                                    {Object.entries(pd.abbreviations.common).map(([abbr, meaning]) => (
                                        <div key={abbr} className="abbrev-item">
                                            <span className="abbrev-key">{abbr}</span>
                                            <span className="abbrev-arrow">=</span>
                                            <span className="abbrev-value">{meaning as string}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {pd.abbreviations.contact_specific && Object.keys(pd.abbreviations.contact_specific).length > 0 && (
                            <div className="abbrev-list">
                                <h4>Contact-Specific</h4>
                                <div className="abbrev-items">
                                    {Object.entries(pd.abbreviations.contact_specific).map(([abbr, meaning]) => (
                                        <div key={abbr} className="abbrev-item">
                                            <span className="abbrev-key">{abbr}</span>
                                            <span className="abbrev-arrow">=</span>
                                            <span className="abbrev-value">{meaning as string}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Section>
                )}

                {/* Topic Variations */}
                {pd.topic_variations && (
                    <Section title="Topic Variations" icon={<Users size={20} />} delay={0.7}>
                        {pd.topic_variations.work && (
                            <div className="topic-item">
                                <h4>Work Topics</h4>
                                <div className="section-grid">
                                    <InfoItem label="Tone" value={pd.topic_variations.work.tone} />
                                    <InfoItem label="Language" value={pd.topic_variations.work.language} />
                                </div>
                            </div>
                        )}
                        {pd.topic_variations.personal && (
                            <div className="topic-item">
                                <h4>Personal Topics</h4>
                                <div className="section-grid">
                                    <InfoItem label="Tone" value={pd.topic_variations.personal.tone} />
                                    <InfoItem label="Language" value={pd.topic_variations.personal.language} />
                                </div>
                            </div>
                        )}
                        {pd.topic_variations.serious && (
                            <div className="topic-item">
                                <h4>Serious Topics</h4>
                                <div className="section-grid">
                                    <InfoItem label="Tone" value={pd.topic_variations.serious.tone} />
                                    <InfoItem label="Language" value={pd.topic_variations.serious.language} />
                                </div>
                            </div>
                        )}
                    </Section>
                )}

                {/* Relationship Metadata */}
                {pd.metadata && (
                    <Section title="Relationship Context" icon={<Heart size={20} />} delay={0.75}>
                        <div className="section-grid">
                            <InfoItem label="Relationship Type" value={pd.metadata.relationship_type} highlight />
                            <InfoItem label="Interaction Frequency" value={pd.metadata.interaction_frequency} />
                        </div>
                        <TagList label="Typical Topics" tags={pd.metadata.typical_topics} variant="primary" />
                    </Section>
                )}

                {/* Example Messages */}
                {(pd.example_messages?.length ?? 0) > 0 && (
                    <Section title="Example Messages" icon={<Quote size={20} />} delay={0.8}>
                        <div className="examples-list">
                            {pd.example_messages?.slice(0, 10).map((ex, idx: number) => (
                                <div key={idx} className="example-item">
                                    <div className="example-meta">
                                        <span className="example-context">{ex.context}</span>
                                        <span className={`example-type type-${ex.type}`}>{ex.type}</span>
                                    </div>
                                    <div className="example-message">{ex.message}</div>
                                </div>
                            ))}
                        </div>
                    </Section>
                )}
            </div>
        </div>
    );
};

// Helper Components
interface SectionProps {
    title: string;
    icon: React.ReactNode;
    delay?: number;
    children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, icon, delay = 0, children }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
    >
        <GlassCard className="profile-section">
            <div className="section-header">
                {icon}
                <h3>{title}</h3>
            </div>
            <div className="section-content">
                {children}
            </div>
        </GlassCard>
    </motion.div>
);

interface InfoItemProps {
    label: string;
    value?: string | number | null;
    highlight?: boolean;
}

const InfoItem: React.FC<InfoItemProps> = ({ label, value, highlight }) => {
    if (!value && value !== 0) return null;
    return (
        <div className={`info-item ${highlight ? 'highlight' : ''}`}>
            <span className="info-label">{label}</span>
            <span className="info-value">{value}</span>
        </div>
    );
};

interface TagListProps {
    label: string;
    tags?: string[];
    variant?: 'default' | 'primary' | 'accent' | 'special';
}

const TagList: React.FC<TagListProps> = ({ label, tags, variant = 'default' }) => {
    if (!tags || tags.length === 0) return null;
    return (
        <div className="tag-list-container">
            <span className="tag-list-label">{label}:</span>
            <div className="tag-list">
                {tags.map((tag, idx) => (
                    <span key={idx} className={`tag tag-${variant}`}>{tag}</span>
                ))}
            </div>
        </div>
    );
};

export default StyleProfileDetailPage;
