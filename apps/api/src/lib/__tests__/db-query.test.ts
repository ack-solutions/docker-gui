import { describe, it, expect } from 'vitest';
import {
  clampOptions,
  DEFAULT_MAX_ROWS,
  DEFAULT_TIMEOUT_MS,
  MAX_ROWS_LIMIT,
  MAX_TIMEOUT_MS,
} from '../db-query.js';

describe('clampOptions', () => {
  it('applies defaults (readOnly defaults to true)', () => {
    expect(clampOptions({})).toEqual({
      readOnly: true,
      maxRows: DEFAULT_MAX_ROWS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
  });

  it('clamps maxRows to the hard ceiling', () => {
    expect(clampOptions({ maxRows: 999_999 }).maxRows).toBe(MAX_ROWS_LIMIT);
    expect(clampOptions({ maxRows: 0 }).maxRows).toBe(1);
    expect(clampOptions({ maxRows: 250 }).maxRows).toBe(250);
  });

  it('clamps the timeout to the allowed window', () => {
    expect(clampOptions({ timeoutMs: 10_000_000 }).timeoutMs).toBe(MAX_TIMEOUT_MS);
    expect(clampOptions({ timeoutMs: 1 }).timeoutMs).toBe(1_000);
    expect(clampOptions({ timeoutMs: 5_000 }).timeoutMs).toBe(5_000);
  });

  it('passes readOnly:false through', () => {
    expect(clampOptions({ readOnly: false }).readOnly).toBe(false);
  });
});
