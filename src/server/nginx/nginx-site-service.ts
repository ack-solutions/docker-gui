import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile as nodeExecFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import { getDataSource } from "@/server/database/data-source";
import {
  NginxProvisionLogEntity,
  type NginxProvisionLogLevel
} from "@/server/nginx/nginx-provision-log.entity";
import {
  NginxSiteEntity,
  type NginxSiteStatus,
  type NginxSslMode
} from "@/server/nginx/nginx-site.entity";
import { dockerService } from "@/server/docker/service";
import type { DockerContainerInspect } from "@/types/docker";
import type { NginxSite, NginxProvisionLog, UpstreamType } from "@/types/server";

const execFile = promisify(nodeExecFile);

const defaultConfigRoot = path.join(process.cwd(), ".data", "nginx");
const NGINX_CONFIG_ROOT = process.env.NGINX_CONFIG_ROOT ?? defaultConfigRoot;
const SITES_AVAILABLE_DIR = path.join(NGINX_CONFIG_ROOT, "sites-available");
const SITES_ENABLED_DIR = path.join(NGINX_CONFIG_ROOT, "sites-enabled");
const CERTBOT_BINARY = process.env.CERTBOT_BINARY ?? "certbot";
const CERTBOT_ADDL_ARGS = process.env.CERTBOT_ARGS?.split(" ").filter(Boolean) ?? [];
const NGINX_BINARY = process.env.NGINX_BINARY ?? "nginx";
const NGINX_TEST_ARGS = process.env.NGINX_TEST_ARGS?.split(" ").filter(Boolean) ?? ["-t"];

const splitCommand = (command: string) => {
  const trimmed = command.trim();
  if (!trimmed.includes(" ")) {
    return { command: trimmed, args: [] as string[] };
  }
  const [head, ...tail] = trimmed.split(/\s+/);
  return { command: head, args: tail };
};

const reloadParts = splitCommand(process.env.NGINX_RELOAD_COMMAND ?? `${NGINX_BINARY} -s reload`);
const NGINX_RELOAD_COMMAND = reloadParts.command;
const NGINX_RELOAD_ARGS = process.env.NGINX_RELOAD_ARGS?.split(" ").filter(Boolean) ?? reloadParts.args;
const NGINX_APPLY_DRY_RUN = process.env.NGINX_APPLY_DRY_RUN === "true";

const domainPattern = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(?:\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*$/;
const containerIdPattern = /^[a-f0-9]{12,64}$/i;

const domainSchema = z
  .string()
  .trim()
  .min(3)
  .max(255)
  .refine((value) => domainPattern.test(value), "Invalid domain name");

const upstreamTypeSchema = z.enum(["container", "service", "external"] as const satisfies readonly UpstreamType[]);
const sslModeSchema = z.enum(["none", "lets-encrypt", "custom"] as const satisfies readonly NginxSslMode[]);

const siteInputSchema = z
  .object({
    primaryDomain: domainSchema,
    serverNames: z.array(domainSchema).min(1),
    upstreamType: upstreamTypeSchema,
    upstreamTarget: z.string().trim().min(1).max(512).optional(),
    containerId: z.string().trim().regex(containerIdPattern).optional().nullable(),
    containerPort: z
      .number({ coerce: true })
      .int()
      .positive()
      .max(65535)
      .optional()
      .nullable(),
    enableHttp: z.boolean().default(true),
    enableHttps: z.boolean().default(true),
    forceHttps: z.boolean().default(false),
    sslMode: sslModeSchema.default("lets-encrypt"),
    letsEncryptEmail: z.string().trim().email().optional().nullable(),
    sslCertificateId: z.string().trim().max(255).optional().nullable(),
    enabled: z.boolean().default(true),
    notes: z.string().trim().max(2000).optional().nullable(),
    extraDirectives: z.string().trim().max(4000).optional().nullable()
  })
  .superRefine((value, ctx) => {
    const normalized = Array.from(new Set(value.serverNames.map((name) => name.toLowerCase())));
    if (!normalized.includes(value.primaryDomain.toLowerCase())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["serverNames"],
        message: "Primary domain must be included in server names list"
      });
    }

    if (value.upstreamType === "container") {
      if (!value.containerId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["containerId"],
          message: "Container ID is required when upstream type is container"
        });
      }
      if (!value.containerPort) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["containerPort"],
          message: "Container port is required when upstream type is container"
        });
      }
    } else if (!value.upstreamTarget) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["upstreamTarget"],
        message: "Upstream target is required"
      });
    }

    if (value.sslMode === "lets-encrypt" && value.enableHttps && !value.letsEncryptEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["letsEncryptEmail"],
        message: "Email address is required when using Let's Encrypt"
      });
    }

    if (value.sslMode === "custom" && !value.sslCertificateId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sslCertificateId"],
        message: "Certificate identifier is required when using custom certificates"
      });
    }
  });

