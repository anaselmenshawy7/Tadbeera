import {
  GEMINI_MAX_OUTPUT_TOKENS,
  GEMINI_MODEL,
  GEMINI_TIMEOUT_MS,
  PHOTO_LOOKUP_TIMEOUT_MS,
  RECIPE_JSON_SCHEMA,
  RECIPE_SYSTEM_INSTRUCTION,
} from '../src/features/recipes/recipeContract.ts';
import {
  doesDishImageStrictlyMatch,
  validateAndNormalizeGeminiRecipe,
  type ValidatedAiRecipe,
} from '../src/features/recipes/recipeSchema.ts';

export interface WorkerEnv {
  GEMINI_API_KEY?: string;
  ALLOWED_ORIGINS?: string;
  REQUIRE_ORIGIN?: string;
  RATE_LIMIT_MAX_PER_MIN?: string;
  RECIPE_CACHE_TTL_SECONDS?: string;
  RECIPE_CLIENT_TOKEN?: string;
}

export interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException?(): void;
}

export interface WorkerCacheLike {
  match(request: Request | string): Promise<Response | undefined>;
  put(request: Request | string, response: Response): Promise<void>;
}

export interface RecipeWorkerDeps {
  fetchFn?: typeof fetch;
  cache?: WorkerCacheLike | null;
  nowFn?: () => number;
  retryDelayMs?: number;
  geminiTimeoutMs?: number;
  photoLookupTimeoutMs?: number;
}

const MAX_BODY_BYTES = 64 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_CACHE_TTL_SECONDS = 120;
const DEFAULT_RATE_LIMIT_MAX = 15;
const MAX_RATE_LIMIT_ENTRIES = 2_000;
const DEFAULT_CACHE_TTL_SECONDS = 43_200; // 12 hours
const TEXT_DECODER = new TextDecoder();

const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const STATIC_SYSTEM_INSTRUCTION_JSON = JSON.stringify({
  parts: [{ text: RECIPE_SYSTEM_INSTRUCTION }],
});

const STATIC_GENERATION_CONFIG_JSON = JSON.stringify({
  responseMimeType: 'application/json',
  responseSchema: RECIPE_JSON_SCHEMA,
  maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
  thinkingConfig: { thinkingLevel: 'minimal' },
});

function buildGeminiRequestBody(query: string): string {
  const userTextJson = JSON.stringify(
    `اكتب وصفة كاملة ودقيقة للأكلة المطلوبة لأسرة من 4 أفراد: "${query}"`
  );
  return `{"systemInstruction":${STATIC_SYSTEM_INSTRUCTION_JSON},"contents":[{"role":"user","parts":[{"text":${userTextJson}}]}],"generationConfig":${STATIC_GENERATION_CONFIG_JSON}}`;
}

