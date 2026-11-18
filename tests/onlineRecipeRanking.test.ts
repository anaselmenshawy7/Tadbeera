import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectMealDbCuisineTier,
  QUICK_SEARCH_SUGGESTIONS,
  CUISINE_BADGE_META,
} from '../src/features/recipes/OnlineRecipeSearch.tsx';
import { EGYPTIAN_ARABIC_CATALOG } from '../src/features/recipes/egyptianRecipesCatalog.ts';
import { RECIPES } from '../src/data/seedData.ts';

test('detects Egyptian, Arab, and International cuisine tiers for ingredient finder badges', () => {
  assert.equal(detectMealDbCuisineTier('Egyptian', 'Koshari'), 'egyptian');
  assert.equal(detectMealDbCuisineTier('Moroccan', 'Fish Tagine'), 'arab');
  assert.equal(detectMealDbCuisineTier('Lebanese', 'Fattoush'), 'arab');
  assert.equal(detectMealDbCuisineTier('Turkish', 'Borek'), 'arab');
  assert.equal(detectMealDbCuisineTier('American', 'Shrimp Alfredo'), 'international');
  assert.equal(detectMealDbCuisineTier(undefined, 'جمبري إسكندراني'), 'egyptian');

  assert.equal(CUISINE_BADGE_META.egyptian.label, '🇪🇬 مصري');
  assert.equal(CUISINE_BADGE_META.arab.label, '🌍 عربي');
  assert.equal(CUISINE_BADGE_META.international.label, '🌐 عالمي');
});

test('offline bundled seedData and Egyptian catalog remain intact for offline kitchen library', () => {
  const shrimpRecipes = RECIPES.filter(r => r.name.includes('جمبري'));
  assert.ok(shrimpRecipes.length >= 6);
  assert.ok(shrimpRecipes.some(r => r.cuisine === 'egyptian'));
  assert.ok(shrimpRecipes.some(r => r.cuisine === 'arab'));

  assert.ok(EGYPTIAN_ARABIC_CATALOG.length >= 150);
  for (const item of EGYPTIAN_ARABIC_CATALOG) {
    assert.ok(item.categories.length >= 1, `Expected category tags on ${item.recipe.title}`);
  }
});

test('voice recipe assistant suggestions highlight Egyptian, Saudi, Levantine, and classic dishes', () => {
  assert.deepEqual(
    [...QUICK_SEARCH_SUGGESTIONS],
    ['كشري مصري', 'مطازيز سعودية', 'مسحب', 'ملوخية مصرية', 'كبسة دجاج', 'كبيبة شامية', 'ديك رومي', 'مكرونة بشاميل']
  );
});
