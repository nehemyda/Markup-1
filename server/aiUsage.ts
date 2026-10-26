// AI usage and cost: every Gemini request is recorded (tokens, feature, project, who) with its estimated cost in
// USD, plus running totals per month. Prices per million tokens are set by admins on the AI Credits page; each
// record keeps the price it was charged at, so changing prices later doesn't rewrite history.
import { AsyncLocalStorage } from 'async_hooks';
import type { GoogleGenAI } from '@google/genai';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin';

export interface AiContext {
  feature: string;
  projectId?: string | null;
  actor?: { uid: string; email: string; name: string } | null;
}

// Which feature / project / person the current request is for (set per HTTP request)
export const aiContext = new AsyncLocalStorage<AiContext>();

// Starting prices (USD per 1M tokens), Google's published Gemini Flash rates; admins can change them
export const DEFAULT_PRICING = { inputPerMillion: 0.3, outputPerMillion: 2.5 };

let pricingCache: { value: typeof DEFAULT_PRICING; at: number } | null = null;
async function currentPricing() {
  if (pricingCache && Date.now() - pricingCache.at < 60_000) return pricingCache.value;
  const doc = (await adminDb.doc('settings/aiPricing').get().catch(() => null))?.data() || {};
  const value = {
    inputPerMillion: Number.isFinite(doc.inputPerMillion) ? Number(doc.inputPerMillion) : DEFAULT_PRICING.inputPerMillion,
    outputPerMillion: Number.isFinite(doc.outputPerMillion) ? Number(doc.outputPerMillion) : DEFAULT_PRICING.outputPerMillion,
  };
  pricingCache = { value, at: Date.now() };
  return value;
}

export function forgetPricingCache() {
  pricingCache = null;
}

// Firestore map keys can't contain dots or slashes
const safeKey = (key: string) => key.replace(/[./]/g, '_') || 'unknown';

async function recordUsage(model: string, usage: any, ctx: AiContext | undefined) {
  const inputTokens = Number(usage?.promptTokenCount || 0);
  // Thinking tokens are billed as output
  const outputTokens = Number(usage?.candidatesTokenCount || 0) + Number(usage?.thoughtsTokenCount || 0);
  if (!inputTokens && !outputTokens) return;
  const pricing = await currentPricing();
  const costUsd = (inputTokens / 1e6) * pricing.inputPerMillion + (outputTokens / 1e6) * pricing.outputPerMillion;
  const now = new Date();
  const month = now.toISOString().slice(0, 7); // YYYY-MM (UTC)
  const feature = ctx?.feature || 'other';
  const projectId = ctx?.projectId || null;
  const inc = (n: number) => FieldValue.increment(n);
  const totals = (extra: Record<string, unknown> = {}) => ({
    requests: inc(1), inputTokens: inc(inputTokens), outputTokens: inc(outputTokens), costUsd: inc(costUsd), ...extra,
  });

  await Promise.all([
    adminDb.collection('aiUsage').add({
      at: FieldValue.serverTimestamp(),
      month,
      feature,
      projectId,
      actor: ctx?.actor || null,
      model,
      inputTokens,
      outputTokens,
      costUsd,
      pricing,
    }),
    adminDb.collection('aiUsageMonthly').doc(month).set({
      month,
      ...totals(),
      projects: { [safeKey(projectId || 'none')]: totals({ projectId }) },
      features: { [safeKey(feature)]: totals({ feature }) },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }),
  ]);
}

// The Gemini client, recording usage after every request (failures to record never break the AI feature)
export function trackUsage(ai: GoogleGenAI): GoogleGenAI {
  const models = ai.models;
  const original = models.generateContent.bind(models);
  (models as any).generateContent = async (params: any) => {
    const response = await original(params);
    const ctx = aiContext.getStore();
    recordUsage(String(params?.model || 'unknown'), (response as any)?.usageMetadata, ctx).catch((err) =>
      console.warn('Could not record AI usage:', err?.message)
    );
    return response;
  };
  return ai;
}
