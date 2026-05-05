import type { FastifyPluginAsync } from 'fastify';
import websocketPlugin from '@fastify/websocket';
import {
  DockerContainersService,
  LogStreamDemuxer,
} from '../services/docker-containers.service.js';
import { verifyWsToken } from '../lib/ws-auth.js';
import type { JwtConfig } from '../lib/jwt.js';

export interface WsRoutesOptions {
  containers: DockerContainersService;
  jwtConfig: JwtConfig;
}

interface WsMessage {
  /**
   * Discriminator for messages from server → client.
   * - `meta`: stream opened / closed
   * - `log`:  one log line (or chunk) with stream tag
   * - `error`: server-side error description (connection will close)
   */
  kind: 'meta' | 'log' | 'error';
  stream?: 'stdout' | 'stderr';
  text?: string;
  message?: string;
}

function send(socket: { send: (data: string) => void }, msg: WsMessage): void {
  try {
    socket.send(JSON.stringify(msg));
  } catch {
    // socket likely closed; nothing useful to do
  }
}

export const wsRoutes: FastifyPluginAsync<WsRoutesOptions> = async (app, opts) => {
  await app.register(websocketPlugin, { options: { maxPayload: 1024 * 1024 } });

  // ---- /ws/logs/:id ----
  // Live container logs. Auth: ?token=<access>. Optional ?tail=N (default 100).
  app.get<{ Params: { id: string }; Querystring: { token?: string; tail?: string } }>(
    '/ws/logs/:id',
    { websocket: true },
    (socket, req) => {
      let dockerStream: NodeJS.ReadableStream | null = null;
      let closed = false;

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (dockerStream && 'destroy' in dockerStream && typeof (dockerStream as { destroy?: unknown }).destroy === 'function') {
          try {
            (dockerStream as unknown as { destroy: () => void }).destroy();
          } catch {
            // ignore
          }
        }
      };

      try {
        verifyWsToken(req.url, opts.jwtConfig);
      } catch (err) {
        send(socket, { kind: 'error', message: err instanceof Error ? err.message : 'Auth failed' });
        socket.close(1008, 'Unauthorized');
        return;
      }

      const tailRaw = req.query?.tail;
      const tail = tailRaw ? Math.min(Math.max(parseInt(tailRaw, 10) || 100, 0), 5000) : 100;

      const containerId = req.params.id;
      send(socket, { kind: 'meta', message: `attached to ${containerId}` });

      const demuxer = new LogStreamDemuxer();
      opts.containers
        .streamLogs(containerId, { tail })
        .then((stream) => {
          if (closed) {
            try {
              (stream as unknown as { destroy?: () => void }).destroy?.();
            } catch {
              // ignore
            }
            return;
          }
          dockerStream = stream;
          stream.on('data', (chunk: Buffer) => {
            demuxer.feed(chunk, (kind, text) => {
              send(socket, { kind: 'log', stream: kind, text });
            });
          });
          stream.on('end', () => {
            send(socket, { kind: 'meta', message: 'stream ended' });
            socket.close(1000, 'stream ended');
          });
          stream.on('error', (err: Error) => {
            send(socket, { kind: 'error', message: err.message });
            socket.close(1011, 'stream error');
          });
        })
        .catch((err: unknown) => {
          send(socket, {
            kind: 'error',
            message: err instanceof Error ? err.message : 'Failed to open log stream',
          });
          socket.close(1011, 'open error');
        });

      socket.on('close', cleanup);
      socket.on('error', cleanup);
    },
  );
};
