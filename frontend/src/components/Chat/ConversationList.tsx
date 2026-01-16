import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MessageSquare, Trash2, Edit3, MoreHorizontal, X, Check, Clock } from 'lucide-react';
import type { ConversationListItem } from '../../types/chat';
import './ConversationList.css';

interface ConversationListProps {
    conversations: ConversationListItem[];
    activeId: string | null;
    onSelect: (id: string) => void;
    onNewChat: () => void;
    onDelete: (id: string) => void;
    onRename: (id: string, title: string) => void;
    onDeleteAll?: () => void;
    isLoading?: boolean;
    hasMessages?: boolean;
    isCollapsed?: boolean;
    pendingNewChat?: boolean;
}

export function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const ConversationList: React.FC<ConversationListProps> = ({
    conversations,
    activeId,
    onSelect,
    onNewChat,
    onDelete,
    onDeleteAll,
    onRename,
    isLoading = false,
    hasMessages = true,
    pendingNewChat = false
}) => {
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const editInputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpenId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (editingId && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingId]);

    const handleMenuToggle = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setMenuOpenId(menuOpenId === id ? null : id);
    };

    const handleStartEdit = (conversation: ConversationListItem) => {
        setEditingId(conversation.id);
        setEditTitle(conversation.title);
        setMenuOpenId(null);
    };

    const handleSaveEdit = () => {
        if (editingId && editTitle.trim()) {
            onRename(editingId, editTitle.trim());
        }
        setEditingId(null);
        setEditTitle('');
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditTitle('');
    };

    const handleDelete = (id: string) => {
        if (confirm('Delete this conversation? This cannot be undone.')) {
            onDelete(id);
        }
        setMenuOpenId(null);
    };

    const handleNewChat = () => {
        if (!hasMessages && activeId && !pendingNewChat) {
            return;
        }
        onNewChat();
    };

    const newChatDisabled = !hasMessages && activeId !== null && !pendingNewChat;

    return (
        <div className="conv-list">
            {/* New Chat Button */}
            <div className="conv-list__header">
                <button
                    className={`conv-list__new-btn ${newChatDisabled ? 'conv-list__new-btn--disabled' : ''}`}
                    onClick={handleNewChat}
                    disabled={newChatDisabled}
                >
                    <Plus size={16} strokeWidth={2.5} />
                    <span>New Chat</span>
                </button>
            </div>

            {/* Conversation List */}
            <div className="conv-list__items custom-scrollbar">
                {isLoading ? (
                    <div className="conv-list__loading">
                        <div className="conv-list__spinner" />
                        <span>Loading...</span>
                    </div>
                ) : conversations.length === 0 ? (
                    <div className="conv-list__empty">
                        <div className="conv-list__empty-icon">
                            <MessageSquare size={20} />
                        </div>
                        <p className="conv-list__empty-title">No conversations</p>
                        <p className="conv-list__empty-subtitle">Start a new chat to begin</p>
                    </div>
                ) : (
                    <div className="conv-list__group">
                        {conversations.map((conv) => {
                            const isActive = conv.id === activeId;
                            const isEditing = conv.id === editingId;
                            const isMenuOpen = conv.id === menuOpenId;

                            return (
                                <motion.div
                                    key={conv.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`conv-list__item ${isActive ? 'conv-list__item--active' : ''}`}
                                    onClick={() => !isEditing && onSelect(conv.id)}
                                >
                                    {isActive && (
                                        <div className="conv-list__item-indicator" />
                                    )}

                                    {isEditing ? (
                                        <div className="conv-list__edit-row">
                                            <input
                                                ref={editInputRef}
                                                type="text"
                                                className="conv-list__edit-input"
                                                value={editTitle}
                                                onChange={(e) => setEditTitle(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveEdit();
                                                    if (e.key === 'Escape') handleCancelEdit();
                                                }}
                                            />
                                            <button
                                                className="conv-list__edit-btn conv-list__edit-btn--save"
                                                onClick={(e) => { e.stopPropagation(); handleSaveEdit(); }}
                                            >
                                                <Check size={14} />
                                            </button>
                                            <button
                                                className="conv-list__edit-btn conv-list__edit-btn--cancel"
                                                onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="conv-list__item-content">
                                            <div className={`conv-list__item-avatar ${isActive ? 'conv-list__item-avatar--active' : ''}`}>
                                                <MessageSquare size={12} />
                                            </div>
                                            <div className="conv-list__item-info">
                                                <div className="conv-list__item-title">{conv.title}</div>
                                                <div className="conv-list__item-time">
                                                    <Clock size={9} />
                                                    {formatRelativeTime(conv.updated_at)}
                                                </div>
                                            </div>
                                            <div className="conv-list__menu-wrapper" ref={isMenuOpen ? menuRef : undefined}>
                                                <button
                                                    className={`conv-list__menu-btn ${isMenuOpen ? 'conv-list__menu-btn--open' : ''}`}
                                                    onClick={(e) => handleMenuToggle(e, conv.id)}
                                                >
                                                    <MoreHorizontal size={14} />
                                                </button>
                                                <AnimatePresence>
                                                    {isMenuOpen && (
                                                        <motion.div
                                                            className="conv-list__dropdown"
                                                            initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                                            exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                                            transition={{ duration: 0.1 }}
                                                        >
                                                            <button
                                                                className="conv-list__dropdown-item"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleStartEdit(conv);
                                                                }}
                                                            >
                                                                <Edit3 size={12} />
                                                                Rename
                                                            </button>
                                                            <div className="conv-list__dropdown-divider" />
                                                            <button
                                                                className="conv-list__dropdown-item conv-list__dropdown-item--danger"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDelete(conv.id);
                                                                }}
                                                            >
                                                                <Trash2 size={12} />
                                                                Delete
                                                            </button>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Clear History Button */}
            {conversations.length > 0 && (
                <div className="conv-list__footer">
                    <button
                        className="conv-list__clear-btn"
                        onClick={() => {
                            if (confirm('Are you sure you want to delete ALL chat history? This cannot be undone.')) {
                                onDeleteAll?.();
                            }
                        }}
                    >
                        <Trash2 size={12} />
                        <span>Clear History</span>
                    </button>
                </div>
            )}
        </div>
    );
};
