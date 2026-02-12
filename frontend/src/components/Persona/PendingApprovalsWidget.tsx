import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, X, Clock, ChevronRight, Edit3, MessageSquare } from 'lucide-react';
import { GlassCard } from '../Shared/GlassCard';
import { Button } from '../Shared/Button';
import { Modal } from '../Shared/Modal';
import { ContactAvatar } from '../Shared/ContactAvatar';
import { ConfidenceBadge } from '../Shared/ConfidenceBadge';
import { usePendingApprovals } from '../../hooks/usePendingApprovals';
import { formatTimeRemaining } from '../../utils/api';
import type { PendingApproval } from '../../types/persona';
import './PendingApprovalsWidget.css';

interface PendingApprovalsWidgetProps {
    onNavigateToHistory?: () => void;
}

export const PendingApprovalsWidget: React.FC<PendingApprovalsWidgetProps> = ({
    onNavigateToHistory
}) => {
    const { approvals, count, isLoading, approve, reject } = usePendingApprovals();
    const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
    const [customResponse, setCustomResponse] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleApprove = async (id: string, custom?: string) => {
        setIsProcessing(true);
        try {
            await approve(id, custom);
            setSelectedApproval(null);
            setCustomResponse('');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async (id: string) => {
        setIsProcessing(true);
        try {
            await reject(id);
            setSelectedApproval(null);
        } finally {
            setIsProcessing(false);
        }
    };

    if (isLoading && count === 0) {
        return null; // Don't show widget while loading with no data
    }

    if (count === 0) {
        return null; // Don't show widget if no pending approvals
    }

    return (
        <>
            <GlassCard className="pending-approvals-widget">
                <div className="widget-header">
                    <div className="widget-title">
                        <Bell size={20} className="widget-icon pulse" />
                        <span>Pending Approvals</span>
                        <span className="widget-count">{count}</span>
                    </div>
                    {onNavigateToHistory && (
                        <Button
                            variant="ghost"
                            onClick={onNavigateToHistory}
                            style={{ padding: '0.5rem' }}
                        >
                            <ChevronRight size={18} />
                        </Button>
                    )}
                </div>

                <div className="approvals-list">
                    <AnimatePresence>
                        {approvals.slice(0, 3).map(approval => (
                            <ApprovalCard
                                key={approval.id}
                                approval={approval}
                                onApprove={() => handleApprove(approval.id)}
                                onReject={() => handleReject(approval.id)}
                                onEdit={() => {
                                    setSelectedApproval(approval);
                                    setCustomResponse(approval.generatedResponse);
                                }}
                            />
                        ))}
                    </AnimatePresence>
                </div>

                {count > 3 && (
                    <div className="widget-footer">
                        <span>+{count - 3} more pending</span>
                    </div>
                )}
            </GlassCard>

            {/* Edit & Approve Modal */}
            <Modal
                isOpen={!!selectedApproval}
                onClose={() => {
                    setSelectedApproval(null);
                    setCustomResponse('');
                }}
                title="Review Response"
                size="md"
                footer={
                    <>
                        <Button
                            variant="danger"
                            onClick={() => selectedApproval && handleReject(selectedApproval.id)}
                            disabled={isProcessing}
                            icon={<X size={16} />}
                        >
                            Reject
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => selectedApproval && handleApprove(
                                selectedApproval.id,
                                customResponse !== selectedApproval.generatedResponse ? customResponse : undefined
                            )}
                            isLoading={isProcessing}
                            icon={<Check size={16} />}
                        >
                            Send
                        </Button>
                    </>
                }
            >
                {selectedApproval && (
                    <div className="approval-edit">
                        <div className="approval-edit__header">
                            <ContactAvatar
                                name={selectedApproval.contactName}
                                jid={selectedApproval.chatJid}
                                size="md"
                            />
                            <div>
                                <h4>{selectedApproval.contactName}</h4>
                                <div className="approval-edit__meta">
                                    <ConfidenceBadge score={selectedApproval.confidenceScore} size="sm" />
                                    <span className="time-remaining">
                                        <Clock size={12} />
                                        {formatTimeRemaining(selectedApproval.timeRemainingSeconds)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="approval-edit__incoming">
                            <label>Incoming Message</label>
                            <p>{selectedApproval.incomingMessage}</p>
                        </div>

                        <div className="approval-edit__response">
                            <label>Response</label>
                            <textarea
                                value={customResponse}
                                onChange={(e) => setCustomResponse(e.target.value)}
                                rows={4}
                            />
                        </div>

                        {selectedApproval.reasonForReview && (
                            <div className="approval-edit__reason">
                                <span>Review reason:</span>
                                {selectedApproval.reasonForReview}
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </>
    );
};

// Approval Card Component
interface ApprovalCardProps {
    approval: PendingApproval;
    onApprove: () => void;
    onReject: () => void;
    onEdit: () => void;
}

const ApprovalCard: React.FC<ApprovalCardProps> = ({
    approval,
    onApprove,
    onReject,
    onEdit
}) => {
    return (
        <motion.div
            className="approval-card"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            layout
        >
            <div className="approval-card__left">
                <ContactAvatar name={approval.contactName} jid={approval.chatJid} size="sm" />
                <div className="approval-card__content">
                    <div className="approval-card__header">
                        <span className="approval-card__name">{approval.contactName}</span>
                        <span className="approval-card__timer">
                            <Clock size={12} />
                            {formatTimeRemaining(approval.timeRemainingSeconds)}
                        </span>
                    </div>
                    <div className="approval-card__messages">
                        <div className="approval-message incoming">
                            <MessageSquare size={12} />
                            <span>{approval.incomingMessage}</span>
                        </div>
                        <div className="approval-message outgoing">
                            <span className="arrow">→</span>
                            <span>{approval.generatedResponse}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="approval-card__actions">
                <ConfidenceBadge score={approval.confidenceScore} size="sm" />
                <div className="action-buttons">
                    <button className="action-btn reject" onClick={onReject} title="Reject">
                        <X size={16} />
                    </button>
                    <button className="action-btn edit" onClick={onEdit} title="Edit">
                        <Edit3 size={16} />
                    </button>
                    <button className="action-btn approve" onClick={onApprove} title="Approve">
                        <Check size={16} />
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

export default PendingApprovalsWidget;
