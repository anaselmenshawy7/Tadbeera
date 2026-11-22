import { GoogleGenAI, Type } from '@google/genai';
import {
  doesDishImageStrictlyMatch,
  formatCuisineLabel,
  validateAndNormalizeGeminiRecipe,
  type ValidatedAiRecipe,
} from './recipeSchema.ts';
import { scoreRecipeDishRelevance } from './arabicSearch.ts';
import { searchEgyptianArabicCatalog } from './egyptianRecipesCatalog.ts';
import { RECIPES } from '../../data/seedData.ts';
import {
  GEMINI_MAX_OUTPUT_TOKENS,
  GEMINI_MODEL,
  GEMINI_TIMEOUT_MS,
  PHOTO_LOOKUP_TIMEOUT_MS,
  RECIPE_SYSTEM_INSTRUCTION,
} from './recipeContract.ts';

export {
  GEMINI_MAX_OUTPUT_TOKENS,
  GEMINI_MODEL,
  GEMINI_TIMEOUT_MS,
  PHOTO_LOOKUP_TIMEOUT_MS,
  RECIPE_SYSTEM_INSTRUCTION,
};

export const RECIPE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    isRecognizedFood: {
      type: Type.BOOLEAN,
      description: 'true if the user query refers to a real dish, drink, pastry, or dessert; false otherwise.',
    },
    clarificationNote: {
      type: Type.STRING,
      description: 'Friendly Egyptian Arabic note only when isRecognizedFood is false.',
    },
    dishName: {
      type: Type.STRING,
      description: 'Accurate, properly spelled Arabic dish name.',
    },
    cuisineName: {
      type: Type.STRING,
      description: 'True culinary origin in Arabic, e.g. المطبخ المصري, المطبخ السعودي, المطبخ الشامي, المطبخ الإيطالي.',
    },
    originCountryCode: {
      type: Type.STRING,
      description: 'Uppercase ISO 3166-1 alpha-2 country code ONLY when unambiguously linked to one country (e.g. EG, SA, IT). Empty string "" for shared/regional or uncertain origins.',
    },
    servings: {
      type: Type.INTEGER,
      description: 'Always 4 (fixed portions for a family of 4).',
    },
    prepTimeMinutes: {
      type: Type.INTEGER,
      description: 'Realistic preparation time in minutes.',
    },
    cookTimeMinutes: {
      type: Type.INTEGER,
      description: 'Realistic cooking time in minutes.',
    },
    totalTimeMinutes: {
      type: Type.INTEGER,
      description: 'Realistic total time in minutes.',
    },
    ingredients: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'Real ingredient name in Arabic.' },
          amount: { type: Type.STRING, description: 'Numeric quantity (e.g. 500, 2, 1/2).' },
          unit: { type: Type.STRING, description: 'Clear unit (جرام، كيلو، ملعقة كبيرة، ملعقة صغيرة، كوب، مللي، حبة، فص).' },
          notes: { type: Type.STRING, description: 'Optional prep note like مفروم ناعم.' },
        },
        required: ['name', 'amount', 'unit'],
      },
    },
    steps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Sequential detailed steps in simple Egyptian Arabic including temperatures and timings.',
    },
    tips: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '2 to 4 practical tips in Egyptian Arabic for recipe success.',
    },
    englishSearchQuery: {
      type: Type.STRING,
      description: 'Short standard English dish name for exact photo verification, or empty string.',
    },
  },
  required: [
    'isRecognizedFood',
    'dishName',
    'cuisineName',
    'originCountryCode',
    'servings',
    'prepTimeMinutes',
    'cookTimeMinutes',
    'totalTimeMinutes',
    'ingredients',
    'steps',
    'tips',
    'englishSearchQuery',
  ],
};

export class GeminiRecipeSdkError extends Error {
  status: number;
  code: string;
  retryable: boolean;

  constructor(message: string, options: { status: number; code: string; retryable: boolean }) {
    super(message);
    this.name = 'GeminiRecipeSdkError';
    this.status = options.status;
    this.code = options.code;
    this.retryable = options.retryable;
  }
}

