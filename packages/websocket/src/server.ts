// @pms/websocket - WebSocket server entry point
import express from 'express';
import WebSocket from 'ws';
import http from 'http';

const app = express();
const PORT = process.env.WS_PORT || 3001;

// Create HTTP server for WebSocket
const server = http.createServer(app);
// Server is runtime class, not exported in types, so cast as any
const wss = new (WebSocket as any).Server({ server });

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'websocket', timestamp: new Date() });
});

wss.on('connection', (ws: WebSocket) => {
  console.log('🔌 WebSocket client connected');

  ws.on('message', (message: string) => {
    console.log('📨 Received:', message);
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket client disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`🚀 WebSocket server running on port ${PORT}`);
});

export default server;
