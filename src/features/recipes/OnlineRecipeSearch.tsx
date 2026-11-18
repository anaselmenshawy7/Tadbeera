import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { ArrowRight, Mic, MicOff, Volume2, VolumeX, Search, X } from 'lucide-react';
import {
  normalizeArabicSearchTerm as normalize,
  matchesArabicSearchAlias,
  scoreRecipeDishRelevance,
  cleanTranslatedArabicTitle,
  ARABIC_RECIPE_STOP_WORDS,
  stripArabicDefinitePrefix,
} from './arabicSearch';
import {
  ARABIC_TO_ENGLISH_CULINARY_DICTIONARY,
  applyCulinaryDictionaryToArabic,
  searchEgyptianArabicCatalog,
} from './egyptianRecipesCatalog';
import { isRelevantRecipe } from './recipeValidation';
import { RECIPES, type Recipe } from '../../data/seedData';
import { EgyptianRecipeSpeechPlayer, buildEgyptianRecipeSpeechSegments } from './recipeSpeech';
import { RecipeIllustration } from '../../components/RecipeIllustration';
import { Kitchen3DIcon } from '../../components/Tadbeera3DIcons';
import { synthesizeDynamicArabicRecipe } from './recipeSynthesizer';

interface RecipeVoicePlugin {
  request(): Promise<{ granted: boolean }>;
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  speak(options: { text: string }): Promise<void>;
  stopSpeaking(): Promise<void>;
  addListener(eventName: 'speechResult', listener: (event: { transcript?: string }) => void): Promise<{ remove(): Promise<void> }>;
  addListener(eventName: 'speechError', listener: (event: { error?: string }) => void): Promise<{ remove(): Promise<void> }>;
  addListener(eventName: 'speechPlaybackStatus', listener: (event: { status?: string }) => void): Promise<{ remove(): Promise<void> }>;
}
const recipeVoice = registerPlugin<RecipeVoicePlugin>('MicrophonePermission');

export type CuisineTier = 'egyptian' | 'arab' | 'international';

export type OnlineRecipe = {
  title: string;
  servings: number;
  pageId: number;
  url: string;
  extract: string;
  cuisine?: CuisineTier;
  prepTime?: string;
  isSynthesized?: boolean;
  imageUrl?: string;
  imageLicense?: string;
  imageCredit?: string;
  _relevanceScore?: number;
};

type MealDbMeal = {
  idMeal: string;
  strMeal: string;
  strArea?: string;
  strMealThumb?: string;
  strInstructions?: string;
  strSource?: string;
  [key: string]: string | undefined;
};

const SAVED_KEY = 'tadbeera_online_recipes_v1';
const MEAL_DB_API = 'https://www.themealdb.com/api/json/v1/1/search.php';
const MEAL_DB_FILTER_API = 'https://www.themealdb.com/api/json/v1/1/filter.php';
const MEAL_DB_LOOKUP_API = 'https://www.themealdb.com/api/json/v1/1/lookup.php';
const WIKIBOOKS_API = 'https://en.wikibooks.org/w/api.php';

const CUISINE_PRIORITY: Record<CuisineTier, number> = {
  egyptian: 0,
  arab: 1,
  international: 2,
};

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

const ENGLISH_SYNONYM_PAIRS: Record<string, string[]> = {
  shrimp: ['prawns'],
  prawns: ['shrimp'],
  prawn: ['shrimp', 'prawns'],
  squid: ['calamari'],
  calamari: ['squid'],
  eggplant: ['aubergine'],
  aubergine: ['eggplant'],
  zucchini: ['courgette'],
  courgette: ['zucchini'],
  cilantro: ['coriander'],
  coriander: ['cilantro'],
  beef: ['lamb'],
  lamb: ['beef'],
  fish: ['salmon', 'cod'],
};

const ARABIC_STOP_WORDS = ARABIC_RECIPE_STOP_WORDS;

const ARABIC_ALIASES = ARABIC_TO_ENGLISH_CULINARY_DICTIONARY;

function readSaved(): OnlineRecipe[] {
  try {
    const value = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    return Array.isArray(value)
      ? value.filter(item => item && typeof item.title === 'string').map(item => ({
          ...item,
          cuisine: item.cuisine || detectMealDbCuisineTier(undefined, item.title),
        }))
      : [];
  } catch {
    return [];
  }
}

