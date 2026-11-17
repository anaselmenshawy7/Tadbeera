import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Check, ExternalLink, Eye, SlidersHorizontal, X } from 'lucide-react';
import { RECIPES } from '../../data/seedData';
import { RecipeIllustration } from '../../components/RecipeIllustration';
import {
  CUISINE_BADGE_META,
  detectMealDbCuisineTier,
  type CuisineTier,
} from './OnlineRecipeSearch';

type Meal = {
  idMeal: string;
  strMeal: string;
  strArea?: string;
  strMealThumb?: string;
  strInstructions?: string;
  strSource?: string;
  [key: string]: string | undefined;
};

type IngredientItem = {
  text: string;
  available: boolean;
};

export type IngredientFinderResult = {
  id: string;
  title: string;
  image?: string;
  cuisine: CuisineTier;
  ingredients: string[];
  ingredientBreakdown: IngredientItem[];
  isLocal?: boolean;
  matched: number;
  total: number;
  missing: string[];
  instructions: string;
  url: string;
};

const API = 'https://www.themealdb.com/api/json/v1/1';
const ONLINE_FETCH_TIMEOUT_MS = 3000;

const CUISINE_PRIORITY: Record<CuisineTier, number> = {
  egyptian: 0,
  arab: 1,
  international: 2,
};

const INGREDIENTS: Record<string, string> = {
  'رز': 'rice', 'ارز': 'rice', 'أرز': 'rice', 'مكرونة': 'pasta', 'بتنجان': 'aubergine', 'باذنجان': 'aubergine',
  'بطاطس': 'potatoes', 'بصل': 'onion', 'طماطم': 'tomato', 'ثوم': 'garlic', 'بيض': 'eggs',
  'فراخ': 'chicken', 'دجاج': 'chicken', 'بواقي فراخ': 'chicken', 'لحمة': 'beef', 'لحم': 'beef', 'بواقي لحمة': 'beef',
  'سمك': 'fish', 'جمبري': 'shrimp', 'سبيط': 'squid', 'كاليماري': 'squid', 'تونة': 'tuna',
  'فلفل': 'pepper', 'فلفل رومي': 'pepper', 'جزر': 'carrots', 'كوسة': 'courgette',
  'عدس': 'lentils', 'عدس اصفر': 'lentils', 'عدس بجبة': 'lentils', 'عدس بجبه': 'lentils',
  'حمص': 'chickpeas', 'فول': 'broad beans', 'سبانخ': 'spinach', 'جبنة': 'cheese', 'جبنه': 'cheese', 'لبن': 'milk',
};

const normalize = (s: string) =>
  s.toLocaleLowerCase('ar').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[\u064B-\u065F]/g, '').trim();

const normalizeText = (s: string) =>
  normalize(s).toLowerCase().replace(/\s+/g, ' ');

/**
 * Strips leftover Latin/foreign script prefixes from translated recipe titles
 * (e.g., "Kaspressknödel - كاسبريسنودل" -> "كاسبريسنودل") so only clean Arabic dish names appear.
 */
