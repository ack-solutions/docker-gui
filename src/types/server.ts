export type DomainStatus = "active" | "pending" | "error";

export interface DomainDnsRecord {
  id: string;
  type: "A" | "AAAA" | "CNAME" | "TXT" | "MX" | "SRV" | "CAA" | "NS";
  host: string;
  value: string;
  ttl: number;
  priority?: number;
  updatedAt: string;
}

export interface ServerDomain {
  id: string;
  name: string;
  status: DomainStatus;
  provider?: string;
  managed: boolean;
  sslCertificateId?: string | null;
  targetService?: string | null;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  records: DomainDnsRecord[];
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

export interface NginxSite {
  id: string;
  serverNames: string[];
  listen: Array<{ port: number; protocol: "http" | "https" }>;
  upstreamType: UpstreamType;
  upstreamTarget: string;
  sslCertificateId?: string | null;
  enabled: boolean;
  lastDeployedAt?: string;
  createdAt: string;
  notes?: string;
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