function scaleArabicRecipeExtract(extract: string, baseServings: number, familySize: number): string {
  const ratio = Math.max(1, Math.min(30, Math.round(familySize))) / Math.max(1, baseServings);
  const splitAt = extract.search(/(?:طريقة التحضير|الطريقة)(?:\s+خطوة بخطوة)?\s*[:：]?/);
  const ingredients = splitAt >= 0 ? extract.slice(0, splitAt) : extract;
  const method = splitAt >= 0 ? extract.slice(splitAt) : '';
  const scaledIngredients = ingredients.replace(/\d+\/\d+|\d+(?:\.\d+)?(?:\s+\d+\/\d+)?/g, value => {
    const amount = value.trim().split(/\s+/).reduce((total, part) => {
      if (!part.includes('/')) return total + Number(part);
      const [numerator, denominator] = part.split('/').map(Number);
      return total + (denominator ? numerator / denominator : 0);
    }, 0);
    return String(Math.round(amount * ratio * 100) / 100);
  });
  return `${scaledIngredients}${method}`;
}

function hasArabic(value: string): boolean {
  const arabicLetters = (value.match(/[\u0600-\u06FF]/g) || []).length;
  const latinLetters = (value.match(/[A-Za-z]/g) || []).length;
  return arabicLetters > 0 && latinLetters <= Math.max(4, Math.floor(arabicLetters * 0.2));
}

function normalizeRecipeLineBreaks(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    // Some providers return the two characters "\n" instead of real line breaks.
    .replace(/\\r\\n|\\n|\\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trim();
}

function stripRecipeListPrefix(value: string): string {
  let cleaned = value.trim();
  // Strip repeated list markers (e.g. "1. 1. Step") so the UI owns numbering.
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

function parseRecipeSections(extract: string, familySize: number, baseServings: number): { ingredients: string[]; steps: string[] } {
  const normalized = normalizeRecipeLineBreaks(extract);
  const separator = normalized.match(/(?:طريقة التحضير|الطريقة)(?:\s+خطوة بخطوة)?\s*[:：]?/);
  const splitIndex = separator?.index ?? -1;
  const ingredientsText = splitIndex >= 0 ? normalized.slice(0, splitIndex) : '';
  const methodText = splitIndex >= 0 ? normalized.slice(splitIndex + separator![0].length) : normalized;
  const ingredients = scaleArabicRecipeExtract(ingredientsText, baseServings, familySize)
    .replace(/^\s*المقادير محسوبة[^\n]*\n?/gm, '')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/^\s*المكونات(?:\s+المطلوبة)?(?:\s*\([^)]*\))?\s*[:：]?/,'')
    .split(/[\n،,؛]+/)
    .map(item => stripRecipeListPrefix(item))
    .filter(item => item.length > 1);
  const steps = methodText
    .replace(/^\s*#{1,6}\s*/gm, '')
    .split(/\n+|(?<=[.!؟])\s+/)
    .map(step => stripRecipeListPrefix(step))
    .filter(step => step.length > 2);
  return { ingredients, steps };
}

async function translateText(value: string, source: 'ar' | 'en', target: 'ar' | 'en'): Promise<string> {
  const text = value.trim();
  if (!text || source === target) return text;
  const sentences = text.match(/[^.!?。！？\n]+[.!?。！？\n]*/g) || [text];
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current.length + sentence.length > 1200 && current) {
      chunks.push(current);
      current = sentence;
    } else current += sentence;
  }
  if (current) chunks.push(current);

  const translated: string[] = [];
  for (const chunk of chunks) {
    try {
      const url = new URL('https://translate.googleapis.com/translate_a/single');
      url.search = new URLSearchParams({ client: 'gtx', sl: source, tl: target, dt: 't', q: chunk }).toString();
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('translation-failed');
      const data = await response.json();
      const output = Array.isArray(data?.[0])
        ? data[0].map((part: unknown[]) => typeof part?.[0] === 'string' ? part[0] : '').join('')
        : '';
      if (!output.trim()) throw new Error('empty-translation');
      if (target === 'ar' && !hasArabic(output)) throw new Error('arabic-translation-unavailable');
      translated.push(output);
    } catch (error) {
      if (target === 'ar') throw error;
      translated.push(chunk);
    }
  }
  return translated.join('');
}

function stripArabicPrepositionPrefix(word: string): string {
  return stripArabicDefinitePrefix(word);
}

function expandEnglishSynonyms(terms: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const add = (value: string) => {
    const clean = value.trim().toLowerCase();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      result.push(clean);
    }
  };
  for (const raw of terms) {
    add(raw);
    const words = raw.trim().toLowerCase().split(/\s+/);
    for (const word of words) {
      const synonyms = ENGLISH_SYNONYM_PAIRS[word];
      if (synonyms) {
        for (const syn of synonyms) add(syn);
      }
    }
  }
  return result;
}

