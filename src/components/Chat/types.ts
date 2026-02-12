/**
 * Type definitions for AgentChat components and hooks.
 */

import type {
    NeuralLinkConnectionState,
    NeuralLinkSession,
    SendSessionMessageParams
} from '../../types/neuralLink';

// Props for AgentChat component
export interface AgentChatProps {
    /** Active session key selected in the sidebar */
    activeConversationId: string | null;
    /** Session options shown in header switcher */
    sessions: NeuralLinkSession[];
    /** Callback to set active conversation ID / session key */
    onSetActiveConversation: (id: string) => void;
    /** Callback to update hasActiveMessages in parent */
    onSetHasMessages?: (hasMessages: boolean) => void;
    /** Callback to refresh sessions from gateway */
    onConversationsChanged?: () => void;
    /** Neural Link connection state */
    connectionState: NeuralLinkConnectionState;
    /** Last connection or RPC error */
    connectionError: string;
    /** Neural Link endpoint settings */
    gatewayUrl: string;
    gatewayToken: string;
    gatewayPassword: string;
    onGatewayUrlChange: (value: string) => void;
    onGatewayTokenChange: (value: string) => void;
    onGatewayPasswordChange: (value: string) => void;
    onConnectGateway: () => Promise<void> | void;
    onRefreshSessions: () => Promise<void> | void;
    /** Gateway chat history loader */
    loadSessionHistory: (sessionKey: string) => Promise<unknown[]>;
    /** Gateway chat sender */
    sendSessionMessage: (params: SendSessionMessageParams) => Promise<string>;
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
