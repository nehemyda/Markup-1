// Express middleware: check the caller's Firebase ID token (sent as "Authorization: Bearer <token>").
import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from './firebaseAdmin';
import { getMember, isAdminRole, MemberProfile } from './access';

export interface AuthedRequest extends Request {
  token?: DecodedIdToken;
  member?: MemberProfile | null;
}

async function readToken(req: Request): Promise<DecodedIdToken | null> {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer (.+)$/);
  if (!match) return null;
  try {
    return await adminAuth.verifyIdToken(match[1]);
  } catch {
    return null;
  }
}

// Any signed-in caller: a workspace member or a guest with a project pass
export async function requireSignedIn(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = await readToken(req);
  if (!token) return res.status(401).json({ error: 'Please sign in.' });
  req.token = token;
  req.member = token.guestProject ? null : await getMember(token.uid);
  if (!req.member && !token.guestProject) return res.status(403).json({ error: 'You are not a member of this workspace.' });
  next();
}

// Workspace members only (not guests)
export async function requireMember(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = await readToken(req);
  if (!token) return res.status(401).json({ error: 'Please sign in.' });
  const member = token.guestProject ? null : await getMember(token.uid);
  if (!member) return res.status(403).json({ error: 'Only workspace members can do this.' });
  req.token = token;
  req.member = member;
  next();
}

// Owners and Admins only
export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  await requireMember(req, res, () => {
    if (!isAdminRole(req.member?.role)) return res.status(403).json({ error: 'Only workspace admins can do this.' });
    next();
  });
}