export function expandArabicAliasesToEnglishTerms(term: string): string[] {
  const normalizedQuery = normalize(term);
  const words = normalizedQuery.split(' ').filter(Boolean).map(stripArabicPrepositionPrefix);
  const strippedQuery = words.join(' ');
  const collected: string[] = [];

  for (const alias of ARABIC_ALIASES) {
    const directHit = alias.terms.some(
      item => matchesArabicSearchAlias(term, item) || matchesArabicSearchAlias(strippedQuery, item)
    );
    const tokenHit = alias.terms.some(item => {
      const normalizedItem = normalize(item);
      if (!normalizedItem || normalizedItem.includes(' ')) return false;
      const itemBase = stripArabicPrepositionPrefix(normalizedItem);
      return words.some(w => !ARABIC_STOP_WORDS.has(w) && (w === normalizedItem || w === itemBase));
    });
    if (directHit || tokenHit) {
      collected.push(...alias.englishTerms);
    }
  }

  return expandEnglishSynonyms(collected);
}

export function detectMealDbCuisineTier(strArea?: string, title = ''): CuisineTier {
  const area = (strArea || '').trim().toLowerCase();
  const normalizedTitle = normalize(title);

  if (area === 'egyptian') return 'egyptian';
  if (
    /مصري|اسكندراني|إسكندراني|صعيدي|فلاحي|بورسعيدي|كشري|ملوخيه|طعميه|فول مدمس|حواوشي|فطير مشلتت|بصاره|بسبوسه|كنافه|ام علي|رقاق/.test(normalizedTitle) ||
    /\begyptian\b|\bkoshari\b|\bmolokhia\b|\bhawawshi\b|\bfeteer\b|\btaameya\b|\bful medames\b/.test(normalizedTitle)
  ) {
    return 'egyptian';
  }

  if (ARAB_AREAS.has(area)) return 'arab';
  if (
    /عربي|خليجي|شامي|سوري|لبناني|مغربي|تونسي|سعودي|يمني|عراقي|فلسطيني|اردني|كبسه|مقلوبه|شاورما|شرموله|طاجن/.test(normalizedTitle) ||
    /\bmoroccan\b|\blebanese\b|\bsyrian\b|\bsaudi\b|\btunisian\b|\bturkish\b|\bkabsa\b|\bshawarma\b|\bmaqluba\b|\btagine\b/.test(normalizedTitle)
  ) {
    return 'arab';
  }

  return 'international';
}

function getCoreRecipeKey(title: string): string {
  const norm = normalize(title)
    .replace(/(?:علي|على)\s+الطريق[هة]\s+\S+(?:\s+\S+)?/g, '')
    .replace(/بالطريق[هة]\s+\S+(?:\s+\S+)?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = norm.split(/\s+/).filter(Boolean);
  return tokens.slice(0, 3).join('_') || norm;
}

export function sortAndDedupeOnlineRecipes<T extends { title: string; cuisine?: CuisineTier; _relevanceScore?: number }>(recipes: T[]): T[] {
  const sorted = [...recipes].sort((a, b) => {
    const rankA = CUISINE_PRIORITY[a.cuisine || 'international'];
    const rankB = CUISINE_PRIORITY[b.cuisine || 'international'];
    if (rankA !== rankB) return rankA - rankB;
    return (b._relevanceScore || 0) - (a._relevanceScore || 0);
  });
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const recipe of sorted) {
    const exactKey = normalize(recipe.title);
    const coreKey = getCoreRecipeKey(recipe.title);
    if (!exactKey || seen.has(exactKey) || seen.has(coreKey)) continue;
    seen.add(exactKey);
    seen.add(coreKey);
    deduped.push(recipe);
  }
  return deduped;
}

async function getEnglishSearchTerms(term: string): Promise<string[]> {
  const aliasMatches = expandArabicAliasesToEnglishTerms(term);
  const terms: string[] = [...aliasMatches];

  if (hasArabic(term)) {
    try {
      const translated = await translateText(term, 'ar', 'en');
      if (translated.trim()) {
        terms.push(translated.trim());
        // Extract significant English content tokens if full phrase is multi-word
        const tokens = translated
          .toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(tok => tok.length > 2 && !['with', 'and', 'the', 'style', 'dish', 'recipe', 'fried', 'baked', 'grilled'].includes(tok));
        terms.push(...tokens);
      }
    } catch {
      // Keep alias-expanded terms even if translation endpoint throttles
    }
  } else {
    terms.push(term.trim());
    const tokens = term
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(tok => tok.length > 2);
    terms.push(...tokens);
  }

  return expandEnglishSynonyms(terms).slice(0, 5);
}

