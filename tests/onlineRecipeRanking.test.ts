import test from 'node:test';
import assert from 'node:assert/strict';
import {
  expandArabicAliasesToEnglishTerms,
  detectMealDbCuisineTier,
  sortAndDedupeOnlineRecipes,
  searchAllLocalArabicRecipes,
  resolveGuaranteedArabicRecipes,
  QUICK_SEARCH_SUGGESTIONS,
  CUISINE_BADGE_META,
} from '../src/features/recipes/OnlineRecipeSearch.tsx';
import { EGYPTIAN_ARABIC_CATALOG } from '../src/features/recipes/egyptianRecipesCatalog.ts';
import { synthesizeDynamicArabicRecipe } from '../src/features/recipes/recipeSynthesizer.ts';
import { RECIPES } from '../src/data/seedData.ts';

test('expands shrimp, crispy chicken strips, pastries, and multi-word Arabic queries into English synonyms', () => {
  const shrimpTerms = expandArabicAliasesToEnglishTerms('جمبري');
  assert.ok(shrimpTerms.includes('shrimp'));
  assert.ok(shrimpTerms.includes('prawns'));

  const multiWordTerms = expandArabicAliasesToEnglishTerms('مكرونة بالجمبري');
  assert.ok(multiWordTerms.includes('pasta'));
  assert.ok(multiWordTerms.includes('shrimp'));
  assert.ok(multiWordTerms.includes('prawns'));

  const calamariTerms = expandArabicAliasesToEnglishTerms('سبيط');
  assert.ok(calamariTerms.includes('squid'));
  assert.ok(calamariTerms.includes('calamari'));

  const turkeyTerms = expandArabicAliasesToEnglishTerms('ديك رومى');
  assert.ok(turkeyTerms.includes('roast turkey'));
  assert.ok(turkeyTerms.includes('turkey'));

  const kibbehTerms = expandArabicAliasesToEnglishTerms('كبيبه');
  assert.ok(kibbehTerms.includes('kibbeh'));

  const musahabTerms = expandArabicAliasesToEnglishTerms('مسحب');
  assert.ok(musahabTerms.includes('crispy chicken strips'));

  const pastryTerms = expandArabicAliasesToEnglishTerms('معجنات');
  assert.ok(pastryTerms.includes('savory pastries'));

  const negrescoTerms = expandArabicAliasesToEnglishTerms('نجرسكو');
  assert.ok(negrescoTerms.includes('chicken alfredo bake'));

  const kabsaTerms = expandArabicAliasesToEnglishTerms('كبسة');
  assert.ok(kabsaTerms.includes('kabsa'));
});

test('detects Egyptian, Arab, and International cuisine tiers from TheMealDB area and title', () => {
  assert.equal(detectMealDbCuisineTier('Egyptian', 'Koshari'), 'egyptian');
  assert.equal(detectMealDbCuisineTier('Moroccan', 'Fish Tagine'), 'arab');
  assert.equal(detectMealDbCuisineTier('Lebanese', 'Fattoush'), 'arab');
  assert.equal(detectMealDbCuisineTier('Turkish', 'Borek'), 'arab');
  assert.equal(detectMealDbCuisineTier('American', 'Shrimp Alfredo'), 'international');
  assert.equal(detectMealDbCuisineTier(undefined, 'جمبري إسكندراني'), 'egyptian');
});

test('ranks merged recipes strictly Egyptian -> Arab -> International and deduplicates', () => {
  const unsorted = [
    { title: 'باستا بالجمبري', cuisine: 'international' as const, pageId: 1 },
    { title: 'كبسة جمبري خليجية', cuisine: 'arab' as const, pageId: 2 },
    { title: 'جمبري إسكندراني', cuisine: 'egyptian' as const, pageId: 3 },
    { title: 'جمبري إسكندراني', cuisine: 'international' as const, pageId: 4 },
  ];
  const sorted = sortAndDedupeOnlineRecipes(unsorted);
  assert.equal(sorted.length, 3);
  assert.equal(sorted[0].cuisine, 'egyptian');
  assert.equal(sorted[1].cuisine, 'arab');
  assert.equal(sorted[2].cuisine, 'international');
  assert.equal(CUISINE_BADGE_META.egyptian.label, '🇪🇬 مصري');
  assert.equal(CUISINE_BADGE_META.arab.label, '🌍 عربي');
  assert.equal(CUISINE_BADGE_META.international.label, '🌐 عالمي');
});

test('seedData includes authentic Egyptian and Arab shrimp recipes', () => {
  const shrimpRecipes = RECIPES.filter(r => r.name.includes('جمبري'));
  assert.ok(shrimpRecipes.length >= 6);
  assert.ok(shrimpRecipes.some(r => r.cuisine === 'egyptian'));
  assert.ok(shrimpRecipes.some(r => r.cuisine === 'arab'));
});

