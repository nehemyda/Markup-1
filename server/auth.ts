// Express middleware: check the caller's Supabase access token (sent as "Authorization: Bearer <token>").
import type { NextFunction, Request, Response } from 'express';
import { supabaseAdmin } from './db';
import { getMember, isAdminRole, MemberProfile } from './access';

// Who is calling. uid is the member id used throughout the app (guests: "guest_<account id>").
export interface CallerToken {
  authId: string;
  uid: string;
  email: string;
  name: string;
  picture: string;
  emailVerified: boolean;
  // The one project a guest link opens (null for team members)
  guestProject: string | null;
}

export interface AuthedRequest extends Request {
  token?: CallerToken;
  member?: MemberProfile | null;
}

// Checking a token asks Supabase; remember answers for a minute
const recent = new Map<string, { token: CallerToken; until: number }>();

export async function readToken(req: Request): Promise<CallerToken | null> {
  const match = (req.headers.authorization || '').match(/^Bearer (.+)$/);
  if (!match) return null;
  const jwt = match[1];
  const cached = recent.get(jwt);
  if (cached && cached.until > Date.now()) return { ...cached.token };
  const { data, error } = await supabaseAdmin.auth.getUser(jwt);
  if (error || !data.user) return null;
  const user = data.user;
  const meta = user.user_metadata || {};
  const token: CallerToken = {
    authId: user.id,
    uid: '',
    email: String(user.email || '').toLowerCase(),
    name: String(meta.full_name || meta.name || ''),
    picture: String(meta.avatar_url || meta.picture || ''),
    emailVerified: !!user.email_confirmed_at,
    guestProject: user.app_metadata?.guest_project ? String(user.app_metadata.guest_project) : null,
  };
  if (recent.size > 5000) recent.clear();
  recent.set(jwt, { token, until: Date.now() + 60_000 });
  return { ...token };
}

// Forget cached answers for this account (e.g. after it got a guest pass)
export function forgetToken(authId: string) {
  for (const [jwt, entry] of recent) if (entry.token.authId === authId) recent.delete(jwt);
}

// Any signed-in caller: a workspace member or a guest with a project pass
export async function requireSignedIn(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = await readToken(req);
  if (!token) return res.status(401).json({ error: 'Please sign in.' });
  const member = token.guestProject ? null : await getMember(token.authId);
  if (!member && !token.guestProject) return res.status(403).json({ error: 'You are not a member of this workspace.' });
  token.uid = member?.id || `guest_${token.authId}`;
  req.token = token;
  req.member = member;
  next();
}

// Workspace members only (not guests)
export async function requireMember(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = await readToken(req);
  if (!token) return res.status(401).json({ error: 'Please sign in.' });
  const member = token.guestProject ? null : await getMember(token.authId);
  if (!member) return res.status(403).json({ error: 'Only workspace members can do this.' });
  token.uid = member.id;
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
