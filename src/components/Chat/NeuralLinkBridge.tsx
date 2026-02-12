import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ConversationListItem } from '../../types';

type RpcRequestFrame = {
  type: 'req';
  id: string;
  method: string;
  params?: Record<string, unknown>;
};

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

type SessionRow = {
  key: string;
  kind?: string;
  channel?: string;
  displayName?: string;
  updatedAt?: number;
  model?: string;
};

type HistoryMessage = {
  role?: string;
  content?: unknown;
  timestamp?: number;
};

interface NeuralLinkBridgeProps {
  activeSessionKey: string | null;
  onActiveSessionChange: (sessionKey: string) => void;
  onSessionsLoaded?: (sessions: ConversationListItem[]) => void;
}

const STORAGE_KEYS = {
  gatewayUrl: 'coda-gateway-url',
  gatewayToken: 'coda-gateway-token',
  gatewayPassword: 'coda-gateway-password',
};

function normalizeWsUrl(input: string): string {
  const value = input.trim();
  if (!value) return '';
  if (value.startsWith('ws://') || value.startsWith('wss://')) return value;
  if (value.startsWith('https://')) return `wss://${value.slice('https://'.length)}`;
  if (value.startsWith('http://')) return `ws://${value.slice('http://'.length)}`;
  return `wss://${value}`;
}

function formatTimestamp(ts?: number): string {
  if (!ts) return 'â€”';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return 'â€”';
  }
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  const parts = content
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      const node = item as Record<string, unknown>;
      const type = String(node.type ?? '');

      if (type === 'text' && typeof node.text === 'string') return node.text;
      if (type === 'input_text' && typeof node.text === 'string') return node.text;
      if (type === 'thinking' && typeof node.thinking === 'string') return `ðŸ’­ ${node.thinking}`;
      if (type === 'toolCall' && typeof node.name === 'string') return `ðŸ› ï¸ ${node.name}`;

      return '';
    })
    .filter(Boolean);

  return parts.join('\n\n');
}