const DEFAULT_ALLOWED_ORIGINS = [
  'https://localhost',
  'capacitor://localhost',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const SUSPICIOUS_QUERY_PATTERNS = [
  /https?:\/\//i,
  /<\s*\/?\s*script/i,
  /ignore\s+(all\s+)?(previous|above)\s+instructions/i,
  /system\s+prompt/i,
  /\bjailbreak\b/i,
];

const INVISIBLE_FORMAT_CHARS_RE = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;
const ARABIC_DIACRITICS_AND_TATWEEL_RE = /[\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const TWO_LETTERS_RE = /\p{L}.*\p{L}/su;

function extractPathname(rawUrl: string): string {
  const schemeIdx = rawUrl.indexOf('://');
  const pathStart = schemeIdx !== -1 ? rawUrl.indexOf('/', schemeIdx + 3) : rawUrl.indexOf('/');
  if (pathStart === -1) return '/';
  const qIdx = rawUrl.indexOf('?', pathStart);
  const hIdx = rawUrl.indexOf('#', pathStart);
  const endIdx =
    qIdx !== -1 && hIdx !== -1 ? Math.min(qIdx, hIdx) : qIdx !== -1 ? qIdx : hIdx;
  return endIdx === -1 ? rawUrl.slice(pathStart) : rawUrl.slice(pathStart, endIdx);
}

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

function normalizeArabicCacheKey(raw: string): string {
  return raw
    .replace(INVISIBLE_FORMAT_CHARS_RE, '')
    .replace(ARABIC_DIACRITICS_AND_TATWEEL_RE, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function redactSecret(text: string, secret: string): string {
  if (!secret || !text) return text;
  return text.split(secret).join('[REDACTED]');
}

function parseAllowedOrigins(rawEnv?: string): string[] {
  const raw = (rawEnv || '').trim();
  if (!raw) return DEFAULT_ALLOWED_ORIGINS;
  return raw
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function isOriginMatch(origin: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (origin === pattern) return true;
  // Support wildcard subdomain patterns like https://*.run.app or https://*.pages.dev
  if (pattern.includes('*.')) {
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace('\\*\\.', '(?:[a-z0-9-]+\\.)+');
    return new RegExp(`^${escaped}$`, 'i').test(origin);
  }
  return false;
}

function evaluateCorsAndOrigin(
  request: Request,
  env: WorkerEnv
): {
  allowed: boolean;
  corsHeaders: Record<string, string>;
} {
  const origin = (request.headers.get('Origin') || '').trim();
  const allowedList = parseAllowedOrigins(env.ALLOWED_ORIGINS);
  const allowsAny = allowedList.includes('*');

  if (!origin) {
    const requireOrigin = env.REQUIRE_ORIGIN === 'true';
    return {
      allowed: !requireOrigin,
      corsHeaders: {
        'Access-Control-Allow-Origin': allowsAny ? '*' : 'https://localhost',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Tadbeera-Client',
        'Access-Control-Max-Age': '86400',
      },
    };
  }

  const matched = allowedList.some(pattern => isOriginMatch(origin, pattern));
  if (!matched) {
    return {
      allowed: false,
      corsHeaders: {
        Vary: 'Origin',
      },
    };
  }

  return {
    allowed: true,
    corsHeaders: {
      'Access-Control-Allow-Origin': allowsAny ? '*' : origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Tadbeera-Client',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  };
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function getClientIp(request: Request): string {
  const cfIp = (request.headers.get('CF-Connecting-IP') || '').trim();
  if (cfIp) return cfIp;
  const forwarded = (request.headers.get('X-Forwarded-For') || '').split(',')[0]?.trim();
  return forwarded || 'unknown';
}

function normalizeRateLimitClientKey(rawIp: string): string {
  const ip = rawIp.trim().toLowerCase();
  if (!ip || ip === 'unknown' || !ip.includes(':')) {
    return ip || 'unknown';
  }
  if (ip.startsWith('::ffff:') && ip.includes('.')) {
    return ip.slice('::ffff:'.length);
  }
  const [leftRaw, rightRaw] = ip.split('::');
  const left = leftRaw ? leftRaw.split(':').filter(Boolean) : [];
  const right = rightRaw !== undefined ? rightRaw.split(':').filter(Boolean) : [];
  const missing = Math.max(0, 8 - (left.length + right.length));
  const full =
    rightRaw !== undefined
      ? [...left, ...Array<string>(missing).fill('0'), ...right]
      : left;
  if (full.length < 4) return ip;
  const prefix = full
    .slice(0, 4)
    .map(part => part.padStart(4, '0'))
    .join(':');
  return `${prefix}::/64`;
}

async function readBoundedJsonBody(
  request: Request
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; status: number; code: string; message: string }> {
  const contentLengthHeader = request.headers.get('Content-Length');
  let declaredSize: number | null = null;
  if (contentLengthHeader) {
    const parsedSize = Number(contentLengthHeader);
    if (Number.isFinite(parsedSize) && parsedSize >= 0) {
      declaredSize = parsedSize;
      if (declaredSize > MAX_BODY_BYTES) {
        return {
          ok: false,
          status: 413,
          code: 'PAYLOAD_TOO_LARGE',
          message: 'حجم الطلب أكبر من الحد المسموح.',
        };
      }
    }
  }

  if (!request.body) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_JSON',
      message: 'محتوى الطلب فارغ أو غير صالح.',
    };
  }

  let text = '';
  if (declaredSize !== null) {
    try {
      const buf = await request.arrayBuffer();
      if (buf.byteLength > MAX_BODY_BYTES) {
        return {
          ok: false,
          status: 413,
          code: 'PAYLOAD_TOO_LARGE',
          message: 'حجم الطلب أكبر من الحد المسموح.',
        };
      }
      text = TEXT_DECODER.decode(buf);
    } catch {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_JSON',
        message: 'تعذر قراءة بيانات الطلب.',
      };
    }
  } else {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        totalBytes += value.byteLength;
        if (totalBytes > MAX_BODY_BYTES) {
          await reader.cancel().catch(() => undefined);
          return {
            ok: false,
            status: 413,
            code: 'PAYLOAD_TOO_LARGE',
            message: 'حجم الطلب أكبر من الحد المسموح.',
          };
        }
        chunks.push(value);
      }
    } catch {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_JSON',
        message: 'تعذر قراءة بيانات الطلب.',
      };
    }

    if (chunks.length === 1) {
      text = TEXT_DECODER.decode(chunks[0]);
    } else {
      const merged = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }
      text = TEXT_DECODER.decode(merged);
    }
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_JSON',
        message: 'صيغة الطلب غير صالحة.',
      };
    }
    return { ok: true, data: parsed as Record<string, unknown> };
  } catch {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_JSON',
      message: 'بيانات JSON غير صالحة.',
    };
  }
}

