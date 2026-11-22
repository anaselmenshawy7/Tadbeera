import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor, registerPlugin } from '@capacitor/core';
import {
  AlertCircle,
  ArrowRight,
  Clock,
  Mic,
  MicOff,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { EgyptianRecipeSpeechPlayer, buildEgyptianRecipeSpeechSegments } from './recipeSpeech';
import {
  buildRecipeExtractText,
  formatCuisineLabel,
  formatStructuredIngredientLine,
  validateAndNormalizeGeminiRecipe,
  type StructuredIngredient,
  type ValidatedAiRecipe,
} from './recipeSchema';
import {
  BASE_RECIPE_SERVINGS,
  MAX_RECIPE_SERVINGS,
  MIN_RECIPE_SERVINGS,
  clampRecipeServings,
  scaleArabicIngredientLine,
  scaleStructuredIngredient,
} from './recipeScaling';
import {
  extractMeaningfulArabicQueryTokens,
  normalizeArabicSearchTerm,
  scoreRecipeDishRelevance,
} from './arabicSearch';
import {
  GeminiRecipeSdkError,
  generateRecipeWithGeminiSdk,
  searchOfflineLocalRecipes,
  type GeminiSdkDeps,
} from './recipeGeminiClient';
import { RecipeCookingClayArt } from '../../components/RecipeCookingClayArt';
import { Kitchen3DIcon } from '../../components/Tadbeera3DIcons';

interface RecipeVoicePlugin {
  request(): Promise<{ granted: boolean }>;
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  speak(options: { text: string }): Promise<void>;
  stopSpeaking(): Promise<void>;
  addListener(
    eventName: 'speechResult',
    listener: (event: { transcript?: string }) => void
  ): Promise<{ remove(): Promise<void> }>;
  addListener(
    eventName: 'speechError',
    listener: (event: { error?: string }) => void
  ): Promise<{ remove(): Promise<void> }>;
  addListener(
    eventName: 'speechPlaybackStatus',
    listener: (event: { status?: string }) => void
  ): Promise<{ remove(): Promise<void> }>;
}
const recipeVoice = registerPlugin<RecipeVoicePlugin>('MicrophonePermission');

export type CuisineTier = 'egyptian' | 'arab' | 'international';

export type OnlineRecipe = {
  title: string;
  dishName?: string;
  servings: number;
  baseServings?: number;
  pageId: number;
  url: string;
  extract: string;
  baseExtract?: string;
  cuisine?: CuisineTier;
  cuisineName?: string;
  originCountryCode?: string;
  countryFlag?: string;
  cuisineLabel?: string;
  prepTime?: string;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  ingredients?: StructuredIngredient[];
  baseIngredients?: StructuredIngredient[];
  steps?: string[];
  tips?: string[];
  isAiGenerated?: boolean;
  isOfflineFallback?: boolean;
  imageUrl?: string;
  imageLicense?: string;
  imageCredit?: string;
};

export interface RecipeSearchErrorState {
  message: string;
  code: string;
  retryable: boolean;
  query: string;
}

export class RecipeApiError extends Error {
  code: string;
  retryable: boolean;
  status: number;

  constructor(message: string, options: { code?: string; retryable?: boolean; status?: number } = {}) {
    super(message);
    this.name = 'RecipeApiError';
    this.code = options.code || 'API_ERROR';
    this.retryable = options.retryable ?? true;
    this.status = options.status ?? 500;
  }
}

export const SAVED_KEY = 'tadbeera_online_recipes_v1';
export const GENERATED_CACHE_KEY = 'tadbeera_generated_recipes_cache_v1';
export const GENERATED_CACHE_MAX_ITEMS = 100;
const API_REQUEST_TIMEOUT_MS = 28_000;

export interface CachedGeneratedRecipeEntry {
  key: string;
  queries: string[];
  normalizedTitle: string;
  recipe: OnlineRecipe;
  updatedAt: number;
}

export type StorageLike = Pick<Storage, 'getItem'> & Partial<Pick<Storage, 'setItem'>>;

export const QUICK_SEARCH_SUGGESTIONS = [
  'كشري مصري',
  'مطازيز سعودية',
  'مسحب',
  'ملوخية مصرية',
  'كبسة دجاج',
  'كبيبة شامية',
  'ديك رومي',
  'مكرونة بشاميل',
] as const;

export const CUISINE_BADGE_META: Record<CuisineTier, { label: string; className: string }> = {
  egyptian: {
    label: '🇪🇬 مصري',
    className: 'bg-[#FADDE4] text-[#C96D84] border border-[#F3DCE2]',
  },
  arab: {
    label: '🌍 عربي',
    className: 'bg-[#FFF8FA] text-[#4A353B] border border-[#E8A8B7]',
  },
  international: {
    label: '🌐 عالمي',
    className: 'bg-[#FFFFFF] text-[#8E757C] border border-[#F3DCE2]',
  },
};

const ARAB_AREAS = new Set([
  'moroccan',
  'tunisian',
  'algerian',
  'lebanese',
  'syrian',
  'palestinian',
  'jordanian',
  'iraqi',
  'saudi',
  'saudi arabian',
  'emirati',
  'kuwaiti',
  'qatari',
  'bahraini',
  'omani',
  'yemeni',
  'libyan',
  'sudanese',
  'middle eastern',
  'arabian',
  'turkish',
]);

function simpleNormalizeArabic(value: string): string {
  return value
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim();
}

export function detectMealDbCuisineTier(strArea?: string, title = ''): CuisineTier {
  const area = (strArea || '').trim().toLowerCase();
  const normalizedTitle = simpleNormalizeArabic(title);

  if (area === 'egyptian') return 'egyptian';
  if (
    /مصري|اسكندراني|صعيدي|فلاحي|بورسعيدي|كشري|ملوخيه|طعميه|فول مدمس|حواوشي|فطير مشلتت|بصاره|بسبوسه|كنافه|ام علي|رقاق/.test(
      normalizedTitle
    ) ||
    /\begyptian\b|\bkoshari\b|\bmolokhia\b|\bhawawshi\b|\bfeteer\b|\btaameya\b|\bful medames\b/.test(
      normalizedTitle
    )
  ) {
    return 'egyptian';
  }

  if (ARAB_AREAS.has(area)) return 'arab';
  if (
    /عربي|خليجي|شامي|سوري|لبناني|مغربي|تونسي|سعودي|يمني|عراقي|فلسطيني|اردني|كبسه|مقلوبه|شاورما|شرموله|طاجن/.test(
      normalizedTitle
    ) ||
    /\bmoroccan\b|\blebanese\b|\bsyrian\b|\bsaudi\b|\btunisian\b|\bturkish\b|\bkabsa\b|\bshawarma\b|\bmaqluba\b|\btagine\b/.test(
      normalizedTitle
    )
  ) {
    return 'arab';
  }

  return 'international';
}

export function scaleMeasure(measure: string, familySize: number, baseServings = 4): string {
  const match = measure.match(/^\s*(\d+\/\d+|\d+(?:\.\d+)?(?:\s+\d+\/\d+)?)(.*)$/);
  if (!match) return measure;
  const amount = match[1]
    .trim()
    .split(/\s+/)
    .reduce((total, part) => {
      if (!part.includes('/')) return total + Number(part);
      const [numerator, denominator] = part.split('/').map(Number);
      return total + (denominator ? numerator / denominator : 0);
    }, 0);
  if (!Number.isFinite(amount) || amount <= 0) return measure;
  return (
    (
      Math.round(
        (amount * Math.max(MIN_RECIPE_SERVINGS, Math.min(MAX_RECIPE_SERVINGS, Math.round(familySize))) / baseServings) *
          100
      ) / 100
    ).toString() +
    ' ' +
    match[2].trim()
  );
}

function stableRecipeId(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) + 100000;
}

