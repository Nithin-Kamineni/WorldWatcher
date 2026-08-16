"""Minimal room-based WebSocket broadcast manager.

Rooms are plain strings the frontend chooses by convention (e.g.
"floor-<map_floor_id>", "combat-<combat_id>", "campaign-<campaign_id>").
REST routers also push into these same rooms after a mutating request
commits, so every connected client sees changes live regardless of
whether they came from a socket message or a plain HTTP call.
"""
import json
from collections import defaultdict
from typing import Any, Optional

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.rooms: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, room: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.rooms[room].add(websocket)

    def disconnect(self, room: str, websocket: WebSocket) -> None:
        self.rooms.get(room, set()).discard(websocket)
        if room in self.rooms and not self.rooms[room]:
            del self.rooms[room]

    async def broadcast(self, room: str, message: dict[str, Any], exclude: Optional[WebSocket] = None) -> None:
        connections = list(self.rooms.get(room, set()))
        if not connections:
            return
        text = json.dumps(message, default=str)
        dead: list[WebSocket] = []
        for ws in connections:
            if ws is exclude:
                continue
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(room, ws)


manager = ConnectionManager()
