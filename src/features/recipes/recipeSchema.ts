export interface StructuredIngredient {
  name: string;
  amount: string;
  unit: string;
  notes?: string;
}

export interface GeminiRecipeRawPayload {
  isRecognizedFood?: unknown;
  clarificationNote?: unknown;
  dishName?: unknown;
  cuisineName?: unknown;
  originCountryCode?: unknown;
  servings?: unknown;
  prepTimeMinutes?: unknown;
  cookTimeMinutes?: unknown;
  totalTimeMinutes?: unknown;
  ingredients?: unknown;
  steps?: unknown;
  tips?: unknown;
  englishSearchQuery?: unknown;
}

export interface ValidatedAiRecipe {
  dishName: string;
  cuisineName: string;
  originCountryCode: string;
  countryFlag: string;
  servings: 4;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  totalTimeMinutes: number;
  ingredients: StructuredIngredient[];
  steps: string[];
  tips: string[];
  englishSearchQuery: string;
  imageUrl?: string;
  imageCredit?: string;
  extract: string;
}

export type RecipeValidationResult =
  | { ok: true; data: ValidatedAiRecipe }
  | { ok: false; reason: 'unrecognized_food' | 'invalid_schema'; message: string };

const COUNTRY_CODE_TO_FLAG: Record<string, string> = {
  EG: '🇪🇬',
  SA: '🇸🇦',
  AE: '🇦🇪',
  KW: '🇰🇼',
  QA: '🇶🇦',
  BH: '🇧🇭',
  OM: '🇴🇲',
  YE: '🇾🇪',
  LB: '🇱🇧',
  SY: '🇸🇾',
  PS: '🇵🇸',
  JO: '🇯🇴',
  IQ: '🇮🇶',
  MA: '🇲🇦',
  TN: '🇹🇳',
  DZ: '🇩🇿',
  LY: '🇱🇾',
  SD: '🇸🇩',
  IT: '🇮🇹',
  FR: '🇫🇷',
  ES: '🇪🇸',
  TR: '🇹🇷',
  GR: '🇬🇷',
  US: '🇺🇸',
  GB: '🇬🇧',
  DE: '🇩🇪',
  MX: '🇲🇽',
  IN: '🇮🇳',
  PK: '🇵🇰',
  JP: '🇯🇵',
  CN: '🇨🇳',
  TH: '🇹🇭',
  KR: '🇰🇷',
  ID: '🇮🇩',
  IR: '🇮🇷',
  BR: '🇧🇷',
  AR: '🇦🇷',
  PE: '🇵🇪',
  ET: '🇪🇹',
};

const SHARED_REGIONAL_CUISINE_PATTERNS = [
  /شامي/,
  /خليجي/,
  /مغاربي/,
  /عربي/,
  /متوسطي/,
  /عالمي/,
  /آسيوي|اسيوي/,
  /أوروبي|اوروبي/,
  /شرق أوسط|شرق اوسط/,
  /غير محدد|مشترك|متنوع/,
];

const PLACEHOLDER_INGREDIENT_PATTERNS = [
  /المكون الرئيسي/,
  /مكون رئيسي/,
  /مكون أساسي/,
  /مكون اساسي/,
  /مكونات متاحة/,
  /حسب المتاح/,
  /المكون المناسب/,
  /المكون الأساسي/,
];

const IMAGE_QUERY_STOP_WORDS = new Set([
  'the',
  'and',
  'with',
  'for',
  'from',
  'style',
  'dish',
  'recipe',
  'traditional',
  'authentic',
  'homemade',
  'classic',
  'arabic',
  'egyptian',
  'saudi',
  'syrian',
  'lebanese',
  'middle',
  'eastern',
]);

function hasArabicScript(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value);
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function parsePositiveMinutes(value: unknown, min = 0, max = 1440): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const rounded = Math.round(value);
    if (rounded >= min && rounded <= max) return rounded;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      const rounded = Math.round(parsed);
      if (rounded >= min && rounded <= max) return rounded;
    }
  }
  return null;
}

/**
 * Resolves an authentic country flag ONLY when the dish belongs clearly to a
 * single country. Shared regional cuisines (شامي / خليجي / عربي) or uncertain
 * origins intentionally return '' so no misleading flag is invented.
 */
