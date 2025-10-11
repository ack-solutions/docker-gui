import type {
  EmailAccount,
  EmailServiceInfo,
  NginxSite,
  ProxyRoute,
  SSLCertificate,
  ServerDomain
} from "@/types/server";
import type { SystemMetrics } from "@/types/system";

const now = Date.now();
const oneDay = 1000 * 60 * 60 * 24;

export const mockDomains: ServerDomain[] = [
  {
    id: "dom-001",
    name: "example.com",
    status: "active",
    provider: "Cloudflare",
    managed: true,
    sslCertificateId: "cert-001",
    targetService: "nginx-prod",
    createdAt: new Date(now - oneDay * 180).toISOString(),
    updatedAt: new Date(now - oneDay).toISOString(),
    notes: "Primary production domain",
    records: [
      { id: "rec-001", type: "A", host: "@", value: "203.0.113.10", ttl: 300, updatedAt: new Date(now - oneDay).toISOString() },
      { id: "rec-002", type: "CNAME", host: "www", value: "@", ttl: 300, updatedAt: new Date(now - oneDay).toISOString() },
      { id: "rec-003", type: "TXT", host: "@", value: "v=spf1 include:mailgun.org ~all", ttl: 600, updatedAt: new Date(now - oneDay * 5).toISOString() }
    ]
  },
  {
    id: "dom-002",
    name: "staging.example.com",
    status: "pending",
    provider: "Route53",
    managed: false,
    sslCertificateId: null,
    targetService: "staging-proxy",
    createdAt: new Date(now - oneDay * 30).toISOString(),
    updatedAt: new Date(now - oneDay * 3).toISOString(),
    notes: "Awaiting DNS delegation",
    records: [
      { id: "rec-004", type: "A", host: "@", value: "198.51.100.25", ttl: 900, updatedAt: new Date(now - oneDay * 3).toISOString() }
    ]
  }
];

export const mockCertificates: SSLCertificate[] = [
  {
    id: "cert-001",
    commonName: "example.com",
    altNames: ["www.example.com"],
    issuer: "Let's Encrypt",
    status: "valid",
    type: "lets-encrypt",
    autoRenew: true,
    issuedAt: new Date(now - oneDay * 40).toISOString(),
    expiresAt: new Date(now + oneDay * 50).toISOString(),
    fingerprint: "AB:CD:12:34:56:78:9A:BC:DE:F0:12:34:56:78:9A:BC",
    managedBy: "Acme client",
    associatedDomains: ["example.com", "www.example.com"]
  },
  {
    id: "cert-002",
    commonName: "api.example.com",
    altNames: [],
    issuer: "Custom CA",
    status: "expiring",
    type: "custom",
    autoRenew: false,
    issuedAt: new Date(now - oneDay * 300).toISOString(),
    expiresAt: new Date(now + oneDay * 10).toISOString(),
    fingerprint: "12:34:56:78:9A:BC:DE:F0:12:34:56:78:9A:BC:DE:F0",
    managedBy: "Security team",
    associatedDomains: ["api.example.com"]
  }
];

export const mockNginxSites: NginxSite[] = [
  {
    id: "site-001",
    serverNames: ["example.com", "www.example.com"],
    listen: [
      { port: 80, protocol: "http" },
      { port: 443, protocol: "https" }
    ],
    upstreamType: "service",
    upstreamTarget: "web-frontend",
    sslCertificateId: "cert-001",
    enabled: true,
    lastDeployedAt: new Date(now - oneDay).toISOString(),
    createdAt: new Date(now - oneDay * 200).toISOString(),
    notes: "Blue/green capable"
  },
  {
    id: "site-002",
    serverNames: ["api.example.com"],
    listen: [{ port: 443, protocol: "https" }],
    upstreamType: "container",
    upstreamTarget: "api-gateway",
    sslCertificateId: "cert-002",
    enabled: true,
    lastDeployedAt: new Date(now - oneDay * 2).toISOString(),
    createdAt: new Date(now - oneDay * 210).toISOString()
  }
];

