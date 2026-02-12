/**
 * Type definitions for AgentChat components and hooks.
 */

import type { ConversationListItem } from '../../types/chat';

// Props for AgentChat component
export interface AgentChatProps {
    /** The model configured in settings (from /api/config). Used as default when no session override. */
    configModel?: string;
    /** Active conversation ID (managed by App.tsx) */
    activeConversationId: string | null;
    /** Whether user clicked "New Chat" but hasn't sent a message yet */
    pendingNewChat: boolean;
    /** Callback when a new conversation is created (deferred creation) */
    onConversationCreated?: (conv: ConversationListItem) => void;
    /** Callback to trigger conversation list refresh */
    onConversationsChanged?: () => void;
    /** Callback to set active conversation ID */
    onSetActiveConversation?: (id: string | null) => void;
    /** Callback to update hasActiveMessages in parent */
    onSetHasMessages?: (hasMessages: boolean) => void;
    /** Callback to set pending new chat state */
    onSetPendingNewChat?: (pending: boolean) => void;
    /** Callback to update a conversation's title */
    onUpdateConversation?: (id: string, updates: Partial<ConversationListItem>) => void;
}

// File reference for shared files
export interface FileInfo {
    path: string;
    name: string;
    size?: number;
    file_type?: string;
    is_workspace?: boolean;
    description?: string;
}

// Types for agent events from SSE stream
export interface AgentEvent {
    type: 'thinking' | 'tool_call_start' | 'tool_call_result' | 'text' | 'error' | 'done' | 'file';
    content?: string;
    name?: string;
    args?: Record<string, unknown>;
    result?: string;
    file?: FileInfo;
    action?: 'created' | 'shared';
}

// Process step for history display
export interface ProcessStep {
    id: string;
    type: 'tool_call' | 'text' | 'thinking' | 'file';
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    toolResult?: string;
    content?: string;
    file?: FileInfo;
    fileAction?: 'created' | 'shared';
}

// Types for messages in the chat UI
export interface Message {
    id: string;
    role: 'user' | 'agent';
    content: string;
    processSteps?: ProcessStep[];
    status?: 'streaming' | 'complete' | 'error';
}

// Stream items - can be text, tool calls, or files, displayed in order
export interface StreamItem {
    id: string;
    type: 'text' | 'tool_call' | 'thinking' | 'file';
    content?: string;
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    toolResult?: string;
    isExecuting?: boolean;
    file?: FileInfo;
    fileAction?: 'created' | 'shared';
}

// Stored message from API
export interface StoredMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    tool_calls?: Array<{
        name: string;
        args: Record<string, unknown>;
        result?: string;
    }>;
    thinking?: string[];
    trace_log?: Array<{
        type: 'text' | 'thinking' | 'tool_call_start' | 'tool_call_result' | 'file';
        content?: string;
        name?: string;
        args?: Record<string, unknown>;
        result?: string;
        file?: FileInfo;
        action?: 'created' | 'shared';
    }>;
    status?: 'streaming' | 'complete' | 'error';
}
