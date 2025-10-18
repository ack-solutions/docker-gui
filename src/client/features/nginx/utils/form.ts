import type {
  NginxSite,
  NginxSslMode,
  SSLCertificate,
  UpstreamType
} from "@/types/server";

export interface NginxFormState {
  id?: string;
  primaryDomain: string;
  aliases: string[];
  enableHttp: boolean;
  enableHttps: boolean;
  forceHttps: boolean;
  upstreamType: UpstreamType;
  upstreamTarget: string;
  containerId?: string;
  containerPort?: number;
  sslMode: NginxSslMode;
  letsEncryptEmail?: string;
  customCertificateId?: string;
  enabled: boolean;
  notes?: string;
  extraDirectives: string;
}

const sanitizeAliasList = (aliases: string[]) =>
  aliases
    .map((alias) => alias.trim())
    .filter((alias) => Boolean(alias))
    .filter((alias, index, self) => self.indexOf(alias) === index);

export const createDefaultForm = (): NginxFormState => ({
  primaryDomain: "",
  aliases: [],
  enableHttp: true,
  enableHttps: true,
  forceHttps: false,
  upstreamType: "service",
  upstreamTarget: "",
  containerId: undefined,
  containerPort: undefined,
  sslMode: "lets-encrypt",
  letsEncryptEmail: "",
  customCertificateId: undefined,
  enabled: true,
  notes: "",
  extraDirectives: ""
});

export const toFormState = (site: NginxSite): NginxFormState => {
  const aliases = site.serverNames.filter(
    (name) => name.toLowerCase() !== site.primaryDomain.toLowerCase()
  );
  return {
    id: site.id,
    primaryDomain: site.primaryDomain,
    aliases,
    enableHttp: site.enableHttp,
    enableHttps: site.enableHttps,
    forceHttps: site.forceHttps,
    upstreamType: site.upstreamType,
    upstreamTarget: site.upstreamType === "external"
      ? site.upstreamTarget
      : site.upstreamTarget.replace(/^https?:\/\//i, ""),
    containerId: site.containerId,
    containerPort: site.containerPort,
    sslMode: site.sslMode,
    letsEncryptEmail: site.letsEncryptEmail ?? "",
    customCertificateId: site.sslCertificateId ?? undefined,
    enabled: site.enabled,
    notes: site.notes ?? "",
    extraDirectives: site.extraDirectives ?? ""
  };
};

export interface NginxSitePayload {
  primaryDomain: string;
  serverNames: string[];
  upstreamType: UpstreamType;
  upstreamTarget?: string;
  containerId?: string | null;
  containerPort?: number | null;
  enableHttp: boolean;
  enableHttps: boolean;
  forceHttps: boolean;
  sslMode: NginxSslMode;
  letsEncryptEmail?: string | null;
  sslCertificateId?: string | null;
  enabled: boolean;
  notes?: string | null;
  extraDirectives?: string | null;
}

const buildServerNames = (primaryDomain: string, aliases: string[]) => {
  const values = [primaryDomain, ...aliases];
  return Array.from(
    new Set(values.map((name) => name.trim()).filter((name) => Boolean(name)))
  );
};

export const buildSitePayload = (form: NginxFormState): NginxSitePayload => {
  const serverNames = buildServerNames(form.primaryDomain, sanitizeAliasList(form.aliases));
  const payload: NginxSitePayload = {
    primaryDomain: form.primaryDomain.trim(),
    serverNames,
    upstreamType: form.upstreamType,
    enableHttp: form.enableHttp,
    enableHttps: form.enableHttps,
    forceHttps: form.forceHttps,
    sslMode: form.sslMode,
    enabled: form.enabled,
    notes: form.notes?.trim() ? form.notes.trim() : null,
    extraDirectives: form.extraDirectives?.trim() ? form.extraDirectives.trim() : null
  };

  if (form.upstreamType === "container") {
    payload.containerId = form.containerId ?? null;
    payload.containerPort = form.containerPort ?? null;
    payload.upstreamTarget = undefined;
  } else {
    payload.containerId = null;
    payload.containerPort = null;
    payload.upstreamTarget = form.upstreamTarget.trim();
  }

  if (form.sslMode === "lets-encrypt" && form.enableHttps) {
    payload.letsEncryptEmail = form.letsEncryptEmail?.trim() || null;
  } else if (form.sslMode === "custom") {
    payload.sslCertificateId = form.customCertificateId ?? null;
  }

  return payload;
};

export const generateConfigPreview = (
  form: NginxFormState,
  certificates: SSLCertificate[]
): string => {
  const serverNames = buildServerNames(form.primaryDomain, form.aliases);
  const lines: string[] = [];

  lines.push("# Preview configuration");
  lines.push(`server_name ${serverNames.join(" ")};`);
  lines.push("");

  if (form.enableHttp) {
    lines.push("server {");
    lines.push("    listen 80;");
    lines.push("    listen [::]:80;");
    lines.push(`    server_name ${serverNames.join(" ")};`);
    lines.push("    location /.well-known/acme-challenge/ {");
    lines.push("        allow all;");
    lines.push("        root /var/www/letsencrypt;");
    lines.push("    }");
    if (form.enableHttps && form.forceHttps) {
      lines.push("    return 301 https://$host$request_uri;");
    } else {
      lines.push("    location / {");
      lines.push("        proxy_set_header Host $host;");
      lines.push("        proxy_set_header X-Real-IP $remote_addr;");
      const upstream = form.upstreamType === "external"
        ? form.upstreamTarget
        : `http://${form.upstreamType === "service" ? form.upstreamTarget : `${form.containerId}:${form.containerPort}`}`;
      lines.push(`        proxy_pass ${upstream};`);
      lines.push("    }");
    }
    lines.push("}");
    lines.push("");
  }

  if (form.enableHttps) {
    lines.push("server {");
    lines.push("    listen 443 ssl http2;");
    lines.push("    listen [::]:443 ssl http2;");
    lines.push(`    server_name ${serverNames.join(" ")};`);
    if (form.sslMode === "lets-encrypt") {
      lines.push(`    ssl_certificate /etc/letsencrypt/live/${form.primaryDomain}/fullchain.pem;`);
      lines.push(`    ssl_certificate_key /etc/letsencrypt/live/${form.primaryDomain}/privkey.pem;`);
    } else if (form.sslMode === "custom" && form.customCertificateId) {
      const cert = certificates.find((certificate) => certificate.id === form.customCertificateId);
      lines.push(`    # Using custom certificate ${cert?.commonName ?? form.customCertificateId}`);
      lines.push(`    ssl_certificate /etc/nginx/certs/${form.customCertificateId}.crt;`);
      lines.push(`    ssl_certificate_key /etc/nginx/certs/${form.customCertificateId}.key;`);
    } else {
      lines.push("    # TLS is enabled but certificate paths are not configured");
    }
    lines.push("    location / {");
    lines.push("        proxy_set_header Host $host;");
    lines.push("        proxy_set_header X-Real-IP $remote_addr;");
    const upstream = form.upstreamType === "external"
      ? form.upstreamTarget
      : `http://${form.upstreamType === "service" ? form.upstreamTarget : `${form.containerId}:${form.containerPort}`}`;
    lines.push(`        proxy_pass ${upstream};`);
    lines.push("    }");
    if (form.extraDirectives.trim()) {
      lines.push("");
      lines.push("    # Additional directives");
      form.extraDirectives
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((directive) => lines.push(`    ${directive}`));
    }
    lines.push("}");
  }

  return lines.join("\n");
};
