import {
    IMailserverAdminProvider,
    Domain,
    Mailbox,
    Alias,
    Forwarder,
} from './admin-provider.interface';

/**
 * Mock in-memory implementation of the mailserver admin provider
 * This is used for development/testing when a real mailserver admin API is not available
 * 
 * TODO: Replace this with real Mailu/Mailcow/docker-mailserver admin API calls in production
 */
export class MockMailserverAdminProvider implements IMailserverAdminProvider {
    private domains: Map<string, Domain> = new Map();
    private mailboxes: Map<string, Mailbox> = new Map();
    private aliases: Map<string, Alias> = new Map();
    private forwarders: Map<string, Forwarder> = new Map();

    constructor() {
        // Initialize with some default data for testing
        this.initializeDefaultData();
    }

    private initializeDefaultData() {
        // Add default localhost domain
        this.domains.set('localhost', {
            name: 'localhost',
            enabled: true,
            createdAt: new Date(),
            maxQuotaBytes: 1024 * 1024 * 1024 * 10, // 10GB
            maxAliases: 50,
        });

        // Add test mailbox
        this.mailboxes.set('test@localhost', {
            email: 'test@localhost',
            domain: 'localhost',
            quotaBytes: 1024 * 1024 * 1024, // 1GB
            enabled: true,
            createdAt: new Date(),
        });
    }

    // ==================== Domain Management ====================

    async listDomains(): Promise<Domain[]> {
        return Array.from(this.domains.values());
    }

    async getDomain(name: string): Promise<Domain | null> {
        return this.domains.get(name) || null;
    }

    async createDomain(domain: Omit<Domain, 'createdAt'>): Promise<Domain> {
        // TODO: Call real Mailu/Mailcow API: POST /api/v1/domains
        // Example for Mailu:
        // await axios.post(`${this.config.apiUrl}/api/v1/domains`, domain, {
        //     headers: { Authorization: `Bearer ${this.config.apiKey}` }
        // });

        if (this.domains.has(domain.name)) {
            throw new Error(`Domain ${domain.name} already exists`);
        }

        const newDomain: Domain = {
            ...domain,
            createdAt: new Date(),
        };

        this.domains.set(domain.name, newDomain);
        return newDomain;
    }

    async updateDomain(name: string, updates: Partial<Omit<Domain, 'name'>>): Promise<Domain> {
        // TODO: Call real Mailu/Mailcow API: PATCH /api/v1/domains/{name}

        const existing = this.domains.get(name);
        if (!existing) {
            throw new Error(`Domain ${name} not found`);
        }

        const updated = { ...existing, ...updates };
        this.domains.set(name, updated);
        return updated;
    }

    async deleteDomain(name: string): Promise<void> {
        // TODO: Call real Mailu/Mailcow API: DELETE /api/v1/domains/{name}

        if (!this.domains.has(name)) {
            throw new Error(`Domain ${name} not found`);
        }

        // Delete all mailboxes in this domain
        const mailboxesToDelete = Array.from(this.mailboxes.values())
            .filter(mb => mb.domain === name);

        for (const mb of mailboxesToDelete) {
            this.mailboxes.delete(mb.email);
        }

        // Delete all aliases in this domain
        const aliasesToDelete = Array.from(this.aliases.values())
            .filter(a => a.source.endsWith(`@${name}`));

        for (const alias of aliasesToDelete) {
            this.aliases.delete(alias.source);
        }

        this.domains.delete(name);
    }

    // ==================== Mailbox Management ====================

    async listMailboxes(domain?: string): Promise<Mailbox[]> {
        const mailboxes = Array.from(this.mailboxes.values());
        if (domain) {
            return mailboxes.filter(mb => mb.domain === domain);
        }
        return mailboxes;
    }

    async getMailbox(email: string): Promise<Mailbox | null> {
        return this.mailboxes.get(email) || null;
    }