test('built-in Egyptian & Arabic catalog includes 150+ categorized dishes and returns exact matches', () => {
  assert.ok(EGYPTIAN_ARABIC_CATALOG.length >= 150, `Expected 150+ catalog recipes, got ${EGYPTIAN_ARABIC_CATALOG.length}`);
  for (const item of EGYPTIAN_ARABIC_CATALOG) {
    assert.ok(item.categories.length >= 1, `Expected category tags on ${item.recipe.title}`);
  }

  // Screenshot 1 bug regression: "ديك رومى" must match turkey ONLY and NEVER شكشوكة/مسقعة/حواوشي/كبدة
  const turkeyResults = searchAllLocalArabicRecipes('ديك رومى');
  assert.ok(turkeyResults.length >= 2);
  assert.ok(turkeyResults.some(r => r.title.includes('ديك رومي')));
  assert.equal(
    turkeyResults.some(r => /شكشوكة|مسقعة|حواوشي|كبدة/.test(r.title)),
    false
  );

  // Screenshot 2 bug regression: "كبيبه" must return authentic kibbeh recipes
  const kibbehResults = searchAllLocalArabicRecipes('كبيبه');
  assert.ok(kibbehResults.length >= 2);
  assert.ok(kibbehResults.some(r => r.title.includes('كبيبة')));

  // "مسحب" must return دجاج مسحب مقرمش (مسحب البيك المنزلي) and never unrelated dishes
  const musahabResults = searchAllLocalArabicRecipes('مسحب');
  assert.ok(musahabResults.length >= 1);
  assert.ok(musahabResults[0].title.includes('مسحب'));
  assert.equal(
    musahabResults.some(r => /شكشوكة|كبدة/.test(r.title)),
    false
  );

  // Category search: "معجنات" must return 6+ authentic Arabic pastries at the top
  const pastryResults = searchAllLocalArabicRecipes('معجنات');
  assert.ok(pastryResults.length >= 6, `Expected 6+ pastries for معجنات, got ${pastryResults.length}`);
  const pastryTitles = pastryResults.map(r => r.title).join(' | ');
  for (const expectedPastry of ['فطير مشلتت', 'قرص طرية', 'باتيه بالجبنة', 'بيتزا شرقي', 'سمبوسك', 'خلية نحل', 'مناقيش زعتر']) {
    assert.ok(pastryTitles.includes(expectedPastry), `Expected "${expectedPastry}" in معجنات results`);
  }

  // Every required classic & high-demand Egyptian/Arab household dish resolves cleanly
  const requiredQueries = [
    'دجاج مسحب',
    'بروستد فراخ',
    'شيش طاووق',
    'زنجر',
    'كوردن بلو',
    'كبسة',
    'مندي',
    'مكرونة نجرسكو',
    'مكرونة بالبشاميل',
    'كشري مصري',
    'ملوخية بالفراخ',
    'بامية باللحمة',
    'محشي ورق عنب',
    'محشي كرنب',
    'طاجن لحمة بالبصل',
    'كفتة الحاتي',
    'رز بلبن',
    'مهلبية',
    'أم علي',
    'بسبوسة',
    'كنافة',
    'بط محشي',
    'حمام محشي',
    'جلاش باللحمة المفرومة',
    'رقاق ناشف باللحمة',
    'فراخ بانيه',
    'شاورما',
    'فتة مصرية',
    'سمك بلطي',
    'جمبري',
  ];
  for (const q of requiredQueries) {
    const matches = searchAllLocalArabicRecipes(q);
    assert.ok(matches.length >= 1, `Expected built-in Arabic match for "${q}"`);
  }

  // Tier 1 stays strict and never leaks unrelated default dishes on unknown queries
  assert.deepEqual(searchAllLocalArabicRecipes('وصفة خيالية غير موجودة'), []);
});

test('3-tier guaranteed recipe pipeline never returns empty or unrelated fallback dishes', async () => {
  // Tier 1 strong match (>= 2) skips online lookup
  let onlineCalled = false;
  const pastryResolved = await resolveGuaranteedArabicRecipes('معجنات', 6, async () => {
    onlineCalled = true;
    return [];
  });
  assert.equal(onlineCalled, false);
  assert.ok(pastryResolved.length >= 6);

  // Tier 2 triggers when Tier 1 returns < 2 matches
  let tier2Called = false;
  const rareOnlineResolved = await resolveGuaranteedArabicRecipes('تاكو مكسيكي', 4, async () => {
    tier2Called = true;
    return [
      {
        title: 'تاكو لحم متبل بالطريقة المنزلية',
        servings: 4,
        pageId: 777001,
        cuisine: 'international',
        url: 'https://www.themealdb.com/',
        extract: 'المكونات (4 أفراد):\n• 500 جم لحم مفروم\n\nطريقة التحضير:\n1. اطبخي اللحم مع التوابل.',
      },
    ];
  });
  assert.equal(tier2Called, true);
  assert.ok(rareOnlineResolved.some(r => r.title.includes('تاكو')));

  // Tier 3 synthesizer guarantees a custom Arabic home recipe when Tier 1 and Tier 2 return empty or fail
  const customQuery = 'أكلة صعيدية تراثية بالخبيزة';
  const tier3Resolved = await resolveGuaranteedArabicRecipes(customQuery, 5, async () => {
    throw new Error('network unavailable');
  });
  assert.equal(tier3Resolved.length, 1);
  assert.equal(tier3Resolved[0].title, `طريقة عمل ${customQuery} في البيت`);
  assert.equal(tier3Resolved[0].isSynthesized, true);
  assert.ok(tier3Resolved[0].prepTime);
  assert.ok(tier3Resolved[0].extract.includes('المكونات'));
  assert.ok(tier3Resolved[0].extract.includes('طريقة التحضير'));
  assert.equal(/شكشوكة|كبدة/.test(tier3Resolved[0].title), false);

  // Direct synthesizer strips conversational prefixes cleanly and formats sweet dishes properly
  const sweetSynth = synthesizeDynamicArabicRecipe('طريقة عمل تورتة الفستق بالكراميل', 4);
  assert.equal(sweetSynth.title, 'طريقة عمل تورتة الفستق بالكراميل في البيت');
  assert.ok(sweetSynth.extract.includes('دقيق'));

  assert.deepEqual([...QUICK_SEARCH_SUGGESTIONS], ['معجنات', 'دجاج مسحب', 'ديك رومي', 'كبيبة', 'نجرسكو', 'حلويات']);
});


