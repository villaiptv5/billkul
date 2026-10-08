import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { store, useAppState } from '../data/app';
import { chooseGoogleAccount, forgetGoogleToken, GOOGLE_AVAILABLE, googleToken, leaveGoogle } from '../platform/google';
import { DriveError, latestOnDrive, readFromDrive, saveToDrive, type DriveBackup, type DriveDeps, type DriveProblem } from './drive';

/** The Google client set on the admin page; '' until Google Cloud is set up, and then the Drive backup stays hidden. */
export function driveClientId(): string {
  return GOOGLE_AVAILABLE ? store.getState().account?.googleClientId ?? '' : '';
}

function deps(clientId: string): DriveDeps {
  return { token: () => googleToken(clientId), forget: forgetGoogleToken, fetch: (...args) => fetch(...args) };
}

export type DriveResult = 'ok' | DriveProblem;

let running: Promise<DriveResult> | null = null;
let lastProblem: DriveProblem | null = null;
const watchers = new Set<() => void>();

function report(problem: DriveProblem | null) {
  lastProblem = problem;
  watchers.forEach((fn) => fn());
}

/** Saves the shop's backup to the chosen Google Drive now. Only one save runs at a time. */
export function backupToDrive(): Promise<DriveResult> {
  const clientId = driveClientId();
  if (!clientId || !store.getState().settings.driveEmail) return Promise.resolve('signed_out');
  if (running) return running;
  running = (async (): Promise<DriveResult> => {
    try {
      const fileId = await saveToDrive(deps(clientId), store.exportBackup(), store.getState().settings.driveFileId);
      store.updateSettings({ driveFileId: fileId, lastBackupAt: new Date().toISOString() });
      report(null);
      return 'ok';
    } catch (error) {
      const problem = error instanceof DriveError ? error.problem : 'failed';
      report(problem);
      return problem;
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Google's window for choosing the Gmail account; on success the backup is switched on and saved at once. */
export async function startDriveBackup(): Promise<DriveResult | 'cancelled'> {
  const clientId = driveClientId();
  if (!clientId) return 'failed';
  try {
    const chosen = await chooseGoogleAccount(clientId);
    store.updateSettings({ driveAsked: true });
    if (!chosen) return 'cancelled';
    store.updateSettings({ driveEmail: chosen.email, driveFileId: '' });
  } catch {
    return 'failed';
  }
  return backupToDrive();
}

export async function stopDriveBackup(): Promise<void> {
  const clientId = driveClientId();
  store.updateSettings({ driveEmail: '', driveFileId: '' });
  report(null);
  if (clientId) await leaveGoogle(clientId);
}

/** Finds the newest backup on the chosen Drive, asking for the account first when none is chosen yet. */
export async function findDriveBackup(): Promise<{ backup: DriveBackup | null; email: string } | DriveProblem | 'cancelled'> {
  const clientId = driveClientId();
  if (!clientId) return 'failed';
  let email = store.getState().settings.driveEmail;
  try {
    if (!email || !(await googleToken(clientId))) {
      const chosen = await chooseGoogleAccount(clientId);
      if (!chosen) return 'cancelled';
      email = chosen.email;
    }
    return { backup: await latestOnDrive(deps(clientId)), email };
  } catch (error) {
    return error instanceof DriveError ? error.problem : 'failed';
  }
}

/** Replaces what is on this device with the backup from the Drive, and keeps backing up to that Drive. */
export async function restoreFromDrive(backup: DriveBackup, email: string): Promise<boolean | DriveProblem> {
  try {
    const json = await readFromDrive(deps(driveClientId()), backup.id);
    if (!store.importBackup(json)) return false;
    store.updateSettings({ driveEmail: email, driveFileId: backup.id, driveAsked: true });
    return true;
  } catch (error) {
    return error instanceof DriveError ? error.problem : 'failed';
  }
}

/** The last problem with the Drive backup, for Settings; null while it works. */
export function useDriveProblem(): DriveProblem | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const fn = () => tick((n) => n + 1);
    watchers.add(fn);
    return () => void watchers.delete(fn);
  }, []);
  return lastProblem;
}

const QUIET = 20 * 1000;
const STALE = 12 * 60 * 60 * 1000;

/**
 * Saves to Google Drive by itself: 20 seconds after the last change, at once when the app goes to the
 * background with a change still waiting, and on opening when the last backup is more than 12 hours old.
 */
export function useAutoDriveBackup(): void {
  const { settings, account, docs, customers, items, cash, stockMoves } = useAppState();
  const on = GOOGLE_AVAILABLE && !!account?.googleClientId && !!settings.driveEmail;
  // Settings change when a backup is saved; those fields must not count as a change to back up.
  const settingsKey = useMemo(() => JSON.stringify({ ...settings, lastBackupAt: '', driveFileId: '' }), [settings]);
  const [waiting, setWaiting] = useState(false);
  const [started] = useState(() => ({ first: true }));

  useEffect(() => {
    if (!on) return;
    if (started.first) {
      started.first = false;
      const last = settings.lastBackupAt ? Date.parse(settings.lastBackupAt) : 0;
      if (Date.now() - last > STALE) void backupToDrive();
      return;
    }
    setWaiting(true);
    const timer = setTimeout(() => {
      setWaiting(false);
      void backupToDrive();
    }, QUIET);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, settingsKey, docs, customers, items, cash, stockMoves]);

  useEffect(() => {
    if (!on || !waiting) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        setWaiting(false);
        void backupToDrive();
      }
    });
    return () => sub.remove();
  }, [on, waiting]);
}
