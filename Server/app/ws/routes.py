"""Generic room relay: connect to /ws/{room}, send JSON, everyone else
in that room gets it. REST endpoints that mutate live state (map
tokens, combatants, combat turns) also broadcast into these same rooms
after committing, so sockets and REST stay in sync automatically."""
import json
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.ws.manager import manager

router = APIRouter()


@router.websocket("/ws/{room}")
async def room_socket(websocket: WebSocket, room: str):
    await manager.connect(room, websocket)
    client_id = str(uuid.uuid4())
    await websocket.send_text(json.dumps({"type": "connected", "client_id": client_id, "room": room}))
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except ValueError:
                continue
            if isinstance(data, dict):
                data.setdefault("client_id", client_id)
            await manager.broadcast(room, data, exclude=websocket)
    except WebSocketDisconnect:
        manager.disconnect(room, websocket)