export const NeuralLinkBridge: React.FC<NeuralLinkBridgeProps> = ({
  activeSessionKey,
  onActiveSessionChange,
  onSessionsLoaded,
}) => {
  const [gatewayUrl, setGatewayUrl] = useState(() => localStorage.getItem(STORAGE_KEYS.gatewayUrl) || 'wss://ymyex-windows.tail615b5c.ts.net');
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEYS.gatewayToken) || '');
  const [password, setPassword] = useState(() => localStorage.getItem(STORAGE_KEYS.gatewayPassword) || '');

  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [error, setError] = useState<string>('');
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [history, setHistory] = useState<HistoryMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reqCounterRef = useRef(1);
  const pendingRef = useRef<Map<string, { resolve: (payload: unknown) => void; reject: (reason?: unknown) => void }>>(new Map());

  const sendRpc = useCallback((method: string, params?: Record<string, unknown>) => {
    return new Promise<unknown>((resolve, reject) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Gateway is not connected'));
        return;
      }

      const id = `req-${reqCounterRef.current++}`;
      pendingRef.current.set(id, { resolve, reject });

      const frame: RpcRequestFrame = {
        type: 'req',
        id,
        method,
        params,
      };

      ws.send(JSON.stringify(frame));

      setTimeout(() => {
        const pending = pendingRef.current.get(id);
        if (pending) {
          pendingRef.current.delete(id);
          pending.reject(new Error(`RPC timeout: ${method}`));
        }
      }, 15000);
    });
  }, []);

  const loadHistory = useCallback(async (sessionKey: string) => {
    if (!sessionKey) return;
    setLoadingHistory(true);
    setError('');
    try {
      const res = await sendRpc('chat.history', { sessionKey, limit: 120 }) as { messages?: HistoryMessage[] };
      setHistory(Array.isArray(res?.messages) ? res.messages : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [sendRpc]);

  const loadSessions = useCallback(async () => {
    setError('');
    try {
      const res = await sendRpc('sessions.list', { limit: 80, messageLimit: 0 }) as { sessions?: SessionRow[] };
      const rows = Array.isArray(res?.sessions) ? res.sessions : [];
      setSessions(rows);

      onSessionsLoaded?.(
        rows.map((s) => ({
          id: s.key,
          title: s.displayName || s.key,
          updated_at: new Date(s.updatedAt || Date.now()).toISOString(),
        })),
      );

      const exists = activeSessionKey && rows.some((s) => s.key === activeSessionKey);
      const first = rows[0]?.key;
      const toSelect = exists ? activeSessionKey! : first;

      if (toSelect) {
        if (toSelect !== activeSessionKey) {
          onActiveSessionChange(toSelect);
        }
        await loadHistory(toSelect);
      } else {
        setHistory([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
      setSessions([]);
      setHistory([]);
    }
  }, [sendRpc, onSessionsLoaded, activeSessionKey, onActiveSessionChange, loadHistory]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnectionState('disconnected');

    for (const pending of pendingRef.current.values()) {
      pending.reject(new Error('Disconnected'));
    }
    pendingRef.current.clear();
  }, []);

  const connect = useCallback(async () => {
    const normalizedUrl = normalizeWsUrl(gatewayUrl);
    if (!normalizedUrl) {
      setError('Gateway URL is required');
      return;
    }

    setConnectionState('connecting');
    setError('');

    localStorage.setItem(STORAGE_KEYS.gatewayUrl, normalizedUrl);
    localStorage.setItem(STORAGE_KEYS.gatewayToken, token);
    localStorage.setItem(STORAGE_KEYS.gatewayPassword, password);

    const ws = new WebSocket(normalizedUrl);
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      try {
        const frame = JSON.parse(String(evt.data)) as GatewayFrame;

        if (frame.type === 'res') {
          const resFrame = frame as RpcResponseFrame;
          const responseId = String(resFrame.id ?? '');
          const pending = pendingRef.current.get(responseId);
          if (!pending) return;

          pendingRef.current.delete(responseId);

          if (resFrame.ok) {
            pending.resolve(resFrame.payload);
          } else {
            const errObj = (resFrame.error ?? {}) as { message?: string };
            pending.reject(new Error(errObj.message || 'Gateway request failed'));
          }
          return;
        }

        if (frame.type === 'event') {
          // Reserved for future live updates (chat/session events)
          return;
        }
      } catch {
        // Ignore malformed frames
      }
    };

    ws.onerror = () => {
      setError('WebSocket connection failed');
    };

    ws.onclose = () => {
      setConnectionState('disconnected');
    };

    ws.onopen = async () => {
      try {
        const connectParams: Record<string, unknown> = {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: 'coda-neural-link',
            displayName: 'Coda Neural Link',
            version: '0.1.0',
            platform: 'web',
            mode: 'ui',
          },
        };

        if (token || password) {
          connectParams.auth = {
            ...(token ? { token } : {}),
            ...(password ? { password } : {}),
          };
        }

        await sendRpc('connect', connectParams);
        setConnectionState('connected');
        await loadSessions();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect');
        disconnect();
      }
    };
  }, [gatewayUrl, token, password, sendRpc, loadSessions, disconnect]);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  useEffect(() => {
    if (connectionState !== 'connected') return;
    if (!activeSessionKey) return;
    loadHistory(activeSessionKey);
  }, [activeSessionKey, connectionState, loadHistory]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.key === activeSessionKey) || null,
    [sessions, activeSessionKey],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      <div style={{
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '12px',
        padding: '1rem',
        background: 'rgba(10, 10, 20, 0.45)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto auto', gap: '0.75rem' }}>
          <input
            value={gatewayUrl}
            onChange={(e) => setGatewayUrl(e.target.value)}
            placeholder="Gateway WS URL (wss://...)"
            style={{ padding: '0.65rem 0.75rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
          />
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Gateway token"
            style={{ padding: '0.65rem 0.75rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Gateway password"
            style={{ padding: '0.65rem 0.75rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
          />
          <button
            onClick={connect}
            disabled={connectionState === 'connecting' || connectionState === 'connected'}
            style={{ padding: '0.65rem 0.9rem', borderRadius: 8, border: 'none', background: '#2f7bff', color: 'white', fontWeight: 600, cursor: 'pointer' }}
          >
            {connectionState === 'connecting' ? 'Connectingâ€¦' : connectionState === 'connected' ? 'Connected' : 'Connect'}
          </button>
          <button
            onClick={() => {
              if (connectionState === 'connected') {
                loadSessions();
              }
            }}
            disabled={connectionState !== 'connected'}
            style={{ padding: '0.65rem 0.9rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'white', fontWeight: 600, cursor: 'pointer' }}
          >
            Refresh
          </button>
        </div>

        <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Status: <strong style={{ color: connectionState === 'connected' ? '#67e8a5' : '#fca5a5' }}>{connectionState.toUpperCase()}</strong>
          {error && <span style={{ marginLeft: 12, color: '#fca5a5' }}>â€¢ {error}</span>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1rem', flex: 1, minHeight: 0 }}>
        <div style={{
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 12,
          background: 'rgba(10, 10, 20, 0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}>
          <div style={{ padding: '0.9rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', fontWeight: 700 }}>
            Sessions ({sessions.length})
          </div>
          <div style={{ overflowY: 'auto' }}>
            {sessions.map((session) => {
              const isActive = session.key === activeSessionKey;
              return (
                <button
                  key={session.key}
                  onClick={() => onActiveSessionChange(session.key)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    background: isActive ? 'rgba(47,123,255,0.18)' : 'transparent',
                    color: 'white',
                    padding: '0.8rem 1rem',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{session.displayName || session.key}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{session.channel || 'â€”'} â€¢ {session.kind || 'â€”'}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>{formatTimestamp(session.updatedAt)}</div>
                </button>
              );
            })}
            {sessions.length === 0 && (
              <div style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                No sessions loaded.
              </div>
            )}
          </div>
        </div>

        <div style={{
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 12,
          background: 'rgba(10, 10, 20, 0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}>
          <div style={{ padding: '0.9rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontWeight: 700 }}>Chat History</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {activeSession ? activeSession.key : 'Select a session'}
            </div>
          </div>

          <div style={{ overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {loadingHistory && <div style={{ color: 'var(--text-secondary)' }}>Loading historyâ€¦</div>}

            {!loadingHistory && history.map((msg, idx) => {
              const isAssistant = msg.role === 'assistant';
              const text = contentToText(msg.content) || '[non-text content]';

              return (
                <div
                  key={`${msg.timestamp || idx}-${idx}`}
                  style={{
                    alignSelf: isAssistant ? 'flex-start' : 'flex-end',
                    maxWidth: '88%',
                    padding: '0.75rem 0.9rem',
                    borderRadius: 10,
                    background: isAssistant ? 'rgba(255,255,255,0.08)' : 'rgba(47,123,255,0.3)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: '0.9rem',
                    lineHeight: 1.45,
                  }}
                >
                  <div style={{ fontSize: '0.72rem', opacity: 0.7, marginBottom: 4 }}>
                    {isAssistant ? 'Assistant' : (msg.role || 'User')} â€¢ {formatTimestamp(msg.timestamp)}
                  </div>
                  {text}
                </div>
              );
            })}

            {!loadingHistory && history.length === 0 && (
              <div style={{ color: 'var(--text-secondary)' }}>
                No messages for this session yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

