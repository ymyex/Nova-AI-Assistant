import React, { useState } from 'react';
import {
    LayoutDashboard,
    Settings,
    MessageSquare,
    Terminal,
    PanelLeftClose,
    PanelLeft,
    Bot,
    ChevronDown,
    ChevronRight,
    Users,
    FileText,
    Sliders,
    History,
    type LucideIcon
} from 'lucide-react';
import { ConversationList } from '../Chat/ConversationList';
import type { ConversationListItem } from '../../types/chat';
import './Sidebar.css';

// Define the tab type including persona sub-pages
export type TabId = 'dashboard' | 'setup' | 'chat' | 'persona-profiles' | 'persona-info' | 'persona-settings' | 'persona-history';

interface SidebarProps {
    activeTab: TabId;
    setActiveTab: (tab: TabId) => void;
    chatOnlyMode?: boolean;
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
    pendingApprovalsCount?: number;
}

interface NavItem {
    id: TabId;
    label: string;
    icon: LucideIcon;
}

interface NavGroupItem {
    id: string;
    label: string;
    icon: LucideIcon;
    children: NavItem[];
}

// Main navigation items
const mainNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Monitor', icon: LayoutDashboard },
    { id: 'chat', label: 'Neural Link', icon: MessageSquare },
];

// Persona Agent sub-navigation
const personaNavGroup: NavGroupItem = {
    id: 'persona',
    label: 'Persona Agent',
    icon: Bot,
    children: [
        { id: 'persona-profiles', label: 'Style Profiles', icon: Users },
        { id: 'persona-info', label: 'Personal Info', icon: FileText },
        { id: 'persona-settings', label: 'Auto-Response', icon: Sliders },
        { id: 'persona-history', label: 'History', icon: History },
    ]
};

// Configuration item (at the end)
const configNavItem: NavItem = { id: 'setup', label: 'Configuration', icon: Settings };

export const Sidebar: React.FC<SidebarProps> = ({
    activeTab,
    setActiveTab,
    chatOnlyMode = false,
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
    hasActiveMessages = false,
    pendingApprovalsCount = 0
}) => {
    // Track if persona section is expanded
    const [personaExpanded, setPersonaExpanded] = useState(() => {
        // Auto-expand if a persona tab is active
        return activeTab.startsWith('persona-');
    });

    // Only show conversations section when expanded AND on chat tab
    const showConversations = activeTab === 'chat' && !isCollapsed;

    // Check if any persona sub-page is active
    const isPersonaActive = activeTab.startsWith('persona-');

    // Render a single nav item
    const renderNavItem = (item: NavItem, isSubItem = false) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
            <div key={item.id} className="sidebar__nav-item-wrapper">
                <button
                    className={`sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''} ${isSubItem ? 'sidebar__nav-item--sub' : ''}`}
                    onClick={() => setActiveTab(item.id)}
                >
                    {isActive && <div className="sidebar__nav-indicator" />}
                    <Icon size={isSubItem ? 16 : 20} className="sidebar__nav-icon" />
                    <span className="sidebar__nav-label">{item.label}</span>
                </button>
                <div className="sidebar__tooltip">{item.label}</div>
            </div>
        );
    };

    // Render the persona nav group with expandable sub-nav
    const renderPersonaGroup = () => {
        const Icon = personaNavGroup.icon;
        const isExpanded = personaExpanded && !isCollapsed;

        return (
            <div className="sidebar__nav-group">
                <div className="sidebar__nav-item-wrapper">
                    <button
                        className={`sidebar__nav-item ${isPersonaActive ? 'sidebar__nav-item--active' : ''}`}
                        onClick={() => {
                            if (isCollapsed) {
                                // When collapsed, clicking should navigate to first sub-page
                                setActiveTab('persona-profiles');
                            } else {
                                setPersonaExpanded(!personaExpanded);
                            }
                        }}
                    >
                        {isPersonaActive && <div className="sidebar__nav-indicator" />}
                        <Icon size={20} className="sidebar__nav-icon" />
                        <span className="sidebar__nav-label">{personaNavGroup.label}</span>
                        {!isCollapsed && (
                            <span className="sidebar__nav-chevron">
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </span>
                        )}
                        {pendingApprovalsCount > 0 && (
                            <span className="sidebar__nav-badge">{pendingApprovalsCount}</span>
                        )}
                    </button>
                    <div className="sidebar__tooltip">{personaNavGroup.label}</div>
                </div>

                {/* Sub-navigation items */}
                {isExpanded && (
                    <div className="sidebar__nav-subitems">
                        {personaNavGroup.children.map(child => renderNavItem(child, true))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <aside className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''}`}>
            {/* Header with Logo and Toggle */}
            <div className="sidebar__header">
                <div className="sidebar__logo">
                    <div className="sidebar__logo-icon">
                        <div className="sidebar__logo-glow" />
                        <img src="./logo.png" alt="CODA" />
                    </div>
                    <div className="sidebar__logo-text">
                        <h1>CODA</h1>
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
                {/* Main nav items */}
                {(chatOnlyMode ? mainNavItems.filter(item => item.id === 'chat') : mainNavItems)
                    .map(item => renderNavItem(item))}

                {/* Persona Agent section with sub-nav */}
                {!chatOnlyMode && renderPersonaGroup()}

                {/* Configuration at the bottom of nav */}
                {!chatOnlyMode && renderNavItem(configNavItem)}
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
                        showNewChat={false}
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


