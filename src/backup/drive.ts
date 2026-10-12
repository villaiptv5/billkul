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

async function backupsOnDrive(deps: DriveDeps): Promise<{ id: string; modifiedTime: string }[]> {
  const found = await json<{ files: { id: string; modifiedTime: string }[] }>(
    await call(deps, `${API}/files?${query(`name = '${BACKUP_NAME}' and trashed = false`, { orderBy: 'modifiedTime desc', pageSize: '100', fields: 'files(id,modifiedTime)' })}`),
  );
  return found.files;
}

/**
 * Sends the backup with Google's resumable upload: it has no 5 MB ceiling like the simple upload,
 * which a busy shop's backup passes within months. First a request opens the upload and Google
 * answers with where to send the file; then the whole file goes there in one request.
 */
async function upload(deps: DriveDeps, open: Response, backup: string): Promise<string> {
  const target = open.headers.get('Location') ?? open.headers.get('location');
  if (!target) throw new DriveError('failed');
  const sent = await json<{ id: string }>(await call(deps, target, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: backup }));
  return sent.id;
}

const START_HEADERS = { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/json' };

async function writeOver(deps: DriveDeps, id: string, backup: string): Promise<boolean> {
  const open = await call(deps, `${UPLOAD}/files/${encodeURIComponent(id)}?uploadType=resumable&fields=id`, { method: 'PATCH', headers: START_HEADERS, body: '{}' });
  // Deleted or moved to the bin on the Drive in the meantime.
  if (open.status === 404 || open.status === 403) return false;
  if (!open.ok) throw new DriveError('failed');
  await upload(deps, open, backup);
  return true;
}

/** Moves extra copies to the Drive's bin (kept there 30 days). A copy that will not move is left alone. */
async function binExtraCopies(deps: DriveDeps, ids: string[]): Promise<void> {
  for (const id of ids) {
    try {
      await call(deps, `${API}/files/${encodeURIComponent(id)}?fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
    } catch {
      // Tidying up is not worth failing the backup for.
    }
  }
}

/**
 * Saves the backup over the one "BillKul backup.json" on the Drive. Every phone and PC of the shop
 * writes to that same file; a new file is made only when there is none. Extra copies left by older
 * versions of the app are moved to the bin. Returns the file's id.
 */
export async function saveToDrive(deps: DriveDeps, backup: string, fileId = ''): Promise<string> {
  const existing = await backupsOnDrive(deps);
  const ids = existing.map((f) => f.id);
  // The file this device saved last time first, then the newest one.
  const order = fileId && ids.includes(fileId) ? [fileId, ...ids.filter((id) => id !== fileId)] : ids;
  for (let i = 0; i < order.length; i++) {
    if (await writeOver(deps, order[i], backup)) {
      await binExtraCopies(deps, order.slice(i + 1));
      return order[i];
    }
  }
  const parent = await folderId(deps);
  const open = await call(deps, `${UPLOAD}/files?uploadType=resumable&fields=id`, {
    method: 'POST',
    headers: START_HEADERS,
    body: JSON.stringify({ name: BACKUP_NAME, parents: [parent], mimeType: 'application/json' }),
  });
  if (!open.ok) throw new DriveError('failed');
  return upload(deps, open, backup);
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
