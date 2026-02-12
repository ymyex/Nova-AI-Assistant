import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, Filter, RefreshCw, AlertCircle, ChevronRight, MessageSquare, Clock, CheckCircle, XCircle } from 'lucide-react';
import { GlassCard } from '../Shared/GlassCard';
import { Button } from '../Shared/Button';
import { Modal } from '../Shared/Modal';
import { ContactAvatar } from '../Shared/ContactAvatar';
import { StatusBadge } from '../Shared/StatusBadge';
import { ConfidenceBadge } from '../Shared/ConfidenceBadge';
import { usePersonaApi } from '../../hooks/usePersonaApi';
import { formatDate } from '../../utils/api';
import type { ResponseLogEntry, ResponseHistoryFilters, ResponseStatus } from '../../types/persona';
import './ResponseHistoryPage.css';

export const ResponseHistoryPage: React.FC = () => {
    const [responses, setResponses] = useState<ResponseLogEntry[]>([]);
    const [filters, setFilters] = useState<ResponseHistoryFilters>({ limit: 50 });
    const [total, setTotal] = useState(0);
    const [selectedResponse, setSelectedResponse] = useState<ResponseLogEntry | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    const api = usePersonaApi();
    // Use ref to avoid infinite loop - api object changes on every render
    const apiRef = useRef(api);
    apiRef.current = api;

    // Load responses
    const loadResponses = useCallback(async () => {
        try {
            const response = await apiRef.current.fetchResponseHistory(filters);
            setResponses(response.responses);
            setTotal(response.total);
        } catch {
            // Error handled by hook
        }
    }, [filters]);

    useEffect(() => {
        loadResponses();
    }, [loadResponses]);

    const handleFilterChange = (key: keyof ResponseHistoryFilters, value: string | undefined) => {
        setFilters(prev => ({
            ...prev,
            [key]: value || undefined,
            offset: 0 // Reset pagination on filter change
        }));
    };

    const handleLoadMore = () => {
        setFilters(prev => ({
            ...prev,
            offset: (prev.offset || 0) + (prev.limit || 50)
        }));
    };

    const statusOptions: { value: ResponseStatus | ''; label: string }[] = [
        { value: '', label: 'All Statuses' },
        { value: 'sent', label: 'Sent' },
        { value: 'pending', label: 'Pending' },
        { value: 'rejected', label: 'Rejected' },
        { value: 'expired', label: 'Expired' },
    ];

    return (
        <div className="persona-page response-history-page">
            {/* Header */}
            <header className="persona-page__header">
                <div className="persona-page__title">
                    <History size={28} className="persona-page__icon" />
                    <div>
                        <h2 className="text-gradient">Response History</h2>
                        <p>View and analyze past auto-generated responses</p>
                    </div>
                </div>
                <div className="persona-page__actions">
                    <Button
                        variant="secondary"
                        icon={<Filter size={18} />}
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        Filters
                    </Button>
                    <Button
                        variant="ghost"
                        icon={<RefreshCw size={18} />}
                        onClick={loadResponses}
                        disabled={api.isLoading}
                    >
                        Refresh
                    </Button>
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

            {/* Filters Panel */}
            <AnimatePresence>
                {showFilters && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="filters-panel"
                    >
                        <GlassCard className="filters-card">
                            <div className="filters-grid">
                                <div className="filter-group">
                                    <label>Status</label>
                                    <select
                                        value={filters.status || ''}
                                        onChange={(e) => handleFilterChange('status', e.target.value as ResponseStatus || undefined)}
                                        className="filter-select"
                                    >
                                        {statusOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="filter-group">
                                    <label>From Date</label>
                                    <input
                                        type="date"
                                        value={filters.fromDate || ''}
                                        onChange={(e) => handleFilterChange('fromDate', e.target.value)}
                                        className="filter-input"
                                    />
                                </div>
                                <div className="filter-group">
                                    <label>To Date</label>
                                    <input
                                        type="date"
                                        value={filters.toDate || ''}
                                        onChange={(e) => handleFilterChange('toDate', e.target.value)}
                                        className="filter-input"
                                    />
                                </div>
                            </div>
                            <div className="filters-actions">
                                <Button
                                    variant="ghost"
                                    onClick={() => setFilters({ limit: 50 })}
                                >
                                    Clear Filters
                                </Button>
                            </div>
                        </GlassCard>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Stats Summary */}
            <div className="history-stats">
                <div className="stat-card">
                    <MessageSquare size={18} />
                    <span className="stat-value">{total}</span>
                    <span className="stat-label">Total</span>
                </div>
                <div className="stat-card sent">
                    <CheckCircle size={18} />
                    <span className="stat-value">{responses.filter(r => r.status === 'sent').length}</span>
                    <span className="stat-label">Sent</span>
                </div>
                <div className="stat-card pending">
                    <Clock size={18} />
                    <span className="stat-value">{responses.filter(r => r.status === 'pending').length}</span>
                    <span className="stat-label">Pending</span>
                </div>
                <div className="stat-card rejected">
                    <XCircle size={18} />
                    <span className="stat-value">{responses.filter(r => r.status === 'rejected').length}</span>
                    <span className="stat-label">Rejected</span>
                </div>
            </div>

            {/* Responses List */}
            <div className="responses-list">
                {api.isLoading && responses.length === 0 ? (
                    <div className="responses-loading">
                        <RefreshCw size={24} className="animate-spin" />
                        <span>Loading history...</span>
                    </div>
                ) : responses.length === 0 ? (
                    <div className="responses-empty">
                        <History size={48} />
                        <h3>No Response History</h3>
                        <p>Auto-generated responses will appear here</p>
                    </div>
                ) : (
                    <>
                        {responses.map(response => (
                            <ResponseCard
                                key={response.id}
                                response={response}
                                onSelect={() => setSelectedResponse(response)}
                            />
                        ))}
                        {responses.length < total && (
                            <div className="load-more">
                                <Button
                                    variant="secondary"
                                    onClick={handleLoadMore}
                                    isLoading={api.isLoading}
                                >
                                    Load More ({responses.length} of {total})
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Response Detail Modal */}
            <Modal
                isOpen={!!selectedResponse}
                onClose={() => setSelectedResponse(null)}
                title="Response Details"
                size="lg"
            >
                {selectedResponse && (
                    <ResponseDetail response={selectedResponse} />
                )}
            </Modal>
        </div>
    );
};

// Response Card Component
interface ResponseCardProps {
    response: ResponseLogEntry;
    onSelect: () => void;
}

const ResponseCard: React.FC<ResponseCardProps> = ({ response, onSelect }) => {
    return (
        <motion.div
            className="response-card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onSelect}
        >
            <ContactAvatar name={response.contactName} jid={response.chatJid} size="sm" />
            <div className="response-card__content">
                <div className="response-card__header">
                    <span className="response-card__name">{response.contactName}</span>
                    <span className="response-card__time">{formatDate(response.createdAt)}</span>
                </div>
                <div className="response-card__messages">
                    <div className="message incoming">
                        <span className="message-label">In:</span>
                        <span className="message-text">{response.incomingMessage}</span>
                    </div>
                    <div className="message outgoing">
                        <span className="message-label">Out:</span>
                        <span className="message-text">{response.generatedResponse}</span>
                    </div>
                </div>
            </div>
            <div className="response-card__meta">
                <StatusBadge status={response.status} />
                <ConfidenceBadge score={response.confidenceScore} size="sm" />
            </div>
            <ChevronRight size={18} className="response-card__chevron" />
        </motion.div>
    );
};

// Response Detail Component
interface ResponseDetailProps {
    response: ResponseLogEntry;
}

const ResponseDetail: React.FC<ResponseDetailProps> = ({ response }) => {
    return (
        <div className="response-detail">
            <div className="response-detail__header">
                <ContactAvatar name={response.contactName} jid={response.chatJid} size="lg" />
                <div>
                    <h3>{response.contactName}</h3>
                    <p>{response.chatJid}</p>
                    <span className="response-detail__time">{formatDate(response.createdAt)}</span>
                </div>
                <div className="response-detail__badges">
                    <StatusBadge status={response.status} size="lg" />
                    <ConfidenceBadge score={response.confidenceScore} showLabel size="md" />
                </div>
            </div>

            <div className="response-detail__messages">
                <div className="detail-message incoming">
                    <h4>Incoming Message</h4>
                    <p>{response.incomingMessage}</p>
                </div>
                <div className="detail-message outgoing">
                    <h4>Generated Response</h4>
                    <p>{response.generatedResponse}</p>
                </div>
                {response.finalResponse && response.finalResponse !== response.generatedResponse && (
                    <div className="detail-message final">
                        <h4>Final Response (Modified)</h4>
                        <p>{response.finalResponse}</p>
                    </div>
                )}
            </div>

            <div className="response-detail__info">
                <div className="info-row">
                    <span className="info-label">Action</span>
                    <span className="info-value capitalize">{(response.action ?? 'sent_auto').replace('_', ' ')}</span>
                </div>
                {response.responseTimeMs && (
                    <div className="info-row">
                        <span className="info-label">Response Time</span>
                        <span className="info-value">{response.responseTimeMs}ms</span>
                    </div>
                )}
                {response.sentAt && (
                    <div className="info-row">
                        <span className="info-label">Sent At</span>
                        <span className="info-value">{new Date(response.sentAt).toLocaleString()}</span>
                    </div>
                )}
                {(response.categoriesUsed?.length ?? 0) > 0 && (
                    <div className="info-row">
                        <span className="info-label">Categories Used</span>
                        <div className="info-tags">
                            {(response.categoriesUsed ?? []).map((cat, i) => (
                                <span key={i} className="category-tag">{cat}</span>
                            ))}
                        </div>
                    </div>
                )}
                {(response.confidenceReasons?.length ?? 0) > 0 && (
                    <div className="info-row">
                        <span className="info-label">Confidence Factors</span>
                        <ul className="confidence-reasons">
                            {(response.confidenceReasons ?? []).map((reason, i) => (
                                <li key={i}>{reason}</li>
                            ))}
                        </ul>
                    </div>
                )}
                {response.decisionReasoning && (
                    <div className="info-row">
                        <span className="info-label">Decision Reasoning</span>
                        <p className="info-text">{response.decisionReasoning}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResponseHistoryPage;
