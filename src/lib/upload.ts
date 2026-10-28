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

async function uploadFile(path: string, localUri: string, contentType?: string) {
  const blob = await uriToBlob(localUri);
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, blob, contentType ? { contentType } : undefined);
  (blob as Blob & { close?: () => void }).close?.();
  return { url: await getDownloadURL(fileRef), path };
}

/** Uploads a local image and returns its public download URL. Same path the web prototype uses. */
export async function uploadProfilePhoto(uid: string, localUri: string): Promise<string> {
  const { url } = await uploadFile(`profile-photos/${uid}/${Date.now()}.jpg`, localUri, 'image/jpeg');
  return url;
}

/** Uploads a showcase snippet (audio, video or image). Same folder as the web prototype. */
export async function uploadMedia(uid: string, localUri: string, fileName: string, contentType?: string) {
  const safeName = fileName.replace(/[^\w.-]+/g, '_').slice(-80);
  return uploadFile(`media/${uid}/${Date.now()}_${safeName}`, localUri, contentType);
}