export type NginxSiteInput = z.infer<typeof siteInputSchema>;

class CommandExecutionError extends Error {
  constructor(
    public readonly command: string,
    public readonly stdout: string,
    public readonly stderr: string,
    public readonly exitCode: number | null
  ) {
    super(`Command "${command}" failed with exit code ${exitCode ?? "unknown"}`);
  }
}

const ensureDirectories = async () => {
  await fs.mkdir(SITES_AVAILABLE_DIR, { recursive: true });
  await fs.mkdir(SITES_ENABLED_DIR, { recursive: true });
};

const siteConfigFilename = (siteId: string) => `nginx-site-${siteId}.conf`;

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);

const sanitizeServerNames = (primaryDomain: string, serverNames: string[]) => {
  const normalized = new Set<string>();
  normalized.add(primaryDomain.toLowerCase());
  serverNames.forEach((name) => normalized.add(name.toLowerCase()));
  return Array.from(normalized);
};

const runCommandStrict = async (command: string, args: string[] = []) => {
  try {
    const result = await execFile(command, args, { env: process.env });
    return {
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? ""
    };
  } catch (error) {
    if (error instanceof Error && "stdout" in error) {
      throw new CommandExecutionError(
        `${command} ${args.join(" ")}`.trim(),
        (error as any).stdout ?? "",
        (error as any).stderr ?? "",
        typeof (error as any).code === "number" ? (error as any).code : null
      );
    }
    throw error;
  }
};

const mapLogEntity = (log?: NginxProvisionLogEntity | null): NginxProvisionLog | null => {
  if (!log) {
    return null;
  }
  return {
    id: log.id,
    siteId: log.siteId,
    level: log.level,
    message: log.message,
    details: log.details ?? undefined,
    createdAt: log.createdAt.toISOString()
  };
};

const mapSiteEntity = (
  entity: NginxSiteEntity,
  lastLog?: NginxProvisionLogEntity | null
): NginxSite => ({
  id: entity.id,
  primaryDomain: entity.primaryDomain,
  serverNames: entity.serverNames,
  upstreamType: entity.upstreamType,
  upstreamTarget: entity.upstreamTarget,
  containerId: entity.containerId ?? undefined,
  containerPort: entity.containerPort ?? undefined,
  enableHttp: entity.enableHttp,
  enableHttps: entity.enableHttps,
  forceHttps: entity.forceHttps,
  sslMode: entity.sslMode,
  letsEncryptEmail: entity.letsEncryptEmail ?? undefined,
  sslCertificateId: entity.sslCertificateId ?? undefined,
  enabled: entity.enabled,
  status: entity.status,
  configPath: entity.configPath ?? undefined,
  lastAppliedAt: entity.lastAppliedAt ? entity.lastAppliedAt.toISOString() : undefined,
  lastValidatedAt: entity.lastValidatedAt ? entity.lastValidatedAt.toISOString() : undefined,
  lastError: entity.lastError ?? undefined,
  createdAt: entity.createdAt.toISOString(),
  updatedAt: entity.updatedAt.toISOString(),
  notes: entity.notes ?? undefined,
  extraDirectives: entity.extraDirectives ?? undefined,
  lastLog: mapLogEntity(lastLog)
});

const recordProvisionLog = async (
  siteId: string,
  level: NginxProvisionLogLevel,
  message: string,
  details?: Record<string, unknown>
) => {
  const dataSource = await getDataSource();
  const repo = dataSource.getRepository(NginxProvisionLogEntity);
  const log = repo.create({
    siteId,
    level,
    message,
    details: details ? JSON.parse(JSON.stringify(details)) : undefined
  });
  await repo.save(log);
  return log;
};

