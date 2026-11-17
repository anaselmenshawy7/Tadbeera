import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Check, ChefHat, ExternalLink, Eye, SlidersHorizontal, X } from 'lucide-react';

type Meal = {
  idMeal: string;
  strMeal: string;
  strMealThumb?: string;
  strInstructions?: string;
  strSource?: string;
  [key: string]: string | undefined;
};

type IngredientItem = {
  text: string;
  available: boolean;
};

type Result = {
  id: string;
  title: string;
  image?: string;
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
const INGREDIENTS: Record<string, string> = {
  'رز': 'rice', 'ارز': 'rice', 'مكرونة': 'pasta', 'بتنجان': 'aubergine', 'باذنجان': 'aubergine',
  'بطاطس': 'potatoes', 'بصل': 'onion', 'طماطم': 'tomato', 'ثوم': 'garlic', 'بيض': 'eggs',
  'فراخ': 'chicken', 'دجاج': 'chicken', 'لحمة': 'beef', 'لحم': 'beef', 'سمك': 'fish',
  'فلفل': 'pepper', 'جزر': 'carrots', 'كوسة': 'courgette', 'عدس': 'lentils', 'حمص': 'chickpeas',
  'فول': 'broad beans', 'سبانخ': 'spinach', 'جبنة': 'cheese', 'لبن': 'milk',
};

const normalize = (s: string) =>
  s.toLocaleLowerCase('ar').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[\u064B-\u065F]/g, '').trim();

const normalizeText = (s: string) =>
  normalize(s).toLowerCase().replace(/\s+/g, ' ');

type LocalRecipeEntry = {
  name: string;
  ingredients: Array<{ label: string; aliases: string[] }>;
  instructions: string;
};

const local: LocalRecipeEntry[] = [
  {
    name: 'مسقعة مصرية',
    ingredients: [
      { label: 'باذنجان', aliases: ['بتنجان', 'باذنجان'] },
      { label: 'طماطم', aliases: ['طماطم'] },
      { label: 'بصل', aliases: ['بصل'] },
      { label: 'ثوم', aliases: ['ثوم'] },
    ],
    instructions: 'قطّع البتنجان وحمّره أو اشوه. حضّر صلصة من البصل والثوم والطماطم، ثم رصّ البتنجان معها واتركه يتسبك.',
  },
  {
    name: 'بطاطس بالصلصة',
    ingredients: [
      { label: 'بطاطس', aliases: ['بطاطس'] },
      { label: 'طماطم', aliases: ['طماطم'] },
      { label: 'بصل', aliases: ['بصل'] },
      { label: 'ثوم', aliases: ['ثوم'] },
    ],
    instructions: 'شوّح البصل والثوم، أضف الطماطم والتوابل ثم البطاطس والماء واتركها حتى تنضج.',
  },
  {
    name: 'كشري مصري',
    ingredients: [
      { label: 'أرز', aliases: ['رز', 'ارز'] },
      { label: 'مكرونة', aliases: ['مكرونة'] },
      { label: 'بصل', aliases: ['بصل'] },
      { label: 'طماطم', aliases: ['طماطم'] },
      { label: 'عدس', aliases: ['عدس'] },
      { label: 'حمص', aliases: ['حمص'] },
    ],
    instructions: 'اسلق العدس والأرز والمكرونة كلًّا على حدة. حضّر صلصة الطماطم وحمّر البصل وقدّم المكونات معًا.',
  },
  {
    name: 'شكشوكة',
    ingredients: [
      { label: 'بيض', aliases: ['بيض'] },
      { label: 'طماطم', aliases: ['طماطم'] },
      { label: 'بصل', aliases: ['بصل'] },
      { label: 'فلفل', aliases: ['فلفل'] },
    ],
    instructions: 'شوّح البصل والفلفل، أضف الطماطم حتى تتسبك، ثم أضف البيض واتركه حتى ينضج.',
  },
  {
    name: 'صينية بطاطس بالباذنجان',
    ingredients: [
      { label: 'بطاطس', aliases: ['بطاطس'] },
      { label: 'باذنجان', aliases: ['بتنجان', 'باذنجان'] },
      { label: 'طماطم', aliases: ['طماطم'] },
      { label: 'بصل', aliases: ['بصل'] },
    ],
    instructions: 'قطّع الخضروات ورصّها في صينية مع عصير الطماطم والبصل والتوابل، ثم اخبزها حتى تنضج.',
  },
];

async function translate(value: string): Promise<string> {
  try {
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.search = new URLSearchParams({ client: 'gtx', sl: 'ar', tl: 'en', dt: 't', q: value }).toString();
    const response = await fetch(url.toString());
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
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error('translation-failed');
    const data = await response.json();
    const translated = Array.isArray(data?.[0]) ? data[0].map((part: unknown[]) => (typeof part?.[0] === 'string' ? part[0] : '')).join('') : '';
    if (!translated.trim() || !/[\u0600-\u06FF]/.test(translated)) throw new Error('arabic-translation-unavailable');
    return translated;
  } catch {
    throw new Error('تعذر ترجمة الوصفة إلى العربية');
  }
}

function getMatchPercent(item: Result): number {
  if (item.total <= 0) return 0;
  return Math.min(100, Math.round((item.matched / item.total) * 100));
}

