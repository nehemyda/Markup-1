import express from 'express';
import crypto from 'crypto';
import { adminAuth, adminDb } from './server/firebaseAdmin';
import { checkAccess, startSession } from './server/access';
import { requireMember, requireSignedIn, AuthedRequest } from './server/auth';
import { logAudit } from './server/audit';
import { addProjectIdToPins } from './server/migrations';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';
import puppeteer, { Browser, Page } from 'puppeteer-core';

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

// ---------- Real screenshots via the local Google Chrome (puppeteer-core) ----------
// Pin snippets are real browser screenshots, like Markup.io. Set CHROME_PATH if Chrome lives elsewhere.
const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PAGE_IDLE_MS = 2 * 60 * 1000;
let browserPromise: Promise<Browser> | null = null;
const openPages = new Map<string, { page: Page; timer: NodeJS.Timeout }>();

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    if (!fs.existsSync(CHROME_PATH)) {
      return Promise.reject(new Error(`Google Chrome was not found at ${CHROME_PATH}. Set CHROME_PATH in .env.`));
    }
    browserPromise = puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--hide-scrollbars'],
      // We close Chrome ourselves on shutdown (see closeBrowser), so the server exits cleanly
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
    });
    browserPromise.then(
      (browser) => browser.on('disconnected', resetBrowser),
      () => { browserPromise = null; }
    );
  }
  return browserPromise;
}

// Forget Chrome and its pages (it closed or crashed); the next request starts a fresh one
function resetBrowser() {
  browserPromise = null;
  for (const { timer } of openPages.values()) clearTimeout(timer);
  openPages.clear();
}

async function closeBrowser() {
  const pending = browserPromise;
  resetBrowser();
  if (pending) await pending.then((b) => b.close()).catch(() => {});
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.once(signal, () => {
    closeBrowser().finally(() => process.exit(0));
  });
}