export function aiRecipeToOnlineRecipe(aiRecipe: ValidatedAiRecipe): OnlineRecipe {
  const cuisineLabel = formatCuisineLabel(aiRecipe.cuisineName, aiRecipe.countryFlag);
  return {
    title: aiRecipe.dishName,
    dishName: aiRecipe.dishName,
    servings: aiRecipe.servings,
    baseServings: aiRecipe.servings,
    pageId: stableRecipeId(`${aiRecipe.dishName}::${aiRecipe.cuisineName}`),
    url: '',
    extract: aiRecipe.extract,
    baseExtract: aiRecipe.extract,
    cuisineName: aiRecipe.cuisineName,
    originCountryCode: aiRecipe.originCountryCode,
    countryFlag: aiRecipe.countryFlag,
    cuisineLabel,
    prepTime: `${aiRecipe.totalTimeMinutes} دقيقة`,
    prepTimeMinutes: aiRecipe.prepTimeMinutes,
    cookTimeMinutes: aiRecipe.cookTimeMinutes,
    totalTimeMinutes: aiRecipe.totalTimeMinutes,
    ingredients: aiRecipe.ingredients,
    baseIngredients: aiRecipe.ingredients,
    steps: aiRecipe.steps,
    tips: aiRecipe.tips,
    isAiGenerated: true,
    imageUrl: aiRecipe.imageUrl,
    imageCredit: aiRecipe.imageCredit,
  };
}

export function readSavedRecipes(
  storage: StorageLike | null = typeof localStorage !== 'undefined' ? localStorage : null
): OnlineRecipe[] {
  if (!storage) return [];
  try {
    const value = JSON.parse(storage.getItem(SAVED_KEY) || '[]');
    return Array.isArray(value)
      ? value.filter(item => item && typeof item.title === 'string' && typeof item.pageId === 'number')
      : [];
  } catch {
    return [];
  }
}

export function readGeneratedRecipesCache(
  storage: StorageLike | null = typeof localStorage !== 'undefined' ? localStorage : null
): CachedGeneratedRecipeEntry[] {
  if (!storage) return [];
  try {
    const raw = JSON.parse(storage.getItem(GENERATED_CACHE_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (entry): entry is CachedGeneratedRecipeEntry =>
        Boolean(
          entry &&
            typeof entry.key === 'string' &&
            Array.isArray(entry.queries) &&
            entry.recipe &&
            typeof entry.recipe.title === 'string'
        )
    );
  } catch {
    return [];
  }
}

export function saveGeneratedRecipeToLruCache(
  rawQuery: string,
  recipe: OnlineRecipe,
  storage: StorageLike | null = typeof localStorage !== 'undefined' ? localStorage : null,
  maxItems = GENERATED_CACHE_MAX_ITEMS
): CachedGeneratedRecipeEntry[] {
  const normQuery = normalizeArabicSearchTerm(rawQuery);
  const strippedQuery = extractMeaningfulArabicQueryTokens(rawQuery).join(' ');
  const normalizedTitle = normalizeArabicSearchTerm(recipe.dishName || recipe.title);
  const key = normQuery || normalizedTitle || strippedQuery;
  if (!key) return [];

  const current = readGeneratedRecipesCache(storage);
  const querySet = new Set<string>([normQuery, strippedQuery, normalizedTitle].filter(Boolean));

  const existingIndex = current.findIndex(
    entry =>
      entry.key === key ||
      entry.normalizedTitle === normalizedTitle ||
      entry.recipe.pageId === recipe.pageId
  );

  if (existingIndex >= 0) {
    for (const q of current[existingIndex].queries) {
      if (q) querySet.add(q);
    }
  }

  const updatedEntry: CachedGeneratedRecipeEntry = {
    key,
    queries: Array.from(querySet),
    normalizedTitle,
    recipe,
    updatedAt: Date.now(),
  };

  const remaining = current.filter((_, idx) => idx !== existingIndex);
  const nextCache = [updatedEntry, ...remaining].slice(0, Math.max(1, maxItems));

  if (storage && typeof storage.setItem === 'function') {
    try {
      storage.setItem(GENERATED_CACHE_KEY, JSON.stringify(nextCache));
    } catch {
      /* ignore quota errors */
    }
  }

  return nextCache;
}

/**
 * Tier 1 Lookup: Searches Saved Recipes first, then Generated Recipes LRU Cache
 * using smart Arabic normalization (ignoring hamzas, diacritics, ى/ي, ة/ه, extra spaces).
 * Promotes LRU entry on cache hit.
 */
export function searchTier1SavedAndCachedRecipes(
  rawQuery: string,
  options: {
    savedRecipes?: OnlineRecipe[];
    storage?: StorageLike | null;
  } = {}
): { recipes: OnlineRecipe[]; source: 'saved' | 'lru_cache' } | null {
  const normQuery = normalizeArabicSearchTerm(rawQuery);
  if (!normQuery) return null;
  const strippedQuery = extractMeaningfulArabicQueryTokens(rawQuery).join(' ');
  const storage = options.storage !== undefined ? options.storage : typeof localStorage !== 'undefined' ? localStorage : null;

  // 1a. Saved Recipes
  const savedList = options.savedRecipes ?? readSavedRecipes(storage);
  const matchedSaved = savedList
    .map(recipe => {
      const displayTitle = recipe.dishName || recipe.title;
      const normTitle = normalizeArabicSearchTerm(displayTitle);
      const exactHit = normTitle === normQuery || (strippedQuery && normTitle === strippedQuery);
      const score = exactHit ? 100 : scoreRecipeDishRelevance(rawQuery, displayTitle);
      return { recipe, score };
    })
    .filter(entry => entry.score >= 75)
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.recipe);

  if (matchedSaved.length > 0) {
    return { recipes: matchedSaved, source: 'saved' };
  }

  // 1b. Generated Recipes Cache (with LRU promotion on hit)
  const cacheEntries = readGeneratedRecipesCache(storage);
  let bestIndex = -1;
  let bestScore = 0;

  for (let idx = 0; idx < cacheEntries.length; idx += 1) {
    const entry = cacheEntries[idx];
    const directHit =
      entry.key === normQuery ||
      (strippedQuery && entry.key === strippedQuery) ||
      entry.normalizedTitle === normQuery ||
      (strippedQuery && entry.normalizedTitle === strippedQuery) ||
      entry.queries.includes(normQuery) ||
      (strippedQuery ? entry.queries.includes(strippedQuery) : false);

    const score = directHit
      ? 100
      : scoreRecipeDishRelevance(rawQuery, entry.recipe.dishName || entry.recipe.title, entry.queries);

    if (score >= 80 && score > bestScore) {
      bestScore = score;
      bestIndex = idx;
      if (score === 100) break;
    }
  }

  if (bestIndex >= 0) {
    const hitEntry = cacheEntries[bestIndex];
    saveGeneratedRecipeToLruCache(rawQuery, hitEntry.recipe, storage);
    return { recipes: [hitEntry.recipe], source: 'lru_cache' };
  }

  return null;
}

