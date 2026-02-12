# OpenClaw Integration Guide

This dashboard (`C:\Users\ymyex\Projects\ymyex.me\coda-integration`) is a remote control surface for your local OpenClaw setup at `S:\openclaw`.

Primary intent:
- Use `https://coda.ymyex.me` as a remote UI to communicate with your personal OpenClaw agent.
- Current integration scope is chat-first: the "Neural Link" chat path is the active integration.

## Current Scope
- Implemented now:
  - Login gate (`Welcome, Master`) in the dashboard UI.
  - OpenClaw chat session listing, history, send, rename, delete.
  - Streaming assistant responses with tool-call/thinking rendering preserved.
- Not fully migrated yet:
  - Legacy dashboard/setup/persona API pages that call `/api/*` endpoints.
  - Those endpoints are separate from OpenClaw chat integration and may return `404` if the legacy backend is not present.

## Network Topology (Tailscale Path)
- Frontend host: `https://coda.ymyex.me` (Vercel deployment).
- OpenClaw gateway host (default in UI): `wss://ymyex-windows.tail615b5c.ts.net`.
- Data path:
  - Browser loads dashboard from Vercel.
  - Browser opens WebSocket directly to the OpenClaw gateway over Tailscale.
  - Dashboard does not proxy chat traffic through Vercel/server APIs.

This means remote chat works when the client can reach your Tailscale network path to the machine running OpenClaw.

## Authentication Layers
- UI gate password (hardcoded): `daadfceb`
  - File: `src/components/Auth/AccessGate.tsx`
  - Storage flag: `CODA-master-authenticated`
- OpenClaw gateway auth (optional/available):
  - Token/password fields in Neural Link panel.
  - Sent during RPC `connect` as `auth.token` and/or `auth.password`.
  - Stored in browser localStorage:
    - `coda-gateway-url`
    - `coda-gateway-token`
    - `coda-gateway-password`

## Chat Integration Contract
Implementation lives in:
- `src/hooks/useNeuralLinkGateway.ts`
- `src/components/Chat/hooks/useChat.ts`
- `src/components/Chat/ChatHeader.tsx`

Connection handshake:
- WebSocket RPC frame format with `req`/`res`/`event`.
- Dashboard sends `connect` with:
  - `minProtocol: 3`
  - `maxProtocol: 3`
  - client metadata:
    - `id: coda-neural-link`
    - `displayName: Coda Neural Link`
    - `version: 0.2.0`
    - `platform: web`
    - `mode: ui`

RPC methods used today:
- `sessions.list`
  - Session switcher source of truth.
- `chat.history`
  - Loads selected session history.
- `chat.send`
  - Sends user message for selected session.
  - Uses `idempotencyKey` for run tracking.
- `sessions.patch`
  - Rename session label.
- `sessions.delete`
  - Delete session.

Event handling:
- Subscribes to `event: "chat"` frames.
- Handles states:
  - `delta`: live partial assistant text.
  - `final`: final assistant message.
  - `error`: surfaced as message failure.

## UI Behavior Requirements (Preserved)
- Model selector was replaced with session switcher.
- Thinking/tool-call visualization remains active:
  - History blocks are parsed into process steps for thinking/tool cards.
- Chat page layout remains mostly unchanged; integration is wired underneath existing UI.

## Local Persistence
- Active session memory key: `CODA-active-session`
- Auth memory key: `CODA-master-authenticated`
- Gateway URL/token/password keys listed above.

## Operations Checklist
1. Ensure OpenClaw is running on machine path `S:\openclaw`.
2. Ensure gateway endpoint is reachable via Tailscale (`wss://...tail615b5c.ts.net` or your configured host).
3. Open `https://coda.ymyex.me`.
4. Enter dashboard password: `daadfceb`.
5. In chat header -> `Neural Link`, verify URL/token/password, click `Connect`, then `Refresh`.
6. Select a session and send messages.

## Notes For Future Agents
- Treat this repo as a frontend integration layer for OpenClaw, not a standalone backend.
- Do not remove or simplify thinking/tool-call rendering in chat.
- Keep chat integration session-based unless explicitly requested otherwise.
- If adding more OpenClaw features, extend the WebSocket RPC path first rather than adding unrelated `/api/*` dependencies.