function validateUserRecipeQuery(raw: unknown): { ok: true; query: string } | { ok: false; message: string } {
  if (typeof raw !== 'string') {
    return {
      ok: false,
      message: 'اكتبي اسم الأكلة المطلوبة بشكل واضح (من حرفين على الأقل).',
    };
  }

  const cleaned = raw
    .replace(INVISIBLE_FORMAT_CHARS_RE, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length < 2 || cleaned.length > 120) {
    return {
      ok: false,
      message: 'اكتبي اسم الأكلة المطلوبة بشكل واضح (من حرفين على الأقل).',
    };
  }

  if (/[\u0000-\u001F\u007F]/.test(cleaned)) {
    return {
      ok: false,
      message: 'اسم الأكلة يحتوي على رموز غير صالحة.',
    };
  }

  if (SUSPICIOUS_QUERY_PATTERNS.some(pattern => pattern.test(cleaned))) {
    return {
      ok: false,
      message: 'يرجى كتابة اسم الأكلة أو الطبق فقط بدون روابط أو تعليمات برمجية.',
    };
  }

  // Reject queries made solely of Arabic diacritics (tashkeel), tatweel, digits, emojis, or punctuation.
  const withoutDiacriticsOrTatweel = cleaned.replace(ARABIC_DIACRITICS_AND_TATWEEL_RE, '').trim();
  if (!TWO_LETTERS_RE.test(withoutDiacriticsOrTatweel)) {
    return {
      ok: false,
      message: 'اكتبي اسم الأكلة المطلوبة بحروف واضحة (حرفين على الأقل بدون الاكتفاء بالتشكيل أو الرموز).',
    };
  }

  return { ok: true, query: cleaned };
}

function mapGeminiHttpError(
  status: number,
  rawBody: string,
  apiKey: string
): { status: number; code: string; message: string; retryable: boolean } {
  const safeText = redactSecret(rawBody, apiKey);
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(safeText)) {
    return {
      status: 429,
      code: 'RATE_LIMITED',
      message: 'الخدمة عليها ضغط دلوقتي أو تم تجاوز الحد المسموح مؤقتاً. استنى ثواني واضغط إعادة المحاولة.',
      retryable: true,
    };
  }
  if (status === 401 || status === 403 || /API_KEY_INVALID|PERMISSION_DENIED|unauthorized/i.test(safeText)) {
    return {
      status: 502,
      code: 'GEMINI_AUTH_ERROR',
      message: 'تعذر التحقق من صلاحية مفتاح الذكاء الاصطناعي حالياً.',
      retryable: false,
    };
  }
  if (status === 404 || /NOT_FOUND/i.test(safeText)) {
    return {
      status: 502,
      code: 'MODEL_NOT_FOUND',
      message: 'نموذج الوصفات الذكي غير متاح حالياً. حاول مرة أخرى بعد قليل.',
      retryable: false,
    };
  }
  if (status === 400) {
    return {
      status: 400,
      code: 'GEMINI_BAD_REQUEST',
      message: 'تعذر معالجة اسم الأكلة المطلوب. اكتبي اسم الطبق بشكل أوضح.',
      retryable: false,
    };
  }
  return {
    status: 502,
    code: 'GEMINI_UNAVAILABLE',
    message: 'حصلت مشكلة مؤقتة في الاتصال بخدمة الوصفات الذكية. تأكد من الإنترنت واضغط إعادة المحاولة.',
    retryable: true,
  };
}