// Reuse a loaded page for the same URL + width so repeated snippets are fast
async function getPage(url: string, width: number): Promise<Page> {
  const key = `${width}|${url}`;
  const cached = openPages.get(key);
  const closeLater = (page: Page) => setTimeout(() => {
    openPages.delete(key);
    page.close().catch(() => {});
  }, PAGE_IDLE_MS);
  if (cached && !cached.page.isClosed()) {
    clearTimeout(cached.timer);
    cached.timer = closeLater(cached.page);
    return cached.page;
  }
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  openPages.set(key, { page, timer: closeLater(page) });
  return page;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Health check endpoint
  // ---------- Sign-in and access (decided on the server) ----------

  // Before creating an account: may this email use the workspace? (Only returns yes/no.)
  app.post('/api/auth/check-access', async (req, res) => {
    const email = String(req.body?.email || '');
    res.json({ allowed: await checkAccess(email) });
  });

  // After sign-in: load (or create) the member profile. 403 if this account may not use the workspace.
  app.post('/api/auth/session', async (req: AuthedRequest, res) => {
    const header = req.headers.authorization || '';
    const idToken = header.startsWith('Bearer ') ? header.slice(7) : '';
    try {
      const token = await adminAuth.verifyIdToken(idToken);
      const profile = await startSession(token);
      if (!profile) {
        return res.status(403).json({
          error: `Access denied: ${token.email || 'this account'} is not allowed in this workspace. Ask a workspace admin to invite you.`,
        });
      }
      req.token = token;
      req.member = profile;
      res.json({ profile });
    } catch {
      res.status(401).json({ error: 'Please sign in again.' });
    }
  });

  // Guest link: a pass that only works for this one project (read it, add pins and comments)
  app.post('/api/guest/session', async (req, res) => {
    const projectId = String(req.body?.projectId || '');
    const guestId = String(req.body?.guestId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || crypto.randomUUID();
    if (!projectId || !(await adminDb.doc(`projects/${projectId}`).get()).exists) {
      return res.status(404).json({ error: 'This shared project no longer exists or the link is incorrect.' });
    }
    const token = await adminAuth.createCustomToken(`guest_${guestId}`, { guestProject: projectId });
    res.json({ token, guestId });
  });

  // AI features and screenshots need a signed-in caller (they use the Gemini key / server Chrome)
  app.use('/api/ai', requireMember);
  app.use('/api/screenshot', requireSignedIn);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 1. AI Summarize Comment Thread
  app.post('/api/ai/summarize-thread', async (req, res) => {
    try {
      const { pinTitle, category, comments } = req.body;
      const ai = getAIClient();
      
      if (ai) {
        const prompt = `You are a technical project manager and UX lead. Analyze the following collaborative feedback thread on a live website annotation pin:
Pin Title: "${pinTitle}"
Category: ${category}
Comments Timeline:
${JSON.stringify(comments, null, 2)}

Provide a concise synthesis of the discussion.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: {
                  type: Type.STRING,
                  description: 'A 2-3 sentence summary of the core discussion and consensus.',
                },
                actionItems: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Specific concrete next steps for designers or developers.',
                },
                recommendedStatus: {
                  type: Type.STRING,
                  description: 'Recommended status: open, in_progress, or resolved',
                },
              },
              required: ['summary', 'actionItems', 'recommendedStatus'],
            },
            systemInstruction: 'Be objective, professional, and actionable.',
          },
        });

        const text = response.text || '{}';
        return res.json(JSON.parse(text));
      }
    } catch (error: any) {
      console.warn('AI Summarize Error (falling back to heuristic summary):', error?.message || error);
    }

    // Fallback response if GEMINI_API_KEY is missing or API fails
    const { pinTitle, comments } = req.body;
    return res.json({
      summary: `The team reviewed "${pinTitle || 'Feedback Pin'}" and discussed optimal implementation steps. Key feedback centers on improving clarity and responsive design across viewports.`,
      actionItems: [
        `Review technical requirements for "${pinTitle || 'element'}"`,
        `Apply CSS / Tailwind updates as discussed in comment history (${(comments || []).length} remarks)`,
        `Re-verify accessibility contrast ratio on mobile devices`
      ],
      recommendedStatus: 'in_progress'
    });
  });

  // 2. AI Convert to Jira / Linear Issue Ticket
  app.post('/api/ai/convert-ticket', async (req, res) => {
    const { pin, comments, platform } = req.body;
    try {
      const ai = getAIClient();

      if (ai) {
        const prompt = `Convert this website annotation feedback into a professional ${platform ? platform.toUpperCase() : 'JIRA'} developer ticket.
Pin Details:
Title: ${pin.title}
Category: ${pin.category}
Priority: ${pin.priority}
Status: ${pin.status}
Technical Metadata: ${JSON.stringify(pin.metadata || {})}
Discussion Comments: ${JSON.stringify(comments || [])}

Generate a structured developer issue ticket ready for copy-pasting or direct integration.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                ticketId: { type: Type.STRING, description: 'Simulated issue ID e.g. LIN-402 or WEB-89' },
                title: { type: Type.STRING, description: 'Concise developer-friendly bug/task title' },
                description: { type: Type.STRING, description: 'Formatted markdown description including Steps to Reproduce, Expected vs Actual behavior, and Technical context (browser, viewport, CSS selector).' },
                priority: { type: Type.STRING, description: 'Recommended priority: high, medium, or low' },
                estimatedEffort: { type: Type.STRING, description: 'Estimated time to resolve e.g. 30 mins, 2 hours, 1 day' },
                suggestedLabels: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Relevant issue tags e.g. frontend, css, accessibility, mobile',
                },
              },
              required: ['ticketId', 'title', 'description', 'priority', 'estimatedEffort', 'suggestedLabels'],
            },
          },
        });

        const text = response.text || '{}';
        return res.json(JSON.parse(text));
      }
    } catch (error: any) {
      console.warn('AI Ticket Conversion Error (falling back to ticket format):', error?.message || error);
    }

    // Fallback ticket response
    const platPrefix = platform === 'linear' ? 'LIN' : 'WEB';
    return res.json({
      ticketId: `${platPrefix}-${Math.floor(100 + Math.random() * 900)}`,
      title: `[${pin?.category?.toUpperCase() || 'UI'}] ${pin?.title || 'Website Annotation Feedback'}`,
      description: `### Bug / Task Description\n${pin?.title || 'Annotation issue'}\n\n### Technical Metadata\n- **Category**: ${pin?.category || 'design'}\n- **Priority**: ${pin?.priority || 'medium'}\n- **Selector**: \`${pin?.selector || '#canvas-element'}\`\n\n### Discussion Notes\n${(comments || []).map((c: any) => `- **${c.author || 'User'}**: ${c.text}`).join('\n') || 'No comments attached.'}`,
      priority: pin?.priority || 'medium',
      estimatedEffort: '1 hour',
      suggestedLabels: ['frontend', 'ui-review', pin?.category || 'annotation']
    });
  });

  // 3. AI Suggest Code / Copy Fix
  app.post('/api/ai/suggest-fix', async (req, res) => {
    try {
      const { pinTitle, category, currentComment, metadata } = req.body;
      const ai = getAIClient();

      if (ai) {
        const prompt = `You are a senior frontend developer and UX copywriter. A team member left this feedback on a website:
Pin Title: "${pinTitle}"
Category: ${category}
User Feedback: "${currentComment}"
Element Metadata: ${JSON.stringify(metadata || {})}

Provide an instant technical fix or copywriting alternative. If it's a styling/UI bug, provide Tailwind CSS classes or JSX/CSS code. If it's content/copy, provide 2-3 higher converting copywriting variations.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                fixType: { type: Type.STRING, description: 'code_snippet or copy_suggestion' },
                explanation: { type: Type.STRING, description: 'Brief explanation of why this fix works best.' },
                codeOrCopy: { type: Type.STRING, description: 'The exact CSS/Tailwind code or the exact copywriting text to use.' },
                additionalTip: { type: Type.STRING, description: 'A bonus performance or accessibility tip related to this element.' },
              },
              required: ['fixType', 'explanation', 'codeOrCopy', 'additionalTip'],
            },
          },
        });

        const text = response.text || '{}';
        return res.json(JSON.parse(text));
      }
    } catch (error: any) {
      console.warn('AI Suggest Fix Error (falling back to code snippet):', error?.message || error);
    }

    // Fallback code fix response
    return res.json({
      fixType: 'code_snippet',
      explanation: 'Apply high-contrast Tailwind classes with smooth transitions and explicit focus rings for WCAG 2.1 AA accessibility.',
      codeOrCopy: 'className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 hover:-translate-y-0.5 cursor-pointer"',
      additionalTip: 'Ensure interactive touch targets maintain a minimum hit box of 44px by 44px on mobile break points.'
    });
  });

  // 4. AI Automated Website Auditor
  app.post('/api/ai/audit-site', async (req, res) => {
    const { url, title, snapshot, existingIssues } = req.body || {};
    const ai = getAIClient();
    if (!ai) {
      return res.status(503).json({ error: 'AI review is unavailable: GEMINI_API_KEY is not set in .env.' });
    }
    if (!snapshot || (snapshot.kind !== 'page' && snapshot.kind !== 'image')) {
      return res.status(400).json({ error: 'Missing page snapshot.' });
    }

    const category = { type: Type.STRING, enum: ['bug', 'design', 'content', 'question'] };
    const priority = { type: Type.STRING, enum: ['high', 'medium', 'low'] };
    const guidance = `Review it like a senior UX designer and accessibility specialist. Report only real, specific problems you can see in the provided data -- for example low text contrast (WCAG AA needs 4.5:1 for normal text, 3:1 for text 24px+ or 18.66px+ bold), missing image alt text, unclear or duplicate link/button labels, tiny tap targets, unreadably small text, weak headings or hierarchy, confusing copy, broken-looking layout or overlap, missing form labels. Do not invent problems or give generic advice. Return between 0 and 6 findings, most important first. Each comment should say what is wrong, why it matters, and the concrete fix.${
      Array.isArray(existingIssues) && existingIssues.length
        ? `\nThese issues are already reported on this page; do not report them again:\n${existingIssues.slice(0, 50).map((t: string) => `- ${String(t).slice(0, 160)}`).join('\n')}`
        : ''
    }`;

    try {
      if (snapshot.kind === 'page') {
        console.log(`AI review: ${url} - ${(snapshot.elements || []).length} elements, screenshot ${snapshot.screenshot ? `${Math.round(snapshot.screenshot.length / 1024)} KB` : 'not available'}`);
        // Compact element list so the prompt stays small; Gemini must point at one of these ids
        const elementLines = (snapshot.elements || []).map((el: any) => {
          const bits = [`#${el.id} <${el.tag}>`, `at (${el.x},${el.y}) ${el.w}x${el.h}px`];
          if (el.text) bits.push(`text="${el.text}"`);
          if (el.fontSize) bits.push(`font=${el.fontSize}px/${el.fontWeight}`);
          if (el.contrast) bits.push(`contrast=${el.contrast}:1 (${el.color} on ${el.background})`);
          if (el.attrs) bits.push(`attrs=${JSON.stringify(el.attrs)}`);
          return bits.join(' ');
        }).join('\n');

        const prompt = `You are reviewing the live webpage "${snapshot.title || title}" (${url}).
Page: ${snapshot.pageWidth}x${snapshot.pageHeight}px, lang="${snapshot.lang}", meta description="${snapshot.description}".
${snapshot.screenshot ? 'An approximate screenshot of the full page is attached. It is a re-render, so it can drop or shift spaces, letter spacing, fonts and some images: use it only for layout, visual hierarchy and overlap. Judge text, spelling, spacing and punctuation ONLY from the text in the element list, which is the real page text.' : 'No screenshot was available; rely on the element list.'}

Visible elements (id, tag, position in page pixels, text, font, measured text contrast, attributes). Text ending in "[...]" was shortened by this tool, not on the page -- never report it as truncated:
${elementLines}

${guidance}
For each finding, set elementId to the id of the element the problem is on (it must be one of the ids above).`;

        const parts: any[] = [{ text: prompt }];
        if (typeof snapshot.screenshot === 'string' && snapshot.screenshot.startsWith('data:image/')) {
          const [meta, data] = snapshot.screenshot.split(',');
          parts.push({ inlineData: { mimeType: meta.slice(5, meta.indexOf(';')), data } });
        }

        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: [{ role: 'user', parts }],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  elementId: { type: Type.INTEGER, description: 'id of the element from the list' },
                  title: { type: Type.STRING, description: 'Short headline, e.g. "Low contrast on Contact button"' },
                  comment: { type: Type.STRING, description: 'What is wrong, why it matters, and the fix' },
                  category,
                  priority,
                },
                required: ['elementId', 'title', 'comment', 'category', 'priority'],
              },
            },
          },
        });

        const byId = new Map((snapshot.elements || []).map((el: any) => [el.id, el]));
        const findings = JSON.parse(response.text || '[]')
          .filter((f: any) => byId.has(f.elementId))
          .map((f: any) => {
            const el: any = byId.get(f.elementId);
            return { ...f, x: el.pinX, y: el.pinY, selector: el.selector };
          });
        return res.json({ findings });
      }

      // Uploaded image / mockup: send the image itself and ask for boxes (0-1000 normalized)
      let mimeType = 'image/png';
      let data = '';
      if (typeof url === 'string' && url.startsWith('data:image/')) {
        const [meta, b64] = url.split(',');
        mimeType = meta.slice(5, meta.indexOf(';'));
        data = b64;
      } else {
        const imgRes = await fetch(url);
        if (!imgRes.ok) throw new Error(`Could not download the image (HTTP ${imgRes.status}).`);
        mimeType = imgRes.headers.get('content-type')?.split(';')[0] || mimeType;
        const buf = Buffer.from(await imgRes.arrayBuffer());
        if (buf.length > 15 * 1024 * 1024) throw new Error('The image is too large to review (over 15 MB).');
        data = buf.toString('base64');
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [{
          role: 'user',
          parts: [
            { text: `You are reviewing a design image titled "${title}".\n${guidance}\nFor each finding, give box_2d as [ymin, xmin, ymax, xmax] normalized to 0-1000 around the area the problem is in.` },
            { inlineData: { mimeType, data } },
          ],
        }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                box_2d: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                title: { type: Type.STRING },
                comment: { type: Type.STRING },
                category,
                priority,
              },
              required: ['box_2d', 'title', 'comment', 'category', 'priority'],
            },
          },
        },
      });

      const box = snapshot.box;
      const findings = JSON.parse(response.text || '[]')
        .filter((f: any) => Array.isArray(f.box_2d) && f.box_2d.length === 4)
        .map((f: any) => {
          const [ymin, xmin, ymax, xmax] = f.box_2d;
          return {
            ...f,
            x: box.left + (((xmin + xmax) / 2) / 1000) * box.width,
            y: box.top + (((ymin + ymax) / 2) / 1000) * box.height,
            selector: `image region [${f.box_2d.join(', ')}]`,
          };
        });
      return res.json({ findings });
    } catch (error: any) {
      console.warn('AI review failed:', error?.message || error);
      return res.status(502).json({ error: `AI review failed: ${error?.message || 'unknown error'}` });
    }
  });

  // Real screenshot of a page area (used for pin snippets)
  app.post('/api/screenshot', async (req, res) => {
    const { url, viewportWidth, x, y, width, height } = req.body || {};
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: 'A full http(s) URL is required.' });
    }
    const nums = [viewportWidth, x, y, width, height].map(Number);
    if (nums.some((n) => !Number.isFinite(n)) || nums[0] < 200 || nums[0] > 4000 || nums[3] <= 0 || nums[4] <= 0) {
      return res.status(400).json({ error: 'Invalid screenshot area.' });
    }
    const [vw, cx, cy, cw, ch] = nums.map(Math.round);
    const capture = async () => {
      const page = await getPage(url, vw);
      // Scroll to the area so lazy-loaded images there load, then capture it in page coordinates
      await page.evaluate((top: number) => window.scrollTo(0, Math.max(0, top - 200)), cy);
      await new Promise((r) => setTimeout(r, 600));
      // Hide floating overlays (chat widgets, cookie banners, back-to-top buttons).
      // Keep only full-width fixed bars at the top of the page, i.e. sticky headers.
      await page.evaluate(() => {
        const vw = window.innerWidth;
        for (const el of Array.from(document.body.querySelectorAll('*'))) {
          if (getComputedStyle(el).position !== 'fixed') continue;
          const r = el.getBoundingClientRect();
          const isTopBar = r.top <= 80 && r.width >= vw * 0.9;
          if (!isTopBar) (el as HTMLElement).style.setProperty('visibility', 'hidden', 'important');
        }
      });
      return page.screenshot({
        type: 'png',
        clip: { x: Math.max(0, cx), y: Math.max(0, cy), width: cw, height: ch },
        captureBeyondViewport: true,
      });
    };
    try {
      let png: Uint8Array;
      try {
        png = await capture();
      } catch (err) {
        // A cached page can go stale (site navigated, Chrome restarted): drop it and try once more
        const key = `${vw}|${url}`;
        const stale = openPages.get(key);
        if (stale) {
          clearTimeout(stale.timer);
          openPages.delete(key);
          stale.page.close().catch(() => {});
        }
        png = await capture();
      }
      res.setHeader('Content-Type', 'image/png');
      return res.send(Buffer.from(png));
    } catch (err: any) {
      console.warn('Screenshot failed for', url, err?.message);
      return res.status(502).json({ error: `Could not take a real screenshot: ${err?.message || 'unknown error'}` });
    }
  });

  // 5. Live Website Proxy with Full-Height Auto-Expansion (Markup.io architecture)
  app.get('/api/proxy-site', async (req, res) => {
    const rawUrl = req.query.url as string;
    if (!rawUrl) {
      return res.status(400).send('Missing url query parameter');
    }

    try {
      let targetUrl = rawUrl.trim();
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }

      // Retry brief network failures (connection reset, DNS hiccup) before showing the error page
      let response: Response | undefined;
      let lastError: any;
      for (let attempt = 0; attempt < 3 && !response; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * attempt));
        try {
          response = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(20000),
          });
        } catch (err: any) {
          lastError = err;
        }
      }
      if (!response) throw lastError;

      const contentType = response.headers.get('content-type') || 'text/html';

      if (contentType.includes('text/html')) {
        let html = await response.text();

        // Strip restrictive meta headers and frame busters
        html = html.replace(/<meta[^>]*http-equiv=["']?X-Frame-Options["']?[^>]*>/gi, '');
        html = html.replace(/<meta[^>]*http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, '');

        const baseTag = `<base href="${escapeHtml(String(targetUrl))}">`;
        const autoHeightSnippet = `
<style>
/* Full Page Continuous Layout - Markup.io style */
/* Let the page grow to its full length inside the frame. Heights are left alone: forcing height:auto broke
   pages that size their layout with percentages (e.g. an editor preview whose frame fills the screen). */
html, body {
  overflow-y: visible !important;
}
</style>
<script>
(function() {
  // Height of the page's real content: the lowest bottom edge of visible, in-flow elements.
  // Ignores the frame's own height and fixed/sticky overlays (chat bubbles, cookie bars), so the frame can shrink to fit.
  // App-style pages (e.g. an editor preview: a toolbar plus one frame that fills the screen and scrolls inside)
  // have no page length of their own. Give them a normal screen height instead of measuring.
  var APP_PAGE_HEIGHT = 900;
  function isAppStylePage() {
    var frames = document.getElementsByTagName('iframe');
    for (var i = 0; i < frames.length; i++) {
      var r = frames[i].getBoundingClientRect();
      if (r.width >= window.innerWidth * 0.5 && r.height >= window.innerHeight * 0.4 && Math.abs(r.bottom - window.innerHeight) < 3) return true;
    }
    return false;
  }
  function contentHeight() {
    if (isAppStylePage()) return APP_PAGE_HEIGHT;
    var maxBottom = 0;
    var els = document.body ? document.body.getElementsByTagName('*') : [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var r = el.getBoundingClientRect();
      if (r.height <= 0 || r.width <= 0) continue;
      var bottom = r.bottom + window.scrollY;
      if (bottom <= maxBottom) continue;
      var st = getComputedStyle(el);
      if (st.position === 'fixed' || st.position === 'sticky' || st.display === 'none' || st.visibility === 'hidden') continue;
      // Skip boxes stretched to the bottom of the frame (min-height: 100vh / 100%, flex fillers);
      // they grow with the frame, so their real content is counted instead
      if (Math.abs(r.bottom + window.scrollY - window.innerHeight) < 3) continue;
      var p = el.parentElement, floating = false;
      while (p && p !== document.body) {
        var ps = getComputedStyle(p).position;
        if (ps === 'fixed' || ps === 'sticky') { floating = true; break; }
        p = p.parentElement;
      }
      if (!floating) maxBottom = bottom;
    }
    return Math.ceil(maxBottom);
  }
  function reportFullHeight() {
    try {
      var height = contentHeight();
      if (height > 200) {
        window.parent.postMessage({ type: 'MARKUP_FULL_PAGE_HEIGHT', height: height, url: window.location.href }, '*');
      }
    } catch(e) {}
  }
  // Frames inside the page (e.g. an editor preview showing desktop/tablet/mobile) also load through the proxy,
  // like Markup.io; otherwise sites that only allow framing by themselves (X-Frame-Options / frame-ancestors) are
  // blocked. Covers frames in the HTML and frames that page scripts create later.
  var PROXY_PREFIX = location.origin + '/api/proxy-site?url=';
  function proxiedFrameUrl(value) {
    if (!value) return value;
    var raw = String(value);
    if (raw.indexOf(PROXY_PREFIX) === 0 || /^(about:|data:|blob:|javascript:)/i.test(raw)) return raw;
    try {
      var abs = new URL(raw, document.baseURI);
      if (!/^https?:$/.test(abs.protocol)) return raw;
      return PROXY_PREFIX + encodeURIComponent(abs.href);
    } catch (err) { return raw; }
  }
  try {
    var srcDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
    if (srcDesc && srcDesc.set) {
      Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
        configurable: true,
        enumerable: srcDesc.enumerable,
        get: function() { return srcDesc.get.call(this); },
        set: function(v) { srcDesc.set.call(this, proxiedFrameUrl(v)); }
      });
    }
    var origSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, value) {
      if (this.tagName === 'IFRAME' && String(name).toLowerCase() === 'src') value = proxiedFrameUrl(value);
      return origSetAttribute.call(this, name, value);
    };
  } catch (err) {}
  function fixFrames(root) {
    var frames = root.querySelectorAll ? root.querySelectorAll('iframe[src]') : [];
    for (var i = 0; i < frames.length; i++) {
      var current = frames[i].getAttribute('src');
      var fixed = proxiedFrameUrl(current);
      if (fixed !== current) frames[i].setAttribute('src', fixed);
    }
  }
  document.addEventListener('DOMContentLoaded', function() { fixFrames(document); });
  new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (node.nodeType !== 1) continue;
        if (node.tagName === 'IFRAME') fixFrames(node.parentNode || document);
        else fixFrames(node);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  // Link clicks: pages of the same website open inside the app (as a page of the project);
  // other websites open in a new tab. Same-page #anchors behave normally.
  document.addEventListener('click', function(e) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var raw = a.getAttribute('href') || '';
    if (!raw || raw.charAt(0) === '#' || /^(javascript|mailto|tel|sms):/i.test(raw)) return;
    var url, base;
    try { url = new URL(raw, document.baseURI); base = new URL(document.baseURI); } catch (err) { return; }
    if (!/^https?:$/.test(url.protocol)) return;
    e.preventDefault();
    e.stopPropagation();
    if (url.hostname.replace(/^www\\./, '') === base.hostname.replace(/^www\\./, '')) {
      url.hash = '';
      window.parent.postMessage({ type: 'MARKUP_NAVIGATE', url: url.href }, '*');
    } else {
      window.open(url.href, '_blank', 'noopener');
    }
  }, true);
  window.addEventListener('load', reportFullHeight);
  window.addEventListener('resize', reportFullHeight);
  document.addEventListener('DOMContentLoaded', reportFullHeight);
  // Sites keep settling after load (images, fonts, widgets): re-check every second for the first 20s,
  // and whenever an image finishes loading
  var checks = 0;
  var timer = setInterval(function() {
    reportFullHeight();
    if (++checks >= 20) clearInterval(timer);
  }, 1000);
  document.addEventListener('load', function(e) {
    if (e.target && e.target.tagName === 'IMG') reportFullHeight();
  }, true);
  if (typeof ResizeObserver !== 'undefined' && document.body) {
    try {
      new ResizeObserver(reportFullHeight).observe(document.body);
    } catch(e) {}
  }
})();
</script>
`;

        if (html.includes('<head>')) {
          html = html.replace('<head>', `<head>${baseTag}${autoHeightSnippet}`);
        } else if (html.includes('<html')) {
          html = html.replace(/<html[^>]*>/, `$&<head>${baseTag}${autoHeightSnippet}</head>`);
        } else {
          html = `${baseTag}${autoHeightSnippet}${html}`;
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('X-Frame-Options', 'ALLOWALL');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.send(html);
      } else {
        const buffer = await response.arrayBuffer();
        res.setHeader('Content-Type', contentType);
        return res.send(Buffer.from(buffer));
      }
    } catch (err: any) {
      console.warn('Proxy request failed for', rawUrl, err?.message, err?.cause?.code || err?.cause?.message || '');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(`
<!DOCTYPE html>
<html>
<head>
  <meta name="markup-proxy-error" content="1">
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; text-align: center; }
    .card { max-width: 600px; margin: 40px auto; background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
    h2 { color: #f59e0b; font-size: 20px; margin-top: 0; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
    .code { font-family: monospace; background: #0b1120; padding: 4px 8px; border-radius: 6px; color: #38bdf8; }
  </style>
</head>
<body>
  <div class="card">
    <h2>🌐 External Web Server Connection Restricted</h2>
    <p>Target: <span class="code">${escapeHtml(rawUrl)}</span></p>
    <p>The website could not be loaded here. This is often a brief network problem; try again. If it keeps happening, the site may require a login or VPN, or block automated requests. Use the open-in-new-tab icon next to the URL to view it directly.</p>
    <p><button onclick="location.reload()" style="background:#4f46e5;color:#fff;border:0;border-radius:8px;padding:8px 16px;font-weight:600;cursor:pointer">Try again</button></p>
  </div>
</body>
</html>
      `);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  addProjectIdToPins()
    .then((n) => n && console.log(`Migration: added projectId to ${n} pins`))
    .catch((err) => console.warn('Migration failed:', err?.message));

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 MarkFlow Server running on http://localhost:${PORT}`);
  });
}

startServer();
