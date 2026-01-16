/**
 * TypeScript types for Nova AI chat history persistence.
 */

// Tool call information stored in message history
export interface ToolCall {
    name: string;
    args: Record<string, unknown>;
    result?: string;
}

// A message in a conversation
export interface Message {
    id: string;
    conversation_id: string;
    role: 'user' | 'assistant';
    content: string;
    tool_calls?: ToolCall[];
    thinking?: string[];
    trace_log?: TraceLogEntry[];
    status?: 'streaming' | 'complete' | 'error';
    created_at: string;
}

// A trace log entry for high-fidelity history reconstruction
export interface TraceLogEntry {
    type: 'text' | 'thinking' | 'tool_call_start' | 'tool_call_result';
    content?: string;
    name?: string;
    args?: Record<string, unknown>;
    result?: string;
}

// A conversation with optional messages
export interface Conversation {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    messages?: Message[];
}

// Summary of a conversation for list display
export interface ConversationListItem {
    id: string;
    title: string;
    updated_at: string;
}

// Request to create a new conversation
export interface CreateConversationRequest {
    title?: string;
}

// Request to update a conversation
export interface UpdateConversationRequest {
    title: string;
}

// Request to send a message to a conversation
export interface ChatMessageRequest {
    message: string;
    model_override?: string;
}
