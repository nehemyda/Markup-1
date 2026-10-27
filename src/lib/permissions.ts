// Role permission matrix, shared by the whole workspace (the "permissions" settings row). Admins edit it in
// Team → Roles & Permissions; the server reads the same row for the permissions it enforces.
import { useEffect, useState } from 'react';
import { mergeSetting, subscribeSetting } from './supabaseSync';
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

export function useRolePermissions(): RolePermissions {
  const [permissions, setPermissions] = useState<RolePermissions>(DEFAULT_ROLE_PERMISSIONS);
  useEffect(
    () => subscribeSetting<RolePermissions>('permissions', (data) => setPermissions({ ...DEFAULT_ROLE_PERMISSIONS, ...(data || {}) })),
    []
  );
  return permissions;
}

// Admins only (enforced by the database rules)
export function saveRolePermission(key: keyof RolePermissions, value: boolean) {
  return mergeSetting('permissions', { [key]: value });
}
