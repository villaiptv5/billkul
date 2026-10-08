/**
 * The BillKul backup on the shop owner's own Google Drive: one file, "BillKul backup.json", in a
 * "BillKul" folder. It is written over each time; Google Drive keeps its earlier versions itself.
 *
 * The app asks only for the drive.file permission, so it can see and change the files it made and
 * nothing else on the Drive.
 */

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
export const BACKUP_NAME = 'BillKul backup.json';
const FOLDER_NAME = 'BillKul';
const FOLDER_TYPE = 'application/vnd.google-apps.folder';

export type DriveProblem = 'signed_out' | 'offline' | 'failed';

export class DriveError extends Error {
  constructor(public problem: DriveProblem) {
    super(problem);
  }
}

export interface DriveDeps {
  /** A current access token for the chosen Google account, or null when it has to be chosen again. */
  token(): Promise<string | null>;
  /** Forgets a token Google refused, so the next one is fresh. */
  forget(token: string): Promise<void>;
  fetch: typeof fetch;
}

async function call(deps: DriveDeps, url: string, init: RequestInit = {}, again = true): Promise<Response> {
  const token = await deps.token();
  if (!token) throw new DriveError('signed_out');
  let response: Response;
  try {
    response = await deps.fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` } });
  } catch {
    throw new DriveError('offline');
  }
  if (response.status === 401 && again) {
    await deps.forget(token);
    return call(deps, url, init, false);
  }
  if (response.status === 401) throw new DriveError('signed_out');
  return response;
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) throw new DriveError('failed');
  return (await response.json()) as T;
}

function query(q: string, extra: Record<string, string> = {}): string {
  return new URLSearchParams({ q, spaces: 'drive', ...extra }).toString();
}

async function folderId(deps: DriveDeps): Promise<string> {
  const found = await json<{ files: { id: string }[] }>(
    await call(deps, `${API}/files?${query(`name = '${FOLDER_NAME}' and mimeType = '${FOLDER_TYPE}' and trashed = false`, { fields: 'files(id)' })}`),
  );
  if (found.files.length) return found.files[0].id;
  const made = await json<{ id: string }>(
    await call(deps, `${API}/files?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_TYPE }) }),
  );
  return made.id;
}

/** Saves the backup, over the file saved last time when it is still there. Returns the file's id. */
export async function saveToDrive(deps: DriveDeps, backup: string, fileId = ''): Promise<string> {
  if (fileId) {
    const updated = await call(deps, `${UPLOAD}/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: backup,
    });
    if (updated.ok) return fileId;
    // Deleted or moved to the bin on the Drive: make a new one.
    if (updated.status !== 404 && updated.status !== 403) throw new DriveError('failed');
  }
  const parent = await folderId(deps);
  const boundary = `billkul${Date.now().toString(36)}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: BACKUP_NAME, parents: [parent], mimeType: 'application/json' }) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${backup}\r\n--${boundary}--`;
  const made = await json<{ id: string }>(
    await call(deps, `${UPLOAD}/files?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body }),
  );
  return made.id;
}

export interface DriveBackup {
  id: string;
  modifiedTime: string;
}

/** The newest BillKul backup this app has saved on the Drive, or null when there is none. */
export async function latestOnDrive(deps: DriveDeps): Promise<DriveBackup | null> {
  const found = await json<{ files: DriveBackup[] }>(
    await call(deps, `${API}/files?${query(`name = '${BACKUP_NAME}' and trashed = false`, { orderBy: 'modifiedTime desc', pageSize: '1', fields: 'files(id,modifiedTime)' })}`),
  );
  return found.files[0] ?? null;
}

export async function readFromDrive(deps: DriveDeps, id: string): Promise<string> {
  const response = await call(deps, `${API}/files/${encodeURIComponent(id)}?alt=media`);
  if (!response.ok) throw new DriveError('failed');
  return response.text();
}
