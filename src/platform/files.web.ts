export async function saveBackupFile(fileName: string, json: string): Promise<boolean> {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

export function pickBackupFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.billkul,application/json';
    input.style.display = 'none';
    input.onchange = async () => {
      const file = input.files?.[0];
      input.remove();
      resolve(file ? await file.text() : null);
    };
    input.oncancel = () => {
      input.remove();
      resolve(null);
    };
    document.body.appendChild(input);
    input.click();
  });
}

export async function saveSheetFile(fileName: string, bytes: Uint8Array): Promise<boolean> {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

export function pickSheetFile(): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv';
    input.style.display = 'none';
    input.onchange = async () => {
      const file = input.files?.[0];
      input.remove();
      resolve(file ? new Uint8Array(await file.arrayBuffer()) : null);
    };
    input.oncancel = () => {
      input.remove();
      resolve(null);
    };
    document.body.appendChild(input);
    input.click();
  });
}
