import test from 'node:test';
import assert from 'node:assert/strict';
import {
  humanizeArabicRecipeSpeech,
  buildEgyptianRecipeSpeechSegments,
  pickNaturalEgyptianFemaleVoice,
} from '../src/features/recipes/recipeSpeech.ts';
import {
  DEFAULT_BUDGET_CATEGORIES,
  BUDGET_PRESETS,
  RECIPES,
} from '../src/data/seedData.ts';
import { normalizeBudgetPercentages } from '../src/data/calculationUtils.ts';
import {
  cleanTranslatedArabicTitle,
  sortIngredientFinderResults,
} from '../src/features/recipes/IngredientRecipeFinder.tsx';
import { resolveRecipeArtworkKind } from '../src/components/RecipeIllustration.tsx';

test('humanizeArabicRecipeSpeech converts fractions and abbreviations to natural Egyptian speech', () => {
  const sample = '• 1/2 كوب زيت، 1/4 كيلو جمبري، 3/4 كوب مية، 2 م ك صلصة، 1 م.ص كمون، 500 جم أرز، 250 مل لبن';
  const spoken = humanizeArabicRecipeSpeech(sample);
  assert.ok(spoken.includes('نص كوب زيت'));
  assert.ok(spoken.includes('ربع كيلو جمبري'));
  assert.ok(spoken.includes('تلات أرباع كوب مية'));
  assert.ok(spoken.includes('معلقة كبيرة صلصة'));
  assert.ok(spoken.includes('معلقة صغيرة كمون'));
  assert.ok(spoken.includes('500 جرام أرز'));
  assert.ok(spoken.includes('250 مللي لبن'));
  assert.equal(spoken.includes('•'), false);
});

test('buildEgyptianRecipeSpeechSegments adds warm Egyptian intros and step transitions', () => {
  const segments = buildEgyptianRecipeSpeechSegments(
    'جمبري إسكندراني',
    4,
    ['1/2 كيلو جمبري', '2 م.ك زيت'],
    ['نسخن الزيت ونشوح الثوم.']
  );
  assert.ok(segments[0].includes('يلا نجهز مع بعض وصفة جمبري إسكندراني'));
  assert.ok(segments.some(s => s.includes('أول حاجة هنحتاج المكونات دي')));
  assert.ok(segments.some(s => s.includes('نص كيلو جمبري')));
  assert.ok(segments.some(s => s.includes('ودلوقتي طريقة التحضير خطوة بخطوة')));
  assert.ok(segments.some(s => s.includes('الخطوة الأولى')));
});

test('pickNaturalEgyptianFemaleVoice prefers ar-EG female/natural voice', () => {
  const mockVoices = [
    { name: 'Arabic Male Tariq', lang: 'ar-SA', localService: true, voiceURI: 'male' },
    { name: 'Microsoft Hoda Online (Natural) - Arabic (Egypt)', lang: 'ar-EG', localService: false, voiceURI: 'hoda' },
    { name: 'Google Arabic', lang: 'ar', localService: false, voiceURI: 'google' },
  ] as unknown as SpeechSynthesisVoice[];

  const chosen = pickNaturalEgyptianFemaleVoice(mockVoices);
  assert.ok(chosen);
  assert.equal(chosen.lang, 'ar-EG');
});

test('default budget categories and all presets sum strictly to 100%', () => {
  const defaultSum = DEFAULT_BUDGET_CATEGORIES.reduce((sum, c) => sum + c.defaultPct, 0);
  assert.equal(defaultSum, 100);
  assert.deepEqual(
    DEFAULT_BUDGET_CATEGORIES.map(c => c.defaultPct),
    [45, 25, 15, 10, 5]
  );

  for (const preset of BUDGET_PRESETS) {
    const sum = preset.percentages.reduce((a, b) => a + b, 0);
    assert.equal(sum, 100, `Preset "${preset.name}" must sum to 100%`);
  }

  // Corrupted 160% or wrong-length percentages normalize cleanly to exact 100%
  const normalized160 = normalizeBudgetPercentages([60, 40, 25, 20, 15], DEFAULT_BUDGET_CATEGORIES);
  assert.equal(normalized160.length, DEFAULT_BUDGET_CATEGORIES.length);
  assert.equal(normalized160.reduce((a, b) => a + b, 0), 100);

  const normalizedMismatch = normalizeBudgetPercentages([50, 50], DEFAULT_BUDGET_CATEGORIES);
  assert.equal(normalizedMismatch.length, DEFAULT_BUDGET_CATEGORIES.length);
  assert.equal(normalizedMismatch.reduce((a, b) => a + b, 0), 100);
});

test('cleanTranslatedArabicTitle strips Latin prefixes and sortIngredientFinderResults enforces 3-tier order', () => {
  assert.equal(cleanTranslatedArabicTitle('Kaspressknödel - كاسبريسنودل'), 'كاسبريسنودل');
  assert.equal(cleanTranslatedArabicTitle('Boeuf Bourguignon: لحم بالصلصة'), 'لحم بالصلصة');
  assert.equal(cleanTranslatedArabicTitle('شاورما فراخ (Shawarma)'), 'شاورما فراخ');

  const ranked = sortIngredientFinderResults([
    { cuisine: 'international' as const, matched: 5, total: 5, missing: [] },
    { cuisine: 'arab' as const, matched: 2, total: 5, missing: ['a', 'b', 'c'] },
    { cuisine: 'egyptian' as const, matched: 1, total: 4, missing: ['a', 'b', 'c'] },
  ]);

  assert.equal(ranked[0].cuisine, 'egyptian');
  assert.equal(ranked[1].cuisine, 'arab');
  assert.equal(ranked[2].cuisine, 'international');
});

test('every built-in recipe resolves to a rich dish artwork kind offline', () => {
  for (const recipe of RECIPES) {
    const kind = resolveRecipeArtworkKind(recipe.name, recipe.svgFallbackIcon || 'koshari', recipe.id);
    assert.ok(kind && kind.length > 0, `Recipe ${recipe.id} must have a valid artwork kind`);
  }
  assert.equal(resolveRecipeArtworkKind('جمبري إسكندراني', 'meat', 'rec_shrimp_alexandrian'), 'shrimp');
  assert.equal(resolveRecipeArtworkKind('طاجن بامية باللحمة', 'soup', 'rec_bamia_meat_egyptian'), 'bamia');
  assert.equal(resolveRecipeArtworkKind('ملوخية بالجمبري', 'soup', 'rec_molokhia_shrimp'), 'shrimp');
  assert.equal(resolveRecipeArtworkKind('الملوخية المصرية بالأرانب', 'soup', 'rec_molokhia'), 'molokhia');
});
