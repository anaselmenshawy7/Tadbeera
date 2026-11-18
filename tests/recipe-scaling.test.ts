import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aiRecipeToOnlineRecipe,
  getRecipeDisplaySections,
  readSavedRecipes,
  SAVED_KEY,
  scaleMeasure as scaleOnlineMeasure,
  scaleOnlineRecipeForServings,
  resolveOnlineOrOfflineRecipe,
} from '../src/features/recipes/OnlineRecipeSearch.tsx';
import { scaleMeasure as scaleIngredientMeasure } from '../src/features/recipes/IngredientRecipeFinder.tsx';
import {
  clampRecipeServings,
  getRecipeScaleFactor,
  scaleArabicIngredientLine,
  scaleStructuredIngredient,
} from '../src/features/recipes/recipeScaling.ts';
import { validateAndNormalizeGeminiRecipe } from '../src/features/recipes/recipeSchema.ts';
import { buildEgyptianRecipeSpeechSegments } from '../src/features/recipes/recipeSpeech.ts';

test('online recipe quantities scale from four base servings to the selected household size', () => {
  assert.equal(scaleOnlineMeasure('2 cups', 6), '3 cups');
  assert.equal(scaleOnlineMeasure('1/2 cup', 8), '1 cup');
  assert.equal(scaleOnlineMeasure('1 tablespoon', 2), '0.5 tablespoon');
  assert.equal(scaleOnlineMeasure('1 1/2 cups', 2), '0.75 cups');
});

test('ingredient-based recipe quantities scale using the same household ratio', () => {
  assert.equal(scaleIngredientMeasure('4 eggs', 2), '2 eggs');
  assert.equal(scaleIngredientMeasure('1/2 cup', 8), '1 cup');
  assert.equal(scaleIngredientMeasure('a pinch', 6), 'a pinch');
  assert.equal(scaleIngredientMeasure('1 1/2 cups', 8), '3 cups');
});

