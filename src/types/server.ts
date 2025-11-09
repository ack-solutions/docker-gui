export type DomainStatus = "active" | "pending" | "error";

export type DomainDnsRecordType = "A" | "AAAA" | "CNAME" | "TXT" | "MX" | "SRV" | "CAA" | "NS";
export type DomainMode = "managed" | "provider" | "manual";

export interface DomainDnsRecord {
  id: string;
  type: DomainDnsRecordType;
  host: string;
  value: string;
  ttl: number;
  priority?: number | null;
  createdAt: string;
  updatedAt: string;
}

export type DomainTargetType = "none" | "container" | "service" | "external" | "static";

export interface DomainTarget {
  type: DomainTargetType;
  containerId?: string | null;
  containerPort?: number | null;
  serviceHost?: string | null;
  externalUrl?: string | null;
  staticRoot?: string | null;
  enableHttp: boolean;
  enableHttps: boolean;
  forceHttps: boolean;
  sslMode: NginxSslMode;
  letsEncryptEmail?: string | null;
  sslCertificateId?: string | null;
  customNginxConfig?: string | null;
}

export interface DomainDnsProviderInfo {
  type: string;
  configured: boolean;
  configKeys?: string[];
}

export interface Domain {
  id: string;
  name: string;
  aliases: string[];
  provider?: string | null;
  mode: DomainMode;
  status: DomainStatus;
  notes?: string | null;
  target: DomainTarget | null;
  nginxSiteId?: string | null;
  lastError?: string | null;
  parentDomainId?: string | null;
  parentDomainName?: string | null;
  createdAt: string;
  updatedAt: string;
  records: DomainDnsRecord[];
  dnsProvider?: DomainDnsProviderInfo | null;
}

export interface DomainUpsertInput {
  name: string;
  aliases?: string[];
  provider?: string | null;
  mode?: DomainMode;
  status?: DomainStatus;
  notes?: string | null;
  target?: DomainTarget | null;
  parentDomainId?: string | null;
  records?: Array<{
    id?: string;
    type: DomainDnsRecordType;
    host: string;
    value: string;
    ttl?: number;
    priority?: number | null;
  }>;
  dnsProvider?: {
    type: string;
    config?: Record<string, unknown>;
  } | null;
}

export type SSLCertificateType = "lets-encrypt" | "custom";
export type SSLCertificateStatus = "valid" | "expiring" | "expired" | "pending";

export interface SSLCertificate {
  id: string;
  commonName: string;
  altNames: string[];
  issuer: string;
  status: SSLCertificateStatus;
  type: SSLCertificateType;
  autoRenew: boolean;
  issuedAt: string;
  expiresAt: string;
  fingerprint: string;
  managedBy?: string;
  associatedDomains: string[];
}

export type UpstreamType = "container" | "service" | "external";
export type NginxSslMode = "none" | "lets-encrypt" | "custom";
export type NginxSiteStatus = "draft" | "pending" | "active" | "error";

export interface NginxProvisionLog {
  id: string;
  siteId: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface NginxSite {
  id: string;
  primaryDomain: string;
  serverNames: string[];
  upstreamType: UpstreamType;
  upstreamTarget: string;
  containerId?: string;
  containerPort?: number;
  enableHttp: boolean;
  enableHttps: boolean;
  forceHttps: boolean;
  sslMode: NginxSslMode;
  letsEncryptEmail?: string;
  sslCertificateId?: string | null;
  enabled: boolean;
  status: NginxSiteStatus;
  configPath?: string;
  lastAppliedAt?: string;
  lastValidatedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  extraDirectives?: string;
  lastLog?: NginxProvisionLog | null;
}

export interface ProxyRoute {
  id: string;
  name: string;
  sourceHost: string;
  sourcePath: string;
  destination: string;
  destinationType: UpstreamType;
  stripPrefix: boolean;
  healthCheck?: {
    path: string;
    intervalSeconds: number;
    unhealthyThreshold: number;
  };
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EmailAccountStatus = "active" | "suspended";

export interface EmailAccount {
  id: string;
  address: string;
  displayName?: string;
  domain: string;
  status: EmailAccountStatus;
  quotaMb: number;
  usedMb: number;
  forwardingTo?: string[];
  createdAt: string;
}

export interface EmailServiceInfo {
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
  supportsStartTls: boolean;
  relayUsagePercent: number;
  dailyRelayLimit: number;
}
