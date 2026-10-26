import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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

/** Uploads a local image and returns its public download URL. Same path the web prototype uses. */
export async function uploadProfilePhoto(uid: string, localUri: string): Promise<string> {
  const blob = await uriToBlob(localUri);
  const fileRef = ref(storage, `profile-photos/${uid}/${Date.now()}.jpg`);
  await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
  (blob as Blob & { close?: () => void }).close?.();
  return getDownloadURL(fileRef);
}