function normalizeRecipeLineBreaks(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/\\r\\n|\\n|\\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trim();
}

function stripRecipeListPrefix(value: string): string {
  let cleaned = value.trim();
  for (let pass = 0; pass < 3; pass += 1) {
    const next = cleaned
      .replace(/^\s*[٠-٩\d]+\s*[.)、:-]\s*/, '')
      .replace(/^\s*[•*▪◦-]\s*/, '')
      .trim();
    if (next === cleaned) break;
    cleaned = next;
  }
  return cleaned;
}

function parseLegacyExtractSections(extract: string): { ingredients: string[]; steps: string[]; tips: string[] } {
  const normalized = normalizeRecipeLineBreaks(extract);
  const tipsSeparator = normalized.match(/نصائح(?:\s+لنجاح الوصفة)?\s*[:：]?/);
  const tipsIndex = tipsSeparator?.index ?? -1;
  const beforeTips = tipsIndex >= 0 ? normalized.slice(0, tipsIndex) : normalized;
  const tipsBlock = tipsIndex >= 0 ? normalized.slice(tipsIndex + tipsSeparator![0].length) : '';

  const separator = beforeTips.match(/(?:طريقة التحضير|الطريقة)(?:\s+خطوة بخطوة)?\s*[:：]?/);
  const splitIndex = separator?.index ?? -1;
  const ingredientsText = splitIndex >= 0 ? beforeTips.slice(0, splitIndex) : '';
  const methodText = splitIndex >= 0 ? beforeTips.slice(splitIndex + separator![0].length) : beforeTips;

  const ingredients = ingredientsText
    .replace(/^\s*المقادير محسوبة[^\n]*\n?/gm, '')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/^\s*المكونات(?:\s+المطلوبة)?(?:\s*\([^)]*\))?\s*[:：]?/, '')
    .split(/[\n،,؛]+/)
    .map(item => stripRecipeListPrefix(item))
    .filter(item => item.length > 1);

  const steps = methodText
    .replace(/^\s*#{1,6}\s*/gm, '')
    .split(/\n+|(?<=[.!؟])\s+/)
    .map(step => stripRecipeListPrefix(step))
    .filter(step => step.length > 2);

  const tips = tipsBlock
    .split(/\n+/)
    .map(tip => stripRecipeListPrefix(tip))
    .filter(tip => tip.length > 2);

  return { ingredients, steps, tips };
}

export function getRecipeDisplaySections(
  recipe: OnlineRecipe,
  targetServings?: number
): {
  ingredients: string[];
  steps: string[];
  tips: string[];
} {
  const baseServings = recipe.baseServings || recipe.servings || BASE_RECIPE_SERVINGS;
  const effectiveServings =
    typeof targetServings === 'number' && Number.isFinite(targetServings)
      ? clampRecipeServings(targetServings)
      : recipe.servings || BASE_RECIPE_SERVINGS;

  const sourceIngredients =
    Array.isArray(recipe.baseIngredients) && recipe.baseIngredients.length > 0
      ? recipe.baseIngredients
      : recipe.ingredients;

  if (
    Array.isArray(sourceIngredients) &&
    sourceIngredients.length > 0 &&
    Array.isArray(recipe.steps) &&
    recipe.steps.length > 0
  ) {
    const scaledIngredients =
      effectiveServings === baseServings && !recipe.baseIngredients
        ? sourceIngredients
        : sourceIngredients.map(item => scaleStructuredIngredient(item, effectiveServings, baseServings));
    return {
      ingredients: scaledIngredients.map(formatStructuredIngredientLine),
      steps: recipe.steps,
      tips: Array.isArray(recipe.tips) ? recipe.tips : [],
    };
  }

  const rawExtract = recipe.baseExtract || recipe.extract || '';
  const parsed = parseLegacyExtractSections(rawExtract);
  const scaledLegacyIngredients =
    effectiveServings === baseServings
      ? parsed.ingredients
      : parsed.ingredients.map(line => scaleArabicIngredientLine(line, effectiveServings, baseServings));
  return {
    ingredients: scaledLegacyIngredients,
    steps: parsed.steps,
    tips: parsed.tips,
  };
}

export function scaleOnlineRecipeForServings(
  recipe: OnlineRecipe,
  targetServings: number
): OnlineRecipe {
  const safeTarget = clampRecipeServings(targetServings);
  const baseServings = recipe.baseServings || recipe.servings || BASE_RECIPE_SERVINGS;
  const baseIngredients =
    Array.isArray(recipe.baseIngredients) && recipe.baseIngredients.length > 0
      ? recipe.baseIngredients
      : Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0
      ? recipe.ingredients
      : undefined;
  const baseExtract = recipe.baseExtract || recipe.extract;

  const scaledStructured = baseIngredients
    ? baseIngredients.map(item => scaleStructuredIngredient(item, safeTarget, baseServings))
    : undefined;

  const sections = getRecipeDisplaySections(
    {
      ...recipe,
      baseServings,
      baseIngredients,
      baseExtract,
    },
    safeTarget
  );

  const scaledExtract =
    scaledStructured && Array.isArray(recipe.steps) && recipe.steps.length > 0
      ? buildRecipeExtractText({
          servings: safeTarget,
          ingredients: scaledStructured,
          steps: recipe.steps,
          tips: Array.isArray(recipe.tips) ? recipe.tips : [],
        })
      : `المكونات (${safeTarget} أفراد):\n${sections.ingredients.map(i => `• ${i}`).join('\n')}\n\nطريقة التحضير:\n${sections.steps.map((s, idx) => `${idx + 1}. ${s}`).join('\n')}${
          sections.tips.length > 0 ? `\n\nنصائح لنجاح الوصفة:\n${sections.tips.map(t => `• ${t}`).join('\n')}` : ''
        }`;

  return {
    ...recipe,
    servings: safeTarget,
    baseServings,
    ingredients: scaledStructured,
    baseIngredients,
    extract: scaledExtract,
    baseExtract,
  };
}

export function getRecipeOriginBadge(recipe: OnlineRecipe): { label: string; className: string } {
  if (recipe.cuisineName) {
    const label = formatCuisineLabel(recipe.cuisineName, recipe.countryFlag || '');
    const isEgyptian = recipe.countryFlag === '🇪🇬' || recipe.cuisineName.includes('المصري');
    return {
      label: label || recipe.cuisineName,
      className: isEgyptian
        ? 'bg-[#FADDE4] text-[#C96D84] border border-[#F3DCE2]'
        : 'bg-[#FFF8FA] text-[#4A353B] border border-[#E8A8B7]',
    };
  }
  if (recipe.cuisineLabel) {
    return {
      label: recipe.cuisineLabel,
      className: 'bg-[#FFF8FA] text-[#4A353B] border border-[#E8A8B7]',
    };
  }
  if (recipe.cuisine && CUISINE_BADGE_META[recipe.cuisine]) {
    return CUISINE_BADGE_META[recipe.cuisine];
  }
  return {
    label: 'وصفة محفوظة',
    className: 'bg-[#FFF8FA] text-[#4A353B] border border-[#E8A8B7]',
  };
}

