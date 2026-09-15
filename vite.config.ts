import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

// Server-side in-memory room storage for instant multiplayer sync
const roomsStore = new Map<string, any>();
const roomSubscribers = new Map<string, Set<any>>();

function broadcastToRoom(code: string, data: any) {
  const subscribers = roomSubscribers.get(code);
  if (!subscribers || subscribers.size === 0) return;
  const message = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of Array.from(subscribers)) {
    try {
      client.write(message);
      if (typeof (client as any).flush === 'function') {
        (client as any).flush();
      }
    } catch {
      subscribers.delete(client);
    }
  }
}

function chessApiPlugin(): Plugin {
  return {
    name: 'chess-multiplayer-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';

        // Real-Time Server-Sent Events (SSE) stream for instantaneous room sync
        if (url.startsWith('/api/rooms/') && url.includes('/events') && req.method === 'GET') {
          const code = url
            .replace('/api/rooms/', '')
            .replace('/events', '')
            .split('?')[0]
            .trim()
            .toUpperCase();

          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform, no-store',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Critical: disables reverse proxy / nginx buffering
            'Access-Control-Allow-Origin': '*',
          });

          if (typeof res.flushHeaders === 'function') {
            res.flushHeaders();
          }

          // Immediate retry parameter for auto-reconnection
          res.write('retry: 1500\n\n');
          res.write(': stream-opened\n\n');

          if (!roomSubscribers.has(code)) {
            roomSubscribers.set(code, new Set());
          }
          const subs = roomSubscribers.get(code)!;
          subs.add(res);

          // Immediately deliver current room state upon connecting
          const existing = roomsStore.get(code);
          if (existing) {
            res.write(`data: ${JSON.stringify({ type: 'ROOM_UPDATE', room: existing })}\n\n`);
          }

          // Heartbeat keep-alive every 15s to keep proxy alive
          const keepAliveTimer = setInterval(() => {
            try {
              res.write(': keepalive\n\n');
              if (typeof (res as any).flush === 'function') {
                (res as any).flush();
              }
            } catch {
              clearInterval(keepAliveTimer);
            }
          }, 15000);

          req.on('close', () => {
            clearInterval(keepAliveTimer);
            subs.delete(res);
            if (subs.size === 0) {
              roomSubscribers.delete(code);
            }
          });
          return;
        }

        // Room state sync endpoint (moves, status updates, join/leave)
        if (url.startsWith('/api/rooms/sync') && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const payload = JSON.parse(body);
              const room = payload.room || payload;
              if (room && room.code) {
                const code = room.code.toUpperCase();
                roomsStore.set(code, room);
                // Instant real-time broadcast to all other players/spectators in room
                broadcastToRoom(code, {
                  type: payload.type || 'ROOM_UPDATE',
                  room,
                  meta: payload.meta,
                });
              }
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({ ok: true }));
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
          return;
        }

        if (url.startsWith('/api/rooms/') && req.method === 'GET') {
          const code = url.replace('/api/rooms/', '').split('?')[0].trim().toUpperCase();
          const room = roomsStore.get(code);
          res.setHeader('Content-Type', 'application/json');
          if (room) {
            res.statusCode = 200;
            res.end(JSON.stringify({ room }));
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Room not found' }));
          }
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), chessApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