test('Dynamic Family Size Scaling (1 to 50 servings) scales AI & Offline Catalog recipes for 2, 7, and 20 servings in <10ms with zero API calls', async () => {
  assert.equal(clampRecipeServings(0), 1);
  assert.equal(clampRecipeServings(4), 4);
  assert.equal(clampRecipeServings(65), 50);
  assert.equal(getRecipeScaleFactor(2, 4), 0.5);
  assert.equal(getRecipeScaleFactor(7, 4), 1.75);
  assert.equal(getRecipeScaleFactor(20, 4), 5);

  const validated = validateAndNormalizeGeminiRecipe({
    isRecognizedFood: true,
    dishName: 'كشري مصري أصلي بالدقة والصلصة',
    cuisineName: 'المطبخ المصري',
    originCountryCode: 'EG',
    servings: 4,
    prepTimeMinutes: 25,
    cookTimeMinutes: 45,
    totalTimeMinutes: 70,
    ingredients: [
      { name: 'أرز مصري مغسول', amount: '2', unit: 'كوب' },
      { name: 'عدس بجبة منقوع', amount: '1', unit: 'كوب' },
      { name: 'مكرونة مرمرية واسباجتي', amount: '400', unit: 'جرام' },
      { name: 'لحم مفروم متبل (اختياري للتقديم)', amount: '300', unit: 'جرام' },
      { name: 'عصير طماطم طازج', amount: '500', unit: 'مللي' },
      { name: 'بصل مقطع جوانح للتقلية', amount: '2', unit: 'بصلة' },
      { name: 'ثوم مفروم للدقة والصلصة', amount: '5', unit: 'فص' },
      { name: 'بيض مسلوق مدحرج', amount: '1', unit: 'بيضة' },
      { name: 'كمون مطحون', amount: '1', unit: 'ملعقة صغيرة' },
    ],
    steps: [
      'حمّري البصل الجوانح في الزيت حتى يصبح ذهبياً ومقرمشاً.',
      'اسلقي العدس نصف سلقة ثم اطهيه مع الأرز والشعرية.',
      'سبّكي صلصة الطماطم بالثوم والخل والكمون وقدمي الكشري ساخناً.',
    ],
    tips: ['استخدمي زيت البصل في الأرز والصلصة لطعم أصلي.'],
    englishSearchQuery: 'Koshari',
  });
  assert.equal(validated.ok, true);
  if (!validated.ok) return;

  const baseRecipe = aiRecipeToOnlineRecipe(validated.data);
  assert.equal(baseRecipe.servings, 4);

  const startMs = performance.now();
  const sections2 = getRecipeDisplaySections(baseRecipe, 2);
  const sections7 = getRecipeDisplaySections(baseRecipe, 7);
  const sections20 = getRecipeDisplaySections(baseRecipe, 20);
  const elapsedMs = performance.now() - startMs;
  assert.ok(elapsedMs < 10, `Expected local scaling in <10ms, took ${elapsedMs.toFixed(2)}ms`);

  // 1) 2 Servings (scaleFactor = 0.5)
  assert.deepEqual(sections2.ingredients, [
    '1 كوب أرز مصري مغسول',
    'نصف كوب عدس بجبة منقوع',
    '200 جرام مكرونة مرمرية واسباجتي',
    '150 جرام لحم مفروم متبل (اختياري للتقديم)',
    '250 مللي عصير طماطم طازج',
    '1 بصلة بصل مقطع جوانح للتقلية',
    '3 فص ثوم مفروم للدقة والصلصة',
    '1 بيضة بيض مسلوق مدحرج', // Countable never drops below 1!
    'نصف ملعقة صغيرة كمون مطحون',
  ]);

  // 2) 7 Servings (scaleFactor = 1.75)
  assert.deepEqual(sections7.ingredients, [
    '3.5 كوب أرز مصري مغسول',
    'كوبان عدس بجبة منقوع',
    '700 جرام مكرونة مرمرية واسباجتي',
    '525 جرام لحم مفروم متبل (اختياري للتقديم)',
    '875 مللي عصير طماطم طازج',
    '3.5 بصلة بصل مقطع جوانح للتقلية',
    '9 فص ثوم مفروم للدقة والصلصة',
    '2 بيضة بيض مسلوق مدحرج',
    '2 ملعقة صغيرة كمون مطحون',
  ]);

  // 3) 20 Servings (scaleFactor = 5) — >=1000g converts to كيلو and >=1000ml converts to لتر
  assert.deepEqual(sections20.ingredients, [
    '10 كوب أرز مصري مغسول',
    '5 كوب عدس بجبة منقوع',
    '2 كيلو مكرونة مرمرية واسباجتي', // 2000g -> 2 كيلو
    '1.5 كيلو لحم مفروم متبل (اختياري للتقديم)', // 1500g -> 1.5 كيلو
    '2.5 لتر عصير طماطم طازج', // 2500ml -> 2.5 لتر
    '10 بصلة بصل مقطع جوانح للتقلية',
    '25 فص ثوم مفروم للدقة والصلصة',
    '5 بيضة بيض مسلوق مدحرج',
    '5 ملعقة صغيرة كمون مطحون',
  ]);

  // Check clean fraction words (ربع، نصف، كوبان) and zero ugly repeating decimals
  assert.equal(
    scaleArabicIngredientLine('نصف كوب لبن', 2, 4),
    'ربع كوب لبن'
  );
  assert.equal(
    scaleArabicIngredientLine('1 كوب مرقة', 8, 4),
    'كوبان مرقة'
  );
  const thirdCupScaled = scaleStructuredIngredient(
    { name: 'زيت زيتون', amount: '1/3', unit: 'كوب' },
    7,
    4
  );
  assert.equal(thirdCupScaled.amount.includes('333'), false);

  // 4) Offline Local Catalog scaling (2, 7, 20 servings)
  const catalogResult = await resolveOnlineOrOfflineRecipe('ملوخية بالارانب', {
    isNative: true,
    isOffline: true,
  });
  const catalogRecipe = catalogResult.recipes[0];
  assert.equal(catalogRecipe.servings, 4);

  const catalog2 = getRecipeDisplaySections(catalogRecipe, 2);
  const catalog7 = getRecipeDisplaySections(catalogRecipe, 7);
  const catalog20 = getRecipeDisplaySections(catalogRecipe, 20);

  assert.ok(catalog2.ingredients.some(line => line.includes('250 جرام ملوخية')));
  assert.ok(catalog7.ingredients.some(line => line.includes('875 جرام ملوخية')));
  assert.ok(catalog20.ingredients.some(line => line.includes('2.5 كيلو ملوخية')));

  // 5) TTS reads the newly scaled quantities for the selected serving count
  const tts7 = buildEgyptianRecipeSpeechSegments(
    baseRecipe.title,
    7,
    sections7.ingredients,
    sections7.steps
  );
  assert.ok(tts7[1].includes('7 أفراد'));
  assert.ok(tts7.some(seg => seg.includes('700 جرام مكرونة')));

  // 6) Saving a recipe at 7 servings persists servings=7 and allows re-scaling to 20 servings without drift
  const savedAt7 = scaleOnlineRecipeForServings(baseRecipe, 7);
  assert.equal(savedAt7.servings, 7);
  assert.equal(savedAt7.baseServings, 4);

  const restoredSaved = readSavedRecipes({
    getItem: key => (key === SAVED_KEY ? JSON.stringify([savedAt7]) : null),
  });
  assert.equal(restoredSaved[0].servings, 7);
  assert.deepEqual(getRecipeDisplaySections(restoredSaved[0]).ingredients, sections7.ingredients);
  assert.deepEqual(getRecipeDisplaySections(restoredSaved[0], 20).ingredients, sections20.ingredients);
});
