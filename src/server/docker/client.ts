import fs from "node:fs";
import path from "node:path";
import Docker, { DockerOptions } from "dockerode";
import { config } from "@/server/config";

const buildConfig = (): DockerOptions => {
  const dockerHost = config.docker.host;

  if (dockerHost && !dockerHost.startsWith("unix://") && !dockerHost.startsWith("npipe://")) {
    try {
      const url = new URL(dockerHost);
      const protocol = (url.protocol.replace(":", "") || "http") as DockerOptions["protocol"];
      const dockerConfig: DockerOptions = {
        host: url.hostname,
        port: Number(url.port || 2375),
        protocol
      };

      const tlsVerify = config.docker.tlsVerify;
      const certPath = config.docker.certPath;

      if (tlsVerify && certPath) {
        try {
          const resolve = (file: string) => path.join(certPath, file);
          return {
            ...dockerConfig,
            ca: fs.readFileSync(resolve("ca.pem")),
            cert: fs.readFileSync(resolve("cert.pem")),
            key: fs.readFileSync(resolve("key.pem"))
          };
        } catch (error) {
          console.warn("Failed to read Docker TLS certificates; continuing without TLS", error);
        }
      }

      return dockerConfig;
    } catch (error) {
      console.warn("Failed to parse DOCKER_HOST; falling back to socket", error);
    }
  }

  // Handle socket paths (unix:// or npipe://)
  const socketPath = dockerHost.replace(/^(unix|npipe):\/\//, '');
  return {
    socketPath
  };
};

const docker = new Docker(buildConfig());

export default docker;
