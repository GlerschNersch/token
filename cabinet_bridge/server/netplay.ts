/**
 * HomeArcade — Netplay WebSocket relay server
 *
 * Provides the signalling layer that EmulatorJS netplay needs.
 * Two peers pair via a 6-char room code; all subsequent messages
 * are forwarded verbatim between them so EmulatorJS can establish
 * its own game-state synchronisation channel.
 *
 * Endpoint: ws(s)://<host><ingressBase>/api/netplay
 * Set as window.EJS_netplayUrl in the player bootstrap.
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";

interface NetplayRoom {
  host: WebSocket;
  client: WebSocket | null;
  createdAt: number;
}

const rooms = new Map<string, NetplayRoom>();

// Prune stale rooms every 5 minutes (rooms older than 2 hours)
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [code, room] of rooms) {
    if (room.createdAt < cutoff) rooms.delete(code);
  }
}, 5 * 60 * 1000);

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? generateRoomCode() : code;
}

function send(ws: WebSocket, obj: object) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

export function attachNetplayServer(httpServer: HttpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/api/netplay" });

  wss.on("connection", (ws: WebSocket) => {
    let roomCode: string | null = null;
    let role: "host" | "client" | null = null;

    ws.on("message", (raw: Buffer | string) => {
      let msg: Record<string, unknown> | null = null;
      try { msg = JSON.parse(raw.toString()); } catch { /* binary data — relay below */ }

      if (msg) {
        const type = msg.type as string | undefined;

        if (type === "create-room" || type === "host") {
          if (roomCode) { send(ws, { type: "error", message: "Already in a room." }); return; }
          roomCode = generateRoomCode();
          role = "host";
          rooms.set(roomCode, { host: ws, client: null, createdAt: Date.now() });
          send(ws, { type: "room-created", room: roomCode });
          console.log(`[netplay] Room ${roomCode} created`);
          return;
        }

        if (type === "join-room" || type === "client") {
          const code = ((msg.room ?? msg.roomId) as string | undefined)?.toUpperCase();
          if (!code) { send(ws, { type: "error", message: "Missing room code." }); return; }
          const room = rooms.get(code);
          if (!room) { send(ws, { type: "error", message: "Room not found." }); return; }
          if (room.client) { send(ws, { type: "error", message: "Room is full." }); return; }
          roomCode = code;
          role = "client";
          room.client = ws;
          send(ws, { type: "room-joined", room: roomCode });
          send(room.host, { type: "peer-joined" });
          console.log(`[netplay] Peer joined room ${roomCode}`);
          return;
        }
      }

      // Relay everything else verbatim to the paired peer
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room) return;
      const peer = role === "host" ? room.client : room.host;
      if (peer && peer.readyState === WebSocket.OPEN) peer.send(raw);
    });

    ws.on("close", () => {
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room) return;
      const peer = role === "host" ? room.client : room.host;
      if (peer && peer.readyState === WebSocket.OPEN) send(peer, { type: "peer-disconnected" });
      rooms.delete(roomCode);
      console.log(`[netplay] Room ${roomCode} closed (${role} disconnected)`);
    });

    ws.on("error", () => { /* close fires next */ });
  });

  console.log("[HomeArcade] Netplay relay attached at ws://<host>/api/netplay");
}
