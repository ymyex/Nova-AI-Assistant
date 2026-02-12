import { useCallback, useEffect, useRef, useState } from 'react';
import type {
    NeuralLinkConnectionState,
    NeuralLinkHistoryMessage,
    NeuralLinkSession,
    SendSessionMessageParams
} from '../types/neuralLink';

type RpcResponseFrame = {
    type: 'res';
    id: string;
    ok: boolean;
    payload?: unknown;
    error?: { message?: string };
};

type RpcEventFrame = {
    type: 'event';
    event: string;
    payload?: unknown;
};

type GatewayFrame = RpcResponseFrame | RpcEventFrame | { type: string; [k: string]: unknown };

type PendingRequest = {
    resolve: (payload: unknown) => void;
    reject: (reason?: unknown) => void;
    timeoutId: number;
};

const STORAGE_KEYS = {
    gatewayUrl: 'coda-gateway-url',
    gatewayToken: 'coda-gateway-token',
    gatewayPassword: 'coda-gateway-password',
} as const;

const DEFAULT_GATEWAY_URL = 'wss://ymyex-windows.tail615b5c.ts.net';

function normalizeWsUrl(input: string): string {
    const value = input.trim();
    if (!value) return '';
    if (value.startsWith('ws://') || value.startsWith('wss://')) return value;
    if (value.startsWith('https://')) return `wss://${value.slice('https://'.length)}`;
    if (value.startsWith('http://')) return `ws://${value.slice('http://'.length)}`;
    return `wss://${value}`;
}

function extractTextFromContent(content: unknown): string {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';

    const parts = content
        .map((item) => {
            if (!item || typeof item !== 'object') return '';
            const node = item as Record<string, unknown>;
            if (typeof node.text === 'string') return node.text;
            if (typeof node.thinking === 'string') return node.thinking;
            if (typeof node.content === 'string') return node.content;
            return '';
        })
        .filter(Boolean);

    return parts.join('\n\n');
}

function extractTextFromChatPayload(message: unknown): string {
    if (!message || typeof message !== 'object') {
        return '';
    }
    const entry = message as Record<string, unknown>;
    return extractTextFromContent(entry.content);
}