const resolveContainerUpstream = async (site: NginxSiteEntity): Promise<{
  targetUrl: string;
  description: string;
}> => {
  if (!site.containerId || !site.containerPort) {
    throw new Error("Container configuration incomplete");
  }

  const inspect = await dockerService.inspectContainer(site.containerId);
  const containerName = inspect.name.replace(/^\//, "");
  const networkName = inspect.hostConfig.networkMode ?? Object.keys(inspect.networkSettings.networks)[0];

  // Prefer Docker embedded DNS using container name.
  const hostname = networkName && networkName !== "default"
    ? `${containerName}`
    : inspect.networkSettings.ipAddress || containerName;

  const targetUrl = `http://${hostname}:${site.containerPort}`;
  const description = `${containerName}:${site.containerPort}`;
  return { targetUrl, description };
};

const resolveProxyTarget = async (
  site: NginxSiteEntity
): Promise<{ targetUrl: string; description: string }> => {
  if (site.upstreamType === "container") {
    return resolveContainerUpstream(site);
  }

  if (site.upstreamType === "external") {
    if (!isHttpUrl(site.upstreamTarget)) {
      throw new Error("External upstream targets must include protocol (http/https)");
    }
    return {
      targetUrl: site.upstreamTarget,
      description: site.upstreamTarget
    };
  }

  // service
  const target = isHttpUrl(site.upstreamTarget)
    ? site.upstreamTarget
    : `http://${site.upstreamTarget}`;
  return {
    targetUrl: target,
    description: target
  };
};

const buildProxyHeaders = () => [
  "proxy_set_header Host $host;",
  "proxy_set_header X-Real-IP $remote_addr;",
  "proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
  "proxy_set_header X-Forwarded-Proto $scheme;",
  "proxy_set_header X-Forwarded-Host $host;",
  "proxy_set_header X-Forwarded-Port $server_port;",
  "proxy_http_version 1.1;",
  "proxy_set_header Connection \"\";"
];

const generateNginxConfig = (site: NginxSiteEntity, proxyTarget: string) => {
  const lines: string[] = [];
  const serverNamesDirective = `server_name ${site.serverNames.join(" ")};`;
  const alsoHandlesHttps = site.enableHttps;

  lines.push(`# Generated by docker-gui at ${new Date().toISOString()}`);
  lines.push(`# Site: ${site.primaryDomain}`);
  lines.push("");

  if (site.enableHttp || !alsoHandlesHttps) {
    lines.push("server {");
    lines.push("    listen 80;");
    lines.push("    listen [::]:80;");
    lines.push(`    ${serverNamesDirective}`);

    lines.push("    location /.well-known/acme-challenge/ {");
    lines.push("        allow all;");
    lines.push("        root /var/www/letsencrypt;");
    lines.push("        default_type text/plain;");
    lines.push("    }");

    if (site.enableHttps && site.forceHttps) {
      lines.push("    if ($scheme = http) {");
      lines.push("        return 301 https://$host$request_uri;");
      lines.push("    }");
    }

    lines.push("    location / {");
    if (!site.enableHttps || !site.forceHttps) {
      lines.push(...buildProxyHeaders().map((line) => `        ${line}`));
      lines.push(`        proxy_pass ${proxyTarget};`);
    } else {
      lines.push("        return 301 https://$host$request_uri;");
    }
    lines.push("    }");
    lines.push("}");
    lines.push("");
  }

  if (site.enableHttps) {
    lines.push("server {");
    lines.push("    listen 443 ssl http2;");
    lines.push("    listen [::]:443 ssl http2;");
    lines.push(`    ${serverNamesDirective}`);

    if (site.sslMode === "lets-encrypt") {
      lines.push(`    ssl_certificate /etc/letsencrypt/live/${site.primaryDomain}/fullchain.pem;`);
      lines.push(`    ssl_certificate_key /etc/letsencrypt/live/${site.primaryDomain}/privkey.pem;`);
    } else if (site.sslMode === "custom" && site.sslCertificateId) {
      lines.push(`    ssl_certificate /etc/nginx/certs/${site.sslCertificateId}.crt;`);
      lines.push(`    ssl_certificate_key /etc/nginx/certs/${site.sslCertificateId}.key;`);
    } else {
      lines.push("    # TLS enabled without certificate selection; add certificate paths manually.");
    }

    lines.push("    ssl_session_timeout 5m;");
    lines.push("    ssl_protocols TLSv1.2 TLSv1.3;");
    lines.push("    ssl_ciphers HIGH:!aNULL:!MD5;");

    lines.push("    location / {");
    lines.push(...buildProxyHeaders().map((line) => `        ${line}`));
    lines.push(`        proxy_pass ${proxyTarget};`);
    lines.push("    }");

    lines.push("    location /.well-known/acme-challenge/ {");
    lines.push("        allow all;");
    lines.push("        root /var/www/letsencrypt;");
    lines.push("        default_type text/plain;");
    lines.push("    }");

    if (site.extraDirectives) {
      lines.push("");
      lines.push("    # Extra directives");
      site.extraDirectives
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((directive) => lines.push(`    ${directive}`));
    }

    lines.push("}");
  }

  return lines.join("\n");
};

const writeConfigFiles = async (siteId: string, config: string) => {
  await ensureDirectories();
  const filename = siteConfigFilename(siteId);
  const availablePath = path.join(SITES_AVAILABLE_DIR, filename);
  const enabledPath = path.join(SITES_ENABLED_DIR, filename);

  await fs.writeFile(availablePath, config, { encoding: "utf-8" });

  try {
    await fs.unlink(enabledPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  try {
    await fs.symlink(availablePath, enabledPath);
  } catch (error) {
    const errno = (error as NodeJS.ErrnoException).code;
    if (errno === "EEXIST") {
      // Already exists (race condition)
      return { availablePath, enabledPath };
    }

    if (errno === "EPERM" || errno === "EACCES" || errno === "EINVAL") {
      // Fall back to copying file on platforms where symlinks are restricted.
      await fs.copyFile(availablePath, enabledPath);
    } else {
      throw error;
    }
  }

  return { availablePath, enabledPath };
};

const removeConfigFiles = async (siteId: string) => {
  const filename = siteConfigFilename(siteId);
  const availablePath = path.join(SITES_AVAILABLE_DIR, filename);
  const enabledPath = path.join(SITES_ENABLED_DIR, filename);

  await Promise.allSettled([fs.unlink(availablePath), fs.unlink(enabledPath)]);
};

const testNginxConfiguration = async () => {
  if (NGINX_APPLY_DRY_RUN) {
    return { stdout: "Dry run: skipping nginx -t", stderr: "" };
  }
  return runCommandStrict(NGINX_BINARY, [...NGINX_TEST_ARGS]);
};

const reloadNginx = async () => {
  if (NGINX_APPLY_DRY_RUN) {
    return { stdout: "Dry run: skipping nginx reload", stderr: "" };
  }
  return runCommandStrict(NGINX_RELOAD_COMMAND, NGINX_RELOAD_ARGS);
};

const requestLetsEncryptCertificate = async (site: NginxSiteEntity) => {
  if (!site.enableHttps || site.sslMode !== "lets-encrypt") {
    return null;
  }

  if (!site.letsEncryptEmail) {
    throw new Error("Let's Encrypt email is required for certificate provisioning");
  }

  if (NGINX_APPLY_DRY_RUN) {
    return {
      stdout: "Dry run: skipping certbot execution",
      stderr: ""
    };
  }

  const args = [
    "certonly",
    "--nginx",
    "--agree-tos",
    "--non-interactive",
    "--no-eff-email",
    "-m",
    site.letsEncryptEmail,
    ...site.serverNames.flatMap((name) => ["-d", name]),
    ...CERTBOT_ADDL_ARGS
  ];

  return runCommandStrict(CERTBOT_BINARY, args);
};

const applySiteInternal = async (site: NginxSiteEntity) => {
  const { targetUrl, description } = await resolveProxyTarget(site);
  await recordProvisionLog(site.id, "info", `Resolved upstream target to ${description}`);

  const config = generateNginxConfig(site, targetUrl);
  const paths = await writeConfigFiles(site.id, config);
  await recordProvisionLog(site.id, "info", `Wrote configuration to ${paths.availablePath}`);

  try {
    const result = await testNginxConfiguration();
    await recordProvisionLog(site.id, "success", "nginx -t completed successfully", {
      stdout: result.stdout,
      stderr: result.stderr
    });
  } catch (error) {
    if (error instanceof CommandExecutionError) {
      const errorOutput = error.stderr || error.stdout || "Unknown error";
      await recordProvisionLog(site.id, "error", "nginx -t failed", {
        stdout: error.stdout,
        stderr: error.stderr,
        exitCode: error.exitCode
      });
      // Include the actual nginx error in the exception message
      throw new Error(`Nginx configuration test failed:\n${errorOutput}`);
    }
    throw error;
  }

  try {
    const result = await reloadNginx();
    await recordProvisionLog(site.id, "success", "Nginx reloaded successfully", {
      stdout: result.stdout,
      stderr: result.stderr
    });
  } catch (error) {
    if (error instanceof CommandExecutionError) {
      const errorOutput = error.stderr || error.stdout || "Unknown error";
      await recordProvisionLog(site.id, "error", "Failed to reload nginx", {
        stdout: error.stdout,
        stderr: error.stderr,
        exitCode: error.exitCode
      });
      throw new Error(`Failed to reload nginx:\n${errorOutput}`);
    }
    throw error;
  }

  if (site.enableHttps && site.sslMode === "lets-encrypt") {
    try {
      const result = await requestLetsEncryptCertificate(site);
      if (result) {
        await recordProvisionLog(site.id, "success", "Let's Encrypt certificate issued", {
          stdout: result.stdout,
          stderr: result.stderr
        });
      }
    } catch (error) {
      if (error instanceof CommandExecutionError) {
        const errorOutput = error.stderr || error.stdout || "Unknown error";
        await recordProvisionLog(site.id, "error", "Failed to request Let's Encrypt certificate", {
          stdout: error.stdout,
          stderr: error.stderr,
          exitCode: error.exitCode
        });
        throw new Error(`Failed to request Let's Encrypt certificate:\n${errorOutput}`);
      }
      throw error;
    }
  }
};

export const listNginxSites = async (): Promise<NginxSite[]> => {
  const dataSource = await getDataSource();
  const siteRepo = dataSource.getRepository(NginxSiteEntity);
  const sites = await siteRepo.find({ order: { createdAt: "DESC" } });

  const logRepo = dataSource.getRepository(NginxProvisionLogEntity);
  const logsBySite = new Map<string, NginxProvisionLogEntity | null>();
  for (const site of sites) {
    const log = await logRepo.findOne({
      where: { siteId: site.id },
      order: { createdAt: "DESC" }
    });
    logsBySite.set(site.id, log);
  }

  return sites.map((site) => mapSiteEntity(site, logsBySite.get(site.id) ?? undefined));
};

export const fetchNginxSite = async (siteId: string): Promise<NginxSite | null> => {
  const dataSource = await getDataSource();
  const siteRepo = dataSource.getRepository(NginxSiteEntity);
  const site = await siteRepo.findOne({ where: { id: siteId } });
  if (!site) {
    return null;
  }
  const logRepo = dataSource.getRepository(NginxProvisionLogEntity);
  const lastLog = await logRepo.findOne({
    where: { siteId },
    order: { createdAt: "DESC" }
  });
  return mapSiteEntity(site, lastLog ?? undefined);
};

export const createNginxSite = async (input: NginxSiteInput): Promise<NginxSite> => {
  const data = siteInputSchema.parse(input);
  const siteRepo = (await getDataSource()).getRepository(NginxSiteEntity);

  const site = siteRepo.create({
    id: crypto.randomUUID(),
    primaryDomain: data.primaryDomain,
    serverNames: sanitizeServerNames(data.primaryDomain, data.serverNames),
    upstreamType: data.upstreamType,
    upstreamTarget:
      data.upstreamType === "container"
        ? data.containerId ?? data.upstreamTarget ?? data.primaryDomain
        : data.upstreamTarget ?? data.primaryDomain,
    containerId: data.upstreamType === "container" ? data.containerId : null,
    containerPort: data.upstreamType === "container" ? data.containerPort : null,
    enableHttp: data.enableHttp,
    enableHttps: data.enableHttps,
    forceHttps: data.forceHttps,
    sslMode: data.sslMode,
    letsEncryptEmail: data.letsEncryptEmail ?? null,
    sslCertificateId: data.sslMode === "custom" ? data.sslCertificateId ?? null : null,
    enabled: data.enabled,
    status: data.enabled ? ("pending" as NginxSiteStatus) : ("draft" as NginxSiteStatus),
    notes: data.notes ?? null,
    extraDirectives: data.extraDirectives ?? null
  });

  await siteRepo.save(site);
  await recordProvisionLog(site.id, "info", "Site created");
  return mapSiteEntity(site);
};

export const updateNginxSite = async (siteId: string, input: NginxSiteInput): Promise<NginxSite> => {
  const dataSource = await getDataSource();
  const siteRepo = dataSource.getRepository(NginxSiteEntity);
  const site = await siteRepo.findOne({ where: { id: siteId } });
  if (!site) {
    throw new Error("Nginx site not found");
  }

  const data = siteInputSchema.parse(input);

  site.primaryDomain = data.primaryDomain;
  site.serverNames = sanitizeServerNames(data.primaryDomain, data.serverNames);
  site.upstreamType = data.upstreamType;
  site.upstreamTarget =
    data.upstreamType === "container"
      ? data.containerId ?? site.upstreamTarget
      : data.upstreamTarget ?? site.upstreamTarget;
  site.containerId = data.upstreamType === "container" ? data.containerId ?? null : null;
  site.containerPort = data.upstreamType === "container" ? data.containerPort ?? null : null;
  site.enableHttp = data.enableHttp;
  site.enableHttps = data.enableHttps;
  site.forceHttps = data.forceHttps;
  site.sslMode = data.sslMode;
  site.letsEncryptEmail = data.letsEncryptEmail ?? null;
  site.sslCertificateId = data.sslMode === "custom" ? data.sslCertificateId ?? null : null;
  site.enabled = data.enabled;
  site.notes = data.notes ?? null;
  site.extraDirectives = data.extraDirectives ?? null;
  site.status = site.enabled ? ("pending" as NginxSiteStatus) : ("draft" as NginxSiteStatus);

  await siteRepo.save(site);
  await recordProvisionLog(site.id, "info", "Site updated");
  return mapSiteEntity(site);
};

export const deleteNginxSite = async (siteId: string): Promise<void> => {
  const dataSource = await getDataSource();
  const siteRepo = dataSource.getRepository(NginxSiteEntity);
  const site = await siteRepo.findOne({ where: { id: siteId } });
  if (!site) {
    return;
  }
  await removeConfigFiles(siteId);
  await siteRepo.remove(site);
};

export const applyNginxSite = async (siteId: string): Promise<NginxSite> => {
  const dataSource = await getDataSource();
  const siteRepo = dataSource.getRepository(NginxSiteEntity);
  const site = await siteRepo.findOne({ where: { id: siteId } });
  if (!site) {
    throw new Error("Nginx site not found");
  }

  site.status = "pending";
  site.lastError = null;
  site.enabled = true;
  await siteRepo.save(site);

  await recordProvisionLog(site.id, "info", "Starting provisioning run");

  try {
    await applySiteInternal(site);
    site.status = "active";
    site.lastAppliedAt = new Date();
    site.lastValidatedAt = new Date();
    await siteRepo.save(site);
    await recordProvisionLog(site.id, "success", "Provisioning completed");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provisioning failed";
    site.status = "error";
    site.lastError = message;
    await siteRepo.save(site);
    await recordProvisionLog(site.id, "error", message);
    throw error;
  }

  const logRepo = dataSource.getRepository(NginxProvisionLogEntity);
  const lastLog = await logRepo.findOne({
    where: { siteId },
    order: { createdAt: "DESC" }
  });
  return mapSiteEntity(site, lastLog ?? undefined);
};

export const fetchNginxProvisionLogs = async (
  siteId: string,
  limit = 50
): Promise<NginxProvisionLog[]> => {
  const dataSource = await getDataSource();
  const logRepo = dataSource.getRepository(NginxProvisionLogEntity);
  const logs = await logRepo.find({
    where: { siteId },
    order: { createdAt: "DESC" },
    take: limit
  });
  return logs.map((log) => mapLogEntity(log)!);
};
