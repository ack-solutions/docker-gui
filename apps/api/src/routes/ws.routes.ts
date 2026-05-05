import type { FastifyPluginAsync } from 'fastify';
import websocketPlugin from '@fastify/websocket';
import {
  DockerContainersService,
  LogStreamDemuxer,
  type ExecSession,
} from '../services/docker-containers.service.js';
import { verifyWsToken } from '../lib/ws-auth.js';
import type { JwtConfig } from '../lib/jwt.js';

export interface WsRoutesOptions {
  containers: DockerContainersService;
  jwtConfig: JwtConfig;
}

/**
 * Server → client message envelope.
 * - `meta`:  attach / detach / lifecycle notice
 * - `log`:   stdout/stderr line (logs route only — multiplexed)
 * - `data`:  raw TTY bytes (exec route only — single combined stream)
 * - `exit`:  exec process exited with `code`
 * - `error`: server-side error; connection closing
 */
interface ServerMessage {
  kind: 'meta' | 'log' | 'data' | 'exit' | 'error';
  stream?: 'stdout' | 'stderr';
  text?: string;
  data?: string;
  message?: string;
  code?: number | null;
}

/**
 * Client → server message envelope (exec route).
 * - `input`:  user typed/pasted keystrokes; `data` is the literal bytes
 * - `resize`: terminal size changed; pty needs `rows` + `cols`
 */
interface ClientExecMessage {
  kind: 'input' | 'resize';
  data?: string;
  rows?: number;
  cols?: number;
}

function send(socket: { send: (data: string) => void }, msg: ServerMessage): void {
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

  // ---- /ws/exec/:id ----
  // Interactive container exec. Auth: ?token=<access>.
  // Optional ?cmd=<shell> (default "/bin/sh"), ?cols, ?rows for initial TTY size.
  app.get<{
    Params: { id: string };
    Querystring: { token?: string; cmd?: string; cols?: string; rows?: string };
  }>(
    '/ws/exec/:id',
    { websocket: true },
    (socket, req) => {
      let session: ExecSession | null = null;
      let closed = false;

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (session) {
          try {
            session.stream.end();
          } catch {
            // ignore
          }
          try {
            (session.stream as unknown as { destroy?: () => void }).destroy?.();
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

      const containerId = req.params.id;
      const cmdRaw = req.query?.cmd?.trim() || '/bin/sh';
      // Split on whitespace; users can pass "/bin/sh -l" for a login shell.
      const cmd = cmdRaw.split(/\s+/).filter((s) => s.length > 0);
      const cols = clampInt(req.query?.cols, 80, 20, 500);
      const rows = clampInt(req.query?.rows, 24, 5, 200);

      send(socket, { kind: 'meta', message: `attaching to ${containerId}` });

      opts.containers
        .exec(containerId, { cmd, cols, rows })
        .then((s) => {
          if (closed) {
            try {
              s.stream.end();
            } catch {
              // ignore
            }
            return;
          }
          session = s;
          send(socket, { kind: 'meta', message: `attached: ${cmdRaw}` });

          s.stream.on('data', (chunk: Buffer) => {
            send(socket, { kind: 'data', data: chunk.toString('utf8') });
          });
          s.stream.on('end', () => {
            // Process exited; read its exit code, then close cleanly.
            s.inspect()
              .then(({ exitCode }) => {
                send(socket, { kind: 'exit', code: exitCode });
                socket.close(1000, 'exited');
              })
              .catch(() => {
                send(socket, { kind: 'exit', code: null });
                socket.close(1000, 'exited');
              });
          });
          s.stream.on('error', (err: Error) => {
            send(socket, { kind: 'error', message: err.message });
            socket.close(1011, 'stream error');
          });
        })
        .catch((err: unknown) => {
          send(socket, {
            kind: 'error',
            message: err instanceof Error ? err.message : 'Failed to start exec',
          });
          socket.close(1011, 'open error');
        });

      socket.on('message', (raw: Buffer) => {
        if (!session || closed) return;
        let msg: ClientExecMessage;
        try {
          msg = JSON.parse(raw.toString('utf8')) as ClientExecMessage;
        } catch {
          return;
        }
        if (msg.kind === 'input' && typeof msg.data === 'string') {
          try {
            session.stream.write(msg.data);
          } catch {
            // stream gone; will be closed by the socket-close handler
          }
        } else if (msg.kind === 'resize' && typeof msg.rows === 'number' && typeof msg.cols === 'number') {
          session
            .resize(Math.floor(msg.rows), Math.floor(msg.cols))
            .catch(() => {
              // benign — terminal will recover on the next write
            });
        }
      });

      socket.on('close', cleanup);
      socket.on('error', cleanup);
    },
  );
};

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}
