import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeArabicSearchTerm,
  matchesArabicSearchAlias,
  scoreRecipeDishRelevance,
  cleanTranslatedArabicTitle,
} from '../src/features/recipes/arabicSearch.ts';

test('normalizes common Arabic spelling variants', () => {
  assert.equal(normalizeArabicSearchTerm('محشى'), normalizeArabicSearchTerm('محشي'));
  assert.equal(normalizeArabicSearchTerm('ملوخية'), normalizeArabicSearchTerm('ملوخيه'));
  assert.equal(normalizeArabicSearchTerm('أرز'), normalizeArabicSearchTerm('ارز'));
  assert.equal(normalizeArabicSearchTerm('ديك رومى'), normalizeArabicSearchTerm('ديك رومي'));
  assert.equal(normalizeArabicSearchTerm('كبيبه'), normalizeArabicSearchTerm('كبيبة'));
});

test('matches Egyptian mahshi and cabbage colloquialisms', () => {
  const aliases = ['محشي', 'محشى', 'كرنب', 'ملفوف', 'ورق كرنب', 'ورق عنب'];
  for (const query of aliases) {
    assert.equal(aliases.some(alias => matchesArabicSearchAlias(query, alias)), true, query);
  }
  assert.equal(matchesArabicSearchAlias('عايز محشي كرنب النهارده', 'محشي'), true);
  assert.equal(matchesArabicSearchAlias('عايز ورق عنب النهارده', 'ورق عنب'), true);
  assert.equal(matchesArabicSearchAlias('ملفوف', 'كرنب'), false);
});

test('does not match partial text inside unrelated words', () => {
  assert.equal(matchesArabicSearchAlias('مكرونة', 'كرنب'), false);
});

test('strict dish relevance rejects unrelated dishes like شاكشوكة or مسقعة when searching ديك رومى or بط', () => {
  assert.equal(
    scoreRecipeDishRelevance('ديك رومى', 'شكشوكة مصرية بالصلصة والبيض', [], ['فطار', 'بيض', 'فلفل رومي']),
    0
  );
  assert.equal(
    scoreRecipeDishRelevance('ديك رومى', 'مسقعة مصرية بالباذنجان والبطاطس', [], ['باذنجان', 'بطاطس']),
    0
  );
  assert.equal(
    scoreRecipeDishRelevance('بط', 'صينية بطاطس بالفراخ في الفرن', [], ['بطاطس', 'فراخ']),
    0
  );
  assert.ok(
    scoreRecipeDishRelevance('ديك رومى', 'ديك رومي مشوي بتتبيلة مصرية', ['ديك رومي', 'تركي']) > 0
  );
  assert.ok(
    scoreRecipeDishRelevance('كبيبه', 'كبيبة شامي مقرمشة بالبرغل واللحمة المفرومة', ['كبيبة', 'كبة']) > 0
  );
});

test('cleanTranslatedArabicTitle removes Latin prefixes cleanly', () => {
  assert.equal(cleanTranslatedArabicTitle('Roast Turkey - ديك رومي مشوي'), 'ديك رومي مشوي');
  assert.equal(cleanTranslatedArabicTitle('كبيبة شامي (Kibbeh)'), 'كبيبة شامي');
});

