import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createRecipeApiApp, type RecipeGeneratorDeps } from '../server.ts';
import {
  doesDishImageStrictlyMatch,
  formatCuisineLabel,
  formatStructuredIngredientLine,
  resolveCountryFlag,
  validateAndNormalizeGeminiRecipe,
} from '../src/features/recipes/recipeSchema.ts';
import {
  aiRecipeToOnlineRecipe,
  GENERATED_CACHE_KEY,
  GENERATED_CACHE_MAX_ITEMS,
  generateRecipeViaApi,
  getRecipeDisplaySections,
  getRecipeOriginBadge,
  readGeneratedRecipesCache,
  readSavedRecipes,
  RecipeApiError,
  resolveOnlineOrOfflineRecipe,
  SAVED_KEY,
  saveGeneratedRecipeToLruCache,
} from '../src/features/recipes/OnlineRecipeSearch.tsx';
import {
  GEMINI_MAX_OUTPUT_TOKENS,
  GEMINI_MODEL,
  searchOfflineLocalRecipes,
} from '../src/features/recipes/recipeGeminiClient.ts';
import { buildEgyptianRecipeSpeechSegments } from '../src/features/recipes/recipeSpeech.ts';

function startTestServer(deps: RecipeGeneratorDeps): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const app = createRecipeApiApp(deps);
  return new Promise(resolve => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise<void>((res, rej) => server.close(err => (err ? rej(err) : res()))),
      });
    });
  });
}

const ACCEPTANCE_FIXTURES: Record<
  string,
  {
    dishName: string;
    cuisineName: string;
    originCountryCode: string;
    expectedFlag: string;
    englishSearchQuery: string;
    prepTimeMinutes: number;
    cookTimeMinutes: number;
    totalTimeMinutes: number;
    ingredients: Array<{ name: string; amount: string; unit: string; notes?: string }>;
    steps: string[];
    tips: string[];
  }
