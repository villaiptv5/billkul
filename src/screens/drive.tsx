import React, { useState } from 'react';
import { View } from 'react-native';
import { backupToDrive, findDriveBackup, restoreFromDrive, startDriveBackup, stopDriveBackup, useDriveProblem, type DriveResult } from '../backup/auto';
import type { DriveProblem } from '../backup/drive';
import { store, useAppState } from '../data/app';
import { formatDayInline, formatTime, isoDate } from '../logic/dates';
import { GOOGLE_AVAILABLE } from '../platform/google';
import { C } from '../theme';
import { Button } from '../ui/Button';
import { Sheet, SheetScroll, useDialogs } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';

/** True when the Drive backup can be offered: the phone app, with Google set up on the admin page. */
export function useDriveReady(): boolean {
  const { account } = useAppState();
  return GOOGLE_AVAILABLE && !!account?.googleClientId;
}

function useDriveMessages() {
  const { t, lang } = useLocale();
  const { notify } = useDialogs();
  const when = (iso: string) => `${formatDayInline(isoDate(new Date(iso)), lang)}, ${formatTime(iso, lang)}`;
  const tell = (result: DriveResult | DriveProblem | 'cancelled') => {
    if (result === 'ok') notify(t('driveSaved'));
    else if (result === 'signed_out') notify(t('driveSignedOut'));
    else if (result !== 'cancelled') notify(t('driveFailed'));
  };
  return { t, notify, when, tell };
}

/** Restoring from the Drive, shared by first-time setup and Settings. */
export function useDriveRestore() {
  const { confirm } = useDialogs();
  const { t, notify, when, tell } = useDriveMessages();
  return async () => {
    const found = await findDriveBackup();
    if (typeof found === 'string') return tell(found);
    if (!found.backup) return notify(t('driveNone'));
    if (!(await confirm({ title: t('driveRestoreTitle', { when: when(found.backup.modifiedTime) }), body: t('restoreBody'), confirmLabel: t('restore') }))) return;
    const done = await restoreFromDrive(found.backup, found.email);
    if (done === true) notify(t('restoreDone'));
    else if (done === false) notify(t('restoreBad'));
    else tell(done);
  };
}

/** Offered once after signing in: choose the Gmail account whose Google Drive keeps the backup. */
export function DriveOffer() {
  const ready = useDriveReady();
  const { settings } = useAppState();
  const { t, tell } = useDriveMessages();
  const [busy, setBusy] = useState(false);
  const visible = ready && settings.setupDone && !settings.driveEmail && !settings.driveAsked;
  if (!visible) return null;

  // Asked once: "Not now" leaves the Drive backup to Settings.
  const later = () => store.updateSettings({ driveAsked: true });

  const choose = async () => {
    setBusy(true);
    tell(await startDriveBackup());
    setBusy(false);
  };

  return (
    <Sheet visible onClose={later} title={t('driveTitle')}>
      <SheetScroll>
        <T size={15}>{t('driveOfferBody')}</T>
        <Button label={t('driveChoose')} icon="cloudUp" size="lg" head disabled={busy} onPress={() => void choose()} testID="drive-choose" />
        <Button label={t('notNow')} variant="ghost" disabled={busy} onPress={later} testID="drive-later" />
      </SheetScroll>
    </Sheet>
  );
}

/** The Google Drive part of the backup card in Settings. Without Google set up, the old "coming soon" line shows. */
export function DriveSection() {
  const ready = useDriveReady();
  const { settings } = useAppState();
  const { confirm } = useDialogs();
  const problem = useDriveProblem();
  const { t, tell } = useDriveMessages();
  const restore = useDriveRestore();
  const [busy, setBusy] = useState(false);

  if (!ready) {
    return (
      <T size={13} color={C.mint}>
        {t('backupDriveSoon')}
      </T>
    );
  }

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (await confirm({ title: t('driveStop'), body: t('driveStopBody'), confirmLabel: t('driveStop') })) await stopDriveBackup();
  };

  return (
    <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: C.inkLine, paddingTop: 14 }}>
      <T size={15} w="semibold" color={C.onInk}>
        {t('driveTitle')}
      </T>
      {settings.driveEmail ? (
        <>
          <T size={13.5} color={problem ? C.orangeOnInk : C.mint} testID="drive-status">
            {problem === 'signed_out' ? t('driveSignedOut') : problem ? t('driveFailed') : t('driveOn', { email: settings.driveEmail })}
          </T>
          <Button label={problem === 'signed_out' ? t('driveChoose') : t('driveBackupNow')} icon="cloudUp" variant="onInk" disabled={busy} onPress={() => void run(async () => tell(problem === 'signed_out' ? await startDriveBackup() : await backupToDrive()))} testID="drive-now" />
          <Button label={t('driveRestore')} icon="download" variant="onInkOutline" disabled={busy} onPress={() => void run(restore)} testID="drive-restore" />
          <Button label={t('driveStop')} variant="onInkOutline" disabled={busy} onPress={() => void run(stop)} testID="drive-stop" />
        </>
      ) : (
        <>
          <T size={13.5} color={C.onInkSoft}>
            {t('driveOfferBody')}
          </T>
          <Button label={t('driveConnect')} icon="cloudUp" variant="onInk" disabled={busy} onPress={() => void run(async () => tell(await startDriveBackup()))} testID="drive-connect" />
          <Button label={t('driveRestore')} icon="download" variant="onInkOutline" disabled={busy} onPress={() => void run(restore)} testID="drive-restore" />
        </>
      )}
    </View>
  );
}
