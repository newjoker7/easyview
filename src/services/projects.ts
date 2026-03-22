import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

export interface ProjectClip {
  id: string;
  url: string;
  start: number;
  end: number;
  name?: string;
  offset?: number;
  serverUrl?: string;
  muted?: boolean;
}

export interface ProjectAudioTrack {
  id: string;
  name: string;
  clips: ProjectClip[];
  muted?: boolean;
}

/** Texto sobre o vídeo (guardado no projeto). */
export interface ProjectTextOverlay {
  id: string;
  text: string;
  xPercent: number;
  yPercent: number;
  fontFamily: string;
  fontSize: number;
  color: string;
  fontWeight: 400 | 700;
  timelineStart: number;
  timelineEnd: number;
}

export interface ProjectData {
  clips: ProjectClip[];
  audioTracks: ProjectAudioTrack[];
  filterType?: string;
  filterIntensity?: number;
  /** Camadas de texto no editor (timeline global). */
  textOverlays?: ProjectTextOverlay[];
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  data: ProjectData;
}

const COLLECTION = 'projects';

export async function createProject(userId: string, name: string): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    userId,
    name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    data: { clips: [], audioTracks: [] },
  });
  return ref.id;
}

export async function getUserProjects(userId: string): Promise<Project[]> {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
}

export async function getProject(projectId: string): Promise<Project | null> {
  const ref = doc(db, COLLECTION, projectId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Project;
}

export async function updateProjectData(projectId: string, data: ProjectData): Promise<void> {
  const ref = doc(db, COLLECTION, projectId);
  await updateDoc(ref, { data, updatedAt: serverTimestamp() });
}

export async function renameProject(projectId: string, name: string): Promise<void> {
  const ref = doc(db, COLLECTION, projectId);
  await updateDoc(ref, { name, updatedAt: serverTimestamp() });
}

export async function deleteProject(projectId: string): Promise<void> {
  const ref = doc(db, COLLECTION, projectId);
  await deleteDoc(ref);
}
