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

// Types for agent events from SSE stream
export interface AgentEvent {
    type: 'thinking' | 'tool_call_start' | 'tool_call_result' | 'text' | 'error' | 'done';
    content?: string;
    name?: string;
    args?: Record<string, unknown>;
    result?: string;
}

// Process step for history display
export interface ProcessStep {
    id: string;
    type: 'tool_call' | 'text' | 'thinking';
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    toolResult?: string;
    content?: string;
}

// Types for messages in the chat UI
export interface Message {
    id: string;
    role: 'user' | 'agent';
    content: string;
    processSteps?: ProcessStep[];
    status?: 'streaming' | 'complete' | 'error';
}

// Stream items - can be text or tool calls, displayed in order
export interface StreamItem {
    id: string;
    type: 'text' | 'tool_call' | 'thinking';
    content?: string;
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    toolResult?: string;
    isExecuting?: boolean;
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
        type: 'text' | 'thinking' | 'tool_call_start' | 'tool_call_result';
        content?: string;
        name?: string;
        args?: Record<string, unknown>;
        result?: string;
    }>;
    status?: 'streaming' | 'complete' | 'error';
}