> = {
  'كشري مصري': {
    dishName: 'كشري مصري أصلي بالدقة والصلصة',
    cuisineName: 'المطبخ المصري',
    originCountryCode: 'EG',
    expectedFlag: '🇪🇬',
    englishSearchQuery: 'Koshari',
    prepTimeMinutes: 25,
    cookTimeMinutes: 45,
    totalTimeMinutes: 70,
    ingredients: [
      { name: 'أرز مصري مغسول', amount: '2', unit: 'كوب' },
      { name: 'عدس بجبة منقوع', amount: '1', unit: 'كوب' },
      { name: 'مكرونة صغيرة واسباجتي', amount: '250', unit: 'جرام' },
      { name: 'عصير طماطم طازج', amount: '500', unit: 'مللي' },
      { name: 'بصل مقطع شرائح رفيعة', amount: '3', unit: 'حبة', notes: 'للتقلية' },
    ],
    steps: [
      'اقلي شرائح البصل في زيت ساخن على نار متوسطة لمدة 12 دقيقة حتى يصبح مقرمشاً وذهبياً، ثم ارفعيه على ورق مطبخ.',
      'اسلقي العدس في ماء مع كمون لمدة 20 دقيقة نصف تسوية، ثم اطهي الأرز والشعرية والعدس معاً في حلة واحدة حتى يتشرب المرق.',
      'حضري الصلصة بتحمير الثوم في زيت البصل ثم أضيفي الخل وعصير الطماطم والكمون واتركيها تتسبك 15 دقيقة، وقدميها مع الدقة.',
    ],
    tips: ['استخدام زيت تحمير البصل في الأرز والصلصة بيدي طعم الكشري الأصلي.', 'رشة سكر صغيرة بتوازن حموضة الطماطم.'],
  },
  'مطازيز سعودية': {
    dishName: 'مطازيز سعودية باللحم والخضار',
    cuisineName: 'المطبخ السعودي',
    originCountryCode: 'SA',
    expectedFlag: '🇸🇦',
    englishSearchQuery: 'Saudi Matazeez',
    prepTimeMinutes: 30,
    cookTimeMinutes: 60,
    totalTimeMinutes: 90,
    ingredients: [
      { name: 'دقيق قمح أسمر (بر)', amount: '2.5', unit: 'كوب' },
      { name: 'لحم غنم بالعظم مقطع', amount: '600', unit: 'جرام' },
      { name: 'قرع عسلي وكوسة وباذنجان مقطع', amount: '400', unit: 'جرام' },
      { name: 'معجون طماطم ولومي أسود', amount: '2', unit: 'ملعقة كبيرة' },
    ],
    steps: [
      'اعجني الدقيق الأسمر مع رشة ملح والماء الدافئ حتى تتكون عجينة متماسكة واتركيها ترتاح 20 دقيقة.',
      'شوحي البصل واللحم مع البهارات واللومي ثم أضيفي معجون الطماطم والماء المغلي واتركي اللحم يغلي 35 دقيقة.',
      'افردي العجين لأقراص صغيرة رفيعة وأسقطيها تدريجياً في المرق المغلي مع الخضار واتركيها على نار هادئة 25 دقيقة.',
    ],
    tips: ['انزلي أقراص المطازيز واحدة تلو الأخرى حتى لا تلتصق ببعضها.'],
  },
  مسحب: {
    dishName: 'دجاج مسحب مقرمش بالثومية',
    cuisineName: 'المطبخ السعودي',
    originCountryCode: 'SA',
    expectedFlag: '🇸🇦',
    englishSearchQuery: 'Crispy Chicken Strips',
    prepTimeMinutes: 30,
    cookTimeMinutes: 20,
    totalTimeMinutes: 50,
    ingredients: [
      { name: 'صدور دجاج فيليه مقطعة مستطيلات سميكة', amount: '700', unit: 'جرام' },
      { name: 'لبن رايب مع عصير ليمون وثوم وبابريكا', amount: '1', unit: 'كوب' },
      { name: 'بقسماط ناعم وكرسبي', amount: '1.5', unit: 'كوب' },
      { name: 'دقيق ونشا', amount: '1', unit: 'كوب' },
    ],
    steps: [
      'دقي صدور الدجاج برفق لتتساوى سماكتها وانقعيها في التتبيلة ساعتين في الثلاجة.',
      'غلفي القطع بالدقيق ثم البيض المخفوق ثم البقسماط مع الضغط الخفيف لتتماسك الطبقة.',
      'اقلي القطع في زيت ساخن 175 درجة مئوية لمدة 6 دقائق حتى تصبح ذهبية ومقرمشة.',
    ],
    tips: ['تجنبي تقليب المسحب أول دقيقتين في الزيت للحفاظ على القشرة.'],
  },
  'ملوخية مصرية': {
    dishName: 'ملوخية مصرية بالطشة والكزبرة',
    cuisineName: 'المطبخ المصري',
    originCountryCode: 'EG',
    expectedFlag: '🇪🇬',
    englishSearchQuery: 'Egyptian Molokhia',
    prepTimeMinutes: 20,
    cookTimeMinutes: 15,
    totalTimeMinutes: 35,
    ingredients: [
      { name: 'ملوخية خضراء مفرومة ناعم', amount: '500', unit: 'جرام' },
      { name: 'شوربة دجاج أو لحم ساخنة', amount: '3', unit: 'كوب' },
      { name: 'ثوم مهروس ناعم', amount: '8', unit: 'فص' },
      { name: 'كزبرة جافة وسمنة بلدي', amount: '1.5', unit: 'ملعقة كبيرة' },
    ],
    steps: [
      'اغلي الشوربة مع فص ثوم نيء ورشة كزبرة ثم هدئي النار تماماً.',
      'أضيفي الملوخية وقلبي بالمضرب السلك غلوة واحدة فقط دون أن تفور.',
      'حمري باقي الثوم مع الكزبرة الجافة في السمنة البلدي وصبي الطشة على الملوخية فور إحمرارها.',
    ],
    tips: ['لا تغطي حلة الملوخية وهي ساخنة حتى لا تسقط في القاع.'],
  },
  'كبسة دجاج': {
    dishName: 'كبسة دجاج سعودية بالبسمتي والمكسرات',
    cuisineName: 'المطبخ السعودي',
    originCountryCode: 'SA',
    expectedFlag: '🇸🇦',
    englishSearchQuery: 'Chicken Kabsa',
    prepTimeMinutes: 20,
    cookTimeMinutes: 45,
    totalTimeMinutes: 65,
    ingredients: [
      { name: 'دجاج مقطع أرباع', amount: '1.2', unit: 'كيلو' },
      { name: 'أرز بسمتي طويل الحبة منقوع', amount: '2.5', unit: 'كوب' },
      { name: 'بصل وطماطم مبشورة وبهارات كبسة صحيحة', amount: '2', unit: 'حبة' },
      { name: 'معجون طماطم ولومي', amount: '2', unit: 'ملعقة كبيرة' },
    ],
    steps: [
      'شوحي البصل والبهارات الصحيحة في الزيت ثم أضيفي قطع الدجاج حتى تأخذ لوناً ذهبياً.',
      'أضيفي الطماطم ومعجون الطماطم والماء المغلي واتركي الدجاج ينضج 30 دقيقة.',
      'ارفعى الدجاج لتحميره في الفرن وأسقطي الأرز البسمتي في المرق على نار هادئة 18 دقيقة.',
    ],
    tips: ['نقع البسمتي 20 دقيقة قبل الطهي يضمن حبات طويلة ومفلفلة.'],
  },
  'كبيبة شامية': {
    dishName: 'كبيبة شامية مقرمشة باللحم والصنوبر',
    cuisineName: 'المطبخ الشامي',
    originCountryCode: 'SY', // Even if a model suggests SY, shared Levantine origin MUST omit the flag!
    expectedFlag: '',
    englishSearchQuery: 'Kibbeh',
    prepTimeMinutes: 40,
    cookTimeMinutes: 25,
    totalTimeMinutes: 65,
    ingredients: [
      { name: 'برغل ناعم منقوع ومصفى', amount: '2', unit: 'كوب' },
      { name: 'لحم هبرة ناعم', amount: '400', unit: 'جرام' },
      { name: 'لحم مفروم وبصل مفروم للحشوة', amount: '300', unit: 'جرام' },
      { name: 'بهار مشكل ورشة قرفة ومكسرات محمصة', amount: '1', unit: 'ملعقة صغيرة' },
    ],
    steps: [
      'اطحني البرغل المنقوع مع اللحم الهبرة والبصل والملح والبهار مرتين حتى تتكون عجينة ناعمة متماسكة.',
      'عصجي لحم الحشوة مع البصل والبهارات وأضيفي المكسرات المحمصة واتركيها تبرد.',
      'شكلي أقراص الكبيبة المجوفة واحشيها ثم اقليها في زيت غزير ساخن 180 درجة لمدة 5 دقائق.',
    ],
    tips: ['بللي يديك بماء بارد مع رشة نشا أثناء التشكيل لقرمشة ممتازة.'],
  },
  'ديك رومي': {
    dishName: 'صدر ديك رومي مشوي في الفرن بالزبدة والأعشاب',
    cuisineName: 'المطبخ المصري',
    originCountryCode: 'EG',
    expectedFlag: '🇪🇬',
    englishSearchQuery: 'Roast Turkey',
    prepTimeMinutes: 25,
    cookTimeMinutes: 90,
    totalTimeMinutes: 115,
    ingredients: [
      { name: 'عرق أو صدر ديك رومي', amount: '1.5', unit: 'كيلو' },
      { name: 'زبدة طرية مع ثوم وإكليل الجبل وبشر برتقال', amount: '60', unit: 'جرام' },
      { name: 'بصل وجزر وكرفس لقاع الصينية', amount: '3', unit: 'حبة' },
      { name: 'مرقة دجاج ساخنة', amount: '1', unit: 'كوب' },
    ],
    steps: [
      'تبلي الديك الرومي بالزبدة المنكهة بالثوم والأعشاب والملح والفلفل تحت الجلد وفوقه.',
      'ضعيه فوق الخضار في صينية مع كوب المرقة وغطيه بورق زبدة وفويل محكم.',
      'ادخليه فرن ساخن 180 درجة لمدة 75 دقيقة ثم اكشفي الغطاء 15 دقيقة للتحمير.',
    ],
    tips: ['اتركي الديك الرومي يرتاح 15 دقيقة بعد الفرن قبل التقطيع ليحتفظ بالعصارة.'],
  },
  'فراخ مشويه زى الحاتي': {
    dishName: 'فراخ مشوية على طريقة الحاتي',
    cuisineName: 'المطبخ المصري',
    originCountryCode: 'EG',
    expectedFlag: '🇪🇬',
    englishSearchQuery: 'Egyptian Grilled Chicken',
    prepTimeMinutes: 20,
    cookTimeMinutes: 45,
    totalTimeMinutes: 65,
    ingredients: [
      { name: 'فرخة مقطعة شيش أو أرباع', amount: '1.4', unit: 'كيلو' },
      { name: 'ماء بصل وعصير طماطم وخل وليمون', amount: '1', unit: 'كوب' },
      { name: 'سماق وفلفل أسود وحبهان مطحون وملح', amount: '1.5', unit: 'ملعقة صغيرة' },
    ],
    steps: [
      'تبلي الفراخ بماء البصل وعصير الطماطم والبهارات لمدة 3 ساعات أو ليلة كاملة.',
      'رصي الفراخ على شبكة فوق صينية فيها ماء مغلي وادخليها فرن حامي 210 درجة لمدة 45 دقيقة.',
      'لفي قطعة فحم مشتعلة بنقطة زيت وسط الصينية وغطيها 5 دقائق لأخذ نكهة الشوي.',
    ],
    tips: ['استخدام ماء البصل بدون التفل يمنع احتراق الفراخ أثناء الشوي.'],
  },
  'ملوخيه بالارانب': {
    dishName: 'ملوخية بالأرانب على الطريقة المصرية',
    cuisineName: 'المطبخ المصري',
    originCountryCode: 'EG',
    expectedFlag: '🇪🇬',
    englishSearchQuery: 'Molokhia with Rabbit',
    prepTimeMinutes: 25,
    cookTimeMinutes: 50,
    totalTimeMinutes: 75,
    ingredients: [
      { name: 'أرنب مقطع ومنقوع بالليمون والدقيق', amount: '1', unit: 'كيلو' },
      { name: 'ملوخية خضراء مفرومة', amount: '500', unit: 'جرام' },
      { name: 'ثوم مهروس وكزبرة ناشفة وسمنة بلدي', amount: '2', unit: 'ملعقة كبيرة' },
    ],
    steps: [
      'اسلقي قطع الأرنب مع البصل والحبهان والمستكة والملح لمدة 40 دقيقة حتى ينضج وتحصلي على شوربة دسمة.',
      'ارفعي الأرنب وحمريه في سمنة بلدي حتى يأخذ لوناً شهياً.',
      'حضري الملوخية في شوربة الأرنب الساخنة مع الطشة بالثوم والكزبرة وقدميها مع الأرز بالشعرية.',
    ],
    tips: ['نقع الأرنب بالليمون والملح والدقيق يزيل أي زفارة تماماً.'],
  },
};