export interface GeminiSdkDeps {
  apiKey?: string;
  sendUserAgent?: boolean;
  timeoutMs?: number;
  generateFromGemini?: (query: string) => Promise<unknown>;
  lookupVerifiedPhoto?: (englishQuery: string) => Promise<{ imageUrl: string; imageCredit: string } | null>;
}

/** The original direct Gemini integration reads the build-time client key. */
export function getBundledClientGeminiApiKey(): string {
  return (process.env.GEMINI_API_KEY || '').trim();
}

export function getGeminiErrorDetails(err: unknown): {
  status: number;
  code: string;
  message: string;
  retryable: boolean;
} {
  if (err instanceof GeminiRecipeSdkError) {
    return {
      status: err.status,
      code: err.code,
      message: err.message,
      retryable: err.retryable,
    };
  }

  const errObj = err as { status?: number; code?: string | number; message?: string; name?: string } | undefined;
  const rawMessage = String(errObj?.message || '');
  const status = typeof errObj?.status === 'number' ? errObj.status : 0;

  if (errObj?.code === 'MISSING_API_KEY' || rawMessage === 'MISSING_GEMINI_API_KEY') {
    return {
      status: 503,
      code: 'MISSING_API_KEY',
      message: 'خدمة الوصفات الذكية مش متفعلة حالياً لعدم توفر مفتاح Gemini. تأكد من إعداد المفتاح.',
      retryable: false,
    };
  }
  if (errObj?.name === 'AbortError' || /timeout|timed out/i.test(rawMessage)) {
    return {
      status: 504,
      code: 'TIMEOUT',
      message: 'الاتصال بخدمة الوصفات أخد وقت أطول من المعتاد. اضغط إعادة المحاولة.',
      retryable: true,
    };
  }
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(rawMessage)) {
    return {
      status: 429,
      code: 'RATE_LIMITED',
      message: 'الخدمة عليها ضغط دلوقتي أو تم تجاوز الحد المسموح مؤقتاً. استنى ثواني واضغط إعادة المحاولة.',
      retryable: true,
    };
  }
  if (status === 401 || status === 403 || /API_KEY_INVALID|PERMISSION_DENIED|unauthorized/i.test(rawMessage)) {
    return {
      status: 502,
      code: 'GEMINI_AUTH_ERROR',
      message: 'تعذر التحقق من صلاحية مفتاح الذكاء الاصطناعي حالياً.',
      retryable: false,
    };
  }
  if (status === 404 || /NOT_FOUND/i.test(rawMessage)) {
    return {
      status: 502,
      code: 'MODEL_NOT_FOUND',
      message: 'نموذج الوصفات الذكي غير متاح حالياً. حاول مرة أخرى بعد قليل.',
      retryable: true,
    };
  }
  return {
    status: 502,
    code: 'GEMINI_UNAVAILABLE',
    message: 'حصلت مشكلة مؤقتة في الاتصال بخدمة الوصفات الذكية. تأكد من الإنترنت واضغط إعادة المحاولة.',
    retryable: true,
  };
}

export async function defaultVerifiedPhotoLookup(
  englishQuery: string
): Promise<{ imageUrl: string; imageCredit: string } | null> {
  const cleanQuery = englishQuery.trim();
  if (cleanQuery.length < 3) return null;

  try {
    const url = new URL('https://www.themealdb.com/api/json/v1/1/search.php');
    url.searchParams.set('s', cleanQuery);
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(PHOTO_LOOKUP_TIMEOUT_MS),
    });
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
  }
}

