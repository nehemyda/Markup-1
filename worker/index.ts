// Vpin on Cloudflare. This Worker serves the web pages (the Vite build in dist/) and passes /api/... to Vpin's Node
// server, which runs in a Cloudflare container (see Dockerfile). One server instance holds the in-memory state
// (Chrome, caches), and a schedule wakes it every 5 minutes so reminders and the daily summary run even when nobody
// has the app open.
import { Container } from '@cloudflare/containers';

// Settings the server reads (wrangler.jsonc "vars" and `wrangler secret put`), passed on to the container
const SERVER_SETTINGS = [
  'APP_URL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VITE_ADMIN_EMAILS',
  'GEMINI_API_KEY',
  'VPIN_SECRET_KEY',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'MAIL_FROM',
  'R2_ACCOUNT_ID',
  'R2_BUCKET',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'PAGE_FETCH_ALLOW_HOSTS',
] as const;

type Env = { SERVER: DurableObjectNamespace<VpinServer>; ASSETS: Fetcher } & Partial<Record<(typeof SERVER_SETTINGS)[number], string>>;

export class VpinServer extends Container<Env> {
  defaultPort = 8080;
  // The schedule below keeps it awake; this only matters if the schedule stops
  sleepAfter = '30m';

  constructor(ctx: DurableObjectState<Env>, env: Env) {
    super(ctx, env);
    this.envVars = Object.fromEntries(SERVER_SETTINGS.filter((name) => env[name]).map((name) => [name, env[name]!]));
  }
}

const server = (env: Env) => env.SERVER.getByName('main');

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/api/')) return server(env).fetch(request);
    return env.ASSETS.fetch(request);
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(server(env).fetch('http://vpin/api/health').then((r) => r.body?.cancel()));
  },
} satisfies ExportedHandler<Env>;
