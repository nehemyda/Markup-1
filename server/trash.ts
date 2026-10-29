// Recently deleted projects. Deleting a project moves it and its pins into deleted_projects; for 30 days the team can
// restore it exactly as it was, then it is removed for good. Its revisions, notifications and WordPress fixes are left
// in place, so they come back with it.
import { supabaseAdmin } from './db';

export const KEEP_DAYS = 30;

export class TrashError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const check = <T>({ data, error }: { data: T; error: { message: string } | null }, action: string): T => {
  if (error) throw new Error(`${action} failed: ${error.message}`);
  return data;
};

export interface Deleter {
  id: string;
  name: string;
  email: string;
}

export async function trashProject(projectId: string, by: Deleter) {
  const project = check(await supabaseAdmin.from('projects').select('*').eq('id', projectId).maybeSingle(), 'Reading the project');
  if (!project) throw new TrashError('This project no longer exists.', 404);
  const assetIds: string[] = (project.assets || []).map((a: any) => String(a.id));
  const byProject = check(await supabaseAdmin.from('pins').select('*').eq('project_id', projectId), 'Reading its pins');
  const byPage = assetIds.length ? check(await supabaseAdmin.from('pins').select('*').in('asset_id', assetIds), 'Reading its pins') : [];
  const pins = [...new Map([...byProject, ...byPage].map((p: any) => [p.id, p])).values()];

  check(
    await supabaseAdmin.from('deleted_projects').upsert({
      id: projectId,
      name: project.name || '',
      url: project.assets?.[0]?.url || null,
      project,
      pins,
      deleted_by: by,
      deleted_at: new Date().toISOString(),
    }),
    'Keeping the project'
  );
  if (pins.length) check(await supabaseAdmin.from('pins').delete().in('id', pins.map((p: any) => p.id)), 'Removing its pins');
  check(await supabaseAdmin.from('projects').delete().eq('id', projectId), 'Removing the project');
  return { pinCount: pins.length };
}

export async function restoreProject(projectId: string) {
  const saved = check(await supabaseAdmin.from('deleted_projects').select('*').eq('id', projectId).maybeSingle(), 'Reading the deleted project');
  if (!saved) throw new TrashError('This project is no longer in Recently deleted.', 404);
  const project = { ...saved.project };
  // Its folder may have been deleted meanwhile: then it comes back outside a folder
  if (project.folder_id) {
    const folder = check(await supabaseAdmin.from('folders').select('id').eq('id', project.folder_id).maybeSingle(), 'Reading its folder');
    if (!folder) project.folder_id = null;
  }
  check(await supabaseAdmin.from('projects').upsert(project), 'Restoring the project');
  const pins = Array.isArray(saved.pins) ? saved.pins : [];
  for (let i = 0; i < pins.length; i += 500) {
    check(await supabaseAdmin.from('pins').upsert(pins.slice(i, i + 500)), 'Restoring its pins');
  }
  check(await supabaseAdmin.from('deleted_projects').delete().eq('id', projectId), 'Clearing it from Recently deleted');
  return { name: saved.name, pinCount: pins.length };
}

export async function purgeProject(projectId: string) {
  check(await supabaseAdmin.from('deleted_projects').delete().eq('id', projectId), 'Deleting the project for good');
}

// Remove projects deleted more than 30 days ago; runs at start and every 6 hours
export function startTrashCleanup() {
  const sweep = async () => {
    const before = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString();
    const { data, error } = await supabaseAdmin.from('deleted_projects').delete().lt('deleted_at', before).select('id');
    if (error) console.warn('Recently deleted cleanup failed:', error.message);
    else if (data?.length) console.log(`Recently deleted: removed ${data.length} project(s) for good after ${KEEP_DAYS} days.`);
  };
  sweep();
  setInterval(sweep, 6 * 3_600_000).unref?.();
}
