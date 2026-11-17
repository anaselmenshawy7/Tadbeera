import test from 'node:test';
import assert from 'node:assert/strict';
import {
  expandArabicAliasesToEnglishTerms,
  detectMealDbCuisineTier,
  sortAndDedupeOnlineRecipes,
  CUISINE_BADGE_META,
} from '../src/features/recipes/OnlineRecipeSearch.tsx';
import { RECIPES } from '../src/data/seedData.ts';

test('expands shrimp and multi-word Arabic queries into English synonyms', () => {
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
