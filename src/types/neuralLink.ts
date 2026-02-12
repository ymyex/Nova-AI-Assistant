export type NeuralLinkConnectionState = 'disconnected' | 'connecting' | 'connected';

export interface NeuralLinkSession {
    key: string;
    kind?: string;
    channel?: string;
    label?: string;
    displayName?: string;
    derivedTitle?: string;
    updatedAt?: number;
    model?: string;
    modelProvider?: string;
    lastMessagePreview?: string;
}

export interface NeuralLinkHistoryMessage {
    role?: string;
    content?: unknown;
    timestamp?: number;
    status?: 'streaming' | 'complete' | 'error';
}

export interface SendSessionMessageParams {
    sessionKey: string;
    message: string;
    onDelta?: (text: string) => void;
    onError?: (message: string) => void;
}