export async function generateRecipeWithGeminiSdk(
  rawQuery: string,
  deps: GeminiSdkDeps = {}
): Promise<ValidatedAiRecipe> {
  const query = rawQuery.trim();
  if (query.length < 2 || query.length > 120) {
    throw new GeminiRecipeSdkError('اكتبي اسم الأكلة المطلوبة بشكل واضح (من حرفين على الأقل).', {
      status: 400,
      code: 'INVALID_QUERY',
      retryable: false,
    });
  }

  const callGemini = async (): Promise<unknown> => {
    if (deps.generateFromGemini) {
      return await deps.generateFromGemini(query);
    }

    const apiKey = (deps.apiKey ?? getBundledClientGeminiApiKey()).trim();
    if (!apiKey) {
      const missingErr = new Error('MISSING_GEMINI_API_KEY') as Error & { code?: string };
      missingErr.code = 'MISSING_API_KEY';
      throw missingErr;
    }

    const ai = new GoogleGenAI(
      deps.sendUserAgent
        ? {
            apiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              },
            },
          }
        : { apiKey }
    );

    const timeoutMs = deps.timeoutMs ?? GEMINI_TIMEOUT_MS;
    const runOnce = async () => {
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          const timeoutErr = new Error('Gemini request timed out');
          timeoutErr.name = 'AbortError';
          reject(timeoutErr);
        }, timeoutMs);
        if (typeof (timer as { unref?: () => void }).unref === 'function') {
          (timer as { unref: () => void }).unref();
        }
      });

      const response = await Promise.race([
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: `اكتب وصفة كاملة ودقيقة للأكلة المطلوبة لأسرة من 4 أفراد: "${query}"`,
          config: {
            systemInstruction: RECIPE_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: RECIPE_RESPONSE_SCHEMA,
            maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
          },
        }),
        timeoutPromise,
      ]);

      const rawText = (response.text || '').trim();
      if (!rawText) {
        throw new Error('Empty JSON response from Gemini');
      }
      return JSON.parse(rawText);
    };

    try {
      return await runOnce();
    } catch (firstErr) {
      const mapped = getGeminiErrorDetails(firstErr);
      if (!mapped.retryable || mapped.status === 429 || mapped.status === 504) {
        throw firstErr;
      }
      await new Promise(resolve => setTimeout(resolve, 600));
      return await runOnce();
    }
  };

  let rawRecipe: unknown;
  try {
    rawRecipe = await callGemini();
  } catch (err) {
    const mapped = getGeminiErrorDetails(err);
    throw new GeminiRecipeSdkError(mapped.message, {
      status: mapped.status,
      code: mapped.code,
      retryable: mapped.retryable,
    });
  }

  const validation = validateAndNormalizeGeminiRecipe(rawRecipe);
  if (validation.ok === false) {
    const status = validation.reason === 'unrecognized_food' ? 422 : 502;
    throw new GeminiRecipeSdkError(validation.message, {
      status,
      code: validation.reason.toUpperCase(),
      retryable: validation.reason === 'invalid_schema',
    });
  }

  const recipe: ValidatedAiRecipe = { ...validation.data };
  const photoLookup = deps.lookupVerifiedPhoto || defaultVerifiedPhotoLookup;
  const verifiedPhoto = await photoLookup(recipe.englishSearchQuery);
  if (verifiedPhoto) {
    recipe.imageUrl = verifiedPhoto.imageUrl;
    recipe.imageCredit = verifiedPhoto.imageCredit;
  }

  return recipe;
}

export interface OfflineFallbackRecipeItem {
  title: string;
  servings: number;
  pageId: number;
  url: string;
  extract: string;
  cuisineName: string;
  countryFlag: string;
  cuisineLabel: string;
  prepTime?: string;
  imageUrl?: string;
  imageCredit?: string;
  isOfflineFallback: true;
  _relevanceScore: number;
}

function cuisineTierToOfflineOrigin(
  tier: 'egyptian' | 'arab' | 'international' | undefined,
  title = ''
): {
  cuisineName: string;
  countryFlag: string;
} {
  if (tier === 'egyptian') {
    return { cuisineName: 'المطبخ المصري', countryFlag: '🇪🇬' };
  }
  if (tier === 'arab') {
    if (/فلسطين|مسخن/.test(title)) return { cuisineName: 'المطبخ الفلسطيني', countryFlag: '🇵🇸' };
    if (/أردن|اردن|منسف/.test(title)) return { cuisineName: 'المطبخ الأردني', countryFlag: '🇯🇴' };
    if (/مغرب|برقوق|طاجين/.test(title)) return { cuisineName: 'المطبخ المغربي', countryFlag: '🇲🇦' };
    if (/عراق|مسقوف/.test(title)) return { cuisineName: 'المطبخ العراقي', countryFlag: '🇮🇶' };
    if (/سعود|خليجي|مطازيز|جريش|قرصان|سليق|كبسة|مسحب/.test(title)) {
      return { cuisineName: 'المطبخ السعودي', countryFlag: '🇸🇦' };
    }
    if (/شام|كبيبة|كبة|مقلوبة|تبولة|فتوش/.test(title)) {
      return { cuisineName: 'المطبخ الشامي', countryFlag: '' };
    }
    return { cuisineName: 'المطبخ العربي', countryFlag: '' };
  }
  return { cuisineName: 'وصفة مكتبة تدبيرة', countryFlag: '' };
}

