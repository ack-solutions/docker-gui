/**
 * Mailserver Admin Provider Abstraction Layer
 * 
 * This abstraction allows the application to work with different mailserver admin APIs
 * (Mailu, Mailcow, docker-mailserver, or custom implementations) through a common interface.
 */

// ==================== Types ====================

export interface Domain {
    name: string;
    enabled: boolean;
    createdAt?: Date;
    maxQuotaBytes?: number;
    maxAliases?: number;
}

export interface Mailbox {
    email: string;
    domain: string;
    password?: string; // Only used during creation/update
    quotaBytes: number;
    enabled: boolean;
    createdAt?: Date;
}

export interface Alias {
    source: string; // e.g., sales@domain.com
    destination: string; // e.g., info@domain.com
    enabled: boolean;
}

export interface Forwarder {
    source: string; // e.g., forward@domain.com
    destination: string; // e.g., external@externaldomain.com
    enabled: boolean;
}

// ==================== Provider Interface ====================

/**
 * Interface that all mailserver admin providers must implement
 */
export interface IMailserverAdminProvider {
    // ==================== Domain Management ====================

    /**
     * List all domains
     */
    listDomains(): Promise<Domain[]>;

    /**
     * Get a specific domain
     */
    getDomain(name: string): Promise<Domain | null>;

    /**
     * Create a new domain
     * @returns The created domain
     */
    createDomain(domain: Omit<Domain, 'createdAt'>): Promise<Domain>;

    /**
     * Update an existing domain
     */
    updateDomain(name: string, updates: Partial<Omit<Domain, 'name'>>): Promise<Domain>;

    /**
     * Delete a domain (and all its mailboxes)
     */
    deleteDomain(name: string): Promise<void>;

    // ==================== Mailbox Management ====================

    /**
     * List all mailboxes (optionally filtered by domain)
     */
    listMailboxes(domain?: string): Promise<Mailbox[]>;

    /**
     * Get a specific mailbox
     */
    getMailbox(email: string): Promise<Mailbox | null>;

    /**
     * Create a new mailbox
     */
    createMailbox(mailbox: Omit<Mailbox, 'createdAt'>): Promise<Mailbox>;

    /**
     * Update an existing mailbox
     */
    updateMailbox(email: string, updates: Partial<Omit<Mailbox, 'email' | 'domain'>>): Promise<Mailbox>;

    /**
     * Delete a mailbox
     */
    deleteMailbox(email: string): Promise<void>;

    /**
     * Set mailbox password
     */
    setMailboxPassword(email: string, password: string): Promise<void>;

    // ==================== Alias Management ====================

    /**
     * List all aliases (optionally filtered by domain)
     */
    listAliases(domain?: string): Promise<Alias[]>;

    /**
     * Create an alias
     */
    createAlias(alias: Alias): Promise<Alias>;

    /**
     * Delete an alias
     */
    deleteAlias(source: string): Promise<void>;

    // ==================== Forwarder Management ====================

    /**
     * List all forwarders (optionally filtered by domain)
     */
    listForwarders(domain?: string): Promise<Forwarder[]>;

    /**
     * Create a forwarder
     */
    createForwarder(forwarder: Forwarder): Promise<Forwarder>;

    /**
     * Delete a forwarder
     */
    deleteForwarder(source: string): Promise<void>;
}

// ==================== Provider Factory ====================

/**
 * Provider type configuration
 */
export type ProviderType = 'mock' | 'mailu' | 'mailcow' | 'docker-mailserver';

export interface ProviderConfig {
    type: ProviderType;
    // Provider-specific configuration
    apiUrl?: string; // For Mailu/Mailcow
    apiKey?: string; // For Mailu/Mailcow
    containerName?: string; // For docker-mailserver
}

/**
 * Get the configured mailserver admin provider
 */
export function getMailserverAdminProvider(config: ProviderConfig): IMailserverAdminProvider {
    // This will be implemented to return the appropriate provider
    throw new Error('Not implemented - use MailserverAdminService');
}
