import { describe, it, expect } from 'vitest';
import { signExplorerToken, verifyExplorerToken } from '../explorer-token.js';

const SECRET = 'explorer-test-secret-which-is-quite-long-1234567890';
const CID = '11111111-2222-3333-4444-555555555555';

describe('explorer token', () => {
  it('round-trips a connection id', () => {
    const t = signExplorerToken(CID, SECRET);
    expect(verifyExplorerToken(t, SECRET)).toEqual({ connectionId: CID });
  });

  it('rejects a token signed with a different secret', () => {
    const t = signExplorerToken(CID, SECRET);
    expect(verifyExplorerToken(t, 'other-secret-which-is-also-long-1234567890')).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const t = signExplorerToken(CID, SECRET);
    const [body, sig] = t.split('.');
    const otherBody = Buffer.from(`evil-cid.${Math.floor(Date.now() / 1000) + 999}`).toString('base64url');
    expect(verifyExplorerToken(`${otherBody}.${sig}`, SECRET)).toBeNull();
    void body;
  });

  it('rejects an expired token', () => {
    const t = signExplorerToken(CID, SECRET, -10); // already expired
    expect(verifyExplorerToken(t, SECRET)).toBeNull();
  });

  it('rejects malformed tokens', () => {
    expect(verifyExplorerToken('garbage', SECRET)).toBeNull();
    expect(verifyExplorerToken('a.b.c', SECRET)).toBeNull();
    expect(verifyExplorerToken('', SECRET)).toBeNull();
  });
});
