import fs from "node:fs";
import path from "node:path";
import Docker, { DockerOptions } from "dockerode";

const buildConfig = (): DockerOptions => {
  const dockerHost = process.env.DOCKER_HOST;

  if (dockerHost) {
    try {
      const url = new URL(dockerHost);
      const protocol = (url.protocol.replace(":", "") || "http") as DockerOptions["protocol"];
      const config: DockerOptions = {
        host: url.hostname,
        port: Number(url.port || 2375),
        protocol
      };

      const tlsVerify = process.env.DOCKER_TLS_VERIFY === "1";
      const certPath = process.env.DOCKER_CERT_PATH;

      if (tlsVerify && certPath) {
        try {
          const resolve = (file: string) => path.join(certPath, file);
          return {
            ...config,
            ca: fs.readFileSync(resolve("ca.pem")),
            cert: fs.readFileSync(resolve("cert.pem")),
            key: fs.readFileSync(resolve("key.pem"))
          };
        } catch (error) {
          console.warn("Failed to read Docker TLS certificates; continuing without TLS", error);
        }
      }

      return config;
    } catch (error) {
      console.warn("Failed to parse DOCKER_HOST; falling back to socket", error);
    }
  }

  return {
    socketPath: process.env.DOCKER_SOCKET_PATH ?? "/var/run/docker.sock"
  };
};

const docker = new Docker(buildConfig());

export default docker;