function stripJsonCodeFences(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function getDefaultWorkerCache(override?: WorkerCacheLike | null): WorkerCacheLike | null {
  if (override !== undefined) return override;
  const cfCaches = (globalThis as { caches?: { default?: WorkerCacheLike } }).caches;
  return cfCaches?.default ?? null;
}

async function lookupVerifiedPhotoViaFetch(
  englishQuery: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<{ imageUrl: string; imageCredit: string } | null> {
  const cleanQuery = englishQuery.trim();
  if (cleanQuery.length < 3) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (typeof (timer as { unref?: () => void }).unref === 'function') {
    (timer as { unref: () => void }).unref();
  }

  try {
    const url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(cleanQuery)}`;
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) return null;

    const data = (await response.json()) as {
      meals?: Array<{ strMeal?: string; strMealThumb?: string }>;
    };
    const meals = Array.isArray(data?.meals) ? data.meals : [];
    const exactMeal = meals.find(
      meal =>
        typeof meal?.strMeal === 'string' &&
        typeof meal?.strMealThumb === 'string' &&
        meal.strMealThumb.startsWith('https://') &&
        doesDishImageStrictlyMatch(cleanQuery, meal.strMeal)
    );
    if (!exactMeal?.strMealThumb) return null;
    return {
      imageUrl: exactMeal.strMealThumb,
      imageCredit: 'TheMealDB',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface SlidingRateWindowEntry {
  windowStart: number;
  currentCount: number;
  previousCount: number;
}

interface RateLimitDecision {
  allowed: boolean;
  retryAfterSec: number;
  remaining: number;
  resetEpochSec: number;
  nextEntry: SlidingRateWindowEntry;
}

function evaluateSlidingWindow(
  entry: SlidingRateWindowEntry | undefined,
  now: number,
  maxPerMinute: number
): RateLimitDecision {
  const currentWindowStart = Math.floor(now / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
  const elapsedInWindow = Math.max(0, now - currentWindowStart);
  const prevWeight = Math.max(0, 1 - elapsedInWindow / RATE_LIMIT_WINDOW_MS);

  let previousCount = 0;
  let currentCount = 0;

  if (entry) {
    if (entry.windowStart === currentWindowStart) {
      previousCount = entry.previousCount;
      currentCount = entry.currentCount;
    } else if (entry.windowStart === currentWindowStart - RATE_LIMIT_WINDOW_MS) {
      previousCount = entry.currentCount;
      currentCount = 0;
    }
  }

  const effectiveCount = previousCount * prevWeight + currentCount;
  const resetEpochSec = Math.ceil((currentWindowStart + RATE_LIMIT_WINDOW_MS) / 1000);

  if (effectiveCount >= maxPerMinute) {
    let retryAfterSec = Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - elapsedInWindow) / 1000));
    if (previousCount > 0 && currentCount < maxPerMinute) {
      const neededWeight = (maxPerMinute - currentCount) / previousCount;
      const targetElapsed = Math.ceil((1 - neededWeight) * RATE_LIMIT_WINDOW_MS);
      const waitMs = Math.max(1000, targetElapsed - elapsedInWindow + 1);
      retryAfterSec = Math.max(1, Math.ceil(waitMs / 1000));
    }
    return {
      allowed: false,
      retryAfterSec,
      remaining: 0,
      resetEpochSec,
      nextEntry: {
        windowStart: currentWindowStart,
        currentCount,
        previousCount,
      },
    };
  }

  const nextEntry: SlidingRateWindowEntry = {
    windowStart: currentWindowStart,
    currentCount: currentCount + 1,
    previousCount,
  };
  const newEffective = previousCount * prevWeight + nextEntry.currentCount;
  const remaining = Math.max(0, Math.floor(maxPerMinute - newEffective));

  return {
    allowed: true,
    retryAfterSec: 0,
    remaining,
    resetEpochSec,
    nextEntry,
  };
}

type RecipeGenerationOutcome =
  | { ok: true; responseBody: string }
  | { ok: false; status: number; code: string; message: string; retryable: boolean };

interface UpstreamGenerationParams {
  query: string;
  apiKey: string;
  fetchImpl: typeof fetch;
  geminiTimeoutMs: number;
  photoLookupTimeoutMs: number;
  retryDelayMs: number;
  cache: WorkerCacheLike | null;
  cacheUrl: string;
  normalizedCacheKey: string;
  cacheTtl: number;
  ctx?: WorkerExecutionContext;
}

async function callGeminiOnce(
  geminiEndpoint: string,
  geminiPayload: string,
  apiKey: string,
  fetchImpl: typeof fetch,
  geminiTimeoutMs: number
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), geminiTimeoutMs);
  if (typeof (timer as { unref?: () => void }).unref === 'function') {
    (timer as { unref: () => void }).unref();
  }

  try {
    const upstreamResponse = await fetchImpl(geminiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
        'User-Agent': 'tadbeera-cloudflare-worker',
      },
      body: geminiPayload,
      signal: controller.signal,
    });

    if (!upstreamResponse.ok) {
      const errBody = await upstreamResponse.text().catch(() => '');
      const mapped = mapGeminiHttpError(upstreamResponse.status, errBody, apiKey);
      throw Object.assign(new Error(mapped.message), mapped);
    }

    const envelope = (await upstreamResponse.json()) as {
      promptFeedback?: { blockReason?: string };
      candidates?: Array<{
        finishReason?: string;
        content?: {
          parts?: Array<{ text?: string; thought?: boolean }>;
        };
      }>;
    };

    const blockReason = envelope?.promptFeedback?.blockReason;
    const candidate = envelope?.candidates?.[0];
    const finishReason = candidate?.finishReason;

    if (
      blockReason ||
      finishReason === 'SAFETY' ||
      finishReason === 'RECITATION' ||
      finishReason === 'PROHIBITED_CONTENT' ||
      finishReason === 'BLOCKLIST'
    ) {
      throw Object.assign(
        new Error('تعذر توليد وصفة لهذا الطلب. اكتبي اسم أكلة أو طبق واضح.'),
        {
          status: 422,
          code: 'UNRECOGNIZED_FOOD',
          retryable: false,
        }
      );
    }

    const parts = candidate?.content?.parts;
    let rawJoined = '';
    if (Array.isArray(parts)) {
      if (parts.length === 1 && !parts[0]?.thought && typeof parts[0]?.text === 'string') {
        rawJoined = parts[0].text;
      } else {
        for (const part of parts) {
          if (!part?.thought && typeof part?.text === 'string') {
            rawJoined += part.text;
          }
        }
      }
    }

    const rawText = stripJsonCodeFences(rawJoined);
    if (!rawText) {
      throw Object.assign(new Error('Empty JSON response from Gemini'), {
        status: 502,
        code: 'GEMINI_UNAVAILABLE',
        retryable: finishReason !== 'MAX_TOKENS',
      });
    }

    try {
      return JSON.parse(rawText);
    } catch {
      throw Object.assign(
        new Error('استجابة خدمة الوصفات لم تكتمل بشكل صالح. حاول مرة أخرى.'),
        {
          status: 502,
          code: 'GEMINI_INVALID_JSON',
          retryable: finishReason !== 'MAX_TOKENS',
        }
      );
    }
  } catch (err) {
    const errObj = err as { name?: string; status?: number; code?: string; message?: string; retryable?: boolean };
    if (errObj?.name === 'AbortError') {
      throw Object.assign(new Error('الاتصال بخدمة الوصفات أخد وقت أطول من المعتاد. اضغط إعادة المحاولة.'), {
        status: 504,
        code: 'TIMEOUT',
        retryable: true,
      });
    }
    if (typeof errObj?.status === 'number' && typeof errObj?.code === 'string') {
      throw err;
    }
    throw Object.assign(
      new Error('حصلت مشكلة مؤقتة في الاتصال بخدمة الوصفات الذكية. تأكد من الإنترنت واضغط إعادة المحاولة.'),
      {
        status: 502,
        code: 'GEMINI_UNAVAILABLE',
        retryable: true,
      }
    );
  } finally {
    clearTimeout(timer);
  }
}

async function runUpstreamRecipeGeneration(params: UpstreamGenerationParams): Promise<RecipeGenerationOutcome> {
  const {
    query,
    apiKey,
    fetchImpl,
    geminiTimeoutMs,
    photoLookupTimeoutMs,
    retryDelayMs,
    cache,
    cacheUrl,
    normalizedCacheKey,
    cacheTtl,
    ctx,
  } = params;

  const geminiPayload = buildGeminiRequestBody(query);
  let rawRecipe: unknown;

  try {
    try {
      rawRecipe = await callGeminiOnce(GEMINI_ENDPOINT, geminiPayload, apiKey, fetchImpl, geminiTimeoutMs);
    } catch (firstErr) {
      const mapped = firstErr as { status?: number; retryable?: boolean };
      if (!mapped.retryable || mapped.status === 429 || mapped.status === 504) {
        throw firstErr;
      }
      if (retryDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
      rawRecipe = await callGeminiOnce(GEMINI_ENDPOINT, geminiPayload, apiKey, fetchImpl, geminiTimeoutMs);
    }
  } catch (err) {
    const mapped = err as { status?: number; code?: string; message?: string; retryable?: boolean };
    return {
      ok: false,
      status: mapped.status || 502,
      code: mapped.code || 'GEMINI_UNAVAILABLE',
      message: redactSecret(
        mapped.message || 'حصلت مشكلة مؤقتة في الاتصال بخدمة الوصفات الذكية.',
        apiKey
      ),
      retryable: mapped.retryable ?? true,
    };
  }

  const validation = validateAndNormalizeGeminiRecipe(rawRecipe);
  if (validation.ok === false) {
    const status = validation.reason === 'unrecognized_food' ? 422 : 502;
    return {
      ok: false,
      status,
      code: validation.reason.toUpperCase(),
      message: validation.message,
      retryable: validation.reason === 'invalid_schema',
    };
  }

  const recipe: ValidatedAiRecipe = { ...validation.data };
  const verifiedPhoto = await lookupVerifiedPhotoViaFetch(
    recipe.englishSearchQuery,
    fetchImpl,
    photoLookupTimeoutMs
  );
  if (verifiedPhoto) {
    recipe.imageUrl = verifiedPhoto.imageUrl;
    recipe.imageCredit = verifiedPhoto.imageCredit;
  }

  const responseBody = JSON.stringify({ recipe });

  if (cache && normalizedCacheKey) {
    const cacheableResponse = new Response(responseBody, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': `public, max-age=${cacheTtl}`,
      },
    });
    const putPromise = cache.put(cacheUrl, cacheableResponse).catch(() => undefined);
    if (ctx?.waitUntil) {
      ctx.waitUntil(putPromise);
    } else {
      await putPromise;
    }
  }

  return { ok: true, responseBody };
}

/**
 * Creates the Cloudflare Worker handler.
 *
 * Free-tier Rate Limiting design (zero KV, D1, Durable Objects, or paid WAF):
 * - Sliding Window Counter (60s) eliminates 2x boundary bursts from fixed windows.
 * - L1 in-memory LRU Map (max 2,000 keys) gives sub-millisecond hot-path checks per isolate.
 * - L2 Cloudflare Edge Cache (`caches.default`, 120s TTL) restores recent per-IP counters after
 *   isolate cold restarts within the same edge data center (PoP).
 * - IPv6 `/64` prefix normalization blocks host-bit rotation bypasses.
 *
 * Inherent free-tier limitations:
 * 1. Per-PoP / Per-Isolate scope (not globally synchronized across all Cloudflare edge PoPs).
 * 2. Non-atomic L2 writes (`caches.default` lacks compare-and-swap under parallel cold-start bursts).
 * 3. On `*.workers.dev`, `caches.default` is a no-op and falls back gracefully to L1 isolate memory;
 *    L2 activates automatically on a proxied custom domain.
 * 4. Users sharing carrier IPv4 CGNAT or an IPv6 `/64` subnet share one rate bucket.
 */
export function createRecipeWorker(deps: RecipeWorkerDeps = {}) {
  const rateWindows = new Map<string, SlidingRateWindowEntry>();
  const inFlightRecipes = new Map<string, Promise<RecipeGenerationOutcome>>();

  const pruneRateWindowsIfFull = (now: number) => {
    if (rateWindows.size < MAX_RATE_LIMIT_ENTRIES) return;
    const expiryCutoff = Math.floor(now / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS - RATE_LIMIT_WINDOW_MS;
    for (const [key, entry] of rateWindows) {
      if (entry.windowStart < expiryCutoff) {
        rateWindows.delete(key);
      }
    }
    if (rateWindows.size >= MAX_RATE_LIMIT_ENTRIES) {
      const oldestKey = rateWindows.keys().next().value;
      if (oldestKey) rateWindows.delete(oldestKey);
    }
  };

  const checkRateLimit = async (
    rawIp: string,
    now: number,
    maxPerMinute: number,
    cache: WorkerCacheLike | null,
    ctx?: WorkerExecutionContext
  ): Promise<RateLimitDecision> => {
    const rateKey = normalizeRateLimitClientKey(rawIp);
    let entry = rateWindows.get(rateKey);
    const rateCacheUrl = cache
      ? `https://ratelimit.tadbeera.internal/v1/ip?k=${encodeURIComponent(rateKey)}`
      : '';

    // L2 hydration only on L1 miss (e.g., isolate cold start within same PoP)
    if (!entry && cache && rateCacheUrl) {
      try {
        const cached = await cache.match(rateCacheUrl);
        if (cached) {
          const parsed = (await cached.json()) as Partial<SlidingRateWindowEntry>;
          if (
            typeof parsed?.windowStart === 'number' &&
            typeof parsed?.currentCount === 'number' &&
            typeof parsed?.previousCount === 'number'
          ) {
            entry = {
              windowStart: parsed.windowStart,
              currentCount: parsed.currentCount,
              previousCount: parsed.previousCount,
            };
          }
        }
      } catch {
        /* Edge cache rate-limit read failures are non-fatal */
      }
    }

    const decision = evaluateSlidingWindow(entry, now, maxPerMinute);

    pruneRateWindowsIfFull(now);
    // Delete then set to maintain LRU eviction order in the Map
    rateWindows.delete(rateKey);
    rateWindows.set(rateKey, decision.nextEntry);

    if (cache && rateCacheUrl && decision.allowed) {
      const putPromise = cache
        .put(
          rateCacheUrl,
          new Response(JSON.stringify(decision.nextEntry), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': `public, max-age=${RATE_LIMIT_CACHE_TTL_SECONDS}`,
            },
          })
        )
        .catch(() => undefined);
      if (ctx?.waitUntil) {
        ctx.waitUntil(putPromise);
      } else {
        await putPromise;
      }
    }

    return decision;
  };

  return {
    async fetch(
      request: Request,
      env: WorkerEnv = {},
      ctx?: WorkerExecutionContext
    ): Promise<Response> {
      const fetchImpl = deps.fetchFn || fetch;
      const nowFn = deps.nowFn || Date.now;
      const retryDelayMs = deps.retryDelayMs ?? 600;
      const geminiTimeoutMs = deps.geminiTimeoutMs ?? GEMINI_TIMEOUT_MS;
      const photoLookupTimeoutMs = deps.photoLookupTimeoutMs ?? PHOTO_LOOKUP_TIMEOUT_MS;

      const pathname = extractPathname(request.url);
      const { allowed: originAllowed, corsHeaders } = evaluateCorsAndOrigin(request, env);

      if (request.method === 'OPTIONS' && pathname.startsWith('/api/')) {
        return new Response(null, {
          status: originAllowed ? 204 : 403,
          headers: {
            ...corsHeaders,
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }

      if (request.method === 'GET' && pathname === '/api/health') {
        return jsonResponse({ ok: true }, 200, {
          ...corsHeaders,
          'Cache-Control': 'no-store',
        });
      }

      if (pathname !== '/api/recipes/generate') {
        return jsonResponse(
          { error: 'المسار غير موجود.', code: 'NOT_FOUND', retryable: false },
          404,
          { ...corsHeaders, 'Cache-Control': 'no-store' }
        );
      }

      if (request.method !== 'POST') {
        return jsonResponse(
          { error: 'طريقة الطلب غير مدعومة.', code: 'METHOD_NOT_ALLOWED', retryable: false },
          405,
          { ...corsHeaders, Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' }
        );
      }

      if (!originAllowed) {
        return jsonResponse(
          { error: 'مصدر الطلب غير مصرح به.', code: 'FORBIDDEN_ORIGIN', retryable: false },
          403,
          { ...corsHeaders, 'Cache-Control': 'no-store' }
        );
      }

      const expectedClientToken = (env.RECIPE_CLIENT_TOKEN || '').trim();
      if (expectedClientToken) {
        const providedToken = (request.headers.get('X-Tadbeera-Client') || '').trim();
        if (!providedToken || !constantTimeEquals(providedToken, expectedClientToken)) {
          return jsonResponse(
            { error: 'تعذر التحقق من هوية التطبيق.', code: 'UNAUTHORIZED_CLIENT', retryable: false },
            401,
            { ...corsHeaders, 'Cache-Control': 'no-store' }
          );
        }
      }

      const contentType = (request.headers.get('Content-Type') || '').toLowerCase();
      if (!contentType.includes('application/json')) {
        return jsonResponse(
          { error: 'يجب إرسال الطلب بصيغة application/json.', code: 'UNSUPPORTED_MEDIA_TYPE', retryable: false },
          415,
          { ...corsHeaders, 'Cache-Control': 'no-store' }
        );
      }

      const cache = getDefaultWorkerCache(deps.cache);
      const parsedRate = Number(env.RATE_LIMIT_MAX_PER_MIN || DEFAULT_RATE_LIMIT_MAX);
      const maxPerMinute = Number.isFinite(parsedRate) && parsedRate > 0 ? Math.floor(parsedRate) : DEFAULT_RATE_LIMIT_MAX;
      const clientIp = getClientIp(request);
      const rateDecision = await checkRateLimit(clientIp, nowFn(), maxPerMinute, cache, ctx);
      const rateLimitHeaders: Record<string, string> = {
        'X-RateLimit-Limit': String(maxPerMinute),
        'X-RateLimit-Remaining': String(rateDecision.remaining),
        'X-RateLimit-Reset': String(rateDecision.resetEpochSec),
      };

      if (!rateDecision.allowed) {
        return jsonResponse(
          {
            error: 'تم تجاوز عدد طلبات الوصفات المسموح مؤقتاً. حاول بعد دقيقة.',
            code: 'RATE_LIMITED',
            retryable: true,
          },
          429,
          {
            ...corsHeaders,
            ...rateLimitHeaders,
            'Retry-After': String(rateDecision.retryAfterSec),
            'Cache-Control': 'no-store',
          }
        );
      }

      const bodyResult = await readBoundedJsonBody(request);
      if (bodyResult.ok === false) {
        return jsonResponse(
          { error: bodyResult.message, code: bodyResult.code, retryable: false },
          bodyResult.status,
          { ...corsHeaders, ...rateLimitHeaders, 'Cache-Control': 'no-store' }
        );
      }

      const queryValidation = validateUserRecipeQuery(bodyResult.data.query);
      if (queryValidation.ok === false) {
        return jsonResponse(
          { error: queryValidation.message, code: 'INVALID_QUERY', retryable: false },
          400,
          { ...corsHeaders, ...rateLimitHeaders, 'Cache-Control': 'no-store' }
        );
      }
      const query = queryValidation.query;

      // Edge Cache lookup before consuming Gemini API quota
      const normalizedCacheKey = normalizeArabicCacheKey(query);
      const cacheUrl = `https://cache.tadbeera.internal/v1/recipe?q=${encodeURIComponent(normalizedCacheKey)}`;
      if (cache && normalizedCacheKey) {
        try {
          const cached = await cache.match(cacheUrl);
          if (cached) {
            const cachedPayload = await cached.text();
            return new Response(cachedPayload, {
              status: 200,
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'X-Content-Type-Options': 'nosniff',
                'X-Recipe-Cache': 'HIT',
                ...corsHeaders,
                ...rateLimitHeaders,
              },
            });
          }
        } catch {
          /* Edge cache read failures are non-fatal */
        }
      }

      const apiKey = (env.GEMINI_API_KEY || '').trim();
      if (!apiKey) {
        return jsonResponse(
          {
            error: 'خدمة الوصفات الذكية مش متفعلة حالياً لعدم توفر مفتاح Gemini. تأكد من إعداد المفتاح.',
            code: 'MISSING_API_KEY',
            retryable: false,
          },
          503,
          { ...corsHeaders, ...rateLimitHeaders, 'Cache-Control': 'no-store' }
        );
      }

      const cacheTtlRaw = Number(env.RECIPE_CACHE_TTL_SECONDS || DEFAULT_CACHE_TTL_SECONDS);
      const cacheTtl = Number.isFinite(cacheTtlRaw) && cacheTtlRaw > 0 ? Math.floor(cacheTtlRaw) : DEFAULT_CACHE_TTL_SECONDS;
      const generationParams: UpstreamGenerationParams = {
        query,
        apiKey,
        fetchImpl,
        geminiTimeoutMs,
        photoLookupTimeoutMs,
        retryDelayMs,
        cache,
        cacheUrl,
        normalizedCacheKey,
        cacheTtl,
        ctx,
      };

      // Single-flight deduplication within the isolate: prevents concurrent/double-tap requests
      // for the same uncached dish from triggering duplicate Gemini API calls.
      let outcome: RecipeGenerationOutcome;
      if (normalizedCacheKey) {
        const existingInFlight = inFlightRecipes.size > 0 ? inFlightRecipes.get(normalizedCacheKey) : undefined;
        if (existingInFlight) {
          outcome = await existingInFlight;
        } else {
          const generationPromise = runUpstreamRecipeGeneration(generationParams).finally(() => {
            inFlightRecipes.delete(normalizedCacheKey);
          });
          inFlightRecipes.set(normalizedCacheKey, generationPromise);
          outcome = await generationPromise;
        }
      } else {
        outcome = await runUpstreamRecipeGeneration(generationParams);
      }

      if (outcome.ok === false) {
        return jsonResponse(
          {
            error: outcome.message,
            code: outcome.code,
            retryable: outcome.retryable,
          },
          outcome.status,
          { ...corsHeaders, ...rateLimitHeaders, 'Cache-Control': 'no-store' }
        );
      }

      return new Response(outcome.responseBody, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
          'X-Recipe-Cache': 'MISS',
          ...corsHeaders,
          ...rateLimitHeaders,
        },
      });
    },
  };
}

export default createRecipeWorker();