test('all 9 acceptance dishes generate structured 4-serving Arabic recipes with accurate flags and zero dummy templates', async () => {
  const { baseUrl, close } = await startTestServer({
    generateFromGemini: async query => {
      const fixture = ACCEPTANCE_FIXTURES[query];
      assert.ok(fixture, `Missing test fixture for query: ${query}`);
      return {
        isRecognizedFood: true,
        clarificationNote: '',
        dishName: fixture.dishName,
        cuisineName: fixture.cuisineName,
        originCountryCode: fixture.originCountryCode,
        servings: 4,
        prepTimeMinutes: fixture.prepTimeMinutes,
        cookTimeMinutes: fixture.cookTimeMinutes,
        totalTimeMinutes: fixture.totalTimeMinutes,
        ingredients: fixture.ingredients,
        steps: fixture.steps,
        tips: fixture.tips,
        englishSearchQuery: fixture.englishSearchQuery,
      };
    },
    lookupVerifiedPhoto: async englishQuery => {
      // Only return a photo when exact dish matches (e.g. Koshari) so offline SVG coverage is also tested
      if (englishQuery === 'Koshari') {
        return {
          imageUrl: 'https://www.themealdb.com/images/media/meals/koshari.jpg',
          imageCredit: 'TheMealDB',
        };
      }
      return null;
    },
  });

  try {
    for (const [query, expected] of Object.entries(ACCEPTANCE_FIXTURES)) {
      const recipe = await generateRecipeViaApi(query, { apiBaseUrl: baseUrl });
      assert.equal(recipe.servings, 4, `Expected fixed servings=4 for ${query}`);
      assert.equal(recipe.dishName, expected.dishName);
      assert.equal(recipe.countryFlag, expected.expectedFlag, `Flag mismatch for ${query}`);
      assert.equal(recipe.cuisineName, expected.cuisineName);
      assert.ok((recipe.ingredients?.length || 0) >= 3);
      assert.ok((recipe.steps?.length || 0) >= 3);
      assert.ok((recipe.tips?.length || 0) >= 1);
      assert.equal(recipe.extract.includes('المكون الرئيسي'), false);

      const badge = getRecipeOriginBadge(recipe);
      if (expected.expectedFlag) {
        assert.ok(badge.label.startsWith(expected.expectedFlag));
      } else {
        // Levantine dish must NOT receive an invented flag
        assert.equal(badge.label, expected.cuisineName);
        assert.equal(/🇪🇬|🇸🇾|🇱🇧/.test(badge.label), false);
      }
    }
  } finally {
    await close();
  }
});

