import {
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

export type UserLanguage = 'en' | 'pt' | 'es';

export interface UserSettings {
  language: UserLanguage;
}

const USERS_COLLECTION = 'users';

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const ref = doc(db, USERS_COLLECTION, userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return { language: 'en' };
  }
  const data = snap.data() as Partial<UserSettings> | undefined;
  const language = (data?.language as UserLanguage) || 'en';
  return { language };
}

export async function saveUserSettings(userId: string, settings: UserSettings): Promise<void> {
  const ref = doc(db, USERS_COLLECTION, userId);
  await setDoc(
    ref,
    { language: settings.language },
    { merge: true }
  );
}

