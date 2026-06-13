import { describe, it, expect } from 'vitest';
import { detectEngine, DEFAULT_PORT } from '../database.service.js';

describe('detectEngine', () => {
  it('detects postgres family', () => {
    expect(detectEngine('postgres:16')).toBe('postgres');
    expect(detectEngine('postgres')).toBe('postgres');
    expect(detectEngine('bitnami/postgresql:15')).toBe('postgres');
    expect(detectEngine('timescale/timescaledb:latest-pg16')).toBe('postgres');
    expect(detectEngine('pgvector/pgvector:pg16')).toBe('postgres');
  });

  it('detects mysql / mariadb / percona', () => {
    expect(detectEngine('mysql:8')).toBe('mysql');
    expect(detectEngine('mariadb:11')).toBe('mariadb');
    expect(detectEngine('percona:8')).toBe('mysql');
  });

  it('returns null for non-database images', () => {
    expect(detectEngine('nginx:alpine')).toBeNull();
    expect(detectEngine('redis:7')).toBeNull();
    expect(detectEngine('caddy:2-alpine')).toBeNull();
    // Avoids false positives on unrelated names that merely contain a substring.
    expect(detectEngine('my-postgres-backup-tool:1')).toBeNull();
  });

  it('has sane default ports', () => {
    expect(DEFAULT_PORT.postgres).toBe(5432);
    expect(DEFAULT_PORT.mysql).toBe(3306);
    expect(DEFAULT_PORT.mariadb).toBe(3306);
  });
});
