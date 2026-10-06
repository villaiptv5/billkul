import { Platform } from 'react-native';
import { store, useAppState } from '../data/app';
import { formatDayInline, formatTime, isoDate } from '../logic/dates';
import { pickBackupFile, saveBackupFile } from '../platform/files';
import { useDialogs } from '../ui/kit';
import { useLocale } from '../ui/locale';

/** Backup to a file and restore from one, shared by the phone and desktop Settings. */
export function useBackupActions() {
  const { t, lang } = useLocale();
  const { confirm, notify } = useDialogs();
  const { settings } = useAppState();

  const status = settings.lastBackupAt
    ? t('lastBackup', { when: `${formatDayInline(isoDate(new Date(settings.lastBackupAt)), lang)}, ${formatTime(settings.lastBackupAt, lang)}` })
    : t('noBackupYet');

  const saveBackup = async () => {
    try {
      const ok = await saveBackupFile(`BillKul-backup-${isoDate()}.json`, store.exportBackup());
      if (ok) {
        store.updateSettings({ lastBackupAt: new Date().toISOString() });
        notify(t('backupSaved'));
      }
    } catch {
      notify(t('shareFailed'));
    }
  };

  const restore = async () => {
    if (!(await confirm({ title: t('restoreTitle'), body: t(Platform.OS === 'web' ? 'restoreBodyPc' : 'restoreBody'), confirmLabel: t('restore') }))) return;
    try {
      const json = await pickBackupFile();
      if (json == null) return;
      notify(store.importBackup(json) ? t('restoreDone') : t('restoreBad'));
    } catch {
      notify(t('restoreBad'));
    }
  };

  return { status, backedUp: !!settings.lastBackupAt, saveBackup, restore };
}
