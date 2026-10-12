import { describe, expect, it } from 'vitest';
import { memoryKV } from '../src/data/storage';
import { createStore } from '../src/data/store';

function fresh() {
  const s = createStore(memoryKV());
  s.load();
  return s;
}
const entry = (id: string, amount: number) => ({ id, date: '2026-10-01', kind: 'in', amount, category: '', note: '', createdAt: '2026-10-01T10:00:00.000Z' });

describe('a shop with years of records', () => {
  it('takes in synced changes in place: changed rows keep their spot, deleted go, new ones join at the end', () => {
    const s = fresh();
    s.applySyncRecords(['a', 'b', 'c'].map((id, i) => ({ kind: 'cash', id, body: entry(id, i + 1) })));
    s.applySyncRecords([
      { kind: 'cash', id: 'b', body: entry('b', 20) },
      { kind: 'cash', id: 'a', body: null },
      { kind: 'cash', id: 'd', body: entry('d', 4) },
      { kind: 'cash', id: 'd', body: entry('d', 40) },
      { kind: 'cash', id: 'zz', body: null },
    ]);
    expect(s.getState().cash.map((e) => [e.id, e.amount])).toEqual([['b', 20], ['c', 3], ['d', 40]]);
  });
  it('a new PC takes in 40,000 records quickly', () => {
    const s = fresh();
    const records = Array.from({ length: 40000 }, (_, i) => ({ kind: 'cash' as const, id: `e${i}`, body: entry(`e${i}`, i) }));
    const start = performance.now();
    for (let i = 0; i < records.length; i += 400) s.applySyncRecords(records.slice(i, i + 400));
    expect(s.getState().cash).toHaveLength(40000);
    expect(performance.now() - start).toBeLessThan(5000);
  });
});
