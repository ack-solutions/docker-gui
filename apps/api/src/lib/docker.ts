import Docker from 'dockerode';
import type { Config } from '../config.js';

const DEFAULT_SOCKET = '/var/run/docker.sock';

export function createDockerClient(config: Config): Docker {
  const socketPath = config.DOCKER_SOCKET ?? DEFAULT_SOCKET;
  return new Docker({ socketPath });
}
