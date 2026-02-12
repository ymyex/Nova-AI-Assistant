import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Plus, Folder, Trash2, Edit3, Tag, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../Shared/Button';
import { SearchInput } from '../Shared/SearchInput';
import { Modal } from '../Shared/Modal';
import { CategoryTag } from '../Shared/CategoryTag';
import { usePersonaApi } from '../../hooks/usePersonaApi';
import type { PersonalInfo, Category } from '../../types/persona';
import './PersonalInfoPage.css';

export const PersonalInfoPage: React.FC = () => {
    const [entries, setEntries] = useState<PersonalInfo[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingEntry, setEditingEntry] = useState<PersonalInfo | null>(null);
    const [newInfoText, setNewInfoText] = useState('');

    const api = usePersonaApi();
    // Use ref to avoid infinite loop - api object changes on every render
    const apiRef = useRef(api);
    apiRef.current = api;

    // Load categories on mount
    const loadCategories = useCallback(async () => {
        try {
            const response = await apiRef.current.fetchCategories();
            setCategories(response.categories);
        } catch {
            // Error handled by hook
        }
    }, []);

    // Load entries based on selected category and search
    const loadEntries = useCallback(async () => {
        try {
            if (searchQuery) {
                const response = await apiRef.current.searchPersonalInfo(searchQuery);
                setEntries(response.results);
            } else {
                const response = await apiRef.current.fetchPersonalInfo(selectedCategory || undefined);
                setEntries(response.items);
            }
        } catch {
            // Error handled by hook
        }
    }, [selectedCategory, searchQuery]);

    useEffect(() => {
        loadCategories();
    }, [loadCategories]);

    useEffect(() => {
        loadEntries();
    }, [loadEntries]);

    const handleAddInfo = async () => {
        if (!newInfoText.trim()) return;
        try {
            const newEntry = await apiRef.current.addPersonalInfo(newInfoText.trim());
            setEntries(prev => [newEntry, ...prev]);
            setNewInfoText('');
            setShowAddModal(false);
            loadCategories(); // Refresh category counts
        } catch {
            // Error handled by hook
        }
    };

    const handleDeleteEntry = async (id: string) => {
        try {
            await apiRef.current.deletePersonalInfo(id);
            setEntries(prev => prev.filter(e => e.id !== id));
            loadCategories(); // Refresh category counts
        } catch {
            // Error handled by hook
        }
    };

    const handleUpdateEntry = async () => {
        if (!editingEntry) return;
        try {
            const updated = await apiRef.current.updatePersonalInfo(editingEntry.id, {
                content: editingEntry.content,
                category: editingEntry.category,
            });
            setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
            setEditingEntry(null);
        } catch {
            // Error handled by hook
        }
    };

    // Get category info by name
    const getCategoryInfo = (name: string): Category | undefined => {
        return categories.find(c => c.name === name);
    };

    return (
        <div className="persona-page personal-info-page">
            {/* Header */}
            <header className="persona-page__header">
                <div className="persona-page__title">
                    <FileText size={28} className="persona-page__icon" />
                    <div>
                        <h2 className="text-gradient">Personal Information</h2>
                        <p>Manage information used for generating responses</p>
                    </div>
                </div>
                <div className="persona-page__actions">
                    <Button
                        variant="primary"
                        icon={<Plus size={18} />}
                        onClick={() => setShowAddModal(true)}
                    >
                        Add Information
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

            <div className="personal-info-layout">
                {/* Categories Sidebar */}
                <aside className="categories-sidebar">
                    <h3>Categories</h3>
                    <nav className="categories-nav">
                        <button
                            className={`category-item ${!selectedCategory ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(null)}
                        >
                            <Folder size={16} />
                            <span>All Items</span>
                            <span className="category-count">
                                {(categories || []).reduce((sum, c) => sum + (c.itemCount || 0), 0)}
                            </span>
                        </button>
                        {categories.map(category => (
                            <button
                                key={category.id}
                                className={`category-item ${selectedCategory === category.name ? 'active' : ''} ${category.isSensitive ? 'sensitive' : ''}`}
                                onClick={() => setSelectedCategory(category.name)}
                            >
                                <Tag size={16} />
                                <span className="capitalize">{category.name}</span>
                                {category.isSensitive && <span className="sensitive-marker">*</span>}
                                <span className="category-count">{category.itemCount}</span>
                            </button>
                        ))}
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="info-content">
                    {/* Search Bar */}
                    <div className="info-toolbar">
                        <SearchInput
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Search information..."
                        />
                    </div>

                    {/* Entries List */}
                    <div className="info-list">
                        {api.isLoading && entries.length === 0 ? (
                            <div className="info-loading">
                                <RefreshCw size={24} className="animate-spin" />
                                <span>Loading information...</span>
                            </div>
                        ) : entries.length === 0 ? (
                            <div className="info-empty">
                                <FileText size={48} />
                                <h3>No Information Found</h3>
                                <p>
                                    {searchQuery
                                        ? 'No items match your search'
                                        : 'Add personal information to help generate better responses'
                                    }
                                </p>
                                {!searchQuery && (
                                    <Button
                                        variant="primary"
                                        icon={<Plus size={18} />}
                                        onClick={() => setShowAddModal(true)}
                                    >
                                        Add Information
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <AnimatePresence>
                                {entries.map(entry => (
                                    <InfoEntry
                                        key={entry.id}
                                        entry={entry}
                                        categoryInfo={getCategoryInfo(entry.category)}
                                        onEdit={() => setEditingEntry(entry)}
                                        onDelete={() => handleDeleteEntry(entry.id)}
                                    />
                                ))}
                            </AnimatePresence>
                        )}
                    </div>
                </main>
            </div>

            {/* Add Info Modal */}
            <Modal
                isOpen={showAddModal}
                onClose={() => {
                    setShowAddModal(false);
                    setNewInfoText('');
                }}
                title="Add Personal Information"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setShowAddModal(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleAddInfo}
                            disabled={!newInfoText.trim()}
                            isLoading={api.isLoading}
                        >
                            Add
                        </Button>
                    </>
                }
            >
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Enter any personal information in natural language. The system will
                    automatically categorize and extract key details.
                </p>
                <textarea
                    value={newInfoText}
                    onChange={(e) => setNewInfoText(e.target.value)}
                    placeholder="e.g., I work at Google as a software engineer"
                    className="info-textarea"
                    rows={4}
                    autoFocus
                />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                    Examples: job details, family members, schedule, preferences, etc.
                </p>
            </Modal>

            {/* Edit Info Modal */}
            <Modal
                isOpen={!!editingEntry}
                onClose={() => setEditingEntry(null)}
                title="Edit Information"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setEditingEntry(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleUpdateEntry}
                            isLoading={api.isLoading}
                        >
                            Save Changes
                        </Button>
                    </>
                }
            >
                {editingEntry && (
                    <>
                        <div className="edit-field">
                            <label>Content</label>
                            <textarea
                                value={editingEntry.content}
                                onChange={(e) => setEditingEntry({
                                    ...editingEntry,
                                    content: e.target.value
                                })}
                                className="info-textarea"
                                rows={3}
                            />
                        </div>
                        <div className="edit-field">
                            <label>Category</label>
                            <select
                                value={editingEntry.category}
                                onChange={(e) => setEditingEntry({
                                    ...editingEntry,
                                    category: e.target.value
                                })}
                                className="info-select"
                            >
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.name}>
                                        {cat.name} {cat.isSensitive ? '(Sensitive)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="edit-field">
                            <label>Keywords</label>
                            <div className="keywords-list">
                                {(editingEntry.keywords ?? []).map((kw, i) => (
                                    <span key={i} className="keyword-tag">{kw}</span>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </Modal>
        </div>
    );
};

// Info Entry Component
interface InfoEntryProps {
    entry: PersonalInfo;
    categoryInfo?: Category;
    onEdit: () => void;
    onDelete: () => void;
}

const InfoEntry: React.FC<InfoEntryProps> = ({ entry, categoryInfo, onEdit, onDelete }) => {
    return (
        <motion.div
            className="info-entry"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
        >
            <div className="info-entry__content">
                <p>{entry.content}</p>
                <div className="info-entry__meta">
                    <CategoryTag
                        name={entry.category}
                        isSensitive={categoryInfo?.isSensitive}
                        size="sm"
                    />
                    {entry.subcategory && (
                        <span className="info-entry__subcategory">{entry.subcategory}</span>
                    )}
                    <span className="info-entry__source">{entry.source}</span>
                </div>
            </div>
            <div className="info-entry__keywords">
                {(entry.keywords ?? []).slice(0, 3).map((kw, i) => (
                    <span key={i} className="keyword-tag">{kw}</span>
                ))}
                {(entry.keywords?.length ?? 0) > 3 && (
                    <span className="keyword-more">+{(entry.keywords?.length ?? 0) - 3}</span>
                )}
            </div>
            <div className="info-entry__actions">
                <button onClick={onEdit} title="Edit">
                    <Edit3 size={16} />
                </button>
                <button onClick={onDelete} title="Delete" className="delete">
                    <Trash2 size={16} />
                </button>
            </div>
        </motion.div>
    );
};

export default PersonalInfoPage;