    async createMailbox(mailbox: Omit<Mailbox, 'createdAt'>): Promise<Mailbox> {
        // TODO: Call real Mailu/Mailcow API: POST /api/v1/mailboxes
        // Example for Mailu:
        // await axios.post(`${this.config.apiUrl}/api/v1/mailboxes`, {
        //     email: mailbox.email,
        //     password: mailbox.password,
        //     quota: mailbox.quotaBytes,
        //     enabled: mailbox.enabled
        // }, {
        //     headers: { Authorization: `Bearer ${this.config.apiKey}` }
        // });

        if (this.mailboxes.has(mailbox.email)) {
            throw new Error(`Mailbox ${mailbox.email} already exists`);
        }

        // Verify domain exists
        if (!this.domains.has(mailbox.domain)) {
            throw new Error(`Domain ${mailbox.domain} does not exist`);
        }

        const newMailbox: Mailbox = {
            ...mailbox,
            createdAt: new Date(),
        };

        // Don't store password in memory (security)
        const { password, ...mailboxWithoutPassword } = newMailbox;

        this.mailboxes.set(mailbox.email, mailboxWithoutPassword as Mailbox);
        return mailboxWithoutPassword as Mailbox;
    }

    async updateMailbox(email: string, updates: Partial<Omit<Mailbox, 'email' | 'domain'>>): Promise<Mailbox> {
        // TODO: Call real Mailu/Mailcow API: PATCH /api/v1/mailboxes/{email}

        const existing = this.mailboxes.get(email);
        if (!existing) {
            throw new Error(`Mailbox ${email} not found`);
        }

        const updated = { ...existing, ...updates };
        // Don't store password
        const { password, ...mailboxWithoutPassword } = updated;

        this.mailboxes.set(email, mailboxWithoutPassword as Mailbox);
        return mailboxWithoutPassword as Mailbox;
    }

    async deleteMailbox(email: string): Promise<void> {
        // TODO: Call real Mailu/Mailcow API: DELETE /api/v1/mailboxes/{email}

        if (!this.mailboxes.has(email)) {
            throw new Error(`Mailbox ${email} not found`);
        }

        this.mailboxes.delete(email);
    }

    async setMailboxPassword(email: string, password: string): Promise<void> {
        // TODO: Call real Mailu/Mailcow API: PATCH /api/v1/mailboxes/{email}/password

        const existing = this.mailboxes.get(email);
        if (!existing) {
            throw new Error(`Mailbox ${email} not found`);
        }

        // In a real implementation, this would update the password on the mailserver
        console.log(`Mock: Would update password for ${email}`);
    }

    // ==================== Alias Management ====================

    async listAliases(domain?: string): Promise<Alias[]> {
        const aliases = Array.from(this.aliases.values());
        if (domain) {
            return aliases.filter(a => a.source.endsWith(`@${domain}`));
        }
        return aliases;
    }

    async createAlias(alias: Alias): Promise<Alias> {
        // TODO: Call real Mailu/Mailcow API: POST /api/v1/aliases

        if (this.aliases.has(alias.source)) {
            throw new Error(`Alias ${alias.source} already exists`);
        }

        this.aliases.set(alias.source, alias);
        return alias;
    }

    async deleteAlias(source: string): Promise<void> {
        // TODO: Call real Mailu/Mailcow API: DELETE /api/v1/aliases/{source}

        if (!this.aliases.has(source)) {
            throw new Error(`Alias ${source} not found`);
        }

        this.aliases.delete(source);
    }

    // ==================== Forwarder Management ====================

    async listForwarders(domain?: string): Promise<Forwarder[]> {
        const forwarders = Array.from(this.forwarders.values());
        if (domain) {
            return forwarders.filter(f => f.source.endsWith(`@${domain}`));
        }
        return forwarders;
    }

    async createForwarder(forwarder: Forwarder): Promise<Forwarder> {
        // TODO: Call real Mailu/Mailcow API: POST /api/v1/forwarders

        if (this.forwarders.has(forwarder.source)) {
            throw new Error(`Forwarder ${forwarder.source} already exists`);
        }

        this.forwarders.set(forwarder.source, forwarder);
        return forwarder;
    }

    async deleteForwarder(source: string): Promise<void> {
        // TODO: Call real Mailu/Mailcow API: DELETE /api/v1/forwarders/{source}

        if (!this.forwarders.has(source)) {
            throw new Error(`Forwarder ${source} not found`);
        }

        this.forwarders.delete(source);
    }
}
