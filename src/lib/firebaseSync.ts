import { 
  collection, 
  doc, 
  where,
  setDoc, 
  onSnapshot, 
  getDocs,
  getDoc,
  deleteDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { db, firebaseConfig } from './firebase';
import { Project, Pin, QARubricRule, Teammate, AuthUser, Folder, WpSite, WpFix } from '../types';

// One project (guests can only read the project in their link)
export function subscribeProject(projectId: string, onUpdate: (project: Project | null) => void): () => void {
  return onSnapshot(doc(db, 'projects', projectId), (snap) => {
    onUpdate(snap.exists() ? ({ ...(snap.data() as Project), id: snap.id }) : null);
  }, (error) => {
    console.warn("Project Firestore subscription error:", error);
    onUpdate(null);
  });
}

// WordPress site linked to a project (null = not connected)
export function subscribeWpSite(projectId: string, onUpdate: (site: WpSite | null) => void): () => void {
  return onSnapshot(doc(db, 'wpSites', projectId), (snap) => {
    onUpdate(snap.exists() ? (snap.data() as WpSite) : null);
  }, (error) => {
    console.warn("WordPress site subscription error:", error);
    onUpdate(null);
  });
}

// AI fix proposals for one pin, newest first
export function subscribeWpFixes(pinId: string, onUpdate: (fixes: WpFix[]) => void): () => void {
  return onSnapshot(query(collection(db, 'wpFixes'), where('pinId', '==', pinId)), (snap) => {
    const fixes = snap.docs.map((d) => ({ ...(d.data() as WpFix), id: d.id }));
    const time = (f: WpFix) => (f.proposedAt?.toMillis ? f.proposedAt.toMillis() : 0);
    onUpdate(fixes.sort((a, b) => time(b) - time(a)));
  }, (error) => {
    console.warn("AI fixes subscription error:", error);
    onUpdate([]);
  });
}

// Sync Projects to Firestore
export function subscribeProjects(onProjectsUpdate: (projects: Project[]) => void): () => void {
  try {
    const projectsCol = collection(db, 'projects');
    const unsubscribe = onSnapshot(projectsCol, (snapshot) => {
      const fetchedProjects: Project[] = [];
      snapshot.forEach((docSnap) => {
        fetchedProjects.push(docSnap.data() as Project);
      });
      onProjectsUpdate(fetchedProjects);
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
// All pins (members), or only one project's pins (guests)
export function subscribePins(onPinsUpdate: (pins: Pin[]) => void, projectId?: string): () => void {
  try {
    const pinsCol = projectId ? query(collection(db, 'pins'), where('projectId', '==', projectId)) : collection(db, 'pins');
    const unsubscribe = onSnapshot(pinsCol, (snapshot) => {
      const fetchedPins: Pin[] = [];
      snapshot.forEach((docSnap) => {
        fetchedPins.push(docSnap.data() as Pin);
      });
      onPinsUpdate(fetchedPins);
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

// Delete all Pins belonging to the given Asset IDs (used when a Project is deleted)
export async function deletePinsForAssets(assetIds: string[]): Promise<void> {
  if (assetIds.length === 0) return;
  try {
    const pinsSnap = await getDocs(collection(db, 'pins'));
    const ids = new Set(assetIds);
    await Promise.all(
      pinsSnap.docs
        .filter((d) => ids.has((d.data() as Pin).assetId))
        .map((d) => deleteDoc(d.ref))
    );
  } catch (err) {
    console.warn("Failed deleting project pins from Firestore:", err);
  }
}

// ---------- Team members ----------
// Members are signed-up accounts (users/{uid}); removed members keep their doc with removed: true.
// Pending invitations live in invites/{email} until that person creates an account.

const INVITE_ID_PREFIX = 'invite:';

export function isInviteId(id: string): boolean {
  return id.startsWith(INVITE_ID_PREFIX);
}

function inviteDocId(email: string): string {
  return email.trim().toLowerCase();
}

// Older profiles stored the long label; the Team page uses the short role names
export function normalizeRole(role: string | undefined): Teammate['role'] {
  if (!role || role === 'Member (Editor & Annotator)') return 'Member';
  return role as Teammate['role'];
}

// Live team list: active members plus pending invitations
export function subscribeTeam(onTeamUpdate: (team: Teammate[]) => void): () => void {
  let members: Teammate[] = [];
  let invites: Teammate[] = [];
  const emit = () => onTeamUpdate([...members, ...invites]);

  try {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      members = [];
      snapshot.forEach((docSnap) => {
        const u = docSnap.data() as AuthUser & { department?: string; removed?: boolean };
        if (u.removed) return;
        members.push({
          id: docSnap.id,
          name: u.name,
          email: u.email,
          avatar: u.avatar,
          role: normalizeRole(u.role),
          status: u.status || 'offline',
          cursorColor: u.cursorColor || '#6366f1',
          department: u.department,
        });
      });
      emit();
    }, (error) => {
      console.warn("Users Firestore subscription error:", error);
    });

    const unsubInvites = onSnapshot(collection(db, 'invites'), (snapshot) => {
      invites = [];
      snapshot.forEach((docSnap) => {
        const inv = docSnap.data() as { name: string; email: string; role: string; invitedBy?: string };
        invites.push({
          id: INVITE_ID_PREFIX + docSnap.id,
          name: inv.name,
          email: inv.email,
          avatar: '',
          role: normalizeRole(inv.role),
          status: 'offline',
          cursorColor: '#94a3b8',
          lastActive: 'Invitation pending',
          createdBy: inv.invitedBy,
        });
      });
      emit();
    }, (error) => {
      console.warn("Invites Firestore subscription error:", error);
    });

    return () => {
      unsubUsers();
      unsubInvites();
    };
  } catch (e) {
    console.warn("Failed to subscribe to team collections:", e);
    return () => {};
  }
}

export async function inviteMember(name: string, email: string, role: Teammate['role'], invitedBy: string): Promise<void> {
  try {
    await setDoc(doc(db, 'invites', inviteDocId(email)), {
      name,
      email: email.trim(),
      role,
      invitedBy,
      invitedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Failed saving invite to Firestore:", err);
  }
}

export async function updateMemberRole(id: string, role: Teammate['role']): Promise<void> {
  try {
    if (isInviteId(id)) {
      await setDoc(doc(db, 'invites', id.slice(INVITE_ID_PREFIX.length)), { role }, { merge: true });
    } else {
      await setDoc(doc(db, 'users', id), { role }, { merge: true });
    }
  } catch (err) {
    console.warn("Failed updating member role in Firestore:", err);
  }
}

export async function removeMember(id: string): Promise<void> {
  try {
    if (isInviteId(id)) {
      await deleteDoc(doc(db, 'invites', id.slice(INVITE_ID_PREFIX.length)));
    } else {
      await setDoc(doc(db, 'users', id), { removed: true, removedAt: new Date().toISOString() }, { merge: true });
    }
  } catch (err) {
    console.warn("Failed removing member in Firestore:", err);
  }
}

// ---------- Folders (group projects, e.g. per partner) ----------
export function subscribeFolders(onFoldersUpdate: (folders: Folder[]) => void): () => void {
  try {
    return onSnapshot(collection(db, 'folders'), (snapshot) => {
      const folders: Folder[] = [];
      snapshot.forEach((docSnap) => folders.push({ ...(docSnap.data() as Folder), id: docSnap.id }));
      onFoldersUpdate(folders);
    }, (error) => {
      console.warn("Folders Firestore subscription error:", error);
    });
  } catch (e) {
    console.warn("Failed to subscribe to folders collection:", e);
    return () => {};
  }
}

export async function saveFolder(folder: Folder): Promise<void> {
  try {
    await setDoc(doc(db, 'folders', folder.id), folder, { merge: true });
  } catch (err) {
    console.warn("Failed saving folder to Firestore:", err);
  }
}

export async function deleteFolderDoc(folderId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'folders', folderId));
  } catch (err) {
    console.warn("Failed deleting folder from Firestore:", err);
  }
}
