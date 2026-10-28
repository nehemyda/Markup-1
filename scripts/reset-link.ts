// Prints a password reset link for a member without sending an email (Supabase's built-in email allows only a few
// emails per hour). Give the link to that person only: it signs them in. Usage:
//   npx tsx --env-file=.env scripts/reset-link.ts person@yourdigitalagents.com https://your-live-address
import { supabaseAdmin } from '../server/db';

const [email, site] = process.argv.slice(2);
if (!email || !site) {
  console.error('Usage: npx tsx --env-file=.env scripts/reset-link.ts <email> <live address>');
  process.exit(1);
}
const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: new URL('/', site).href } });
if (error) {
  console.error(error.message);
  process.exit(1);
}
console.log(`\nReset link for ${email} (works once, expires in 1 hour):\n\n${data.properties.action_link.replace(/&amp;/g, '&')}\n`);