export function cleanTranslatedArabicTitle(rawTitle: string): string {
  const trimmed = (rawTitle || '').trim();
  if (!trimmed) return '';
  if (!/[\u0600-\u06FF]/.test(trimmed)) return trimmed;

  let cleaned = trimmed
    // Strip leading Latin/accented prefix followed by separator (-, –, —, :, |, /)
    .replace(/^[A-Za-z0-9\u00C0-\u024F\s'’"().,!?&]+[-–—:|/]+\s*/u, '')
    // Strip trailing parenthesized foreign text e.g. "(Kaspressknödel)"
    .replace(/\s*\([A-Za-z0-9\u00C0-\u024F\s'’".,!?-]+\)\s*$/u, '')
    // Strip standalone leading Latin words before Arabic text
    .replace(/^(?:[A-Za-z\u00C0-\u024F'’.-]+\s+)+(?=[\u0600-\u06FF])/u, '')
    .replace(/^[-–—:|/\s]+|[-–—:|/\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || trimmed;
}

type LocalRecipeEntry = {
  id: string;
  name: string;
  cuisine: CuisineTier;
  imageUrl?: string;
  ingredients: Array<{ label: string; aliases: string[] }>;
  instructions: string;
};

const CURATED_LOCAL_BASICS: LocalRecipeEntry[] = [
  {
    id: 'local-moussaka',
    name: 'مسقعة مصرية',
    cuisine: 'egyptian',
    ingredients: [
      { label: 'باذنجان', aliases: ['بتنجان', 'باذنجان'] },
      { label: 'طماطم', aliases: ['طماطم'] },
      { label: 'بصل', aliases: ['بصل'] },
      { label: 'ثوم', aliases: ['ثوم'] },
    ],
    instructions: 'قطّع البتنجان وحمّره أو اشوه. حضّر صلصة من البصل والثوم والطماطم، ثم رصّ البتنجان معها واتركه يتسبك.',
  },
  {
    id: 'local-potato-sauce',
    name: 'بطاطس بالصلصة',
    cuisine: 'egyptian',
    ingredients: [
      { label: 'بطاطس', aliases: ['بطاطس'] },
      { label: 'طماطم', aliases: ['طماطم'] },
      { label: 'بصل', aliases: ['بصل'] },
      { label: 'ثوم', aliases: ['ثوم'] },
    ],
    instructions: 'شوّح البصل والثوم، أضف الطماطم والتوابل ثم البطاطس والماء واتركها حتى تنضج.',
  },
  {
    id: 'local-koshari',
    name: 'كشري مصري',
    cuisine: 'egyptian',
    ingredients: [
      { label: 'أرز', aliases: ['رز', 'ارز', 'أرز'] },
      { label: 'مكرونة', aliases: ['مكرونة'] },
      { label: 'بصل', aliases: ['بصل'] },
      { label: 'طماطم', aliases: ['طماطم'] },
      { label: 'عدس', aliases: ['عدس', 'عدس بجبة'] },
      { label: 'حمص', aliases: ['حمص'] },
    ],
    instructions: 'اسلق العدس والأرز والمكرونة كلًّا على حدة. حضّر صلصة الطماطم وحمّر البصل وقدّم المكونات معًا.',
  },
  {
    id: 'local-shakshouka',
    name: 'شكشوكة',
    cuisine: 'egyptian',
    ingredients: [
      { label: 'بيض', aliases: ['بيض'] },
      { label: 'طماطم', aliases: ['طماطم'] },
      { label: 'بصل', aliases: ['بصل'] },
      { label: 'فلفل', aliases: ['فلفل', 'فلفل رومي'] },
    ],
    instructions: 'شوّح البصل والفلفل، أضف الطماطم حتى تتسبك، ثم أضف البيض واتركه حتى ينضج.',
  },
  {
    id: 'local-potato-eggplant',
    name: 'صينية بطاطس بالباذنجان',
    cuisine: 'egyptian',
    ingredients: [
      { label: 'بطاطس', aliases: ['بطاطس'] },
      { label: 'باذنجان', aliases: ['بتنجان', 'باذنجان'] },
      { label: 'طماطم', aliases: ['طماطم'] },
      { label: 'بصل', aliases: ['بصل'] },
    ],
    instructions: 'قطّع الخضروات ورصّها في صينية مع عصير الطماطم والبصل والتوابل، ثم اخبزها حتى تنضج.',
  },
];

function buildExpandedLocalLibrary(): LocalRecipeEntry[] {
  const seenNames = new Set<string>(CURATED_LOCAL_BASICS.map((item) => normalizeText(item.name)));
  const fromSeed: LocalRecipeEntry[] = [];

  for (const recipe of RECIPES) {
    const normName = normalizeText(recipe.name);
    if (!normName || seenNames.has(normName)) continue;
    seenNames.add(normName);

    const detectedCuisine = recipe.cuisine || detectMealDbCuisineTier(undefined, `${recipe.name} ${recipe.tags.join(' ')}`);
    const finalCuisine: CuisineTier =
      detectedCuisine === 'international' ? 'egyptian' : detectedCuisine;

    fromSeed.push({
      id: `local-${recipe.id}`,
      name: recipe.name,
      cuisine: finalCuisine,
      imageUrl: recipe.imageUrl || undefined,
      ingredients: recipe.ingredients.map((ing) => {
        const words = normalizeText(ing.name).split(' ').filter((w) => w.length > 2);
        return {
          label: `${ing.name}${ing.quantity ? ` (${ing.quantity})` : ''}`,
          aliases: Array.from(new Set([ing.name, ...words])),
        };
      }),
      instructions: recipe.steps.map((s, idx) => `${idx + 1}. ${s}`).join('\n'),
    });
  }

  return [...CURATED_LOCAL_BASICS, ...fromSeed];
}

const EXPANDED_LOCAL_RECIPES = buildExpandedLocalLibrary();

// Cache online results per sorted normalized ingredient signature for instant repeat taps
const onlineIngredientCache = new Map<string, IngredientFinderResult[]>();

async function fetchWithTimeout(url: string, timeoutMs = ONLINE_FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timer);
  }
}

async function translate(value: string): Promise<string> {
  try {
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.search = new URLSearchParams({ client: 'gtx', sl: 'ar', tl: 'en', dt: 't', q: value }).toString();
    const response = await fetchWithTimeout(url.toString(), ONLINE_FETCH_TIMEOUT_MS);
    if (!response.ok) throw new Error('translation-failed');
    const data = await response.json();
    return Array.isArray(data?.[0]) ? data[0].map((part: unknown[]) => (typeof part?.[0] === 'string' ? part[0] : '')).join('') : value;
  } catch {
    return value;
  }
}

export function scaleMeasure(value: string, familySize: number, baseServings = 4): string {
  const match = value.match(/^\s*(\d+\/\d+|\d+(?:\.\d+)?(?:\s+\d+\/\d+)?)(.*)$/);
  if (!match) return value;
  const amount = match[1].trim().split(/\s+/).reduce((total, part) => {
    if (!part.includes('/')) return total + Number(part);
    const [numerator, denominator] = part.split('/').map(Number);
    return total + (denominator ? numerator / denominator : 0);
  }, 0);
  if (!Number.isFinite(amount) || amount <= 0) return value;
  return (Math.round(((amount * Math.max(1, Math.min(30, Math.round(familySize)))) / baseServings) * 100) / 100).toString() + ' ' + match[2].trim();
}

async function translateToArabic(value: string): Promise<string> {
  if (!value.trim()) return '';
  try {
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.search = new URLSearchParams({ client: 'gtx', sl: 'en', tl: 'ar', dt: 't', q: value.slice(0, 4500) }).toString();
    const response = await fetchWithTimeout(url.toString(), ONLINE_FETCH_TIMEOUT_MS);
    if (!response.ok) throw new Error('translation-failed');
    const data = await response.json();
    const translated = Array.isArray(data?.[0]) ? data[0].map((part: unknown[]) => (typeof part?.[0] === 'string' ? part[0] : '')).join('') : '';
    if (!translated.trim() || !/[\u0600-\u06FF]/.test(translated)) throw new Error('arabic-translation-unavailable');
    return translated;
  } catch {
    throw new Error('تعذر ترجمة الوصفة إلى العربية');
  }
}

function getMatchPercent(item: { matched: number; total: number }): number {
  if (item.total <= 0) return 0;
  return Math.min(100, Math.round((item.matched / item.total) * 100));
}

function buildLocalResults(availableIngredients: string[]): IngredientFinderResult[] {
  const normalizedSelected = availableIngredients.map(normalizeText).filter(Boolean);

  return EXPANDED_LOCAL_RECIPES.map((recipe) => {
    const breakdown: IngredientItem[] = recipe.ingredients.map((ing) => {
      const available = ing.aliases.some((alias) => {
        const normAlias = normalizeText(alias);
        if (!normAlias) return false;
        return normalizedSelected.some(
          (sel) => sel === normAlias || sel.includes(normAlias) || normAlias.includes(sel)
        );
      });
      return { text: ing.label, available };
    });

    const matched = breakdown.filter((b) => b.available).length;
    const missing = breakdown.filter((b) => !b.available).map((b) => b.text);

    return {
      id: recipe.id,
      title: recipe.name,
      image: recipe.imageUrl,
      cuisine: recipe.cuisine,
      ingredients: breakdown.map((b) => b.text),
      ingredientBreakdown: breakdown,
      isLocal: true,
      matched,
      total: breakdown.length,
      missing,
      instructions: recipe.instructions,
      url: 'https://www.themealdb.com/',
    };
  });
}

/**
 * Enforces strict 3-tier priority (Egyptian -> Arab -> International) BEFORE
 * sorting by match percentage descending, matched count, and fewer missing items.
 */
export function sortIngredientFinderResults<
  T extends { cuisine?: CuisineTier; matched: number; total: number; missing: string[] }
>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const tierDiff = CUISINE_PRIORITY[a.cuisine || 'international'] - CUISINE_PRIORITY[b.cuisine || 'international'];
    if (tierDiff !== 0) return tierDiff;
    const percentDiff = getMatchPercent(b) - getMatchPercent(a);
    if (percentDiff !== 0) return percentDiff;
    const matchedDiff = b.matched - a.matched;
    if (matchedDiff !== 0) return matchedDiff;
    return a.missing.length - b.missing.length;
  });
}

function dedupeAndSortResults(list: IngredientFinderResult[]): IngredientFinderResult[] {
  const sorted = sortIngredientFinderResults(list);
  const seen = new Set<string>();
  const unique: IngredientFinderResult[] = [];
  for (const item of sorted) {
    const key = normalizeText(item.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

export function IngredientRecipeFinder({ availableIngredients, familySize = 4 }: { availableIngredients: string[]; familySize?: number }) {
  const [results, setResults] = useState<IngredientFinderResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cuisine, setCuisine] = useState<'all' | 'egyptian'>('all');
  const [showAllRecipes, setShowAllRecipes] = useState(false);
  const [selected, setSelected] = useState<IngredientFinderResult | null>(null);
  const [modalImageBroken, setModalImageBroken] = useState(false);

  useEffect(() => {
    setModalImageBroken(false);
  }, [selected?.id]);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelected(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected]);

  const search = async () => {
    if (!availableIngredients.length || loading) return;
    setError('');
    setSelected(null);
    setShowAllRecipes(false);

    const normalizedArabicSelected = availableIngredients.map(normalizeText).filter(Boolean);
    const cacheKey = [...normalizedArabicSelected].sort().join('|');

    // Step 1: Render matched local Egyptian & Arab recipes instantaneously (0ms)
    const localResults = buildLocalResults(availableIngredients);
    const cachedOnline = onlineIngredientCache.get(cacheKey);
    if (cachedOnline) {
      const instantCombined = dedupeAndSortResults([...localResults, ...cachedOnline]);
      setResults(instantCombined);
      if (!instantCombined.some((item) => item.matched > 0)) {
        setError('ملقيناش وصفات مطابقة لمكوناتك الحالية. جرّب إضافة مكونات تانية أو اعرض كل الوصفات.');
      }
      return;
    }

    const immediateLocal = dedupeAndSortResults(localResults);
    setResults(immediateLocal);
    setLoading(true);

    try {
      // Step 2: Cap online lookups to top 4 core ingredients in parallel with strict 3s timeout
      const coreIngredients = availableIngredients.slice(0, 4);
      const english = await Promise.all(
        coreIngredients.map(async (name) => {
          const key = normalize(name);
          return INGREDIENTS[key] || INGREDIENTS[name] || (await translate(name));
        }),
      );
      const normalizedEnglishSelected = english.map((item) => item.trim().toLowerCase()).filter(Boolean);

      const ingredientListsSettled = await Promise.allSettled(
        normalizedEnglishSelected.map(async (ingredient) => {
          const response = await fetchWithTimeout(`${API}/filter.php?i=${encodeURIComponent(ingredient)}`, ONLINE_FETCH_TIMEOUT_MS);
          if (!response.ok) return [];
          const data = await response.json();
          return (Array.isArray(data.meals) ? data.meals : []) as Array<{ idMeal: string; strMeal: string; strMealThumb?: string }>;
        }),
      );
      const ingredientLists = ingredientListsSettled.map((outcome) =>
        outcome.status === 'fulfilled' ? outcome.value : []
      );

      const matchCounts = new Map<string, number>();
      ingredientLists.forEach((list) =>
        list.forEach((meal) => {
          matchCounts.set(meal.idMeal, (matchCounts.get(meal.idMeal) || 0) + 1);
        }),
      );

      const ids = [...matchCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([id]) => id);

      const detailsSettled = await Promise.allSettled(
        ids.map(async (id) => {
          const response = await fetchWithTimeout(`${API}/lookup.php?i=${id}`, ONLINE_FETCH_TIMEOUT_MS);
          if (!response.ok) return null;
          const data = await response.json();
          return (data.meals?.[0] || null) as Meal | null;
        }),
      );

      const valid = detailsSettled.flatMap((item) => (item.status === 'fulfilled' && item.value ? [item.value] : []));
      const mappedResults = await Promise.allSettled(
        valid.map(async (meal): Promise<IngredientFinderResult> => {
          const mealEntries = Array.from({ length: 20 }, (_, i) => {
            const name = meal[`strIngredient${i + 1}`]?.trim() || '';
            const measure = meal[`strMeasure${i + 1}`]?.trim() || '';
            return {
              name,
              line: name ? `${measure} ${name}`.trim() : '',
            };
          }).filter((entry) => entry.name);

          const raw = meal.strInstructions || 'لا تتوفر طريقة التحضير في المصدر.';
          const rawIngredients = mealEntries.map((entry) => entry.line).join('\n');

          const [translatedTitle, ingredientsText, instructions] = await Promise.all([
            translateToArabic(meal.strMeal),
            translateToArabic(rawIngredients),
            translateToArabic(raw),
          ]);

          const cleanTitle = cleanTranslatedArabicTitle(translatedTitle);
          const translatedLines = ingredientsText.split('\n').map((line) => line.trim()).filter(Boolean);
          const breakdown: IngredientItem[] = translatedLines.map((line, index) => {
            const engName = (mealEntries[index]?.name || '').toLowerCase();
            const normLine = normalizeText(line);
            const matchesEnglish =
              !!engName &&
              normalizedEnglishSelected.some((sel) => engName.includes(sel) || sel.includes(engName));
            const matchesArabic = normalizedArabicSelected.some(
              (sel) => normLine.includes(sel) || sel.includes(normLine),
            );
            return {
              text: line,
              available: matchesEnglish || matchesArabic,
            };
          });

          const apiMatched = ingredientLists.filter((list) => list.some((entry) => entry.idMeal === meal.idMeal)).length;
          const breakdownMatched = breakdown.filter((b) => b.available).length;
          const total = breakdown.length || availableIngredients.length;
          const matched = Math.min(total, Math.max(breakdownMatched, apiMatched));
          const missing = breakdown.filter((b) => !b.available).map((b) => b.text);

          return {
            id: meal.idMeal,
            title: cleanTitle,
            image: meal.strMealThumb,
            cuisine: detectMealDbCuisineTier(meal.strArea, `${meal.strMeal} ${cleanTitle}`),
            ingredients: translatedLines,
            ingredientBreakdown: breakdown,
            matched,
            total,
            missing,
            instructions,
            url: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`,
          };
        }),
      );

      const mapped: IngredientFinderResult[] = mappedResults.flatMap((item) =>
        item.status === 'fulfilled' ? [item.value] : []
      );
      onlineIngredientCache.set(cacheKey, mapped);

      const unique = dedupeAndSortResults([...localResults, ...mapped]);
      setResults(unique);
      if (!unique.some((item) => item.matched > 0)) {
        setError('ملقيناش وصفات مطابقة لمكوناتك الحالية. جرّب إضافة مكونات تانية أو اعرض كل الوصفات.');
      }
    } catch {
      setResults(immediateLocal);
      if (!immediateLocal.some((item) => item.matched > 0)) {
        setError('تعذر الاتصال بمكتبة الوصفات. يمكنك عرض الوصفات المحلية أو التحقق من الإنترنت.');
      }
    } finally {
      setLoading(false);
    }
  };

  const cuisineFilteredResults = useMemo(() => {
    const base =
      cuisine === 'egyptian'
        ? results.filter((item) => item.cuisine === 'egyptian')
        : results;
    return sortIngredientFinderResults(base);
  }, [results, cuisine]);

  const matchedCount = useMemo(
    () => cuisineFilteredResults.filter((item) => item.matched > 0).length,
    [cuisineFilteredResults],
  );

  const zeroMatchCount = useMemo(
    () => cuisineFilteredResults.filter((item) => item.matched === 0).length,
    [cuisineFilteredResults],
  );

  const visibleResults = useMemo(
    () => (showAllRecipes ? cuisineFilteredResults : cuisineFilteredResults.filter((item) => item.matched > 0)),
    [cuisineFilteredResults, showAllRecipes],
  );

  const selectedAvailableIngredients = useMemo(
    () => (selected ? selected.ingredientBreakdown.filter((item) => item.available) : []),
    [selected],
  );

  const selectedMissingIngredients = useMemo(
    () => (selected ? selected.ingredientBreakdown.filter((item) => !item.available) : []),
    [selected],
  );

  const modalContent = selected ? (
    <div
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipe-detail-modal-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          setSelected(null);
        }
      }}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 backdrop-blur-[2px] sm:items-center sm:p-4"
    >
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[#E4DECF] bg-[#FBF8F1] shadow-2xl sm:rounded-3xl">
        {/* Mobile bottom-sheet grab handle */}
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-[#D8D0C0] sm:hidden" aria-hidden="true" />

        {/* Sticky Modal Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#E6DFCE] bg-[#FBF8F1] px-4 py-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${CUISINE_BADGE_META[selected.cuisine].className}`}>
                {CUISINE_BADGE_META[selected.cuisine].label}
              </span>
            </div>
            <h4 id="recipe-detail-modal-title" className="text-base font-black leading-snug text-[#1E5631]">
              {selected.title}
            </h4>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[#5C6650] tabular-nums">
              <span>
                متوفر {selected.matched} من {selected.total} مكوّن
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-bold text-[#2E7D32]">{getMatchPercent(selected)}% تطابق</span>
              <span aria-hidden="true">·</span>
              <span>لـ {familySize} أفراد</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-label="إغلاق"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-[#E4DECF] bg-white text-[#43523D] transition hover:bg-[#F1EDE2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E5631]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Details Body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
          {selected.image && !modalImageBroken ? (
            <div className="overflow-hidden rounded-2xl border border-[#E4DECF] bg-[#EFE9DA]">
              <img
                src={selected.image}
                alt={selected.title}
                referrerPolicy="no-referrer"
                onError={() => setModalImageBroken(true)}
                className="max-h-56 w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-44 w-full items-center justify-center rounded-2xl border border-[#E4DECF] bg-[#F3EBDD] p-3">
              <RecipeIllustration recipeId={selected.id} recipeName={selected.title} className="h-36 w-36" />
            </div>
          )}

          {/* Available vs. Missing Ingredients */}
          {selected.ingredientBreakdown.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h5 className="text-xs font-black text-[#1E5631]">
                  {selected.isLocal ? `المكونات الأساسية (تناسب ${familySize} أفراد)` : `المكونات المضبوطة لـ ${familySize} أفراد`}
                </h5>
                <span className="text-[11px] font-semibold text-[#68745F] tabular-nums">
                  {selectedAvailableIngredients.length} متوفر · {selectedMissingIngredients.length} ناقص
                </span>
              </div>

              {selectedAvailableIngredients.length > 0 && (
                <div className="rounded-2xl border border-[#CBE0CC] bg-[#EEF6EE] p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-[#1E5631]">
                    <Check className="h-4 w-4 shrink-0" />
                    <span>مكونات متوفرة عندك ({selectedAvailableIngredients.length})</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-[#1E4628]">
                    {selectedAvailableIngredients.map((ing, index) => (
                      <li key={index} className="flex items-start gap-2 leading-5">
                        <span className="mt-0.5 font-bold text-[#2E7D32]" aria-hidden="true">✓</span>
                        <span className="font-semibold">{scaleMeasure(ing.text, familySize)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedMissingIngredients.length > 0 ? (
                <div className="rounded-2xl border border-[#E6D9B8] bg-[#F7F0DE] p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-[#765B3A]">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>مكونات ناقصة (تحتاجها الوصفة) ({selectedMissingIngredients.length})</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-[#5E482D]">
                    {selectedMissingIngredients.map((ing, index) => (
                      <li key={index} className="flex items-start gap-2 leading-5">
                        <span className="mt-0.5 font-bold text-[#9A6B2F]" aria-hidden="true">•</span>
                        <span className="font-medium">{scaleMeasure(ing.text, familySize)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-2xl border border-[#CBE0CC] bg-[#EEF6EE] p-3 text-xs font-bold text-[#1E5631]">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>كل مكونات الوصفة متوفرة عندك — جاهزة للتحضير فوراً</span>
                </div>
              )}
            </div>
          )}

          {/* Preparation Steps */}
          <div className="space-y-2 rounded-2xl border border-[#E4DECF] bg-white p-3.5">
            <h5 className="text-xs font-black text-[#1E5631]">طريقة التحضير</h5>
            <p className="whitespace-pre-wrap text-sm leading-7 text-gray-800">{selected.instructions}</p>
          </div>

          {!selected.isLocal && (
            <div className="pt-1">
              <a
                href={selected.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[40px] items-center gap-1.5 text-xs font-bold text-[#1E5631] underline underline-offset-4 hover:text-[#2E7D32]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>المصدر الأصلي للوصفة</span>
              </a>
            </div>
          )}
        </div>

        {/* Sticky Modal Footer */}
        <div className="shrink-0 border-t border-[#E6DFCE] bg-[#FBF8F1] px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#1E5631] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#2E7D32] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E5631]"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <section dir="rtl" className="mt-3 space-y-3 rounded-2xl border border-[#DFD7C5] bg-[#FBF8F1] p-3.5">
      <div>
        <h3 className="text-sm font-black text-[#1E5631]">🍲 اطبخ بالموجود عندك</h3>
        <p className="mt-1 text-[11px] leading-5 text-[#665F52]">
          ابحث بالمكونات المتوفرة، والوصفات المصرية والعربية بتظهر فوراً مع مقادير مضبوطة لـ {familySize} أفراد.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setCuisine('all')}
          className={`min-h-[40px] whitespace-nowrap shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E5631] ${
            cuisine === 'all'
              ? 'bg-[#1E5631] text-white shadow-xs'
              : 'border border-[#DDD5C3] bg-white text-[#43523D] hover:bg-[#F5F0E5]'
          }`}
        >
          كل المطابخ
        </button>
        <button
          type="button"
          onClick={() => setCuisine('egyptian')}
          className={`min-h-[40px] whitespace-nowrap shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E5631] ${
            cuisine === 'egyptian'
              ? 'bg-[#1E5631] text-white shadow-xs'
              : 'border border-[#DDD5C3] bg-white text-[#43523D] hover:bg-[#F5F0E5]'
          }`}
        >
          أكلات مصرية
        </button>
        <button
          type="button"
          disabled={!availableIngredients.length || loading}
          onClick={search}
          className="min-h-[40px] whitespace-nowrap shrink-0 rounded-xl bg-[#2E7D32] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#1E5631] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E5631]"
        >
          {loading ? 'بنكمّل البحث أونلاين…' : 'دور بالمكونات دي'}
        </button>
      </div>

      <p className="text-[11px] text-[#6E675A]">
        المكونات المختارة: {availableIngredients.join('، ') || 'اختار مكونات البيت أولاً'}
      </p>

      {error && (
        <p role="status" className="rounded-xl border border-[#E6D9B8] bg-[#F7F0DE] p-2.5 text-xs font-medium text-[#6B502F]">
          {error}
        </p>
      )}

      {cuisineFilteredResults.length > 0 && (
        <div className="space-y-2.5 pt-1">
          {/* Smart Filter Header Bar above Results */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E6DFCE] pb-2">
            <div className="text-xs font-bold text-[#43523D] tabular-nums">
              {showAllRecipes
                ? `كل الوصفات (${cuisineFilteredResults.length})`
                : `الوصفات المناسبة لمكوناتك (${matchedCount})`}
              {loading && <span className="mr-2 text-[10px] font-medium text-[#2E7D32]">· جاري إضافة نتائج أونلاين…</span>}
            </div>

            {zeroMatchCount > 0 && (
              <button
                type="button"
                aria-pressed={showAllRecipes}
                onClick={() => setShowAllRecipes((prev) => !prev)}
                className={`inline-flex min-h-[36px] whitespace-nowrap shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E5631] ${
                  showAllRecipes
                    ? 'border-[#1E5631] bg-[#1E5631] text-white'
                    : 'border-[#D5CCB8] bg-white text-[#1E5631] hover:bg-[#F3EDE0]'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
                <span>إظهار كل الوصفات</span>
                {showAllRecipes && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            )}
          </div>

          {visibleResults.length > 0 ? (
            <div className="space-y-2">
              {visibleResults.map((item) => {
                const percent = getMatchPercent(item);
                const isSelected = selected?.id === item.id;
                const badge = CUISINE_BADGE_META[item.cuisine];

                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-white p-2.5 text-right transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E5631] ${
                      isSelected ? 'border-[#1E5631] ring-1 ring-[#1E5631]/30' : 'border-[#E6DFCE] hover:border-[#2E7D32]/60'
                    }`}
                  >
                    <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[#F3EBDD]">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.title}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <RecipeIllustration recipeId={item.id} recipeName={item.title} className="h-full w-full" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate text-xs font-extrabold text-gray-900">{item.title}</span>
                        <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap ${badge.className}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums">
                        <span className={item.matched > 0 ? 'font-bold text-[#1E5631]' : 'font-medium text-[#7B7364]'}>
                          متوفر {item.matched} من {item.total} مكوّن
                        </span>
                        <span className="text-gray-300" aria-hidden="true">·</span>
                        <span className={item.matched > 0 ? 'font-bold text-[#2E7D32]' : 'text-[#8C8373]'}>
                          {percent}% تطابق
                        </span>
                      </div>
                    </div>

                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#1E5631]">
                      <Eye className="h-3.5 w-3.5" />
                      <span>التفاصيل</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2.5 rounded-xl border border-dashed border-[#D8CFBC] bg-white p-4 text-center">
              <p className="text-xs font-semibold text-[#5C5548]">
                مفيش وصفات مطابقة للمكونات المختارة حالياً.
              </p>
              {zeroMatchCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllRecipes(true)}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#1E5631] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#2E7D32]"
                >
                  إظهار كل الوصفات ({cuisineFilteredResults.length})
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {typeof document !== 'undefined' && modalContent ? createPortal(modalContent, document.body) : modalContent}
    </section>
  );
}