export function getApiBaseUrl(): string {
  return (import.meta.env.VITE_GEMINI_API_BASE_URL || '').trim();
}

export async function generateRecipeViaApi(
  rawTerm: string,
  options: {
    fetchFn?: typeof fetch;
    apiBaseUrl?: string;
    timeoutMs?: number;
  } = {}
): Promise<OnlineRecipe> {
  const query = rawTerm.trim();
  if (query.length < 2) {
    throw new RecipeApiError('اكتبي اسم الأكلة المطلوبة بشكل واضح (من حرفين على الأقل).', {
      code: 'INVALID_QUERY',
      retryable: false,
      status: 400,
    });
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new RecipeApiError('مفيش اتصال بالإنترنت حالياً. اتأكد من الشبكة واضغط إعادة المحاولة.', {
      code: 'OFFLINE',
      retryable: true,
      status: 0,
    });
  }

  const fetchImpl = options.fetchFn || fetch;
  const baseUrl = (options.apiBaseUrl ?? getApiBaseUrl()).replace(/\/$/, '');
  const endpoint = `${baseUrl}/api/recipes/generate`;
  const timeoutMs = options.timeoutMs ?? API_REQUEST_TIMEOUT_MS;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });

    let data: {
      recipe?: unknown;
      error?: string;
      code?: string;
      retryable?: boolean;
    } | null = null;

    try {
      data = (await response.json()) as {
        recipe?: unknown;
        error?: string;
        code?: string;
        retryable?: boolean;
      };
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new RecipeApiError(
        data?.error ||
          (response.status === 429
            ? 'الخدمة عليها ضغط دلوقتي. استنى ثواني واضغط إعادة المحاولة.'
            : 'حصلت مشكلة مؤقتة في تجهيز الوصفة. اضغط إعادة المحاولة.'),
        {
          code: data?.code || `HTTP_${response.status}`,
          retryable: data?.retryable ?? response.status !== 400,
          status: response.status,
        }
      );
    }

    const rawRecipe = data?.recipe as (Record<string, unknown> | undefined);
    const validated = validateAndNormalizeGeminiRecipe(rawRecipe);
    if (validated.ok === false) {
      throw new RecipeApiError(validated.message, {
        code: validated.reason.toUpperCase(),
        retryable: validated.reason === 'invalid_schema',
        status: validated.reason === 'unrecognized_food' ? 422 : 502,
      });
    }

    const aiRecipe: ValidatedAiRecipe = {
      ...validated.data,
      imageUrl:
        typeof rawRecipe?.imageUrl === 'string' && rawRecipe.imageUrl.startsWith('https://')
          ? rawRecipe.imageUrl
          : undefined,
      imageCredit:
        typeof rawRecipe?.imageCredit === 'string' && rawRecipe.imageCredit.trim()
          ? rawRecipe.imageCredit.trim()
          : undefined,
    };

    return aiRecipeToOnlineRecipe(aiRecipe);
  } catch (err) {
    if (err instanceof RecipeApiError) {
      throw err;
    }
    const errObj = err as { name?: string; message?: string };
    if (errObj?.name === 'AbortError') {
      throw new RecipeApiError('الاتصال أخد وقت أطول من المعتاد. اتأكد من الإنترنت واضغط إعادة المحاولة.', {
        code: 'TIMEOUT',
        retryable: true,
        status: 504,
      });
    }
    throw new RecipeApiError('تعذر الاتصال بخدمة الوصفات الذكية دلوقتي. اتأكد من الإنترنت واضغط إعادة المحاولة.', {
      code: 'NETWORK_ERROR',
      retryable: true,
      status: 0,
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function resolveOnlineOrOfflineRecipe(
  rawTerm: string,
  options: {
    isNative?: boolean;
    isOffline?: boolean;
    skipLocalCatalog?: boolean;
    savedRecipes?: OnlineRecipe[];
    storage?: StorageLike | null;
    clientSdkDeps?: GeminiSdkDeps;
    fetchFn?: typeof fetch;
    apiBaseUrl?: string;
    timeoutMs?: number;
  } = {}
): Promise<{ recipes: OnlineRecipe[]; mode: 'cache' | 'catalog' | 'ai' | 'offline_fallback' }> {
  const query = rawTerm.trim();
  if (query.length < 2) {
    throw new RecipeApiError('اكتبي اسم الأكلة المطلوبة بشكل واضح (من حرفين على الأقل).', {
      code: 'INVALID_QUERY',
      retryable: false,
      status: 400,
    });
  }

  const storage =
    options.storage !== undefined
      ? options.storage
      : typeof localStorage !== 'undefined'
      ? localStorage
      : null;

  // Tier 1: Saved Recipes + Generated Recipes Cache (LocalStorage LRU)
  const tier1Hit = searchTier1SavedAndCachedRecipes(query, {
    savedRecipes: options.savedRecipes,
    storage,
  });
  if (tier1Hit && tier1Hit.recipes.length > 0) {
    return { recipes: tier1Hit.recipes, mode: 'cache' };
  }

  const isOffline = options.isOffline ?? (typeof navigator !== 'undefined' && navigator.onLine === false);

  // Tier 2: Built-in Local Catalog (runs both online and offline unless explicitly skipped)
  if (!options.skipLocalCatalog) {
    const localCatalogMatches: OnlineRecipe[] = searchOfflineLocalRecipes(query).map(item => ({
      title: item.title,
      dishName: item.title,
      servings: item.servings,
      pageId: item.pageId,
      url: item.url,
      extract: item.extract,
      cuisineName: item.cuisineName,
      countryFlag: item.countryFlag,
      cuisineLabel: item.cuisineLabel,
      prepTime: item.prepTime,
      imageUrl: item.imageUrl,
      imageCredit: item.imageCredit,
      isOfflineFallback: isOffline,
    }));

    if (localCatalogMatches.length > 0) {
      return {
        recipes: localCatalogMatches,
        mode: isOffline ? 'offline_fallback' : 'catalog',
      };
    }
  }

  // Tier 3: Live Gemini API Generation (only when not in Tier 1 Cache or Tier 2 Local Catalog)
  if (isOffline) {
    throw new RecipeApiError(
      'أنت غير متصل بالإنترنت حالياً ومفيش وصفة مطابقة في الكاش أو المكتبة الأوفلاين. وصّل الإنترنت واضغط إعادة المحاولة.',
      {
        code: 'OFFLINE',
        retryable: true,
        status: 0,
      }
    );
  }

  // Tests may inject an SDK adapter explicitly. Production always routes
  // Gemini requests through the server-side API; no client key is bundled.
  if (options.clientSdkDeps) {
    let recipe: OnlineRecipe;
    try {
      const aiRecipe = await generateRecipeWithGeminiSdk(query, options.clientSdkDeps);
      recipe = aiRecipeToOnlineRecipe(aiRecipe);
    } catch (err) {
      if (err instanceof GeminiRecipeSdkError) {
        throw new RecipeApiError(err.message, {
          code: err.code,
          retryable: err.retryable,
          status: err.status,
        });
      }
      throw new RecipeApiError('تعذر الاتصال بخدمة الوصفات الذكية حالياً. تأكد من الإنترنت واضغط إعادة المحاولة.', {
        code: 'GEMINI_UNAVAILABLE',
        retryable: true,
        status: 502,
      });
    }
    saveGeneratedRecipeToLruCache(query, recipe, storage);
    return { recipes: [recipe], mode: 'ai' };
  }

  const recipe = await generateRecipeViaApi(query, {
    fetchFn: options.fetchFn,
    apiBaseUrl: options.apiBaseUrl,
    timeoutMs: options.timeoutMs,
  });
  saveGeneratedRecipeToLruCache(query, recipe, storage);
  return { recipes: [recipe], mode: 'ai' };
}

function ServingsStepperControl({
  value,
  onChange,
  ariaLabelPrefix = 'عدد الأفراد',
}: {
  value: number;
  onChange: (next: number) => void;
  ariaLabelPrefix?: string;
}) {
  const [draft, setDraft] = useState<string>(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commitValue = (raw: string) => {
    const cleaned = raw.replace(/[٠-٩]/g, ch => String(ch.charCodeAt(0) - 0x0660)).replace(/[^\d]/g, '');
    if (!cleaned) {
      setDraft(String(value));
      return;
    }
    const parsed = clampRecipeServings(Number(cleaned), value);
    setDraft(String(parsed));
    if (parsed !== value) {
      onChange(parsed);
    }
  };

  return (
    <div
      className="inline-flex items-center gap-1 rounded-2xl border border-[#E8A8B7]/75 bg-[#FFF8FA] p-1 shadow-2xs"
      role="group"
      aria-label={ariaLabelPrefix}
    >
      <button
        type="button"
        onClick={() => onChange(clampRecipeServings(value - 1))}
        disabled={value <= MIN_RECIPE_SERVINGS}
        aria-label="تقليل عدد الأفراد"
        className="clay-tactile flex h-8 w-8 items-center justify-center rounded-xl bg-[#FADDE4] text-[#C96D84] font-black transition hover:bg-[#F3DCE2] disabled:opacity-40"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>

      <input
        type="number"
        inputMode="numeric"
        min={MIN_RECIPE_SERVINGS}
        max={MAX_RECIPE_SERVINGS}
        value={draft}
        aria-label={`${ariaLabelPrefix} من 1 إلى 50`}
        onChange={event => {
          const nextRaw = event.target.value;
          setDraft(nextRaw);
          const ascii = nextRaw.replace(/[٠-٩]/g, ch => String(ch.charCodeAt(0) - 0x0660)).trim();
          const num = Number(ascii);
          if (ascii !== '' && Number.isFinite(num) && num >= MIN_RECIPE_SERVINGS && num <= MAX_RECIPE_SERVINGS) {
            onChange(Math.round(num));
          }
        }}
        onBlur={() => commitValue(draft)}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commitValue(draft);
          }
        }}
        className="clay-inset h-8 w-12 px-1 text-center text-xs font-black text-[#4A353B] outline-none focus:border-[#D47E93] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />

      <button
        type="button"
        onClick={() => onChange(clampRecipeServings(value + 1))}
        disabled={value >= MAX_RECIPE_SERVINGS}
        aria-label="زيادة عدد الأفراد"
        className="clay-tactile flex h-8 w-8 items-center justify-center rounded-xl bg-[#D47E93] text-white font-black transition hover:bg-[#C96D84] disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function OnlineRecipeSearch({
  familySize: _familySize = 4,
  onBack,
}: {
  familySize?: number;
  onBack?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [servingsCount, setServingsCount] = useState<number>(BASE_RECIPE_SERVINGS);
  const [results, setResults] = useState<OnlineRecipe[]>([]);
  const [selected, setSelected] = useState<OnlineRecipe | null>(null);
  const [saved, setSaved] = useState<OnlineRecipe[]>(() => readSavedRecipes());
  const [showSaved, setShowSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState('');
  const [errorState, setErrorState] = useState<RecipeSearchErrorState | null>(null);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Record<number, boolean>>({});
  const recognitionRef = useRef<any>(null);
  const voiceListenersRef = useRef<Array<{ remove(): Promise<void> }>>([]);
  const speechPlayerRef = useRef<EgyptianRecipeSpeechPlayer | null>(null);

  if (!speechPlayerRef.current) {
    speechPlayerRef.current = new EgyptianRecipeSpeechPlayer(recipeVoice);
  }

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    } catch {
      /* storage may be full */
    }
  }, [saved]);

  const handleServingsChange = (nextServings: number) => {
    const clamped = clampRecipeServings(nextServings);
    setServingsCount(clamped);
    if (speaking) {
      void stopRecipeSpeech();
    }
    if (selected && saved.some(item => item.pageId === selected.pageId)) {
      const scaledCopy = scaleOnlineRecipeForServings(selected, clamped);
      setSaved(current =>
        current.map(item => (item.pageId === selected.pageId ? scaledCopy : item))
      );
    }
  };

  const searchForTerm = async (rawTerm: string) => {
    const term = rawTerm.trim();
    if (!term || loading) return;
    setLoading(true);
    setErrorState(null);
    setOfflineNotice('');
    setSelected(null);
    setShowSaved(false);
    setResults([]);

    try {
      const resolved = await resolveOnlineOrOfflineRecipe(term, {
        savedRecipes: saved,
      });
      setResults(resolved.recipes);
      if (resolved.mode === 'offline_fallback') {
        setOfflineNotice('وضع بدون إنترنت — تم عرض وصفات مطابقة من مكتبة تدبيرة الأوفلاين.');
      }
    } catch (err) {
      const apiErr =
        err instanceof RecipeApiError
          ? err
          : new RecipeApiError('تعذر الاتصال بخدمة الوصفات الذكية حالياً. اضغط إعادة المحاولة.');
      setErrorState({
        message: apiErr.message,
        code: apiErr.code,
        retryable: apiErr.retryable,
        query: term,
      });
    } finally {
      setLoading(false);
    }
  };

  const search = (event: React.FormEvent) => {
    event.preventDefault();
    void searchForTerm(query);
  };

  const stopVoiceSearch = async () => {
    try {
      recognitionRef.current?.stop?.();
      recognitionRef.current = null;
      if (Capacitor.isNativePlatform()) await recipeVoice.stopListening();
    } catch {
      /* recognition may already have stopped */
    }
    setVoiceListening(false);
  };

  const startVoiceSearch = async () => {
    if (voiceListening) {
      await stopVoiceSearch();
      return;
    }
    setVoiceMessage('');
    try {
      if (Capacitor.isNativePlatform()) {
        const permission = await recipeVoice.request();
        if (!permission.granted) {
          setVoiceMessage('اسمح لتدبيرة باستخدام الميكروفون من إعدادات الجهاز ثم حاول مرة أخرى.');
          return;
        }
        voiceListenersRef.current.forEach(listener => {
          void listener.remove();
        });
        voiceListenersRef.current = [];
        const resultListener = await recipeVoice.addListener('speechResult', event => {
          const transcript = (event.transcript || '').trim();
          setVoiceListening(false);
          if (!transcript) {
            setVoiceMessage('ملقطناش كلام واضح. اضغط على الميكروفون وجرب تاني.');
            return;
          }
          setQuery(transcript);
          setVoiceMessage(`سمعت: ${transcript}`);
          void searchForTerm(transcript);
        });
        const errorListener = await recipeVoice.addListener('speechError', event => {
          setVoiceListening(false);
          const reason =
            event.error === 'no-speech'
              ? 'ملقطناش صوت. اتكلم بوضوح وجرب تاني.'
              : event.error === 'network'
              ? 'خدمة التعرف على الكلام محتاجة إنترنت.'
              : event.error === 'not-allowed'
              ? 'إذن الميكروفون غير متاح. فعّله من إعدادات التطبيق.'
              : 'تعذر تشغيل الميكروفون. تأكد من توفر خدمة التعرف على الكلام على جهازك.';
          setVoiceMessage(reason);
        });
        voiceListenersRef.current = [resultListener, errorListener];
        await recipeVoice.startListening();
        setVoiceListening(true);
        setVoiceMessage('بتسمعك دلوقتي… قول اسم الأكلة 🎙️');
        return;
      }

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setVoiceMessage('البحث الصوتي غير مدعوم في المتصفح الحالي. استخدم الكتابة أو افتح التطبيق على جهاز يدعم التعرف على الكلام.');
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-EG';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => {
        setVoiceListening(true);
        setVoiceMessage('بتسمعك دلوقتي… قول اسم الأكلة 🎙️');
      };
      recognition.onresult = (event: any) => {
        const transcript = (event.results?.[0]?.[0]?.transcript || '').trim();
        setVoiceListening(false);
        if (transcript) {
          setQuery(transcript);
          setVoiceMessage(`سمعت: ${transcript}`);
          void searchForTerm(transcript);
        } else {
          setVoiceMessage('ملقطناش كلام واضح. جرب تاني.');
        }
      };
      recognition.onerror = (event: any) => {
        setVoiceListening(false);
        setVoiceMessage(
          event.error === 'not-allowed' ? 'فعّل إذن الميكروفون من إعدادات الجهاز.' : 'تعذر سماع طلبك. حاول مرة أخرى.'
        );
      };
      recognition.onend = () => setVoiceListening(false);
      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setVoiceListening(false);
      setVoiceMessage('مش قادرين نشغل الميكروفون دلوقتي. راجع الإذن وحاول تاني.');
    }
  };

  const stopRecipeSpeech = async () => {
    await speechPlayerRef.current?.stop();
    setSpeaking(false);
  };

  const closeSelectedModal = () => {
    void stopRecipeSpeech();
    setSelected(null);
  };

  const speakRecipe = async (recipe: OnlineRecipe, targetServings = servingsCount) => {
    const activeServings = clampRecipeServings(targetServings);
    const sections = getRecipeDisplaySections(recipe, activeServings);
    const segments = buildEgyptianRecipeSpeechSegments(
      recipe.dishName || recipe.title,
      activeServings,
      sections.ingredients,
      sections.steps
    );
    await speechPlayerRef.current?.speakSegments(segments, {
      isNative: Capacitor.isNativePlatform(),
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: msg => {
        setSpeaking(false);
        setVoiceMessage(msg);
      },
    });
  };

  useEffect(() => {
    if (!selected) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        void speechPlayerRef.current?.stop();
        setSpeaking(false);
        setSelected(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected]);

  useEffect(() => {
    let playbackListener: { remove(): Promise<void> } | undefined;
    if (Capacitor.isNativePlatform()) {
      void recipeVoice
        .addListener('speechPlaybackStatus', event => {
          if (event.status === 'completed' || event.status === 'stopped' || event.status === 'error') setSpeaking(false);
          if (event.status === 'speaking') setSpeaking(true);
        })
        .then(listener => {
          playbackListener = listener;
        });
    }
    return () => {
      try {
        recognitionRef.current?.stop?.();
      } catch {
        /* ignore */
      }
      void speechPlayerRef.current?.stop();
      voiceListenersRef.current.forEach(listener => {
        void listener.remove();
      });
      if (playbackListener) void playbackListener.remove();
      if (Capacitor.isNativePlatform()) {
        void recipeVoice.stopListening();
      }
    };
  }, []);

  const saveRecipe = (recipe: OnlineRecipe, targetServings = servingsCount) => {
    const scaledRecipe = scaleOnlineRecipeForServings(recipe, targetServings);
    setSelected(scaledRecipe);
    setSaved(current => {
      const exists = current.some(item => item.pageId === scaledRecipe.pageId);
      if (exists) {
        return current.map(item => (item.pageId === scaledRecipe.pageId ? scaledRecipe : item));
      }
      return [scaledRecipe, ...current];
    });
  };
  const removeSaved = (pageId: number) => setSaved(current => current.filter(item => item.pageId !== pageId));
  const currentItems = showSaved ? saved : results;

  return (
    <section dir="rtl" className="min-h-full space-y-3" aria-label="البحث الصوتي عن الوصفات بالذكاء الاصطناعي">
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="clay-btn-secondary clay-tactile inline-flex min-h-[44px] items-center gap-1 px-3 py-2 text-xs font-bold text-[#4A353B]"
          >
            <ArrowRight className="h-4 w-4" /> رجوع
          </button>
        )}
        <div className="clay-card-soft min-w-0 flex-1 bg-gradient-to-br from-[#FFF1E8] via-[#FADDE4] to-[#F3DCE2] p-3 flex items-center gap-2.5">
          <span className="clay-icon-well w-10 h-10 rounded-2xl flex items-center justify-center shrink-0">
            <Kitchen3DIcon className="w-7 h-7" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-black text-[#4A353B] flex items-center gap-1.5">
              <span>مساعد الوصفات الصوتي</span>
              <Sparkles className="h-4 w-4 text-[#C96D84]" aria-hidden="true" />
            </h3>
            <p className="mt-0.5 text-[11px] leading-5 text-[#8E757C]">
              اطلب أي أكلة مصرية أو عربية أو عالمية بالكلام أو الكتابة، وهنجهزلك وصفتها الحقيقية فوراً.
            </p>
          </div>
        </div>
      </div>

      {/* Servings Selector Bar + Saved Recipes Toggle */}
      <div className="clay-card-soft flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#4A353B]">
            <Users className="h-3.5 w-3.5 text-[#D47E93]" aria-hidden="true" />
            <span>المقادير والكميات محسوبة ومضبوطة لـ {servingsCount} أفراد</span>
          </span>
          <ServingsStepperControl
            value={servingsCount}
            onChange={handleServingsChange}
            ariaLabelPrefix="تحديد عدد الأفراد في شاشة البحث"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setShowSaved(value => !value);
            setSelected(null);
            setErrorState(null);
          }}
          className="clay-btn-secondary clay-tactile px-3.5 py-2 text-[11px] font-extrabold text-[#C96D84]"
        >
          {showSaved ? 'نتائج البحث' : 'المحفوظات'} ({saved.length})
        </button>
      </div>

      {!showSaved && (
        <div className="space-y-2">
          <form onSubmit={search} className="flex gap-2">
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="قول أو اكتب اسم الأكلة..."
              maxLength={100}
              className="clay-inset min-w-0 flex-1 px-3.5 py-3 text-sm text-[#4A353B] outline-none focus:border-[#D47E93]"
            />
            <button
              type="button"
              onClick={() => void startVoiceSearch()}
              disabled={loading}
              aria-label={voiceListening ? 'إيقاف الاستماع' : 'البحث بالصوت'}
              className={`clay-tactile rounded-2xl px-3.5 py-2 disabled:opacity-50 ${
                voiceListening ? 'bg-red-600 text-white' : 'clay-btn-secondary text-[#C96D84]'
              }`}
            >
              {voiceListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="clay-btn-primary px-4 py-2 text-xs font-extrabold disabled:opacity-50"
            >
              {loading ? (
                'جاري التحضير…'
              ) : (
                <>
                  <Search className="inline h-4 w-4 ml-1" /> ابحث
                </>
              )}
            </button>
          </form>

          {/* Powder Pink Quick-Search Suggestion Chips */}
          <div className="flex flex-wrap items-center gap-1.5" aria-label="اقتراحات بحث سريعة">
            {QUICK_SEARCH_SUGGESTIONS.map(chip => {
              const isActive = simpleNormalizeArabic(query) === simpleNormalizeArabic(chip);
              return (
                <button
                  key={chip}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setQuery(chip);
                    void searchForTerm(chip);
                  }}
                  className={`clay-tactile rounded-xl px-3 py-1.5 text-[11px] font-bold transition disabled:opacity-50 ${
                    isActive
                      ? 'clay-btn-primary text-white'
                      : 'bg-[#FADDE4]/75 text-[#4A353B] border border-[#E8A8B7]/60 hover:bg-[#FADDE4] hover:border-[#D47E93]'
                  }`}
                >
                  {chip}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {voiceMessage && (
        <p role="status" className="clay-card-soft p-3 text-xs leading-6 text-[#4A353B]">
          {voiceMessage}
        </p>
      )}

      {loading && (
        <div className="clay-card p-5 text-center space-y-2.5 animate-pulse" role="status" aria-live="polite">
          <div className="mx-auto w-14 h-14">
            <RecipeCookingClayArt className="w-14 h-14" title="جاري تجهيز الوصفة" />
          </div>
          <p className="text-xs font-extrabold text-[#4A353B]">بنحضّرلك الوصفة الدقيقة بالمقادير والخطوات…</p>
          <p className="text-[11px] text-[#8E757C]">لحظات وتظهر الوصفة جاهزة لـ {servingsCount} أفراد</p>
        </div>
      )}

      {!loading && !showSaved && offlineNotice && (
        <p role="status" className="clay-card-soft border border-[#A8B8A0]/50 bg-[#A8B8A0]/15 p-3 text-xs font-bold leading-6 text-[#4A353B]">
          {offlineNotice}
        </p>
      )}

      {!loading && !showSaved && errorState && (
        <div
          role="alert"
          className="clay-card border border-[#E8A8B7] bg-gradient-to-br from-[#FFF8FA] to-[#FADDE4]/55 p-4 space-y-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0 text-[#C96D84] mt-0.5" aria-hidden="true" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-xs font-extrabold text-[#4A353B]">تعذر تجهيز الوصفة</p>
              <p className="text-xs leading-6 text-[#6D5158]">{errorState.message}</p>
            </div>
          </div>
          {errorState.retryable && (
            <button
              type="button"
              onClick={() => void searchForTerm(errorState.query)}
              className="clay-btn-primary clay-tactile inline-flex min-h-[42px] items-center gap-2 px-4 py-2 text-xs font-extrabold"
            >
              <RefreshCw className="h-4 w-4" /> إعادة المحاولة
            </button>
          )}
        </div>
      )}

      {!loading && currentItems.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          {currentItems.map(item => {
            const badge = getRecipeOriginBadge(item);
            const hasImage = Boolean(item.imageUrl) && !brokenImages[item.pageId];
            const cardServings = showSaved ? item.servings || servingsCount : servingsCount;
            const sections = getRecipeDisplaySections(item, cardServings);
            const displayTitle = item.dishName || item.title;
            return (
              <div
                key={item.pageId}
                className={`clay-card p-3.5 space-y-3 border ${
                  selected?.pageId === item.pageId ? 'border-[#D47E93] ring-1 ring-[#D47E93]/35' : 'border-[#F3DCE2]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (showSaved && item.servings) {
                      setServingsCount(clampRecipeServings(item.servings));
                    }
                    setSelected(item);
                  }}
                  className="w-full flex items-center gap-3 text-right group"
                >
                  <span className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#FFF1E8] border border-[#F3DCE2] flex items-center justify-center">
                    {hasImage ? (
                      <img
                        src={item.imageUrl}
                        alt={displayTitle}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={() => setBrokenImages(prev => ({ ...prev, [item.pageId]: true }))}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <RecipeCookingClayArt title={displayTitle} className="h-full w-full p-1" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="min-w-0 flex-1 text-sm font-black leading-6 text-[#4A353B] group-hover:text-[#C96D84] transition">
                        {displayTitle}
                      </span>
                      <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#8E757C]">
                      <span>👥 {cardServings} أفراد</span>
                      {typeof item.totalTimeMinutes === 'number' ? (
                        <span>⏱️ {item.totalTimeMinutes} دقيقة</span>
                      ) : item.prepTime ? (
                        <span>⏱️ {item.prepTime}</span>
                      ) : null}
                      {sections.ingredients.length > 0 && <span>🍲 {sections.ingredients.length} مكونات</span>}
                    </div>

                    <span className="inline-block text-[11px] font-extrabold text-[#C96D84]">
                      اضغط لعرض المقادير والخطوات والنصائح كاملة ←
                    </span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selected &&
        (() => {
          const badge = getRecipeOriginBadge(selected);
          const sections = getRecipeDisplaySections(selected, servingsCount);
          const displayTitle = selected.dishName || selected.title;
          const hasValidImage = Boolean(selected.imageUrl) && !brokenImages[selected.pageId];
          const hasExternalSource =
            Boolean(selected.url) && selected.url !== 'https://www.themealdb.com/' && !selected.isAiGenerated;
          const savedMatch = saved.find(item => item.pageId === selected.pageId);
          const isSavedWithSameServings = Boolean(savedMatch && savedMatch.servings === servingsCount);

          const modalNode = (
            <div
              dir="rtl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="online-recipe-fullscreen-title"
              className="fixed inset-0 z-[100] bg-[#FFF8FA] flex flex-col overflow-hidden"
            >
              {/* Sticky Top Header */}
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#F3DCE2] bg-[#FFFFFF]/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${badge.className}`}>
                      {badge.label}
                    </span>
                    <span className="text-[11px] font-semibold text-[#8E757C]">لأسرة من {servingsCount} أفراد</span>
                  </div>
                  <h4
                    id="online-recipe-fullscreen-title"
                    className="mt-1 text-base font-black leading-snug text-[#4A353B] line-clamp-2"
                  >
                    {displayTitle}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={closeSelectedModal}
                  aria-label="إغلاق"
                  className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-[#F3DCE2] bg-[#FFF8FA] text-[#4A353B] shadow-2xs transition hover:bg-[#FADDE4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D47E93]"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              {/* Full-Screen Scrollable Recipe Content */}
              <div className="flex-1 overflow-y-auto p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                <div className="mx-auto max-w-2xl space-y-4">
                  <div className="overflow-hidden rounded-2xl border border-[#F3DCE2] bg-[#FFFFFF] shadow-xs">
                    {hasValidImage ? (
                      <img
                        src={selected.imageUrl}
                        alt={displayTitle}
                        referrerPolicy="no-referrer"
                        onError={() => setBrokenImages(prev => ({ ...prev, [selected.pageId]: true }))}
                        className="h-56 w-full object-cover sm:h-64"
                      />
                    ) : (
                      <div className="flex h-48 w-full flex-col items-center justify-center bg-gradient-to-br from-[#FFF1E8] to-[#FADDE4]/55 p-4 gap-2">
                        <RecipeCookingClayArt title={displayTitle} className="h-32 w-32" />
                        <span className="text-[11px] font-bold text-[#8E757C]">{displayTitle}</span>
                      </div>
                    )}
                  </div>

                  {/* Timings & Dynamic Servings Strip */}
                  <div className="clay-card-soft flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-3 text-xs font-bold text-[#4A353B]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 font-extrabold text-[#4A353B]">
                        <Users className="h-4 w-4 text-[#D47E93]" aria-hidden="true" />
                        <span>المقادير والكميات محسوبة ومضبوطة لـ {servingsCount} أفراد</span>
                      </span>
                      <ServingsStepperControl
                        value={servingsCount}
                        onChange={handleServingsChange}
                        ariaLabelPrefix="تغيير عدد الأفراد داخل الوصفة"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-extrabold text-[#C96D84]">
                      {typeof selected.prepTimeMinutes === 'number' && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          التحضير: {selected.prepTimeMinutes} د
                        </span>
                      )}
                      {typeof selected.cookTimeMinutes === 'number' && (
                        <span>الطهي: {selected.cookTimeMinutes} د</span>
                      )}
                      {typeof selected.totalTimeMinutes === 'number' ? (
                        <span>الإجمالي: {selected.totalTimeMinutes} د</span>
                      ) : selected.prepTime ? (
                        <span>⏱️ {selected.prepTime}</span>
                      ) : null}
                    </div>
                  </div>

                  {sections.ingredients.length > 0 && (
                    <section className="clay-card p-4">
                      <h5 className="mb-2.5 text-sm font-black text-[#4A353B]">
                        المكونات المطلوبة ({servingsCount} أفراد)
                      </h5>
                      <ul className="space-y-2 text-sm leading-7 text-[#4A353B]">
                        {sections.ingredients.map((ingredient, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-[#D47E93]" aria-hidden="true" />
                            <span>{ingredient}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {sections.steps.length > 0 && (
                    <section className="clay-card p-4">
                      <h5 className="mb-3 text-sm font-black text-[#4A353B]">طريقة التحضير خطوة بخطوة</h5>
                      <ol className="space-y-3 text-sm leading-7 text-[#4A353B]">
                        {sections.steps.map((step, index) => (
                          <li key={index} className="clay-inset flex items-start gap-3 p-3">
                            <span className="clay-btn-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white">
                              {['١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '١٠'][index] || String(index + 1)}
                            </span>
                            <span className="min-w-0 flex-1">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}

                  {sections.tips.length > 0 && (
                    <section className="clay-card-cream border border-[#D9AE72]/35 p-4 space-y-2">
                      <h5 className="text-sm font-black text-[#4A353B]">نصائح الشيف لنجاح الوصفة ✨</h5>
                      <ul className="space-y-1.5 text-xs leading-6 text-[#5B4148]">
                        {sections.tips.map((tip, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-[#D9AE72] font-black">•</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {hasValidImage && selected.imageCredit && (
                    <p className="text-[10px] leading-5 text-[#8E757C]">
                      مصدر الصورة المطابقة للطبق: {selected.imageCredit}
                    </p>
                  )}
                </div>
              </div>

              {/* Sticky Bottom Controls Bar */}
              <footer className="shrink-0 border-t border-[#F3DCE2] bg-[#FFFFFF]/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-sm">
                <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void (speaking ? stopRecipeSpeech() : speakRecipe(selected, servingsCount))}
                    className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 px-4 py-2 text-xs font-extrabold ${
                      speaking ? 'rounded-xl bg-red-600 hover:bg-red-700 text-white transition' : 'clay-btn-primary'
                    }`}
                  >
                    {speaking ? (
                      <>
                        <VolumeX className="h-4 w-4 shrink-0" /> إيقاف الاستماع
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-4 w-4 shrink-0" /> اسمع الوصفة ({servingsCount} أفراد)
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => saveRecipe(selected, servingsCount)}
                    className="clay-btn-secondary clay-tactile min-h-[44px] px-3.5 py-2 text-xs font-extrabold text-[#C96D84]"
                  >
                    {isSavedWithSameServings
                      ? `✓ محفوظة (${servingsCount} أفراد)`
                      : savedMatch
                      ? `☆ احفظ لـ ${servingsCount} أفراد`
                      : '☆ احفظ الوصفة'}
                  </button>
                  {showSaved && (
                    <button
                      type="button"
                      onClick={() => {
                        removeSaved(selected.pageId);
                        closeSelectedModal();
                      }}
                      className="min-h-[44px] rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                    >
                      حذف
                    </button>
                  )}
                  {hasExternalSource && (
                    <a
                      href={selected.url}
                      target="_blank"
                      rel="noreferrer"
                      className="clay-btn-secondary inline-flex min-h-[44px] items-center px-3 py-2 text-xs font-bold text-[#C96D84]"
                    >
                      المصدر ↗
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={closeSelectedModal}
                    className="clay-btn-secondary min-h-[44px] px-4 py-2 text-xs font-bold text-[#4A353B]"
                  >
                    إغلاق
                  </button>
                </div>
              </footer>
            </div>
          );

          return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
        })()}

      {!loading && showSaved && saved.length === 0 && (
        <p className="clay-card-cream p-4 text-center text-xs text-[#8E757C]">لسه مفيش وصفات محفوظة في المساعد الصوتي.</p>
      )}
      {!loading && !showSaved && !errorState && results.length === 0 && (
        <p className="text-[11px] leading-5 text-[#8E757C]">
          اكتب أو قول اسم أي أكلة مصرية أو عربية أو عالمية، وهنجهزلك وصفة حقيقية بالمقادير والخطوات والنصائح فوراً.
        </p>
      )}
    </section>
  );
}
