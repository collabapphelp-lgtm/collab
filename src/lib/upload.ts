import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

// React Native's fetch().blob() is unreliable with Firebase Storage; XHR is the known-good path.
function uriToBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error('Could not read the selected file'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

async function uploadFile(path: string, localUri: string, contentType?: string, onProgress?: (fraction: number) => void) {
  const blob = await uriToBlob(localUri);
  const fileRef = ref(storage, path);
  // Resumable so big videos report progress (and survive brief network blips).
  const task = uploadBytesResumable(fileRef, blob, contentType ? { contentType } : undefined);
  await new Promise<void>((resolve, reject) =>
    task.on('state_changed', (s) => onProgress?.(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0), reject, () => resolve()),
  );
  (blob as Blob & { close?: () => void }).close?.();
  return { url: await getDownloadURL(fileRef), path };
}

/** Uploads a local image and returns its public download URL. Same path the web prototype uses. */
export async function uploadProfilePhoto(uid: string, localUri: string): Promise<string> {
  const { url } = await uploadFile(`profile-photos/${uid}/${Date.now()}.jpg`, localUri, 'image/jpeg');
  return url;
}

/** Uploads a showcase snippet (audio, video or image). Same folder as the web prototype. */
export async function uploadMedia(
  uid: string,
  localUri: string,
  fileName: string,
  contentType?: string,
  onProgress?: (fraction: number) => void,
) {
  const safeName = fileName.replace(/[^\w.-]+/g, '_').slice(-80);
  return uploadFile(`media/${uid}/${Date.now()}_${safeName}`, localUri, contentType, onProgress);
}

/** Uploads an event flyer. Under the poster's folder so deleting their account removes it. */
export async function uploadEventFlyer(uid: string, localUri: string, onProgress?: (fraction: number) => void) {
  const { url } = await uploadFile(`event-flyers/${uid}/${Date.now()}.jpg`, localUri, 'image/jpeg', onProgress);
  return url;
}

/** Uploads a recorded voice note (m4a) for a chat. Lives under the sender's folder so account deletion removes it. */
export async function uploadVoiceNote(uid: string, matchId: string, localUri: string) {
  return uploadFile(`voice/${uid}/${matchId}_${Date.now()}.m4a`, localUri, 'audio/mp4');
}
