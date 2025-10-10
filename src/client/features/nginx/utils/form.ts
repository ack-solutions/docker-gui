import type { NginxSite, SSLCertificate, UpstreamType } from "@/types/server";

export type SslMode = "none" | "lets-encrypt" | "custom";

export interface NginxFormState {
  id?: string;
  serverNames: string[];
  enableHttp: boolean;
  enableHttps: boolean;
  upstreamType: UpstreamType;
  upstreamTarget: string;
  sslMode: SslMode;
  letsEncryptEmail?: string;
  customCertificateId?: string;
  notes?: string;
  extraDirectives: string;
}

export const createDefaultForm = (): NginxFormState => ({
  serverNames: [],
  enableHttp: true,
  enableHttps: true,
  upstreamType: "service",
  upstreamTarget: "",
  sslMode: "lets-encrypt",
  letsEncryptEmail: "",
  customCertificateId: undefined,
  notes: "",
  extraDirectives: ""
});

export const toFormState = (site: NginxSite): NginxFormState => ({
  id: site.id,
  serverNames: site.serverNames,
  enableHttp: site.listen.some((entry) => entry.protocol === "http"),
  enableHttps: site.listen.some((entry) => entry.protocol === "https"),
  upstreamType: site.upstreamType,
  upstreamTarget: site.upstreamTarget,
  sslMode: site.sslCertificateId ? "custom" : "lets-encrypt",
  customCertificateId: site.sslCertificateId ?? undefined,
  letsEncryptEmail: "",
  notes: site.notes ?? "",
  extraDirectives: ""
});

export const buildNginxSite = (
  form: NginxFormState,
  certificates: SSLCertificate[]
): NginxSite => {
  const listen: NginxSite["listen"] = [];
  if (form.enableHttp) {
    listen.push({ port: 80, protocol: "http" });
  }
  if (form.enableHttps) {
    listen.push({ port: 443, protocol: "https" });
  }

  const sslCertificateId =
    form.sslMode === "custom" ? form.customCertificateId ?? null : null;

  return {
    id: form.id ?? `site-${Date.now()}`,
    serverNames: form.serverNames,
    listen: listen.length ? listen : [{ port: 80, protocol: "http" }],
    upstreamType: form.upstreamType,
    upstreamTarget: form.upstreamTarget,
    sslCertificateId,
    enabled: true,
    lastDeployedAt: undefined,
    createdAt: new Date().toISOString(),
    notes: form.notes
  };
};

export const generateConfigPreview = (
  form: NginxFormState,
  certificates: SSLCertificate[],
  managedDomains: string[]
): string => {
  const lines: string[] = [];
  lines.push("server {");

  if (form.enableHttp) {
    lines.push("    listen 80;");
  }
  if (form.enableHttps) {
    lines.push("    listen 443 ssl;");
  }

  if (form.serverNames.length) {
    lines.push(`    server_name ${form.serverNames.join(" ")};`);
  }

  if (form.enableHttps) {
    if (form.sslMode === "lets-encrypt") {
      lines.push("    # Managed by Let's Encrypt (acme.sh / certbot)");
      lines.push("    ssl_certificate /etc/letsencrypt/live/<domain>/fullchain.pem;");
      lines.push("    ssl_certificate_key /etc/letsencrypt/live/<domain>/privkey.pem;");
    } else if (form.sslMode === "custom" && form.customCertificateId) {
      const cert = certificates.find((c) => c.id === form.customCertificateId);
      lines.push(`    # Custom certificate (${cert?.commonName ?? ""})`);
      lines.push(`    ssl_certificate /etc/nginx/certs/${form.customCertificateId}.crt;`);
      lines.push(`    ssl_certificate_key /etc/nginx/certs/${form.customCertificateId}.key;`);
    } else {
      lines.push("    # TLS enabled but no certificate selected");
    }
  }

  lines.push("    location / {");
  if (form.upstreamType === "external") {
    lines.push(`        proxy_pass ${form.upstreamTarget};`);
  } else {
    lines.push("        proxy_set_header Host $host;");
    lines.push("        proxy_set_header X-Real-IP $remote_addr;");
    lines.push(`        proxy_pass http://${form.upstreamTarget};`);
  }
  lines.push("    }");

  if (form.extraDirectives.trim()) {
    lines.push("    # Custom directives");
    form.extraDirectives
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => lines.push(`    ${line}`));
  }

  lines.push("}");

  if (form.enableHttps && form.sslMode === "lets-encrypt") {
    lines.push("\n# Let's Encrypt certificate request configuration");
    lines.push("certbot certonly --nginx ");
    lines.push(`  -d ${form.serverNames.join(",")}`);
    if (form.letsEncryptEmail) {
      lines.push(`  -m ${form.letsEncryptEmail}`);
    }
    lines.push("  --agree-tos --no-eff-email");
  }

  if (managedDomains.length) {
    lines.push("\n# Managed domains:");
    managedDomains.forEach((domain) => lines.push(`- ${domain}`));
  }

  return lines.join("\n");
};