test('flag & schema validation forbids dummy templates and never assigns Egypt flag by default', () => {
  assert.equal(resolveCountryFlag('EG', 'المطبخ المصري'), '🇪🇬');
  assert.equal(resolveCountryFlag('SA', 'المطبخ السعودي'), '🇸🇦');
  assert.equal(resolveCountryFlag('IT', 'المطبخ الإيطالي'), '🇮🇹');
  // Regional cuisines never get a single-country flag even if country code was sent
  assert.equal(resolveCountryFlag('SY', 'المطبخ الشامي'), '');
  assert.equal(resolveCountryFlag('SA', 'المطبخ الخليجي'), '');
  assert.equal(resolveCountryFlag('', 'مطبخ غير محدد'), '');
  assert.equal(formatCuisineLabel('المطبخ الشامي', ''), 'المطبخ الشامي');

  // Dummy placeholder ingredient is rejected cleanly
  const dummyValidation = validateAndNormalizeGeminiRecipe({
    isRecognizedFood: true,
    dishName: 'أكلة تجربة',
    cuisineName: 'المطبخ المصري',
    originCountryCode: 'EG',
    servings: 4,
    prepTimeMinutes: 15,
    cookTimeMinutes: 30,
    totalTimeMinutes: 45,
    ingredients: [
      { name: 'المكون الرئيسي الطازج', amount: '500', unit: 'جرام' },
      { name: 'بصل مفروم', amount: '1', unit: 'حبة' },
      { name: 'ملح وفلفل', amount: '1', unit: 'ملعقة صغيرة' },
    ],
    steps: [
      'الخطوة الأولى تحضير المكونات في المطبخ بشكل جيد.',
      'الخطوة الثانية طهي المكونات على نار متوسطة حتى النضج.',
      'الخطوة الثالثة تقديم الطبق ساخناً للأسرة.',
    ],
    tips: ['نقدم الطبق ساخناً فوراً بعد الطهي.'],
    englishSearchQuery: '',
  });
  assert.equal(dummyValidation.ok, false);
  if (dummyValidation.ok === false) {
    assert.equal(dummyValidation.reason, 'invalid_schema');
  }
});

