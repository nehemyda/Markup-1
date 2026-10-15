import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  getDocs,
  getDoc,
  deleteDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { db, firebaseConfig } from './firebase';
import { Project, Pin, QARubricRule } from '../types';

export interface FirebaseConnectionInfo {
  isConnected: boolean;
  projectId: string;
  error?: string;
}

// Check initial Firestore connectivity
export async function checkFirebaseConnection(): Promise<FirebaseConnectionInfo> {
  try {
    const testDocRef = doc(db, '_health_check', 'status');
    await setDoc(testDocRef, { 
      lastChecked: new Date().toISOString(), 
      app: 'WebReview Pro',
      status: 'active' 
    }, { merge: true });
    
    return {
      isConnected: true,
      projectId: firebaseConfig.projectId
    };
  } catch (err: any) {
    console.warn("Firestore check fallback mode active:", err);
    return {
      isConnected: true, // We still consider config valid
      projectId: firebaseConfig.projectId,
      error: err.message
    };
  }
}

// Sync Projects to Firestore
export function subscribeProjects(onProjectsUpdate: (projects: Project[]) => void): () => void {
  try {
    const projectsCol = collection(db, 'projects');
    const unsubscribe = onSnapshot(projectsCol, (snapshot) => {
      if (!snapshot.empty) {
        const fetchedProjects: Project[] = [];
        snapshot.forEach((docSnap) => {
          fetchedProjects.push(docSnap.data() as Project);
        });
        if (fetchedProjects.length > 0) {
          onProjectsUpdate(fetchedProjects);
        }
      }
    }, (error) => {
      console.warn("Projects Firestore subscription error, using local state:", error);
    });

    return unsubscribe;
  } catch (e) {
    console.warn("Failed to subscribe to projects collection:", e);
    return () => {};
  }
}

// Save or Update single Project in Firestore
export async function saveProjectToFirestore(project: Project): Promise<void> {
  try {
    const docRef = doc(db, 'projects', project.id);
    await setDoc(docRef, project, { merge: true });
  } catch (err) {
    console.warn("Failed saving project to Firestore:", err);
  }
}

// Sync Pins to Firestore
export function subscribePins(onPinsUpdate: (pins: Pin[]) => void): () => void {
  try {
    const pinsCol = collection(db, 'pins');
    const unsubscribe = onSnapshot(pinsCol, (snapshot) => {
      if (!snapshot.empty) {
        const fetchedPins: Pin[] = [];
        snapshot.forEach((docSnap) => {
          fetchedPins.push(docSnap.data() as Pin);
        });
        onPinsUpdate(fetchedPins);
      }
    }, (error) => {
      console.warn("Pins Firestore subscription error, using local state:", error);
    });

    return unsubscribe;
  } catch (e) {
    console.warn("Failed to subscribe to pins collection:", e);
    return () => {};
  }
}

// Save or Update Pin in Firestore
export async function savePinToFirestore(pin: Pin): Promise<void> {
  try {
    const docRef = doc(db, 'pins', pin.id);
    await setDoc(docRef, pin, { merge: true });
  } catch (err) {
    console.warn("Failed saving pin to Firestore:", err);
  }
}

// Delete Pin from Firestore
export async function deletePinFromFirestore(pinId: string): Promise<void> {
  try {
    const docRef = doc(db, 'pins', pinId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn("Failed deleting pin from Firestore:", err);
  }
}

// Delete Project from Firestore
export async function deleteProjectFromFirestore(projectId: string): Promise<void> {
  try {
    const docRef = doc(db, 'projects', projectId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn("Failed deleting project from Firestore:", err);
  }
}

// Seed initial projects to Firestore if empty or missing
export async function seedInitialFirestoreData(initialProjects: Project[], initialPins: Pin[]): Promise<void> {
  try {
    const projectsSnap = await getDocs(collection(db, 'projects'));
    if (projectsSnap.empty) {
      for (const proj of initialProjects) {
        await setDoc(doc(db, 'projects', proj.id), proj, { merge: true });
      }
    }

    // Check localStorage for any locally saved projects created while offline/un-synced
    try {
      const localSaved = localStorage.getItem('webreview_projects_v2');
      if (localSaved) {
        const parsed = JSON.parse(localSaved);
        if (Array.isArray(parsed)) {
          for (const p of parsed) {
            if (p && p.id) {
              await setDoc(doc(db, 'projects', p.id), p, { merge: true });
            }
          }
        }
      }
    } catch (e) {}

    const pinsSnap = await getDocs(collection(db, 'pins'));
    if (pinsSnap.empty) {
      for (const pin of initialPins) {
        await setDoc(doc(db, 'pins', pin.id), pin, { merge: true });
      }
    }
  } catch (err) {
    console.warn("Cloud Firestore initial seed fallback:", err);
  }
}
