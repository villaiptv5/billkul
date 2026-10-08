import { describe, expect, it } from 'vitest';
import { BACKUP_NAME, DriveError, latestOnDrive, readFromDrive, saveToDrive, type DriveDeps } from '../src/backup/drive';
import { memoryKV } from '../src/data/storage';
import { createStore } from '../src/data/store';

interface FakeFile {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  body: string;
  modifiedTime: string;
  trashed: boolean;
}

/** A small stand-in for the Google Drive API: just the calls the backup makes. */
function fakeDrive(opts: { expireFirstToken?: boolean } = {}) {
  const files: FakeFile[] = [];
  const seen: string[] = [];
  let clock = 0;
  let tokens = 0;
  let expired = !!opts.expireFirstToken;
  const stamp = () => new Date(Date.UTC(2026, 9, 8, 10, 0, clock++)).toISOString();
  const reply = (status: number, body: unknown = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

  const fetchFn = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? 'GET';
    const auth = (init.headers as Record<string, string>)?.Authorization ?? '';
    seen.push(`${method} ${url.pathname}`);
    if (!auth.startsWith('Bearer ')) return reply(401);
    if (expired && auth === 'Bearer t1') return reply(401);
    if (method === 'GET' && url.pathname === '/drive/v3/files') {
      const q = url.searchParams.get('q') ?? '';
      const name = /name = '([^']+)'/.exec(q)?.[1];
      const folder = q.includes('folder');
      const list = files
        .filter((f) => !f.trashed && f.name === name && (folder ? f.mimeType.includes('folder') : !f.mimeType.includes('folder')))
        .sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime));
      return reply(200, { files: list.map((f) => ({ id: f.id, modifiedTime: f.modifiedTime })) });
    }
    if (method === 'POST' && url.pathname === '/drive/v3/files') {
      const meta = JSON.parse(String(init.body));
      const file = { id: `id${files.length + 1}`, name: meta.name, mimeType: meta.mimeType, parents: [], body: '', modifiedTime: stamp(), trashed: false };
      files.push(file);
      return reply(200, { id: file.id });
    }
    if (method === 'POST' && url.pathname === '/upload/drive/v3/files') {
      const body = String(init.body);
      const boundary = /boundary=(\S+)/.exec((init.headers as Record<string, string>)['Content-Type'])![1];
      const parts = body.split(`--${boundary}`).slice(1, 3).map((p) => p.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, ''));
      const meta = JSON.parse(parts[0]);
      const file = { id: `id${files.length + 1}`, name: meta.name, mimeType: meta.mimeType, parents: meta.parents, body: parts[1], modifiedTime: stamp(), trashed: false };
      files.push(file);
      return reply(200, { id: file.id });
    }
    const id = decodeURIComponent(url.pathname.split('/').pop() ?? '');
    const file = files.find((f) => f.id === id && !f.trashed);
    if (method === 'PATCH') {
      if (!file) return reply(404);
      file.body = String(init.body);
      file.modifiedTime = stamp();
      return reply(200, { id });
    }
    if (method === 'GET' && url.searchParams.get('alt') === 'media') return file ? reply(200, file.body) : reply(404);
    return reply(400);
  }) as typeof fetch;

  const deps: DriveDeps = {
    token: async () => `t${++tokens}`,
    forget: async () => {
      expired = false;
    },
    fetch: fetchFn,
  };
  return { files, seen, deps };
}

describe('backup on Google Drive', () => {
  it('makes a BillKul folder with one backup file in it, then writes over that file', async () => {
    const drive = fakeDrive();
    const id = await saveToDrive(drive.deps, '{"v":1}');
    const folder = drive.files.find((f) => f.mimeType.includes('folder'))!;
    const file = drive.files.find((f) => f.id === id)!;
    expect(folder.name).toBe('BillKul');
    expect(file.name).toBe(BACKUP_NAME);
    expect(file.parents).toEqual([folder.id]);
    expect(file.body).toBe('{"v":1}');
    expect(await saveToDrive(drive.deps, '{"v":2}', id)).toBe(id);
    expect(drive.files).toHaveLength(2);
    expect(file.body).toBe('{"v":2}');
  });
  it('keeps the Urdu in a backup intact', async () => {
    const drive = fakeDrive();
    const backup = JSON.stringify({ shop: 'المیزان الیکٹرانکس', note: 'کیش' });
    const id = await saveToDrive(drive.deps, backup);
    expect(await readFromDrive(drive.deps, id)).toBe(backup);
  });
  it('makes the file again when it was deleted on the Drive, in the folder already there', async () => {
    const drive = fakeDrive();
    const id = await saveToDrive(drive.deps, '{"v":1}');
    drive.files.find((f) => f.id === id)!.trashed = true;
    const again = await saveToDrive(drive.deps, '{"v":2}', id);
    expect(again).not.toBe(id);
    expect(drive.files.filter((f) => f.mimeType.includes('folder'))).toHaveLength(1);
  });
  it('finds the newest backup and reads it back', async () => {
    const drive = fakeDrive();
    const id = await saveToDrive(drive.deps, '{"v":1}');
    await saveToDrive(drive.deps, '{"v":2}', id);
    const latest = await latestOnDrive(drive.deps);
    expect(latest?.id).toBe(id);
    expect(await readFromDrive(drive.deps, latest!.id)).toBe('{"v":2}');
    expect(await latestOnDrive(fakeDrive().deps)).toBeNull();
  });
  it('asks for a fresh token once when Google refuses an old one', async () => {
    const drive = fakeDrive({ expireFirstToken: true });
    await saveToDrive(drive.deps, '{"v":1}');
    expect(drive.files).toHaveLength(2);
  });
  it('says when the account must be chosen again, and when there is no internet', async () => {
    const signedOut = fakeDrive();
    signedOut.deps.token = async () => null;
    await expect(saveToDrive(signedOut.deps, '{}')).rejects.toMatchObject({ problem: 'signed_out' });
    const offline = fakeDrive();
    offline.deps.fetch = (async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch;
    const error = await saveToDrive(offline.deps, '{}').catch((e) => e);
    expect(error).toBeInstanceOf(DriveError);
    expect(error.problem).toBe('offline');
  });
  it('restores a full shop from a backup made by the app', async () => {
    const source = createStore(memoryKV());
    source.load();
    source.completeSetup({ language: 'ur', businessType: 'computer', shopName: 'المیزان', phone: '0300 1234567', logo: '' }, true);
    source.createDoc('quote');
    const drive = fakeDrive();
    const id = await saveToDrive(drive.deps, source.exportBackup());
    const target = createStore(memoryKV());
    target.load();
    target.updateSettings({ driveEmail: 'shop@gmail.com', driveFileId: 'keep', driveAsked: true });
    expect(target.importBackup(await readFromDrive(drive.deps, id))).toBe(true);
    expect(target.getState().settings.shopName).toBe('المیزان');
    expect(target.getState().docs).toHaveLength(1);
    expect(target.getState().settings.driveEmail).toBe('shop@gmail.com');
    expect(target.getState().settings.driveFileId).toBe('keep');
  });
});