export function resolveCountryFlag(originCountryCode?: string, cuisineName = ''): string {
  const normalizedCuisine = cleanText(cuisineName);
  if (SHARED_REGIONAL_CUISINE_PATTERNS.some((pattern) => pattern.test(normalizedCuisine))) {
    return '';
  }
  const code = cleanText(originCountryCode).toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return COUNTRY_CODE_TO_FLAG[code] || '';
}

export function formatCuisineLabel(cuisineName: string, countryFlag = ''): string {
  const cleanCuisine = cleanText(cuisineName);
  const cleanFlag = cleanText(countryFlag);
  if (!cleanCuisine) return '';
  return cleanFlag ? `${cleanFlag} ${cleanCuisine}` : cleanCuisine;
}

export function formatStructuredIngredientLine(item: StructuredIngredient): string {
  const qty = [item.amount, item.unit].filter(Boolean).join(' ').trim();
  const base = qty ? `${qty} ${item.name}` : item.name;
  return item.notes ? `${base} (${item.notes})` : base;
}

export function buildRecipeExtractText(recipe: {
  servings: number;
  ingredients: StructuredIngredient[];
  steps: string[];
  tips: string[];
}): string {
  const ingredientsLines = recipe.ingredients
    .map((item) => `• ${formatStructuredIngredientLine(item)}`)
    .join('\n');
  const stepsLines = recipe.steps
    .map((step, index) => `${index + 1}. ${step}`)
    .join('\n');
  const tipsLines = recipe.tips.length
    ? `\n\nنصائح لنجاح الوصفة:\n${recipe.tips.map((tip) => `• ${tip}`).join('\n')}`
    : '';
  return `المكونات (${recipe.servings} أفراد):\n${ingredientsLines}\n\nطريقة التحضير:\n${stepsLines}${tipsLines}`;
}

/**
 * Strict validator for Gemini Structured JSON Output. Prevents partial JSON,
 * placeholder ingredients, or mismatched origin flags from reaching the UI.
 */
