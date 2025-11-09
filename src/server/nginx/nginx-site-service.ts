import fs from "node:fs/promises";
import path from "node:path";
import { execFile as nodeExecFile } from "node:child_process";
import { promisify } from "node:util";
import * as yup from "yup";
import type { InferType } from "yup";
import type { Prisma, NginxProvisionLog as PrismaProvisionLog, NginxSite as PrismaNginxSite } from "@prisma/client";
import { prisma } from "@/server/database/client";
import { dockerService } from "@/server/docker/service";
import type { NginxSite, NginxProvisionLog, UpstreamType, NginxSiteStatus, NginxSslMode } from "@/types/server";

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

const reloadParts = splitCommand(`${NGINX_BINARY} -s reload`);
const NGINX_RELOAD_COMMAND = reloadParts.command;
const NGINX_RELOAD_ARGS = process.env.NGINX_RELOAD_ARGS?.split(" ").filter(Boolean) ?? reloadParts.args;
const NGINX_APPLY_DRY_RUN = process.env.NGINX_APPLY_DRY_RUN === "true";

const domainPattern = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(?:\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*$/;
const containerIdPattern = /^[a-f0-9]{12,64}$/i;

type NginxProvisionLogLevel = NginxProvisionLog["level"];

const domainSchema = yup
  .string()
  .trim()
  .min(3)
  .max(255)
  .test("valid-domain", "Invalid domain name", (value) => !value || domainPattern.test(value))
  .required();

const upstreamTypeSchema = yup
  .mixed<UpstreamType>()
  .oneOf(["container", "service", "external"])
  .required();

const sslModeSchema = yup
  .mixed<NginxSslMode>()
  .oneOf(["none", "lets-encrypt", "custom"])
  .default("lets-encrypt")
  .required();

const coerceNullableString = () =>
  yup
    .string()
    .trim()
    .transform((value, originalValue) => (originalValue === undefined || originalValue === null || originalValue === "" ? undefined : value))
    .nullable();

const nullableString = () =>
  coerceNullableString()
    .max(255)
    .nullable()
    .transform((value) => (value === undefined ? null : value));

const siteInputSchema = yup
  .object({
    primaryDomain: domainSchema.required(),
    serverNames: yup.array().of(domainSchema).min(1).required(),
    upstreamType: upstreamTypeSchema,
    upstreamTarget: coerceNullableString().max(512),
    containerId: coerceNullableString()
      .matches(containerIdPattern, "Invalid container id")
      .nullable()
      .transform((value) => (value === undefined ? null : value)),
    containerPort: yup
      .number()
      .transform((value, originalValue) => {
        if (originalValue === undefined || originalValue === null || originalValue === "") {
          return null;
        }
        const parsed = Number(originalValue);
        return Number.isNaN(parsed) ? value : parsed;
      })
      .integer()
      .positive()
      .max(65535)
      .nullable()
      .default(null),
    enableHttp: yup.boolean().default(true).required(),
    enableHttps: yup.boolean().default(true).required(),
    forceHttps: yup.boolean().default(false).required(),
    sslMode: sslModeSchema,
    letsEncryptEmail: coerceNullableString().email("Invalid email address").nullable().transform((value) => (value === undefined ? null : value)),
    sslCertificateId: nullableString(),
    enabled: yup.boolean().default(true).required(),
    notes: coerceNullableString().max(2000).nullable().transform((value) => (value === undefined ? null : value)),
    extraDirectives: coerceNullableString().max(4000).nullable().transform((value) => (value === undefined ? null : value))
  })
  .noUnknown()
  .test("primary-domain-in-server-names", "Primary domain must be included in server names list", function (value) {
    if (!value) {
      return false;
    }
    const normalized = new Set(value.serverNames.map((name) => name.toLowerCase()));
    return normalized.has(value.primaryDomain.toLowerCase());
  })
  .test("upstream-requirements", "Upstream configuration incomplete", function (value) {
    if (!value) {
      return false;
    }

    if (value.upstreamType === "container") {
      if (!value.containerId) {
        return this.createError({
          path: "containerId",
          message: "Container ID is required when upstream type is container"
        });
      }
      if (!value.containerPort) {
        return this.createError({
          path: "containerPort",
          message: "Container port is required when upstream type is container"
        });
      }
      return true;
    }

    if (!value.upstreamTarget) {
      return this.createError({
        path: "upstreamTarget",
        message: "Upstream target is required"
      });
    }

    return true;
  })
  .test("lets-encrypt-email", "Email address is required when using Let's Encrypt", function (value) {
    if (!value) {
      return false;
    }
    if (value.sslMode === "lets-encrypt" && value.enableHttps && !value.letsEncryptEmail) {
      return this.createError({
        path: "letsEncryptEmail",
        message: "Email address is required when using Let's Encrypt"
      });
    }
    return true;
  })
  .test("custom-cert-id", "Certificate identifier is required when using custom certificates", function (value) {
    if (!value) {
      return false;
    }
    if (value.sslMode === "custom" && !value.sslCertificateId) {
      return this.createError({
        path: "sslCertificateId",
        message: "Certificate identifier is required when using custom certificates"
      });
    }
    return true;
  });

export type NginxSiteInput = InferType<typeof siteInputSchema>;

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

const jsonToStringArray = (value: Prisma.JsonValue | null | undefined): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
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

const mapLogEntity = (log?: PrismaProvisionLog | null): NginxProvisionLog | null => {
  if (!log) {
    return null;
  }
  return {
    id: log.id,
    siteId: log.siteId,
    level: log.level as NginxProvisionLogLevel,
    message: log.message,
    details: log.details ?? {} as any,
    createdAt: log.createdAt.toISOString()
  };
};

const mapSiteEntity = (
  entity: PrismaNginxSite,
  lastLog?: PrismaProvisionLog | null
): NginxSite => ({
  id: entity.id,
  primaryDomain: entity.primaryDomain,
  serverNames: jsonToStringArray(entity.serverNames),
  upstreamType: entity.upstreamType as UpstreamType,
  upstreamTarget: entity.upstreamTarget,
  containerId: entity.containerId ?? undefined,
  containerPort: entity.containerPort ?? undefined,
  enableHttp: entity.enableHttp,
  enableHttps: entity.enableHttps,
  forceHttps: entity.forceHttps,
  sslMode: entity.sslMode as NginxSslMode,
  letsEncryptEmail: entity.letsEncryptEmail ?? undefined,
  sslCertificateId: entity.sslCertificateId ?? undefined,
  enabled: entity.enabled,
  status: entity.status as NginxSiteStatus,
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
  return prisma.nginxProvisionLog.create({
    data: {
      siteId,
      level,
      message,
      details: details ? JSON.parse(JSON.stringify(details)) : undefined
    }
  });
};

const resolveContainerUpstream = async (site: PrismaNginxSite): Promise<{
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
  site: PrismaNginxSite
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

const generateNginxConfig = (site: PrismaNginxSite, proxyTarget: string) => {
  const lines: string[] = [];
  const serverNames = jsonToStringArray(site.serverNames);
  const serverNamesDirective = `server_name ${serverNames.join(" ")};`;
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

const requestLetsEncryptCertificate = async (site: PrismaNginxSite) => {
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
    ...jsonToStringArray(site.serverNames).flatMap((name) => ["-d", name]),
    ...CERTBOT_ADDL_ARGS
  ];

  return runCommandStrict(CERTBOT_BINARY, args);
};

const applySiteInternal = async (site: PrismaNginxSite) => {
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
  const sites = await prisma.nginxSite.findMany({ orderBy: { createdAt: "desc" } });

  const logsBySite = new Map<string, PrismaProvisionLog | null>();
  await Promise.all(
    sites.map(async (site) => {
      const log = await prisma.nginxProvisionLog.findFirst({
        where: { siteId: site.id },
        orderBy: { createdAt: "desc" }
      });
      logsBySite.set(site.id, log);
    })
  );

  return sites.map((site) => mapSiteEntity(site, logsBySite.get(site.id) ?? undefined));
};

export const fetchNginxSite = async (siteId: string): Promise<NginxSite | null> => {
  const site = await prisma.nginxSite.findUnique({ where: { id: siteId } });
  if (!site) {
    return null;
  }
  const lastLog = await prisma.nginxProvisionLog.findFirst({
    where: { siteId },
    orderBy: { createdAt: "desc" }
  });
  return mapSiteEntity(site, lastLog ?? undefined);
};

export const createNginxSite = async (input: NginxSiteInput): Promise<NginxSite> => {
  const data = await siteInputSchema.validate(input, { abortEarly: false, stripUnknown: true });
  const site = await prisma.nginxSite.create({
    data: {
      primaryDomain: data.primaryDomain,
      serverNames: sanitizeServerNames(data.primaryDomain, data.serverNames),
      upstreamType: data.upstreamType,
      upstreamTarget:
        data.upstreamType === "container"
          ? data.containerId ?? data.upstreamTarget ?? data.primaryDomain
          : data.upstreamTarget ?? data.primaryDomain,
      containerId: data.upstreamType === "container" ? data.containerId ?? null : null,
      containerPort: data.upstreamType === "container" ? data.containerPort ?? null : null,
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
    }
  });
  await recordProvisionLog(site.id, "info", "Site created");
  return mapSiteEntity(site);
};

export const updateNginxSite = async (siteId: string, input: NginxSiteInput): Promise<NginxSite> => {
  const site = await prisma.nginxSite.findUnique({ where: { id: siteId } });
  if (!site) {
    throw new Error("Nginx site not found");
  }

  const data = await siteInputSchema.validate(input, { abortEarly: false, stripUnknown: true });

  const updated = await prisma.nginxSite.update({
    where: { id: siteId },
    data: {
      primaryDomain: data.primaryDomain,
      serverNames: sanitizeServerNames(data.primaryDomain, data.serverNames),
      upstreamType: data.upstreamType,
      upstreamTarget:
        data.upstreamType === "container"
          ? data.containerId ?? site.upstreamTarget
          : data.upstreamTarget ?? site.upstreamTarget,
      containerId: data.upstreamType === "container" ? data.containerId ?? null : null,
      containerPort: data.upstreamType === "container" ? data.containerPort ?? null : null,
      enableHttp: data.enableHttp,
      enableHttps: data.enableHttps,
      forceHttps: data.forceHttps,
      sslMode: data.sslMode,
      letsEncryptEmail: data.letsEncryptEmail ?? null,
      sslCertificateId: data.sslMode === "custom" ? data.sslCertificateId ?? null : null,
      enabled: data.enabled,
      notes: data.notes ?? null,
      extraDirectives: data.extraDirectives ?? null,
      status: data.enabled ? ("pending" as NginxSiteStatus) : ("draft" as NginxSiteStatus)
    }
  });

  await recordProvisionLog(updated.id, "info", "Site updated");
  return mapSiteEntity(updated);
};

export const deleteNginxSite = async (siteId: string): Promise<void> => {
  const site = await prisma.nginxSite.findUnique({ where: { id: siteId } });
  if (!site) {
    return;
  }
  await removeConfigFiles(siteId);
  await prisma.nginxSite.delete({ where: { id: siteId } });
};

export const applyNginxSite = async (siteId: string): Promise<NginxSite> => {
  let site = await prisma.nginxSite.findUnique({ where: { id: siteId } });
  if (!site) {
    throw new Error("Nginx site not found");
  }

  site = await prisma.nginxSite.update({
    where: { id: siteId },
    data: {
      status: "pending",
      lastError: null,
      enabled: true
    }
  });

  await recordProvisionLog(site.id, "info", "Starting provisioning run");

  try {
    await applySiteInternal(site);
    site = await prisma.nginxSite.update({
      where: { id: siteId },
      data: {
        status: "active",
        lastAppliedAt: new Date(),
        lastValidatedAt: new Date(),
        lastError: null
      }
    });
    await recordProvisionLog(site.id, "success", "Provisioning completed");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provisioning failed";
    site = await prisma.nginxSite.update({
      where: { id: siteId },
      data: {
        status: "error",
        lastError: message
      }
    });
    await recordProvisionLog(site.id, "error", message);
    throw error;
  }

  const lastLog = await prisma.nginxProvisionLog.findFirst({
    where: { siteId },
    orderBy: { createdAt: "desc" }
  });
  return mapSiteEntity(site, lastLog ?? undefined);
};

export const fetchNginxProvisionLogs = async (
  siteId: string,
  limit = 50
): Promise<NginxProvisionLog[]> => {
  const logs = await prisma.nginxProvisionLog.findMany({
    where: { siteId },
    orderBy: { createdAt: "desc" },
    take: limit
  });
  return logs.map((log) => mapLogEntity(log)!);
};