/**
 * Built-in local recipe catalog lookup (Tier 2 in the Local-First pipeline,
 * and offline fallback when disconnected). Uses flexible Arabic normalization
 * (ignoring hamzas, diacritics, ى/ي, ة/ه) and requires dish-level relevance
 * (default minScore = 65) so unrelated ingredient-only matches are excluded.
 */
export function searchOfflineLocalRecipes(
  rawQuery: string,
  options: { minScore?: number } = {}
): OfflineFallbackRecipeItem[] {
  const query = rawQuery.trim();
  if (query.length < 2) return [];
  const minScore = options.minScore ?? 65;

  const catalogMatches: OfflineFallbackRecipeItem[] = searchEgyptianArabicCatalog(query, 4)
    .filter(item => item._relevanceScore >= minScore)
    .map(item => {
      const origin = cuisineTierToOfflineOrigin(item.cuisine, item.title);
      return {
        title: item.title,
        servings: 4,
        pageId: item.pageId,
        url: '',
        extract: item.extract,
        cuisineName: origin.cuisineName,
        countryFlag: origin.countryFlag,
        cuisineLabel: formatCuisineLabel(origin.cuisineName, origin.countryFlag),
        imageUrl: item.imageUrl || undefined,
        imageCredit: item.imageCredit,
        isOfflineFallback: true,
        _relevanceScore: item._relevanceScore,
      };
    });

  const bundledMatches: OfflineFallbackRecipeItem[] = RECIPES.map(recipe => ({
    recipe,
    score: scoreRecipeDishRelevance(
      query,
      recipe.name,
      [],
      recipe.tags,
      recipe.ingredients.map(i => i.name).join(' ')
    ),
  }))
    .filter(entry => entry.score >= minScore)
    .map(entry => {
      const { recipe, score } = entry;
      const origin = cuisineTierToOfflineOrigin(recipe.cuisine, recipe.name);
      const ingredientsText = recipe.ingredients.map(i => `• ${i.name} — ${i.quantity}`).join('\n');
      const stepsText = recipe.steps.map((s, idx) => `${idx + 1}. ${s}`).join('\n');
      const pageId =
        910000 + Math.abs(recipe.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0));
      return {
        title: recipe.name,
        servings: 4,
        pageId,
        url: '',
        extract: `المكونات:\n${ingredientsText}\n\nطريقة التحضير:\n${stepsText}`,
        cuisineName: origin.cuisineName,
        countryFlag: origin.countryFlag,
        cuisineLabel: formatCuisineLabel(origin.cuisineName, origin.countryFlag),
        prepTime: recipe.prepTimeMinutes ? `${recipe.prepTimeMinutes} دقيقة` : undefined,
        imageUrl: recipe.imageUrl || undefined,
        imageCredit: recipe.imageUrl ? 'مكتبة تدبيرة' : undefined,
        isOfflineFallback: true as const,
        _relevanceScore: score,
      };
    });

  const seenTitles = new Set<string>();
  return [...catalogMatches, ...bundledMatches]
    .sort((a, b) => b._relevanceScore - a._relevanceScore)
    .filter(item => {
      const key = item.title.trim();
      if (!key || seenTitles.has(key)) return false;
      seenTitles.add(key);
      return true;
    })
    .slice(0, 8);
}

export const searchBuiltInLocalRecipes = searchOfflineLocalRecipes;

