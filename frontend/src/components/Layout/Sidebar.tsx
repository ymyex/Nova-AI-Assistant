import React from 'react';
import { LayoutDashboard, Settings, MessageSquare, Terminal, PanelLeftClose, PanelLeft } from 'lucide-react';
import { ConversationList } from '../Chat/ConversationList';
import type { ConversationListItem } from '../../types/chat';
import './Sidebar.css';

interface SidebarProps {
    activeTab: 'dashboard' | 'setup' | 'chat';
    setActiveTab: (tab: 'dashboard' | 'setup' | 'chat') => void;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
    conversations?: ConversationListItem[];
    activeConversationId?: string | null;
    onSelectConversation?: (id: string) => void;
    onNewChat?: () => void;
    onDeleteChat?: (id: string) => void;
    onRenameChat?: (id: string, title: string) => void;
    onDeleteAllChats?: () => void;
    isLoadingConversations?: boolean;
    pendingNewChat?: boolean;
    hasActiveMessages?: boolean;
}

const navItems = [
    { id: 'dashboard', label: 'Monitor', icon: LayoutDashboard },
    { id: 'chat', label: 'Neural Link', icon: MessageSquare },
    { id: 'setup', label: 'Configuration', icon: Settings },
] as const;

export const Sidebar: React.FC<SidebarProps> = ({
    activeTab,
    setActiveTab,
    isCollapsed = false,
    onToggleCollapse,
    conversations = [],
    activeConversationId = null,
    onSelectConversation,
    onNewChat,
    onDeleteChat,
    onRenameChat,
    onDeleteAllChats,
    isLoadingConversations = false,
    pendingNewChat = false,
    hasActiveMessages = false
}) => {
    // Only show conversations section when expanded AND on chat tab
    const showConversations = activeTab === 'chat' && !isCollapsed;

    return (
        <aside className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''}`}>
            {/* Header with Logo and Toggle */}
            <div className="sidebar__header">
                <div className="sidebar__logo">
                    <div className="sidebar__logo-icon">
                        <div className="sidebar__logo-glow" />
                        <img src="./logo.png" alt="Nova" />
                    </div>
                    <div className="sidebar__logo-text">
                        <h1>NOVA</h1>
                        <p>System</p>
                    </div>
                </div>
                <button
                    className="sidebar__toggle"
                    onClick={onToggleCollapse}
                    aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {isCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
                </button>
            </div>

            {/* Navigation */}
            <nav className="sidebar__nav">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <div key={item.id} className="sidebar__nav-item-wrapper">
                            <button
                                className={`sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`}
                                onClick={() => setActiveTab(item.id as 'dashboard' | 'setup' | 'chat')}
                            >
                                {isActive && <div className="sidebar__nav-indicator" />}
                                <Icon size={20} className="sidebar__nav-icon" />
                                <span className="sidebar__nav-label">{item.label}</span>
                            </button>
                            <div className="sidebar__tooltip">{item.label}</div>
                        </div>
                    );
                })}
            </nav>

            {/* Conversation List - Only when expanded and on chat tab */}
            {showConversations && (
                <div className="sidebar__conversations">
                    <ConversationList
                        conversations={conversations}
                        activeId={activeConversationId}
                        onSelect={onSelectConversation || (() => {})}
                        onNewChat={onNewChat || (() => {})}
                        onDelete={onDeleteChat || (() => {})}
                        onRename={onRenameChat || (() => {})}
                        onDeleteAll={onDeleteAllChats}
                        isLoading={isLoadingConversations}
                        hasMessages={hasActiveMessages}
                        isCollapsed={false}
                        pendingNewChat={pendingNewChat}
                    />
                </div>
            )}

            {/* Spacer */}
            <div className="sidebar__spacer" />

            {/* Status Footer */}
            <div className="sidebar__footer">
                <div className="sidebar__status">
                    <div className="sidebar__status-indicator">
                        <span className="sidebar__status-dot" />
                        <span className="sidebar__status-pulse" />
                    </div>
                    <div className="sidebar__status-content">
                        <span className="sidebar__status-text">ONLINE</span>
                        <div className="sidebar__connection">
                            <Terminal size={11} />
                            <span>Connected to Core</span>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
};