function buildLocalResults(availableIngredients: string[]): Result[] {
  const normalizedSelected = availableIngredients.map(normalizeText).filter(Boolean);

  return local.map((recipe, index) => {
    const breakdown: IngredientItem[] = recipe.ingredients.map((ing) => {
      const available = ing.aliases.some((alias) => {
        const normAlias = normalizeText(alias);
        return normalizedSelected.some((sel) => sel === normAlias || sel.includes(normAlias) || normAlias.includes(sel));
      });
      return { text: ing.label, available };
    });

    const matched = breakdown.filter((b) => b.available).length;
    const missing = breakdown.filter((b) => !b.available).map((b) => b.text);

    return {
      id: `local-${index}`,
      title: recipe.name,
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

function sortResultsByMatch(list: Result[]): Result[] {
  return [...list].sort((a, b) => {
    const percentDiff = getMatchPercent(b) - getMatchPercent(a);
    if (percentDiff !== 0) return percentDiff;
    const matchedDiff = b.matched - a.matched;
    if (matchedDiff !== 0) return matchedDiff;
    return a.missing.length - b.missing.length;
  });
}

export function IngredientRecipeFinder({ availableIngredients, familySize = 4 }: { availableIngredients: string[]; familySize?: number }) {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cuisine, setCuisine] = useState<'all' | 'egyptian'>('all');
  const [showAllRecipes, setShowAllRecipes] = useState(false);
  const [selected, setSelected] = useState<Result | null>(null);
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
    setLoading(true);
    setError('');
    setSelected(null);
    setResults([]);
    setShowAllRecipes(false);

    const normalizedArabicSelected = availableIngredients.map(normalizeText).filter(Boolean);

    try {
      const english = await Promise.all(
        availableIngredients.map(async (name) => {
          const key = normalize(name);
          return INGREDIENTS[key] || INGREDIENTS[name] || (await translate(name));
        }),
      );
      const normalizedEnglishSelected = english.map((item) => item.trim().toLowerCase()).filter(Boolean);

      const ingredientLists = await Promise.all(
        english.map(async (ingredient) => {
          const response = await fetch(`${API}/filter.php?i=${encodeURIComponent(ingredient)}`);
          if (!response.ok) return [];
          const data = await response.json();
          return (Array.isArray(data.meals) ? data.meals : []) as Array<{ idMeal: string; strMeal: string; strMealThumb?: string }>;
        }),
      );

      const matchCounts = new Map<string, number>();
      ingredientLists.forEach((list) =>
        list.forEach((meal) => {
          matchCounts.set(meal.idMeal, (matchCounts.get(meal.idMeal) || 0) + 1);
        }),
      );

      const ids = [...matchCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([id]) => id);

      const details = await Promise.all(
        ids.map(async (id) => {
          const response = await fetch(`${API}/lookup.php?i=${id}`);
          if (!response.ok) return null;
          const data = await response.json();
          return (data.meals?.[0] || null) as Meal | null;
        }),
      );

      const valid = details.filter((meal): meal is Meal => !!meal);
      const mappedResults = await Promise.allSettled(
        valid.map(async (meal) => {
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

          const [title, ingredientsText, instructions] = await Promise.all([
            translateToArabic(meal.strMeal),
            translateToArabic(rawIngredients),
            translateToArabic(raw),
          ]);

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
            title,
            image: meal.strMealThumb,
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

      const mapped: Result[] = mappedResults.flatMap((item) => (item.status === 'fulfilled' ? [item.value] : []));
      const localResults = buildLocalResults(availableIngredients);
      const combined = [...mapped, ...localResults];
      const unique = sortResultsByMatch(Array.from(new Map(combined.map((item) => [item.title, item])).values()));

      setResults(unique);
      if (!unique.some((item) => item.matched > 0)) {
        setError('ملقيناش وصفات مطابقة لمكوناتك الحالية. جرّب إضافة مكونات تانية أو اعرض كل الوصفات.');
      }
    } catch {
      const fallback = sortResultsByMatch(buildLocalResults(availableIngredients));
      setResults(fallback);
      if (!fallback.some((item) => item.matched > 0)) {
        setError('تعذر الاتصال بمكتبة الوصفات. يمكنك عرض الوصفات المحلية أو التحقق من الإنترنت.');
      }
    } finally {
      setLoading(false);
    }
  };

  const cuisineFilteredResults = useMemo(() => {
    const base =
      cuisine === 'egyptian'
        ? results.filter((item) => item.isLocal || /مصري|كشري|مسقعة|شكشوكة|بطاطس|صينية/i.test(item.title))
        : results;
    return sortResultsByMatch(base);
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
            <h4 id="recipe-detail-modal-title" className="text-base font-black leading-snug text-[#1E5631]">
              {selected.title}
            </h4>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[#5C6650] tabular-nums">
              <span>
                متوفر {selected.matched} من {selected.total} مكوّن
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-[#2E7D32] font-bold">{getMatchPercent(selected)}% تطابق</span>
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
          ) : selected.image ? (
            <div className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-[#E4DECF] bg-[#F3EBDD] text-[#5C6650]">
              <ChefHat className="h-7 w-7 text-[#1E5631]" />
              <span className="text-xs font-bold">{selected.title}</span>
            </div>
          ) : null}

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
          <div className="rounded-2xl border border-[#E4DECF] bg-white p-3.5 space-y-2">
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
          ابحث بالمكونات المتوفرة، والوصفات المترجمة بتظهر بالعربي مع مقادير مضبوطة لـ {familySize} أفراد.
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
          {loading ? 'جاري البحث أونلاين…' : 'دور بالمكونات دي'}
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

                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-white p-3 text-right transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E5631] ${
                      isSelected ? 'border-[#1E5631] ring-1 ring-[#1E5631]/30' : 'border-[#E6DFCE] hover:border-[#2E7D32]/60'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-extrabold text-gray-900">{item.title}</span>
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
            <div className="rounded-xl border border-dashed border-[#D8CFBC] bg-white p-4 text-center space-y-2.5">
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