export function scaleMeasure(measure: string, familySize: number, baseServings = 4): string {
  const match = measure.match(/^\s*(\d+\/\d+|\d+(?:\.\d+)?(?:\s+\d+\/\d+)?)(.*)$/);
  if (!match) return measure;
  const amount = match[1].trim().split(/\s+/).reduce((total, part) => {
    if (!part.includes('/')) return total + Number(part);
    const [numerator, denominator] = part.split('/').map(Number);
    return total + (denominator ? numerator / denominator : 0);
  }, 0);
  if (!Number.isFinite(amount) || amount <= 0) return measure;
  return (Math.round(amount * Math.max(1, Math.min(30, Math.round(familySize))) / baseServings * 100) / 100).toString() + ' ' + match[2].trim();
}

function extractMealIngredientNames(meal: MealDbMeal): string {
  const parts: string[] = [];
  for (let index = 1; index <= 20; index += 1) {
    const ingredient = meal[`strIngredient${index}`]?.trim();
    if (ingredient) parts.push(ingredient);
  }
  return parts.join(' ');
}

async function mapMeal(meal: MealDbMeal, _familySize: number): Promise<OnlineRecipe> {
  const ingredients: string[] = [];
  for (let index = 1; index <= 20; index += 1) {
    const ingredient = meal[`strIngredient${index}`]?.trim();
    const measure = meal[`strMeasure${index}`]?.trim();
    if (ingredient) ingredients.push(`• ${ingredient}${measure ? ` — ${measure}` : ''}`);
  }
  const instructions = (meal.strInstructions || '').replace(/\r/g, '').trim();
  const rawExtract = `${ingredients.length ? `المكونات:\n${ingredients.join('\n')}\n\n` : ''}طريقة التحضير:\n${instructions || 'راجع صفحة المصدر للتعليمات.'}`;
  let arabicTitle = '';
  let arabicExtract = '';
  try {
    const [translatedTitle, translatedExtract] = await Promise.all([
      translateText(meal.strMeal, 'en', 'ar'),
      translateText(rawExtract, 'en', 'ar'),
    ]);
    arabicTitle = cleanTranslatedArabicTitle(applyCulinaryDictionaryToArabic(translatedTitle));
    arabicExtract = applyCulinaryDictionaryToArabic(translatedExtract);
  } catch {
    arabicTitle = cleanTranslatedArabicTitle(applyCulinaryDictionaryToArabic(meal.strMeal));
    arabicExtract = applyCulinaryDictionaryToArabic(rawExtract);
  }
  if (!hasArabic(arabicTitle) || !hasArabic(arabicExtract)) throw new Error('تعذر تجهيز الوصفة باللغة العربية.');
  return {
    title: arabicTitle,
    servings: 4,
    pageId: Number(meal.idMeal),
    cuisine: detectMealDbCuisineTier(meal.strArea, `${meal.strMeal} ${arabicTitle}`),
    url: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`,
    imageUrl: meal.strMealThumb,
    imageCredit: 'TheMealDB',
    imageLicense: 'راجع مصدر الوصفة الأصلي وشروط استخدام الصورة',
    extract: arabicExtract || rawExtract,
  };
}

function localSeedRecipeToOnline(recipe: Recipe, baseServings = recipe.baseServings): OnlineRecipe {
  const ingredientsText = recipe.ingredients.map(item => `• ${item.name} — ${item.quantity}`).join('\n');
  return {
    title: recipe.name,
    servings: baseServings,
    pageId: 910000 + Math.abs(recipe.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)),
    cuisine: recipe.cuisine || detectMealDbCuisineTier(undefined, `${recipe.name} ${recipe.tags.join(' ')}`),
    url: 'https://www.themealdb.com/',
    imageUrl: recipe.imageUrl || undefined,
    imageCredit: recipe.imageUrl ? 'صورة الوصفة المحفوظة في تدبيرة' : undefined,
    extract: `المكونات (المقادير الأساسية لـ ${baseServings} أفراد):\n${ingredientsText}\n\nطريقة التحضير:\n${recipe.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`,
  };
}

export const QUICK_SEARCH_SUGGESTIONS = [
  'معجنات',
  'دجاج مسحب',
  'ديك رومي',
  'كبيبة',
  'نجرسكو',
  'حلويات',
] as const;

export function findBundledEgyptianRecipes(term: string): OnlineRecipe[] {
  return RECIPES
    .map(recipe => ({
      recipe,
      score: scoreRecipeDishRelevance(
        term,
        recipe.name,
        [],
        recipe.tags,
        recipe.ingredients.map(i => i.name).join(' ')
      ),
    }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 14)
    .map(entry => ({
      ...localSeedRecipeToOnline(entry.recipe, entry.recipe.baseServings),
      _relevanceScore: entry.score,
    }));
}

export function findCuratedLocalMatches(term: string, bundledMatches: OnlineRecipe[], familySize = 4): OnlineRecipe[] {
  return searchEgyptianArabicCatalog(term, familySize).map(recipe => {
    const bundledPhoto = bundledMatches.find(b => normalize(b.title) === normalize(recipe.title))?.imageUrl;
    return {
      ...recipe,
      imageUrl: recipe.imageUrl || bundledPhoto,
    };
  });
}

export function searchAllLocalArabicRecipes(term: string, familySize = 4): OnlineRecipe[] {
  const bundledMatches = findBundledEgyptianRecipes(term);
  const curatedMatches = findCuratedLocalMatches(term, bundledMatches, familySize);
  return sortAndDedupeOnlineRecipes([...curatedMatches, ...bundledMatches]);
}

async function queryOnlineTranslatedRecipes(term: string, familySize: number): Promise<OnlineRecipe[]> {
  const englishTerms = await getEnglishSearchTerms(term);
  if (englishTerms.length === 0) return [];

  const fullMealsById = new Map<string, MealDbMeal>();
  const ingredientStubIds: string[] = [];
  const seenStubIds = new Set<string>();

  const singleWordTerms = englishTerms.filter(t => !t.includes(' ')).slice(0, 3);
  const searchRequests = englishTerms.slice(0, 4).map(async qTerm => {
    const mealUrl = new URL(MEAL_DB_API);
    mealUrl.searchParams.set('s', qTerm);
    const res = await fetch(mealUrl.toString());
    if (!res.ok) return [] as MealDbMeal[];
    const data = await res.json();
    return (Array.isArray(data?.meals) ? data.meals : []) as MealDbMeal[];
  });

  const filterRequests = singleWordTerms.map(async ingredientTerm => {
    const filterUrl = new URL(MEAL_DB_FILTER_API);
    filterUrl.searchParams.set('i', ingredientTerm);
    const res = await fetch(filterUrl.toString());
    if (!res.ok) return [] as Array<{ idMeal: string }>;
    const data = await res.json();
    return (Array.isArray(data?.meals) ? data.meals : []) as Array<{ idMeal: string }>;
  });

  const [searchSettled, filterSettled] = await Promise.all([
    Promise.allSettled(searchRequests),
    Promise.allSettled(filterRequests),
  ]);

  for (const outcome of searchSettled) {
    if (outcome.status === 'fulfilled') {
      for (const meal of outcome.value) {
        if (meal?.idMeal && !fullMealsById.has(meal.idMeal)) {
          fullMealsById.set(meal.idMeal, meal);
        }
      }
    }
  }

  for (const outcome of filterSettled) {
    if (outcome.status === 'fulfilled') {
      for (const stub of outcome.value) {
        if (stub?.idMeal && !fullMealsById.has(stub.idMeal) && !seenStubIds.has(stub.idMeal)) {
          seenStubIds.add(stub.idMeal);
          ingredientStubIds.push(stub.idMeal);
        }
      }
    }
  }

  if (ingredientStubIds.length > 0) {
    const lookupSettled = await Promise.allSettled(
      ingredientStubIds.slice(0, 6).map(async idMeal => {
        const lookupUrl = new URL(MEAL_DB_LOOKUP_API);
        lookupUrl.searchParams.set('i', idMeal);
        const res = await fetch(lookupUrl.toString());
        if (!res.ok) return null;
        const data = await res.json();
        return Array.isArray(data?.meals) && data.meals[0] ? (data.meals[0] as MealDbMeal) : null;
      })
    );
    for (const outcome of lookupSettled) {
      if (outcome.status === 'fulfilled' && outcome.value?.idMeal) {
        fullMealsById.set(outcome.value.idMeal, outcome.value);
      }
    }
  }

  const relevantMeals = Array.from(fullMealsById.values()).filter(meal => {
    const mealTitle = meal.strMeal || '';
    const ingredientsText = extractMealIngredientNames(meal);
    return englishTerms.some(qTerm => {
      const qWords = qTerm.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      if (qWords.length >= 2) {
        const combined = `${mealTitle} ${ingredientsText}`.toLowerCase();
        return qWords.every(w => combined.includes(w));
      }
      return isRelevantRecipe(qTerm, mealTitle, '');
    });
  });

  const translatedOnlineSettled = await Promise.allSettled(
    relevantMeals.slice(0, 8).map(meal => mapMeal(meal, familySize))
  );
  let onlineResults: OnlineRecipe[] = translatedOnlineSettled.flatMap(item =>
    item.status === 'fulfilled' ? [item.value] : []
  );

  if (onlineResults.length === 0) {
    const primaryEnglish = englishTerms[0];
    const wikiUrl = new URL(WIKIBOOKS_API);
    wikiUrl.search = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: `"${primaryEnglish}" recipe OR cookbook`,
      srlimit: '8',
      format: 'json',
      origin: '*',
    }).toString();
    const wikiResponse = await fetch(wikiUrl.toString());
    if (wikiResponse.ok) {
      const wikiData = await wikiResponse.json();
      const hits = (wikiData.query?.search || []) as Array<{ title: string; pageid: number; snippet?: string }>;
      const recipeHits = hits.filter(hit =>
        /cookbook:/i.test(hit.title) &&
        englishTerms.some(qTerm => isRelevantRecipe(qTerm, hit.title, hit.snippet || ''))
      );
      if (recipeHits.length) {
        const pageUrl = new URL(WIKIBOOKS_API);
        pageUrl.search = new URLSearchParams({
          action: 'query', prop: 'extracts', explaintext: '1', exchars: '7000',
          pageids: recipeHits.slice(0, 8).map(hit => String(hit.pageid)).join('|'),
          format: 'json', origin: '*',
        }).toString();
        const pageResponse = await fetch(pageUrl.toString());
        if (pageResponse.ok) {
          const pageData = await pageResponse.json();
          const wikiPages = (Object.values(pageData.query?.pages || {}) as Array<{ pageid: number; title: string; extract?: string }>)
            .filter(page => (page.extract || '').trim().length > 100 &&
              englishTerms.some(qTerm => isRelevantRecipe(qTerm, page.title, page.extract || '')) &&
              /ingredient|ingredients|method|preheat|cook|bake|fry|mix|stir|serve/i.test(page.extract || '') &&
              /ingredient|flour|salt|oil|water|onion|tomato|meat|chicken|egg|rice|sugar|milk|shrimp|fish|turkey|kibbeh/i.test(page.extract || '')
            );
          const translatedPages = await Promise.allSettled(wikiPages.map(async page => {
            const rawTitle = page.title.replace(/^Cookbook:/i, '').replace(/_/g, ' ');
            const [translatedTitle, translatedExtract] = await Promise.all([
              translateText(rawTitle, 'en', 'ar'),
              translateText((page.extract || '').trim(), 'en', 'ar'),
            ]);
            const title = cleanTranslatedArabicTitle(applyCulinaryDictionaryToArabic(translatedTitle));
            const extract = applyCulinaryDictionaryToArabic(translatedExtract);
            if (!hasArabic(title) || !hasArabic(extract)) throw new Error('تعذر ترجمة الوصفة إلى العربية.');
            return {
              title,
              servings: 4,
              pageId: page.pageid,
              cuisine: detectMealDbCuisineTier(undefined, `${page.title} ${title}`),
              url: `https://en.wikibooks.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
              extract: `المقادير محسوبة لـ ${familySize} أفراد تقريبًا.\n\n${extract}`,
            };
          }));
          onlineResults = translatedPages.flatMap(item =>
            item.status === 'fulfilled' ? [item.value] : [],
          );
        }
      }
    }
  }

  return sortAndDedupeOnlineRecipes(onlineResults);
}

