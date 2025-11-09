import axios from "axios";

interface DomainRecordInput {
  type: string;
  host: string;
  value: string;
  ttl: number;
  priority?: number | null;
}

export interface ExternalDnsSyncPayload {
  provider: string;
  domainName: string;
  config: Record<string, unknown>;
  records: DomainRecordInput[];
}

interface DnsProviderStrategy {
  supports(provider: string): boolean;
  validateConfig(config: Record<string, unknown>): void;
  syncRecords(payload: ExternalDnsSyncPayload): Promise<void>;
}

const MANAGED_COMMENT = "Managed by Docker GUI";

const buildRecordName = (host: string, domainName: string) => {
  if (!host || host === "@" || host === ".") {
    return domainName;
  }
  if (host.endsWith(`.${domainName}`)) {
    return host;
  }
  return `${host}.${domainName}`;
};

class CloudflareDnsProvider implements DnsProviderStrategy {
  supports(provider: string) {
    return provider === "cloudflare";
  }

  validateConfig(config: Record<string, unknown>) {
    const token = this.extractToken(config);
    const zoneId = this.extractZoneId(config);
    if (!token) {
      throw new Error("[dns] Cloudflare API token is required.");
    }
    if (!zoneId) {
      throw new Error("[dns] Cloudflare zone ID is required.");
    }
  }

  async syncRecords(payload: ExternalDnsSyncPayload) {
    const apiToken = this.extractToken(payload.config);
    const zoneId = this.extractZoneId(payload.config);
    if (!apiToken || !zoneId) {
      throw new Error("[dns] Missing Cloudflare credentials.");
    }

    const apiBase = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`;
    const headers = {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json"
    };

    const normalized = payload.records
      .filter((record) => Boolean(record.type && record.host && record.value))
      .map((record) => ({
        type: record.type,
        name: buildRecordName(record.host, payload.domainName),
        content: record.value,
        ttl: record.ttl ?? 300,
        priority: record.priority ?? undefined
      }));

    const existing = await this.fetchAllRecords(apiBase, headers);

    const desiredKey = (rec: typeof normalized[number]) => `${rec.type}:${rec.name}:${rec.content}`;
    const desiredKeys = new Set(normalized.map(desiredKey));

    for (const record of normalized) {
      const match = existing.find((entry) => entry.type === record.type && entry.name === record.name);

      if (!match) {
        await axios.post(
          apiBase,
          {
            type: record.type,
            name: record.name,
            content: record.content,
            ttl: record.ttl,
            priority: record.priority,
            proxied: false,
            comment: MANAGED_COMMENT
          },
          { headers }
        );
        continue;
      }

      if (match.content !== record.content || match.ttl !== record.ttl || match.priority !== record.priority) {
        await axios.put(
          `${apiBase}/${match.id}`,
          {
            type: record.type,
            name: record.name,
            content: record.content,
            ttl: record.ttl,
            priority: record.priority,
            proxied: match.proxied ?? false,
            comment: match.comment || MANAGED_COMMENT
          },
          { headers }
        );
      }
    }

    const managedRecords = existing.filter((entry) => entry.comment === MANAGED_COMMENT);
    for (const record of managedRecords) {
      const key = `${record.type}:${record.name}:${record.content}`;
      if (!desiredKeys.has(key)) {
        await axios.delete(`${apiBase}/${record.id}`, { headers }).catch(() => undefined);
      }
    }
  }

  private extractToken(config: Record<string, unknown>) {
    return (
      (typeof config.apiToken === "string" && config.apiToken) ||
      (typeof config.cloudflareApiToken === "string" && config.cloudflareApiToken) ||
      (typeof config.token === "string" && config.token) ||
      ""
    );
  }

  private extractZoneId(config: Record<string, unknown>) {
    return (
      (typeof config.zoneId === "string" && config.zoneId) ||
      (typeof config.cloudflareZoneId === "string" && config.cloudflareZoneId) ||
      ""
    );
  }

  private async fetchAllRecords(apiBase: string, headers: Record<string, string>) {
    const results: any[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const response = await axios.get(apiBase, {
        headers,
        params: {
          per_page: 100,
          page
        }
      });

      if (!response.data?.success) {
        throw new Error(
          response.data?.errors?.[0]?.message ?? "Failed to fetch existing DNS records from Cloudflare."
        );
      }

      results.push(...(response.data.result ?? []));
      const info = response.data.result_info;
      totalPages = info?.total_pages ?? 1;
      page += 1;
    }

    return results;
  }
}

const PROVIDERS: DnsProviderStrategy[] = [new CloudflareDnsProvider()];

export const syncExternalDnsRecords = async (payload: ExternalDnsSyncPayload) => {
  const provider = PROVIDERS.find((strategy) => strategy.supports(payload.provider));
  if (!provider) {
    throw new Error(`[dns] Unsupported DNS provider "${payload.provider}".`);
  }

  provider.validateConfig(payload.config);
  await provider.syncRecords(payload);
};
