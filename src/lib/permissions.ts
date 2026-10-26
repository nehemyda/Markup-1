// Role permission matrix, shared by the whole workspace (Firestore settings/permissions). Admins edit it in
// Team → Roles & Permissions; the server reads the same document for the permissions it enforces.
import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { RolePermissions } from '../types';

export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  membersCanViewAllQAScores: false,
  membersCanManageRubric: false,
  membersCanInvite: true,
  membersCanManageRoles: false,
  membersCanDeleteProjects: false,
  membersCanArchiveProjects: true,
  membersCanUseAiFix: false,
  membersCanApplyAiFix: false,
};

const permissionsRef = doc(db, 'settings', 'permissions');

export function useRolePermissions(): RolePermissions {
  const [permissions, setPermissions] = useState<RolePermissions>(DEFAULT_ROLE_PERMISSIONS);
  useEffect(
    () =>
      onSnapshot(
        permissionsRef,
        (snap) => setPermissions({ ...DEFAULT_ROLE_PERMISSIONS, ...(snap.data() as Partial<RolePermissions> | undefined) }),
        () => setPermissions(DEFAULT_ROLE_PERMISSIONS)
      ),
    []
  );
  return permissions;
}

// Admins only (enforced by the security rules)
export function saveRolePermission(key: keyof RolePermissions, value: boolean) {
  return setDoc(permissionsRef, { [key]: value, updatedAt: new Date().toISOString() }, { merge: true });
}
