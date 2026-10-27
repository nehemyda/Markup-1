// Audit log of sensitive actions (who did what, when). Written by the server only; admins can read it.
import { insertRow, now } from './db';
import type { AuthedRequest } from './auth';

export async function logAudit(req: AuthedRequest, action: string, details: Record<string, unknown> = {}) {
  try {
    await insertRow('audit_log', {
      action,
      actorUid: req.token?.uid || null,
      actorEmail: req.token?.email || null,
      actorRole: req.member?.role || (req.token?.guestProject ? 'Guest' : null),
      details,
      at: now(),
    });
  } catch (err: any) {
    console.warn('Audit log write failed:', err?.message);
  }
}