/**
 * Deterministic 3-Tier Guaranteed Arabic Recipe Pipeline:
 * 1. Tier 1: Built-in 160+ Egyptian & Arab catalog + bundled recipes.
 * 2. Tier 2: Smart online search & Arabic translation when Tier 1 returns < 2 matches.
 * 3. Tier 3: Dynamic Arabic Home Recipe Synthesizer tailored to the query (zero dead-ends).
 */
export async function resolveGuaranteedArabicRecipes(
  rawTerm: string,
  familySize = 4,
  onlineLookup?: (term: string, englishTerms: string[]) => Promise<OnlineRecipe[]>
): Promise<OnlineRecipe[]> {
  const term = rawTerm.trim();
  if (!term) return [];

  // Tier 1: Comprehensive Egyptian & Arab local database
  const localMerged = searchAllLocalArabicRecipes(term, familySize);
  if (localMerged.length >= 2) {
    return localMerged;
  }

  // Tier 2: Smart online search when Tier 1 returns fewer than 2 matches
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (!isOffline) {
    try {
      const onlineResults = onlineLookup
        ? await onlineLookup(term, expandArabicAliasesToEnglishTerms(term))
        : await queryOnlineTranslatedRecipes(term, familySize);
      const merged = sortAndDedupeOnlineRecipes([...localMerged, ...onlineResults]);
      if (merged.length > 0) {
        return merged;
      }
    } catch {
      if (localMerged.length > 0) {
        return localMerged;
      }
    }
  }

  if (localMerged.length > 0) {
    return localMerged;
  }

  // Tier 3: Dynamic Arabic Home Recipe Synthesizer (100% guarantee, never returns empty)
  return [synthesizeDynamicArabicRecipe(term, familySize)];
}

