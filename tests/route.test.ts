import { describe, expect, it } from 'vitest';
import { fromHash, toHash, type Route } from '../src/desktop/route';

describe('desktop addresses', () => {
  it('round-trips every page', () => {
    const routes: Route[] = [
      { page: 'home' },
      { page: 'documents', type: 'quote' },
      { page: 'documents', type: 'invoice' },
      { page: 'customers' },
      { page: 'items' },
      { page: 'settings' },
      { page: 'editor', docId: 'mgabc12x9k' },
    ];
    for (const route of routes) expect(fromHash(toHash(route))).toEqual(route);
  });
  it('falls back to Home for an empty or unknown address', () => {
    expect(fromHash('')).toEqual({ page: 'home' });
    expect(fromHash('#/nonsense')).toEqual({ page: 'home' });
    expect(fromHash('#/doc')).toEqual({ page: 'documents', type: 'quote' });
  });
});
