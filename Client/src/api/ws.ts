/** Thin wrapper around the backend's generic room-relay WebSocket
 * (Server/app/ws/routes.py: /ws/{room}). REST calls that mutate map
 * tokens/shapes/combatants already broadcast into these same rooms
 * after committing, so subscribing here is enough to see live updates
 * from other connected clients (or other browser tabs) without polling. */

/** Same reasoning as client.ts's API_BASE_URL: fall back to the page's own
 * host/protocol (proxied by nginx) instead of a fixed URL, so the built
 * image works from any host. */
const WS_BASE_URL = (
  import.meta.env.VITE_WS_BASE_URL ??
  `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
).replace(/\/+$/, '');

export interface RoomMessage {
  type: string;
  data?: unknown;
  client_id?: string;
  [key: string]: unknown;
}

export function connectRoom(room: string, onMessage: (message: RoomMessage) => void): () => void {
  let socket: WebSocket | null = null;
  let closedByCaller = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (closedByCaller) return;
    socket = new WebSocket(`${WS_BASE_URL}/${room}`);
    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as RoomMessage;
        if (parsed.type !== 'connected') onMessage(parsed);
      } catch {
        // ignore malformed frames
      }
    };
    socket.onclose = () => {
      if (closedByCaller) return;
      retryTimer = setTimeout(connect, 2000);
    };
    socket.onerror = () => {
      socket?.close();
    };
  };

  connect();

  return () => {
    closedByCaller = true;
    if (retryTimer) clearTimeout(retryTimer);
    socket?.close();
  };
}

export function floorRoom(floorId: string): string {
  return `floor-${floorId}`;
}

export function combatRoom(combatId: string): string {
  return `combat-${combatId}`;
}