export function OnlineRecipeSearch({ familySize = 4, onBack }: { familySize?: number; onBack?: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OnlineRecipe[]>([]);
  const [selected, setSelected] = useState<OnlineRecipe | null>(null);
  const [saved, setSaved] = useState<OnlineRecipe[]>(readSaved);
  const [showSaved, setShowSaved] = useState(false);
  const [loading, setLoading] = useState(false);
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
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(saved)); } catch { /* storage may be full */ }
  }, [saved]);

  const searchForTerm = async (rawTerm: string) => {
    const term = rawTerm.trim();
    if (!term || loading) return;
    setLoading(true);
    setSelected(null);
    setShowSaved(false);
    setResults([]);

    try {
      const resolved = await resolveGuaranteedArabicRecipes(term, familySize);
      setResults(resolved);
    } catch {
      const localMatches = searchAllLocalArabicRecipes(term, familySize);
      setResults(localMatches.length > 0 ? localMatches : [synthesizeDynamicArabicRecipe(term, familySize)]);
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
    } catch { /* recognition may already have stopped */ }
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
        voiceListenersRef.current.forEach(listener => { void listener.remove(); });
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
          const reason = event.error === 'no-speech' ? 'ملقطناش صوت. اتكلم بوضوح وجرب تاني.' :
            event.error === 'network' ? 'خدمة التعرف على الكلام محتاجة إنترنت.' :
            event.error === 'not-allowed' ? 'إذن الميكروفون غير متاح. فعّله من إعدادات التطبيق.' :
            'تعذر تشغيل الميكروفون. تأكد من توفر خدمة التعرف على الكلام على جهازك.';
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
        setVoiceMessage(event.error === 'not-allowed' ? 'فعّل إذن الميكروفون من إعدادات الجهاز.' : 'تعذر سماع طلبك. حاول مرة أخرى.');
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

  const speakRecipe = async (recipe: OnlineRecipe) => {
    const sections = parseRecipeSections(recipe.extract, familySize, recipe.servings || 4);
    const segments = buildEgyptianRecipeSpeechSegments(
      recipe.title,
      familySize,
      sections.ingredients,
      sections.steps
    );
    await speechPlayerRef.current?.speakSegments(segments, {
      isNative: Capacitor.isNativePlatform(),
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: (msg) => {
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
      void recipeVoice.addListener('speechPlaybackStatus', event => {
        if (event.status === 'completed' || event.status === 'stopped' || event.status === 'error') setSpeaking(false);
        if (event.status === 'speaking') setSpeaking(true);
      }).then(listener => { playbackListener = listener; });
    }
    return () => {
      try { recognitionRef.current?.stop?.(); } catch {}
      void speechPlayerRef.current?.stop();
      voiceListenersRef.current.forEach(listener => { void listener.remove(); });
      if (playbackListener) void playbackListener.remove();
      if (Capacitor.isNativePlatform()) {
        void recipeVoice.stopListening();
      }
    };
  }, []);

  const saveRecipe = (recipe: OnlineRecipe) => {
    setSaved(current => current.some(item => item.pageId === recipe.pageId) ? current : [recipe, ...current]);
  };
  const removeSaved = (pageId: number) => setSaved(current => current.filter(item => item.pageId !== pageId));
  const currentItems = showSaved ? saved : results;

  return (
    <section dir="rtl" className="min-h-full space-y-3" aria-label="البحث الصوتي عن الوصفات أونلاين">
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
            <h3 className="text-base font-black text-[#4A353B]">مساعد الوصفات الصوتي 🎙️</h3>
            <p className="mt-0.5 text-[11px] leading-5 text-[#8E757C]">ابحث بالكلام أو الكتابة، واسمع المكونات وطريقة التحضير بالعربي.</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-[#8E757C] tabular-nums">لأسرة من {familySize} أفراد</span>
        <button
          type="button"
          onClick={() => { setShowSaved(value => !value); setSelected(null); }}
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
              maxLength={80}
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
              {loading ? 'جاري البحث…' : <><Search className="inline h-4 w-4 ml-1" /> ابحث</>}
            </button>
          </form>

          {/* Powder Pink Quick-Search Suggestion Chips */}
          <div className="flex flex-wrap items-center gap-1.5" aria-label="اقتراحات بحث سريعة">
            {QUICK_SEARCH_SUGGESTIONS.map(chip => {
              const isActive = normalize(query) === normalize(chip);
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

      {voiceMessage && <p role="status" className="clay-card-soft p-3 text-xs leading-6 text-[#4A353B]">{voiceMessage}</p>}

      {currentItems.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {currentItems.map(item => {
            const badge = CUISINE_BADGE_META[item.cuisine || 'international'];
            const hasImage = Boolean(item.imageUrl) && !brokenImages[item.pageId];
            return (
              <button
                key={item.pageId}
                type="button"
                onClick={() => setSelected(item)}
                className={`clay-card clay-tactile flex items-center gap-3 p-3 text-right hover:border-[#D47E93] ${
                  selected?.pageId === item.pageId
                    ? 'border-[#D47E93] ring-1 ring-[#D47E93]/35'
                    : ''
                }`}
              >
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#FADDE4]/40 border border-[#F3DCE2]">
                  {hasImage ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={() => setBrokenImages(prev => ({ ...prev, [item.pageId]: true }))}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <RecipeIllustration recipeName={item.title} className="h-full w-full" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 flex-1 text-xs font-extrabold leading-5 text-[#4A353B] line-clamp-2">
                      {item.title}
                    </span>
                    <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                  <span className="mt-1 block text-[10px] font-medium text-[#C96D84]">
                    اضغط لعرض المقادير والطريقة كاملة ←
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (() => {
        const badge = CUISINE_BADGE_META[selected.cuisine || 'international'];
        const sections = parseRecipeSections(selected.extract, familySize, selected.servings || 4);
        const hasValidImage = Boolean(selected.imageUrl) && !brokenImages[selected.pageId];
        const hasExternalSource = Boolean(selected.url) && selected.url !== 'https://www.themealdb.com/';

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
                <div className="flex items-center gap-2">
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${badge.className}`}>
                    {badge.label}
                  </span>
                  <span className="text-[11px] font-semibold text-[#8E757C]">
                    لأسرة من {familySize} أفراد
                  </span>
                </div>
                <h4
                  id="online-recipe-fullscreen-title"
                  className="mt-1 text-base font-black leading-snug text-[#4A353B] line-clamp-2"
                >
                  {selected.title}
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
                      alt={selected.title}
                      referrerPolicy="no-referrer"
                      onError={() => setBrokenImages(prev => ({ ...prev, [selected.pageId]: true }))}
                      className="h-56 w-full object-cover sm:h-64"
                    />
                  ) : (
                    <div className="flex h-48 w-full items-center justify-center bg-[#FADDE4]/35 p-4">
                      <RecipeIllustration recipeName={selected.title} className="h-36 w-36" />
                    </div>
                  )}
                </div>

                <div className="clay-card-soft flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-bold text-[#4A353B]">
                  <span>المقادير والكميات محسوبة ومضبوطة لـ {familySize} أفراد</span>
                  {selected.prepTime && (
                    <span className="text-[11px] font-extrabold text-[#C96D84]">⏱️ مدة التحضير: {selected.prepTime}</span>
                  )}
                </div>

                {sections.ingredients.length > 0 && (
                  <section className="clay-card p-4">
                    <h5 className="mb-2.5 text-sm font-black text-[#4A353B]">المكونات المطلوبة</h5>
                    <ul className="space-y-2 text-sm leading-7 text-[#4A353B]">
                      {sections.ingredients.map((ingredient, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#D47E93]" aria-hidden="true" />
                          <span>{ingredient}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

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

                {selected.imageUrl && !brokenImages[selected.pageId] && (
                  <p className="text-[10px] leading-5 text-[#8E757C]">
                    الصورة: {selected.imageCredit || 'TheMealDB'} — {selected.imageLicense || 'راجع المصدر الأصلي'}
                  </p>
                )}
              </div>
            </div>

            {/* Sticky Bottom Controls Bar */}
            <footer className="shrink-0 border-t border-[#F3DCE2] bg-[#FFFFFF]/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-sm">
              <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void (speaking ? stopRecipeSpeech() : speakRecipe(selected))}
                  className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 px-4 py-2 text-xs font-extrabold ${
                    speaking ? 'rounded-xl bg-red-600 hover:bg-red-700 text-white transition' : 'clay-btn-primary'
                  }`}
                >
                  {speaking ? <><VolumeX className="h-4 w-4 shrink-0" /> إيقاف الاستماع</> : <><Volume2 className="h-4 w-4 shrink-0" /> اسمع الوصفة</>}
                </button>
                <button
                  type="button"
                  onClick={() => saveRecipe(selected)}
                  className="clay-btn-secondary clay-tactile min-h-[44px] px-3.5 py-2 text-xs font-extrabold text-[#C96D84]"
                >
                  {saved.some(item => item.pageId === selected.pageId) ? '✓ محفوظة' : '☆ احفظ الوصفة'}
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

      {!loading && showSaved && saved.length === 0 && <p className="clay-card-cream p-4 text-center text-xs text-[#8E757C]">لسه مفيش وصفات أونلاين محفوظة.</p>}
      {!loading && !showSaved && results.length === 0 && <p className="text-[10px] leading-5 text-[#8E757C]">اكتب اسم الأكلة أو اختر من الاقتراحات السريعة، وهتظهرلك الوصفة بالمقادير والخطوات فوراً.</p>}
    </section>
  );
}
