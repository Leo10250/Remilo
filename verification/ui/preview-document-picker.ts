import type { DocumentPickerResult } from 'expo-document-picker';

const fixture =
  typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get('reviewBackup');

/** Synthetic document selection for the opt-in web review only. */
export async function getDocumentAsync(): Promise<DocumentPickerResult> {
  if (fixture === 'cancel') return { canceled: true, assets: null };
  return {
    canceled: false,
    assets: [
      {
        name: 'remilo-backup.zip',
        uri:
          fixture === 'invalid' ? 'memory://backup/invalid' : 'memory://backup/remilo-backup.zip',
        mimeType: 'application/zip',
        lastModified: 0,
      },
    ],
  };
}
