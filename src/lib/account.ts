import { deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { reauthWithProvider, signInMethod } from './social-auth';
import { collection, deleteDoc, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { deleteObject, listAll, ref } from 'firebase/storage';
import { auth, db, storage } from './firebase';
import { UI_PREVIEW } from './preview';
import { deletePushTokens } from './push';
import { deleteMyEventData } from './events';
import { leaveGroup, respondToGroup } from './connections';

async function deleteAllIn(path: [string, ...string[]]) {
  const snap = await getDocs(collection(db, ...path));
  // Firestore batches max out at 500 writes.
  for (let i = 0; i < snap.docs.length; i += 450) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

async function deleteStorageFolder(folder: string) {
  const res = await listAll(ref(storage, folder));
  await Promise.all(res.items.map((item) => deleteObject(item).catch(() => {})));
}

/**
 * Permanently deletes the signed-in person's account and data.
 * Throws with code 'auth/wrong-password' / 'auth/invalid-credential' if the password is wrong.
 *
 * Not removed here: other people's "like" records pointing at this account.
 * They reference a deleted profile and are ignored.
 */
export async function deleteAccount(password: string | null) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  if (UI_PREVIEW) return;

  // Firebase only allows deleting an account right after signing in, so confirm it's them first:
  // their password, or the Apple/Google sheet for accounts made that way.
  const method = signInMethod(user);
  if (method === 'password' && user.email && password) await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  else if (method === 'apple' || method === 'google') await reauthWithProvider(user, method);
  else throw Object.assign(new Error('Confirm your password'), { code: 'auth/missing-password' });
  const me = user.uid;

  // 1. Conversations: delete the messages I sent and close the chat for the other person.
  const matches = await getDocs(query(collection(db, 'matches'), where('members', 'array-contains', me)));
  for (const m of matches.docs) {
    const mine = await getDocs(query(collection(m.ref, 'messages'), where('senderId', '==', me)));
    for (let i = 0; i < mine.docs.length; i += 450) {
      const batch = writeBatch(db);
      mine.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    const batch = writeBatch(db);
    batch.update(m.ref, { closedBy: me });
    await batch.commit();
  }

  // 1b. Group chats: delete what I sent, then leave (and turn down open invites).
  const inGroups = await getDocs(query(collection(db, 'groups'), where('members', 'array-contains', me))).catch(() => null);
  for (const g of inGroups?.docs ?? []) {
    const mine = await getDocs(query(collection(g.ref, 'messages'), where('senderId', '==', me)));
    for (let i = 0; i < mine.docs.length; i += 450) {
      const batch = writeBatch(db);
      mine.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    await leaveGroup(g.id).catch(() => {});
  }
  const invitedTo = await getDocs(query(collection(db, 'groups'), where('invited', 'array-contains', me))).catch(() => null);
  for (const g of invitedTo?.docs ?? []) await respondToGroup(g.id, { id: me } as never, false).catch(() => {});

  // 2. My likes, passes and blocks.
  await deleteAllIn(['users', me, 'likes']);
  await deleteAllIn(['users', me, 'passes']);
  await deleteAllIn(['users', me, 'blocks']);

  // 3. Uploaded photos and snippets.
  await deleteStorageFolder(`profile-photos/${me}`);
  await deleteStorageFolder(`media/${me}`);
  await deleteStorageFolder(`voice/${me}`);
  await deleteStorageFolder(`event-flyers/${me}`).catch(() => {});

  // 4. Push tokens, profile, then the login itself.
  await deleteMyEventData(me).catch(() => {});
  await deletePushTokens(me);
  await deleteDoc(doc(db, 'activity', me)).catch(() => {});
  await deleteDoc(doc(db, 'users', me));
  await deleteUser(user);
}