export function useNeuralLinkGateway() {
    const [gatewayUrl, setGatewayUrl] = useState(
        () => localStorage.getItem(STORAGE_KEYS.gatewayUrl) || DEFAULT_GATEWAY_URL
    );
    const [gatewayToken, setGatewayToken] = useState(
        () => localStorage.getItem(STORAGE_KEYS.gatewayToken) || ''
    );
    const [gatewayPassword, setGatewayPassword] = useState(
        () => localStorage.getItem(STORAGE_KEYS.gatewayPassword) || ''
    );

    const [connectionState, setConnectionState] = useState<NeuralLinkConnectionState>('disconnected');
    const [error, setError] = useState('');
    const [sessions, setSessions] = useState<NeuralLinkSession[]>([]);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);

    const wsRef = useRef<WebSocket | null>(null);
    const pendingRef = useRef<Map<string, PendingRequest>>(new Map());
    const listenersRef = useRef<Map<string, Set<(payload: unknown) => void>>>(new Map());
    const reqCounterRef = useRef(1);
    const connectPromiseRef = useRef<Promise<void> | null>(null);
    const mountedRef = useRef(true);
    const connectedConfigRef = useRef<{ url: string; token: string; password: string } | null>(null);

    const clearPendingRequests = useCallback((reason: string) => {
        for (const pending of pendingRef.current.values()) {
            window.clearTimeout(pending.timeoutId);
            pending.reject(new Error(reason));
        }
        pendingRef.current.clear();
    }, []);

    const emitEvent = useCallback((eventName: string, payload: unknown) => {
        const handlers = listenersRef.current.get(eventName);
        if (!handlers || handlers.size === 0) return;
        for (const handler of handlers) {
            handler(payload);
        }
    }, []);

    const disconnect = useCallback(() => {
        const ws = wsRef.current;
        wsRef.current = null;
        connectedConfigRef.current = null;
        if (ws) {
            ws.close();
        }
        if (mountedRef.current) {
            setConnectionState('disconnected');
        }
        clearPendingRequests('Disconnected');
    }, [clearPendingRequests]);

    const sendRpc = useCallback((method: string, params?: Record<string, unknown>, timeoutMs = 15000) => {
        return new Promise<unknown>((resolve, reject) => {
            const ws = wsRef.current;
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                reject(new Error('Gateway is not connected'));
                return;
            }

            const id = `req-${reqCounterRef.current++}`;

            const timeoutId = window.setTimeout(() => {
                const pending = pendingRef.current.get(id);
                if (!pending) return;
                pendingRef.current.delete(id);
                pending.reject(new Error(`RPC timeout: ${method}`));
            }, timeoutMs);

            pendingRef.current.set(id, { resolve, reject, timeoutId });

            ws.send(
                JSON.stringify({
                    type: 'req',
                    id,
                    method,
                    params,
                })
            );
        });
    }, []);

    const subscribeToEvent = useCallback((eventName: string, handler: (payload: unknown) => void) => {
        const listeners = listenersRef.current.get(eventName) ?? new Set<(payload: unknown) => void>();
        listeners.add(handler);
        listenersRef.current.set(eventName, listeners);

        return () => {
            const current = listenersRef.current.get(eventName);
            if (!current) return;
            current.delete(handler);
            if (current.size === 0) {
                listenersRef.current.delete(eventName);
            }
        };
    }, []);

    const connect = useCallback(async () => {
        if (connectPromiseRef.current) {
            await connectPromiseRef.current;
            return;
        }

        const normalizedUrl = normalizeWsUrl(gatewayUrl);
        if (!normalizedUrl) {
            const message = 'Gateway URL is required';
            setError(message);
            throw new Error(message);
        }

        const nextConfig = {
            url: normalizedUrl,
            token: gatewayToken,
            password: gatewayPassword
        };

        const currentConfig = connectedConfigRef.current;
        const isSameConfig =
            currentConfig &&
            currentConfig.url === nextConfig.url &&
            currentConfig.token === nextConfig.token &&
            currentConfig.password === nextConfig.password;

        if (
            connectionState === 'connected' &&
            wsRef.current?.readyState === WebSocket.OPEN &&
            isSameConfig
        ) {
            return;
        }

        if (
            connectionState === 'connected' &&
            wsRef.current?.readyState === WebSocket.OPEN &&
            !isSameConfig
        ) {
            disconnect();
        }

        const connectPromise = new Promise<void>((resolve, reject) => {
            setConnectionState('connecting');
            setError('');

            const ws = new WebSocket(normalizedUrl);
            wsRef.current = ws;
            let settled = false;

            const fail = (reason: string, err?: unknown) => {
                if (settled) return;
                settled = true;
                const message = err instanceof Error ? err.message : reason;
                if (mountedRef.current) {
                    setError(message || reason);
                    setConnectionState('disconnected');
                }
                reject(err instanceof Error ? err : new Error(message || reason));
            };

            ws.onmessage = (event) => {
                try {
                    const frame = JSON.parse(String(event.data)) as GatewayFrame;

                    if (frame.type === 'res') {
                        const response = frame as RpcResponseFrame;
                        const pending = pendingRef.current.get(String(response.id ?? ''));
                        if (!pending) return;

                        pendingRef.current.delete(String(response.id ?? ''));
                        window.clearTimeout(pending.timeoutId);

                        if (response.ok) {
                            pending.resolve(response.payload);
                        } else {
                            pending.reject(new Error(response.error?.message || 'Gateway request failed'));
                        }
                        return;
                    }

                    if (frame.type === 'event') {
                        const eventFrame = frame as RpcEventFrame;
                        emitEvent(eventFrame.event, eventFrame.payload);
                    }
                } catch {
                    // Ignore malformed frames.
                }
            };

            ws.onerror = () => {
                if (mountedRef.current && !settled) {
                    setError('WebSocket connection failed');
                }
            };

            ws.onclose = () => {
                if (wsRef.current === ws) {
                    wsRef.current = null;
                }
                clearPendingRequests('Disconnected');
                if (mountedRef.current) {
                    setConnectionState('disconnected');
                }
                if (!settled) {
                    fail('Connection closed during handshake');
                }
            };

            ws.onopen = async () => {
                try {
                    const connectParams: Record<string, unknown> = {
                        minProtocol: 3,
                        maxProtocol: 3,
                        client: {
                            id: 'coda-neural-link',
                            displayName: 'Coda Neural Link',
                            version: '0.2.0',
                            platform: 'web',
                            mode: 'ui',
                        },
                    };

                    if (gatewayToken || gatewayPassword) {
                        connectParams.auth = {
                            ...(gatewayToken ? { token: gatewayToken } : {}),
                            ...(gatewayPassword ? { password: gatewayPassword } : {}),
                        };
                    }

                    await sendRpc('connect', connectParams, 10000);

                    if (mountedRef.current) {
                        setConnectionState('connected');
                    }
                    connectedConfigRef.current = nextConfig;
                    settled = true;
                    resolve();
                } catch (err) {
                    ws.close();
                    fail('Failed to connect to gateway', err);
                }
            };
        });

        connectPromiseRef.current = connectPromise.finally(() => {
            connectPromiseRef.current = null;
        });

        await connectPromiseRef.current;
    }, [
        connectionState,
        gatewayPassword,
        gatewayToken,
        gatewayUrl,
        sendRpc,
        emitEvent,
        clearPendingRequests,
        disconnect,
    ]);

    const refreshSessions = useCallback(async () => {
        setIsLoadingSessions(true);
        setError('');
        try {
            await connect();
            const response = await sendRpc('sessions.list', {
                limit: 120,
                includeUnknown: false,
                includeGlobal: true,
                includeDerivedTitles: true,
                includeLastMessage: true,
            });
            const payload = response as { sessions?: NeuralLinkSession[] };
            const rows = Array.isArray(payload?.sessions) ? payload.sessions : [];
            setSessions(rows);
            return rows;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load sessions';
            setError(message);
            setSessions([]);
            return [];
        } finally {
            setIsLoadingSessions(false);
        }
    }, [connect, sendRpc]);

    const loadSessionHistory = useCallback(
        async (sessionKey: string): Promise<NeuralLinkHistoryMessage[]> => {
            if (!sessionKey) {
                return [];
            }
            await connect();
            const response = await sendRpc('chat.history', { sessionKey, limit: 180 });
            const payload = response as { messages?: NeuralLinkHistoryMessage[] };
            return Array.isArray(payload?.messages) ? payload.messages : [];
        },
        [connect, sendRpc]
    );

    const sendSessionMessage = useCallback(
        async ({ sessionKey, message, onDelta, onError }: SendSessionMessageParams): Promise<string> => {
            await connect();

            const runId = `coda-${Date.now()}-${Math.random().toString(16).slice(2)}`;

            return await new Promise<string>((resolve, reject) => {
                let latestDelta = '';
                let settled = false;

                const finalize = (handler: () => void) => {
                    if (settled) return;
                    settled = true;
                    unsubscribeChat();
                    window.clearTimeout(timeoutId);
                    handler();
                };

                const unsubscribeChat = subscribeToEvent('chat', (payload) => {
                    if (!payload || typeof payload !== 'object') return;
                    const event = payload as Record<string, unknown>;
                    if (event.runId !== runId || event.sessionKey !== sessionKey) return;

                    const state = String(event.state ?? '');
                    if (state === 'delta') {
                        const deltaText = extractTextFromChatPayload(event.message);
                        latestDelta = deltaText;
                        onDelta?.(deltaText);
                        return;
                    }

                    if (state === 'final') {
                        const finalText = extractTextFromChatPayload(event.message) || latestDelta || 'Done.';
                        finalize(() => resolve(finalText));
                        return;
                    }

                    if (state === 'error') {
                        const messageText =
                            typeof event.errorMessage === 'string'
                                ? event.errorMessage
                                : 'Assistant returned an error';
                        onError?.(messageText);
                        finalize(() => reject(new Error(messageText)));
                    }
                });

                const timeoutId = window.setTimeout(() => {
                    const messageText = 'Timed out waiting for assistant response';
                    onError?.(messageText);
                    finalize(() => reject(new Error(messageText)));
                }, 180000);

                void (async () => {
                    try {
                        await sendRpc('chat.send', {
                            sessionKey,
                            message,
                            idempotencyKey: runId,
                        });
                    } catch (err) {
                        const messageText = err instanceof Error ? err.message : 'Failed to send message';
                        onError?.(messageText);
                        finalize(() => reject(err instanceof Error ? err : new Error(messageText)));
                    }
                })();
            });
        },
        [connect, sendRpc, subscribeToEvent]
    );

    const renameSession = useCallback(
        async (sessionKey: string, label: string) => {
            await connect();
            await sendRpc('sessions.patch', {
                key: sessionKey,
                label: label.trim() || null,
            });
            await refreshSessions();
        },
        [connect, sendRpc, refreshSessions]
    );

    const deleteSession = useCallback(
        async (sessionKey: string) => {
            await connect();
            await sendRpc('sessions.delete', { key: sessionKey });
            await refreshSessions();
        },
        [connect, sendRpc, refreshSessions]
    );

    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.gatewayUrl, normalizeWsUrl(gatewayUrl));
    }, [gatewayUrl]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.gatewayToken, gatewayToken);
    }, [gatewayToken]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.gatewayPassword, gatewayPassword);
    }, [gatewayPassword]);

    useEffect(() => {
        mountedRef.current = true;
        void connect()
            .then(() => refreshSessions())
            .catch(() => {
                // Connection errors are surfaced in state.
            });

        return () => {
            mountedRef.current = false;
            disconnect();
        };
        // Intentionally run once to avoid reconnecting on every settings keystroke.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        gatewayUrl,
        gatewayToken,
        gatewayPassword,
        setGatewayUrl,
        setGatewayToken,
        setGatewayPassword,
        connectionState,
        error,
        sessions,
        isLoadingSessions,
        connect,
        disconnect,
        refreshSessions,
        loadSessionHistory,
        sendSessionMessage,
        renameSession,
        deleteSession,
    };
}