export function validateAndNormalizeGeminiRecipe(raw: unknown): RecipeValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      reason: 'invalid_schema',
      message: 'استجابة الذكاء الاصطناعي لم تكن بصيغة وصفة صالحة. جرّب مرة تانية.',
    };
  }

  const payload = raw as GeminiRecipeRawPayload;

  if (payload.isRecognizedFood === false) {
    const clarification = cleanText(payload.clarificationNote);
    return {
      ok: false,
      reason: 'unrecognized_food',
      message:
        clarification && hasArabicScript(clarification)
          ? clarification
          : 'مش قادرين نحدد اسم الأكلة بوضوح من الطلب ده. اكتب اسم الأكلة أو الطبق بالعربي أو العامية وهنجهزلك وصفته فوراً.',
    };
  }

  const dishName = cleanText(payload.dishName);
  if (dishName.length < 2 || !hasArabicScript(dishName)) {
    return {
      ok: false,
      reason: 'invalid_schema',
      message: 'تعذر قراءة اسم الأكلة من الاستجابة. جرّب البحث مرة أخرى.',
    };
  }

  const cuisineName = cleanText(payload.cuisineName);
  if (cuisineName.length < 3 || !hasArabicScript(cuisineName)) {
    return {
      ok: false,
      reason: 'invalid_schema',
      message: 'تعذر تحديد المطبخ الأصلي للأكلة بشكل موثوق. جرّب البحث مرة أخرى.',
    };
  }

  const prepTimeMinutes = parsePositiveMinutes(payload.prepTimeMinutes, 1, 720);
  const cookTimeMinutes = parsePositiveMinutes(payload.cookTimeMinutes, 0, 1440);
  const totalTimeRaw = parsePositiveMinutes(payload.totalTimeMinutes, 1, 1440);

  if (prepTimeMinutes === null || cookTimeMinutes === null || totalTimeRaw === null) {
    return {
      ok: false,
      reason: 'invalid_schema',
      message: 'مدد التحضير والطهي غير مكتملة في الوصفة المستلمة. جرّب مرة أخرى.',
    };
  }
  const totalTimeMinutes = Math.max(totalTimeRaw, prepTimeMinutes + cookTimeMinutes);

  if (!Array.isArray(payload.ingredients)) {
    return {
      ok: false,
      reason: 'invalid_schema',
      message: 'قائمة المكونات غير مكتملة. جرّب البحث مرة أخرى.',
    };
  }

  const ingredients: StructuredIngredient[] = [];
  for (const entry of payload.ingredients) {
    if (!entry || typeof entry !== 'object') continue;
    const rec = entry as Record<string, unknown>;
    const name = cleanText(rec.name);
    const amount = cleanText(rec.amount);
    const unit = cleanText(rec.unit);
    const notes = cleanText(rec.notes);
    if (!name || !amount || !unit) continue;
    if (PLACEHOLDER_INGREDIENT_PATTERNS.some((pattern) => pattern.test(name))) {
      return {
        ok: false,
        reason: 'invalid_schema',
        message: 'المكونات المولّدة لم تكن دقيقة بما يكفي. أعد المحاولة لوصفة أدق.',
      };
    }
    ingredients.push(notes ? { name, amount, unit, notes } : { name, amount, unit });
  }

  if (ingredients.length < 3) {
    return {
      ok: false,
      reason: 'invalid_schema',
      message: 'قائمة المكونات أقل من المتوقع لوصفة حقيقية. أعد المحاولة.',
    };
  }

  if (!Array.isArray(payload.steps)) {
    return {
      ok: false,
      reason: 'invalid_schema',
      message: 'خطوات التحضير غير متوفرة. أعد المحاولة.',
    };
  }

  const steps = payload.steps
    .map((step) => cleanText(step).replace(/^\d+[.)\-\s]+/, '').trim())
    .filter((step) => step.length >= 10 && hasArabicScript(step));

  if (steps.length < 3) {
    return {
      ok: false,
      reason: 'invalid_schema',
      message: 'خطوات التحضير لم تكتمل بالتفصيل الكافي. أعد المحاولة.',
    };
  }

  const tips = Array.isArray(payload.tips)
    ? payload.tips.map((tip) => cleanText(tip)).filter((tip) => tip.length >= 6 && hasArabicScript(tip))
    : [];

  if (tips.length < 1) {
    return {
      ok: false,
      reason: 'invalid_schema',
      message: 'نصائح نجاح الوصفة غير مكتملة. أعد المحاولة.',
    };
  }

  const rawCode = cleanText(payload.originCountryCode).toUpperCase();
  const countryFlag = resolveCountryFlag(rawCode, cuisineName);
  const originCountryCode = countryFlag ? rawCode : '';
  const englishSearchQuery = cleanText(payload.englishSearchQuery).replace(/[^A-Za-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();

  const servings = 4 as const;
  const extract = buildRecipeExtractText({ servings, ingredients, steps, tips });

  return {
    ok: true,
    data: {
      dishName,
      cuisineName,
      originCountryCode,
      countryFlag,
      servings,
      prepTimeMinutes,
      cookTimeMinutes,
      totalTimeMinutes,
      ingredients,
      steps,
      tips,
      englishSearchQuery,
      extract,
    },
  };
}

/**
 * Verifies that an external photo candidate actually matches the requested dish
 * by whole-word English token matching—preventing unrelated dish photos.
 */
export function doesDishImageStrictlyMatch(englishDishQuery: string, candidateTitle: string): boolean {
  const queryTokens = cleanText(englishDishQuery)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((tok) => tok.length >= 3 && !IMAGE_QUERY_STOP_WORDS.has(tok));

  const titleTokens = cleanText(candidateTitle)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((tok) => tok.length >= 2 && !IMAGE_QUERY_STOP_WORDS.has(tok));

  if (queryTokens.length === 0 || titleTokens.length === 0) return false;
  const titleSet = new Set(titleTokens);

  const allQueryTokensPresent = queryTokens.every((tok) => titleSet.has(tok));
  if (!allQueryTokensPresent) return false;

  // Guard against overly broad matches (e.g. "Chicken" matching "Chicken Marengo")
  return titleTokens.length <= queryTokens.length + 2;
}
