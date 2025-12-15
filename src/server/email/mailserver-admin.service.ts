import { IMailserverAdminProvider, ProviderConfig } from './admin-provider.interface';
import { MockMailserverAdminProvider } from './mock-admin-provider';

/**
 * Singleton service for managing mailserver admin operations
 * This service wraps the admin provider and provides a consistent interface
 * 
 * Uses global to persist across Next.js hot reloads in development
 */
class MailserverAdminService {
    private provider: IMailserverAdminProvider;
    private initialized = false;

    constructor() {
        // Initialize with mock provider by default
        // In production, this would be configured via environment variables
        const config: ProviderConfig = {
            type: process.env.MAILSERVER_ADMIN_PROVIDER as any || 'mock',
            apiUrl: process.env.MAILSERVER_ADMIN_API_URL,
            apiKey: process.env.MAILSERVER_ADMIN_API_KEY,
            containerName: process.env.MAILSERVER_CONTAINER_NAME || 'mailserver',
        };

        this.provider = this.createProvider(config);
        this.initialized = true;
    }

    private createProvider(config: ProviderConfig): IMailserverAdminProvider {
        // Check if we already have a provider instance in global
        // This ensures data persists across Next.js hot reloads
        if ((global as any).__mailserverProvider) {
            return (global as any).__mailserverProvider;
        }

        let provider: IMailserverAdminProvider;

        switch (config.type) {
            case 'mock':
                provider = new MockMailserverAdminProvider();
                break;

            case 'mailu':
                // TODO: Implement MailuAdminProvider
                // provider = new MailuAdminProvider(config);
                throw new Error('Mailu provider not implemented yet');

            case 'mailcow':
                // TODO: Implement MailcowAdminProvider
                // provider = new MailcowAdminProvider(config);
                throw new Error('Mailcow provider not implemented yet');

            case 'docker-mailserver':
                // TODO: Implement DockerMailserverAdminProvider
                // provider = new DockerMailserverAdminProvider(config);
                throw new Error('docker-mailserver provider not implemented yet');

            default:
                console.warn(`Unknown provider type: ${config.type}, using mock provider`);
                provider = new MockMailserverAdminProvider();
        }

        // Store in global to persist across hot reloads
        (global as any).__mailserverProvider = provider;
        console.log('[MailserverAdminService] Created new provider and stored in global');

        return provider;
    }

    // ==================== Domain Management ====================

    async listDomains() {
        return this.provider.listDomains();
    }

    async getDomain(name: string) {
        return this.provider.getDomain(name);
    }

    async createDomain(domain: Parameters<IMailserverAdminProvider['createDomain']>[0]) {
        return this.provider.createDomain(domain);
    }

    async updateDomain(name: string, updates: Parameters<IMailserverAdminProvider['updateDomain']>[1]) {
        return this.provider.updateDomain(name, updates);
    }

    async deleteDomain(name: string) {
        return this.provider.deleteDomain(name);
    }

    // ==================== Mailbox Management ====================

    async listMailboxes(domain?: string) {
        return this.provider.listMailboxes(domain);
    }

    async getMailbox(email: string) {
        return this.provider.getMailbox(email);
    }

    async createMailbox(mailbox: Parameters<IMailserverAdminProvider['createMailbox']>[0]) {
        return this.provider.createMailbox(mailbox);
    }

    async updateMailbox(email: string, updates: Parameters<IMailserverAdminProvider['updateMailbox']>[1]) {
        return this.provider.updateMailbox(email, updates);
    }

    async deleteMailbox(email: string) {
        return this.provider.deleteMailbox(email);
    }

    async setMailboxPassword(email: string, password: string) {
        return this.provider.setMailboxPassword(email, password);
    }

    // ==================== Alias Management ====================

    async listAliases(domain?: string) {
        return this.provider.listAliases(domain);
    }

    async createAlias(alias: Parameters<IMailserverAdminProvider['createAlias']>[0]) {
        return this.provider.createAlias(alias);
    }

    async deleteAlias(source: string) {
        return this.provider.deleteAlias(source);
    }

    // ==================== Forwarder Management ====================

    async listForwarders(domain?: string) {
        return this.provider.listForwarders(domain);
    }

    async createForwarder(forwarder: Parameters<IMailserverAdminProvider['createForwarder']>[0]) {
        return this.provider.createForwarder(forwarder);
    }

    async deleteForwarder(source: string) {
        return this.provider.deleteForwarder(source);
    }
}

// Export singleton instance
// Use global to ensure singleton persists across Next.js hot reloads
if (!(global as any).__mailserverAdminService) {
    (global as any).__mailserverAdminService = new MailserverAdminService();
}

export const mailserverAdminService = (global as any).__mailserverAdminService as MailserverAdminService;