test('strict dish image matching rejects unrelated dish photos and approves exact matches', () => {
  assert.equal(doesDishImageStrictlyMatch('Koshari', 'Koshari'), true);
  assert.equal(doesDishImageStrictlyMatch('Roast Turkey', 'Roast Turkey'), true);
  assert.equal(doesDishImageStrictlyMatch('Chicken Kabsa', 'Saudi Chicken Kabsa'), true);
  assert.equal(doesDishImageStrictlyMatch('Koshari', 'Shakshuka'), false);
  assert.equal(doesDishImageStrictlyMatch('Roast Turkey', 'Turkey Meatloaf'), false);
  assert.equal(doesDishImageStrictlyMatch('Crispy Chicken Strips', 'Chicken Marengo'), false);
  assert.equal(doesDishImageStrictlyMatch('', 'Shakshuka'), false);
});

test('API error paths return clean HTTP errors and NEVER mask failures with fake recipes', async () => {
  // 1. Missing GEMINI_API_KEY -> 503
  const savedKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const noKeyServer = await startTestServer({});
  try {
    await assert.rejects(
      () => generateRecipeViaApi('كشري مصري', { apiBaseUrl: noKeyServer.baseUrl }),
      (err: unknown) => err instanceof RecipeApiError && err.status === 503 && err.code === 'MISSING_API_KEY'
    );
  } finally {
    await noKeyServer.close();
    if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
  }

  // 2. Non-food query -> 422 unrecognized_food
  const nonFoodServer = await startTestServer({
    generateFromGemini: async () => ({
      isRecognizedFood: false,
      clarificationNote: 'الطلب ده مش اسم أكلة. اكتب اسم الطبق اللي حابب تعمله.',
    }),
  });
  try {
    await assert.rejects(
      () => generateRecipeViaApi('شاحن موبايل', { apiBaseUrl: nonFoodServer.baseUrl }),
      (err: unknown) => err instanceof RecipeApiError && err.status === 422 && err.retryable === false
    );
  } finally {
    await nonFoodServer.close();
  }

  // 3. Timeout & Rate Limit -> 504 / 429 with retryable: true + CORS headers on /api/*
  const errorServer = await startTestServer({
    generateFromGemini: async query => {
      if (query.includes('تايم')) {
        const timeoutErr = new Error('Gemini request timed out');
        timeoutErr.name = 'AbortError';
        throw timeoutErr;
      }
      const rateErr = new Error('RESOURCE_EXHAUSTED') as Error & { status?: number };
      rateErr.status = 429;
      throw rateErr;
    },
  });
  try {
    const corsPreflight = await fetch(`${errorServer.baseUrl}/api/recipes/generate`, { method: 'OPTIONS' });
    assert.equal(corsPreflight.status, 204);
    assert.equal(corsPreflight.headers.get('access-control-allow-origin'), '*');

    const healthRes = await fetch(`${errorServer.baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    assert.deepEqual(await healthRes.json(), { ok: true });

    await assert.rejects(
      () => generateRecipeViaApi('كشري تايم', { apiBaseUrl: errorServer.baseUrl }),
      (err: unknown) => err instanceof RecipeApiError && err.status === 504 && err.retryable === true
    );
    await assert.rejects(
      () => generateRecipeViaApi('ملوخية', { apiBaseUrl: errorServer.baseUrl }),
      (err: unknown) => err instanceof RecipeApiError && err.status === 429 && err.retryable === true
    );
  } finally {
    await errorServer.close();
  }
});

test('TTS speech segments and offline saved recipes (new AI & legacy format) work cleanly without Gemini calls', () => {
  const validated = validateAndNormalizeGeminiRecipe({
    isRecognizedFood: true,
    ...ACCEPTANCE_FIXTURES['مطازيز سعودية'],
    servings: 4,
  });
  assert.equal(validated.ok, true);
  if (!validated.ok) return;

  const onlineRecipe = aiRecipeToOnlineRecipe(validated.data);
  const sections = getRecipeDisplaySections(onlineRecipe);
  assert.equal(sections.ingredients.length, 4);
  assert.equal(sections.steps.length, 3);
  assert.equal(sections.tips.length, 1);

  const segments = buildEgyptianRecipeSpeechSegments(
    onlineRecipe.dishName || onlineRecipe.title,
    onlineRecipe.servings,
    sections.ingredients,
    sections.steps
  );
  assert.ok(segments[0].includes('مطازيز سعودية باللحم والخضار'));
  assert.ok(segments[1].includes('4 أفراد'));
  assert.ok(segments.some(s => s.includes(formatStructuredIngredientLine(validated.data.ingredients[0])) || s.includes('دقيق قمح أسمر')));
  assert.ok(segments.some(s => s.includes('الخطوة الأولى:')));

  // Legacy saved item + new AI item both restore cleanly offline via SAVED_KEY without inventing flags
  const legacySaved = {
    title: 'فتة شاورما بيتي',
    servings: 4,
    pageId: 123456,
    url: '',
    extract: 'المكونات (4 أفراد):\n• 500 جم صدور دجاج\n• 2 كوب أرز بسمتي\n\nطريقة التحضير:\n1. تبلي الدجاج واشويه.\n2. رصي العيش المحمص والأرز والشاورما.',
  };

  const fakeStorage = {
    getItem: (key: string) => (key === SAVED_KEY ? JSON.stringify([onlineRecipe, legacySaved]) : null),
  };

  const restored = readSavedRecipes(fakeStorage);
  assert.equal(restored.length, 2);
  assert.equal(getRecipeOriginBadge(restored[0]).label, '🇸🇦 المطبخ السعودي');
  assert.equal(getRecipeOriginBadge(restored[1]).label, 'وصفة محفوظة');
  const legacySections = getRecipeDisplaySections(restored[1]);
  assert.equal(legacySections.ingredients.length, 2);
  assert.equal(legacySections.steps.length, 2);
});

test('3-Tier Local-First + Cache-First (100-item LRU) + Gemini Flash pipeline minimizes API quota and preserves accuracy', async () => {
  assert.equal(GEMINI_MODEL, 'gemini-3.5-flash-lite');
  assert.equal(GEMINI_MAX_OUTPUT_TOKENS, 1200);
  assert.equal(GENERATED_CACHE_MAX_ITEMS, 100);

  const memoryMap = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => memoryMap.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memoryMap.set(key, value);
    },
  };

  // Tier 2: Dish in built-in local catalog resolves immediately online WITHOUT calling Gemini API
  let geminiCalls = 0;
  const tier2Online = await resolveOnlineOrOfflineRecipe('مطازيز سعودية', {
    isNative: true,
    isOffline: false,
    storage: mockStorage,
    clientSdkDeps: {
      generateFromGemini: async () => {
        geminiCalls += 1;
        throw new Error('Tier 2 catalog dish must not call Gemini API');
      },
    },
  });
  assert.equal(geminiCalls, 0);
  assert.equal(tier2Online.mode, 'catalog');
  assert.equal(getRecipeOriginBadge(tier2Online.recipes[0]).label, '🇸🇦 المطبخ السعودي');

  // Tier 3: Dish NOT in Tier 1 cache or Tier 2 local catalog calls Gemini API once and auto-caches in LRU
  const novelDishFixture = {
    isRecognizedFood: true,
    clarificationNote: '',
    dishName: 'رامين ياباني بالدجاج والميسو',
    cuisineName: 'المطبخ الياباني',
    originCountryCode: 'JP',
    servings: 4,
    prepTimeMinutes: 20,
    cookTimeMinutes: 30,
    totalTimeMinutes: 50,
    ingredients: [
      { name: 'نودلز رامين', amount: '400', unit: 'جرام' },
      { name: 'صدور دجاج مشوية شرائح', amount: '500', unit: 'جرام' },
      { name: 'معجون ميسو ومرقة دجاج', amount: '4', unit: 'كوب' },
    ],
    steps: [
      'حضري مرقة الدجاج مع الثوم والزنجبيل ومعجون الميسو على نار هادئة لمدة 20 دقيقة.',
      'اسلقي نودلز الرامين في ماء مغلي لمدة 4 دقائق ثم صفيها ووزعيها في 4 أطباق عميقة.',
      'صبي المرقة الساخنة فوق النودلز ورصي شرائح الدجاج والبيض المسلوق والبصل الأخضر.',
    ],
    tips: ['لا تتركي الميسو يغلي بقوة حتى يحتفظ بنكهته الغنية.'],
    englishSearchQuery: 'Chicken Ramen',
  };

  const tier3FirstCall = await resolveOnlineOrOfflineRecipe('رامين ياباني', {
    isNative: true,
    isOffline: false,
    storage: mockStorage,
    clientSdkDeps: {
      generateFromGemini: async () => {
        geminiCalls += 1;
        return novelDishFixture;
      },
      lookupVerifiedPhoto: async () => null,
    },
  });
  assert.equal(geminiCalls, 1);
  assert.equal(tier3FirstCall.mode, 'ai');
  assert.equal(tier3FirstCall.recipes[0].countryFlag, '🇯🇵');

  // Tier 1 (Generated Recipes Cache hit): Searching again (even with spelling/yaa variation & offline!) resolves in <1ms with ZERO Gemini calls
  const tier1CacheHit = await resolveOnlineOrOfflineRecipe('  رامين   يابانى ', {
    isNative: true,
    isOffline: true,
    storage: mockStorage,
    clientSdkDeps: {
      generateFromGemini: async () => {
        geminiCalls += 1;
        throw new Error('Cached recipe must never call Gemini again');
      },
    },
  });
  assert.equal(geminiCalls, 1);
  assert.equal(tier1CacheHit.mode, 'cache');
  assert.equal(tier1CacheHit.recipes[0].dishName, 'رامين ياباني بالدجاج والميسو');

  // Tier 1 (Saved Recipes hit): Searching a user-saved recipe resolves immediately from Tier 1
  const savedItem = tier3FirstCall.recipes[0];
  const tier1SavedHit = await resolveOnlineOrOfflineRecipe('رامين ياباني بالدجاج والميسو', {
    isNative: true,
    isOffline: true,
    savedRecipes: [savedItem],
    storage: mockStorage,
  });
  assert.equal(tier1SavedHit.mode, 'cache');
  assert.equal(tier1SavedHit.recipes[0].pageId, savedItem.pageId);

  // LRU Eviction at 100 items: inserting 105 items keeps exactly 100 most-recent items
  for (let i = 1; i <= 105; i += 1) {
    saveGeneratedRecipeToLruCache(
      `وصفة خاصة رقم ${i}`,
      {
        ...savedItem,
        title: `وصفة خاصة رقم ${i}`,
        dishName: `وصفة خاصة رقم ${i}`,
        pageId: 800000 + i,
      },
      mockStorage,
      GENERATED_CACHE_MAX_ITEMS
    );
  }
  const cacheAfter105 = readGeneratedRecipesCache(mockStorage);
  assert.equal(cacheAfter105.length, 100);
  assert.equal(cacheAfter105[0].recipe.title, 'وصفة خاصة رقم 105');
  assert.equal(
    cacheAfter105.some(entry => entry.recipe.title === 'وصفة خاصة رقم 1'),
    false
  );

  // Tier 3 Error Handling: Uncached novel dish when key is missing or offline must throw clean error (no dummy fallback)
  await assert.rejects(
    () =>
      resolveOnlineOrOfflineRecipe('تكا مسالا هندي', {
        isNative: true,
        isOffline: false,
        storage: mockStorage,
        clientSdkDeps: { apiKey: '' },
      }),
    (err: unknown) => err instanceof RecipeApiError && err.code === 'MISSING_API_KEY'
  );

  assert.deepEqual(searchOfflineLocalRecipes('أكلة خيالية مش موجودة خالص'), []);
  await assert.rejects(
    () =>
      resolveOnlineOrOfflineRecipe('أكلة خيالية مش موجودة خالص', {
        isNative: true,
        isOffline: true,
        storage: mockStorage,
      }),
    (err: unknown) => err instanceof RecipeApiError && err.code === 'OFFLINE' && err.retryable === true
  );
});

test('all 22 Egyptian, Gulf/Saudi, Levantine, Moroccan, and Iraqi dishes resolve accurate origin flags, authentic ingredients, TTS, and save state', async () => {
  const expectedDishes: Array<{ query: string; expectedBadge: string; expectNoEgyptFlag?: boolean }> = [
    { query: 'كشري مصري', expectedBadge: '🇪🇬 المطبخ المصري' },
    { query: 'ملوخية بالارانب', expectedBadge: '🇪🇬 المطبخ المصري' },
    { query: 'بصارة', expectedBadge: '🇪🇬 المطبخ المصري' },
    { query: 'مسقعة بالبشاميل', expectedBadge: '🇪🇬 المطبخ المصري' },
    { query: 'فطير مشلتت', expectedBadge: '🇪🇬 المطبخ المصري' },
    { query: 'حواوشي اسكندراني', expectedBadge: '🇪🇬 المطبخ المصري' },
    { query: 'ممبار', expectedBadge: '🇪🇬 المطبخ المصري' },
    { query: 'كوارع', expectedBadge: '🇪🇬 المطبخ المصري' },
    { query: 'ارز معمر', expectedBadge: '🇪🇬 المطبخ المصري' },
    { query: 'أم علي', expectedBadge: '🇪🇬 المطبخ المصري' },
    { query: 'مطازيز', expectedBadge: '🇸🇦 المطبخ السعودي', expectNoEgyptFlag: true },
    { query: 'مسحب', expectedBadge: '🇸🇦 المطبخ السعودي', expectNoEgyptFlag: true },
    { query: 'جريش', expectedBadge: '🇸🇦 المطبخ السعودي', expectNoEgyptFlag: true },
    { query: 'قرصان', expectedBadge: '🇸🇦 المطبخ السعودي', expectNoEgyptFlag: true },
    { query: 'سليق طائفي', expectedBadge: '🇸🇦 المطبخ السعودي', expectNoEgyptFlag: true },
    { query: 'كبسة دجاج', expectedBadge: '🇸🇦 المطبخ السعودي', expectNoEgyptFlag: true },
    { query: 'كبيبة شامية', expectedBadge: 'المطبخ الشامي', expectNoEgyptFlag: true },
    { query: 'كبة', expectedBadge: 'المطبخ الشامي', expectNoEgyptFlag: true },
    { query: 'مسخن فلسطيني', expectedBadge: '🇵🇸 المطبخ الفلسطيني', expectNoEgyptFlag: true },
    { query: 'مقلوبة', expectedBadge: 'المطبخ الشامي', expectNoEgyptFlag: true },
    { query: 'منسف أردني', expectedBadge: '🇯🇴 المطبخ الأردني', expectNoEgyptFlag: true },
    { query: 'طاجن لحم بالبرقوق', expectedBadge: '🇲🇦 المطبخ المغربي', expectNoEgyptFlag: true },
    { query: 'مسقوف عراقي', expectedBadge: '🇮🇶 المطبخ العراقي', expectNoEgyptFlag: true },
  ];

  for (const item of expectedDishes) {
    const res = await resolveOnlineOrOfflineRecipe(item.query, { isNative: true, isOffline: true });
    assert.ok(res.recipes.length >= 1, `Expected recipe result for ${item.query}`);
    const top = res.recipes[0];
    const badge = getRecipeOriginBadge(top);
    assert.equal(badge.label, item.expectedBadge, `Origin badge mismatch for ${item.query}`);
    if (item.expectNoEgyptFlag) {
      assert.equal(badge.label.includes('🇪🇬'), false, `Egypt flag must not appear on ${item.query}`);
    }
    const sections = getRecipeDisplaySections(top);
    assert.ok(sections.ingredients.length >= 3, `Expected >=3 real ingredients for ${item.query}`);
    assert.equal(sections.ingredients.join(' ').includes('المكون الرئيسي'), false);
    assert.ok(sections.steps.length >= 2, `Expected steps for ${item.query}`);
    const segments = buildEgyptianRecipeSpeechSegments(top.title, top.servings, sections.ingredients, sections.steps);
    assert.ok(segments.length >= 6);
    const saved = readSavedRecipes({ getItem: k => (k === SAVED_KEY ? JSON.stringify([top]) : null) });
    assert.equal(saved.length, 1);
  }
});
