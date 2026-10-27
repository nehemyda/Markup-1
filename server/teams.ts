// Who covers for whom. Admins group people into teams (Settings → Teams): a Manager, a Team Lead and developers.
// While someone is out of office, their notifications also go to their Team Lead; when the Team Lead is out (or the
// person away is the lead), to the Manager.
import { findRows } from './db';

export interface Recipient {
  uid: string;
  // Set when this person gets it because `forName` is out of office
  forName?: string;
}

const today = () => new Date().toISOString().slice(0, 10);

// Out of office now: switched on, and not past the last day away
export const isAway = (user: any) => !!user?.outOfOffice && (!user.outOfOfficeUntil || String(user.outOfOfficeUntil) >= today());

export async function loadCoverage() {
  const [users, teams] = await Promise.all([findRows('users', { removed: false }), findRows('teams')]);
  const byId = new Map(users.map((u) => [u.id, u]));
  const away = (uid: string) => isAway(byId.get(uid));

  // The people who cover for uid (present ones only)
  const coversFor = (uid: string): string[] => {
    const covers = new Set<string>();
    for (const team of teams) {
      const members: string[] = team.memberIds || [];
      if (members.includes(uid) && team.leadId && team.leadId !== uid) {
        covers.add(away(team.leadId) && team.managerId ? team.managerId : team.leadId);
      }
      if (team.leadId === uid && team.managerId) covers.add(team.managerId);
    }
    return [...covers].filter((id) => id && id !== uid && byId.has(id) && !away(id));
  };

  // Everyone to tell: the people themselves, plus whoever covers for those who are away
  const expand = (uids: Iterable<string>): Recipient[] => {
    const out = new Map<string, Recipient>();
    for (const uid of uids) {
      if (!uid || !byId.has(uid)) continue;
      out.set(uid, { uid });
    }
    for (const uid of [...out.keys()]) {
      if (!away(uid)) continue;
      const name = String(byId.get(uid)?.name || 'a teammate');
      for (const cover of coversFor(uid)) if (!out.has(cover)) out.set(cover, { uid: cover, forName: name });
    }
    return [...out.values()];
  };

  return { byId, away, coversFor, expand, teams };
}

// "… (for Arjun, out of office)"
export const coverTitle = (title: string, r: Recipient) => (r.forName ? `${title} (for ${r.forName}, out of office)` : title);