export const mockProxyRoutes: ProxyRoute[] = [
  {
    id: "proxy-001",
    name: "Frontend",
    sourceHost: "example.com",
    sourcePath: "/",
    destination: "web-frontend",
    destinationType: "service",
    stripPrefix: false,
    healthCheck: {
      path: "/healthz",
      intervalSeconds: 30,
      unhealthyThreshold: 3
    },
    enabled: true,
    createdAt: new Date(now - oneDay * 180).toISOString(),
    updatedAt: new Date(now - oneDay).toISOString()
  },
  {
    id: "proxy-002",
    name: "API",
    sourceHost: "api.example.com",
    sourcePath: "/v1",
    destination: "api-gateway",
    destinationType: "container",
    stripPrefix: true,
    enabled: true,
    createdAt: new Date(now - oneDay * 150).toISOString(),
    updatedAt: new Date(now - oneDay * 5).toISOString()
  }
];

export const mockEmailAccounts: EmailAccount[] = [
  {
    id: "email-001",
    address: "support@example.com",
    displayName: "Support",
    domain: "example.com",
    status: "active",
    quotaMb: 2048,
    usedMb: 512,
    forwardingTo: ["admin@example.com"],
    createdAt: new Date(now - oneDay * 400).toISOString()
  },
  {
    id: "email-002",
    address: "billing@example.com",
    displayName: "Billing",
    domain: "example.com",
    status: "active",
    quotaMb: 1024,
    usedMb: 128,
    createdAt: new Date(now - oneDay * 200).toISOString()
  },
  {
    id: "email-003",
    address: "test@staging.example.com",
    domain: "staging.example.com",
    status: "suspended",
    quotaMb: 512,
    usedMb: 64,
    createdAt: new Date(now - oneDay * 90).toISOString()
  }
];

export const mockEmailService: EmailServiceInfo = {
  smtpHost: "smtp.example.com",
  smtpPort: 587,
  imapHost: "imap.example.com",
  imapPort: 993,
  supportsStartTls: true,
  relayUsagePercent: 42,
  dailyRelayLimit: 10000
};

export const mockSystemMetrics: SystemMetrics = {
  timestamp: new Date().toISOString(),
  hostname: "mock-host",
  platform: "linux",
  release: "6.8.12-mock",
  architecture: "x86_64",
  uptimeSeconds: 42_000,
  cpu: {
    overallUsagePercent: 37.5,
    loadAverage: [0.42, 0.38, 0.35],
    cores: [
      { id: "cpu-0", usagePercent: 32.1, speedMhz: 3200 },
      { id: "cpu-1", usagePercent: 41.8, speedMhz: 3200 },
      { id: "cpu-2", usagePercent: 29.5, speedMhz: 3200 },
      { id: "cpu-3", usagePercent: 46.6, speedMhz: 3200 }
    ]
  },
  memory: {
    totalBytes: 32 * 1024 ** 3,
    usedBytes: 18.7 * 1024 ** 3,
    freeBytes: 13.3 * 1024 ** 3,
    usagePercent: 58.4
  },
  disks: {
    totalBytes: 512 * 1024 ** 3,
    usedBytes: 284 * 1024 ** 3,
    availableBytes: 228 * 1024 ** 3,
    usagePercent: 55.5,
    partitions: [
      {
        filesystem: "/dev/sda1",
        mountpoint: "/",
        sizeBytes: 256 * 1024 ** 3,
        usedBytes: 190 * 1024 ** 3,
        availableBytes: 66 * 1024 ** 3,
        usagePercent: 74.2
      },
      {
        filesystem: "/dev/sdb1",
        mountpoint: "/data",
        sizeBytes: 256 * 1024 ** 3,
        usedBytes: 94 * 1024 ** 3,
        availableBytes: 162 * 1024 ** 3,
        usagePercent: 36.8
      }
    ]
  }
};
