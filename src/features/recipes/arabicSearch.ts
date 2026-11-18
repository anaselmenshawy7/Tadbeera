/**
 * Shared Egyptian-Arabic query normalization and strict dish relevance matching.
 * Keeps the original query for display; normalized forms are used for matching.
 */
export function normalizeArabicSearchTerm(value: string): string {
  return value
    .toLocaleLowerCase('ar')
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchesArabicSearchAlias(query: string, alias: string): boolean {
  const normalizedQuery = normalizeArabicSearchTerm(query);
  const normalizedAlias = normalizeArabicSearchTerm(alias);
  if (!normalizedQuery || !normalizedAlias) return false;
  if (normalizedQuery === normalizedAlias) return true;
  // Support natural Egyptian phrases such as "عايز محشي كرنب" without
  // matching a short alias in the middle of an unrelated word.
  return ` ${normalizedQuery} `.includes(` ${normalizedAlias} `);
}

export const ARABIC_RECIPE_STOP_WORDS = new Set([
  'في', 'علي', 'على', 'من', 'الي', 'إلى', 'عن', 'مع', 'بال', 'و', 'او', 'أو',
  'طريقه', 'طريقة', 'عمل', 'وصفه', 'وصفة', 'اكله', 'أكلة', 'وجبه', 'وجبة',
  'عايز', 'عاوزه', 'عاوز', 'اعمل', 'ازاي', 'كيفيه', 'كيفية', 'تحضير',
  'بتتبيله', 'تتبيله', 'مقلي', 'مشوي', 'مسلوق', 'بالفرن', 'فرن', 'طاسه',
  'صينيه', 'طاجن', 'مصري', 'مصريه', 'شامي', 'شاميه', 'سوري', 'سوريه', 'خليجي',
]);

export function stripArabicDefinitePrefix(word: string): string {
  const cleaned = normalizeArabicSearchTerm(word);
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.startsWith('بال') && cleaned.length > 4) return cleaned.slice(3);
  if (cleaned.startsWith('وال') && cleaned.length > 4) return cleaned.slice(3);
  if (cleaned.startsWith('كال') && cleaned.length > 4) return cleaned.slice(3);
  if (cleaned.startsWith('فال') && cleaned.length > 4) return cleaned.slice(3);
  if (cleaned.startsWith('لل') && cleaned.length > 3) return cleaned.slice(2);
  if (cleaned.startsWith('ال') && cleaned.length > 3) return cleaned.slice(2);
  return cleaned;
}

/**
 * Egyptian & Arabic culinary synonym groups for strict dish matching.
 * All entries are normalized automatically.
 */
const EGYPTIAN_SYNONYM_GROUPS: string[][] = [
  ['كبيبة', 'كبيبه', 'كبة', 'كبه', 'كبيبا'],
  ['ديك رومي', 'ديك رومى', 'ديك', 'تركي'],
  ['فراخ', 'دجاج', 'فرخة', 'فرخه', 'دواجن'],
  ['مسحب', 'ستريبس', 'ستربس', 'ناجتس', 'تندر'],
  ['بروستد', 'بروست'],
  ['زنجر', 'زينجر'],
  ['كوردن بلو', 'كوردون بلو'],
  ['لحمة', 'لحمه', 'لحم', 'لحوم'],
  ['مفروم', 'مفرومة', 'مفرومه'],
  ['مكرونة', 'مكرونه', 'معكرونة', 'معكرونه', 'باستا', 'مكرونات'],
  ['بشاميل', 'باشاميل', 'بشميل'],
  ['نجرسكو', 'نجريسكو'],
  ['محشي', 'محشى', 'محاشي'],
  ['معجنات', 'مخبوزات', 'فطائر', 'فطاير'],
  ['حلويات', 'حلى', 'تحلية', 'تحليه'],
  ['مشويات', 'مشاوي'],
  ['سندوتشات', 'ساندوتش', 'سندوتش', 'ساندويتش', 'ساندويتشات'],
  ['فطار', 'فطور', 'افطار', 'إفطار'],
  ['طواجن', 'طاجن'],
  ['شاورما', 'شاورمه'],
  ['طعمية', 'طعميه', 'فلافل'],
  ['جمبري', 'جمبرى', 'روبيان', 'قريدس'],
  ['سبيط', 'كاليماري', 'كالماري', 'حبار'],
  ['كفتة', 'كفته'],
  ['كبدة', 'كبده'],
  ['رقاق', 'رقائق'],
  ['جلاش', 'بوريك'],
  ['بط', 'بطة', 'بطه'],
  ['حمام', 'زغاليل'],
  ['بلطي', 'بلطى'],
  ['ارز', 'أرز', 'رز'],
  ['مسقعة', 'مسقعه'],
  ['ملوخية', 'ملوخيه'],
  ['بامية', 'باميه'],
  ['بسبوسة', 'بسبوسه', 'هريسة', 'هريسه'],
  ['كنافة', 'كنافه'],
  ['مهلبية', 'مهلبيه'],
  ['قطايف', 'قطايفه'],
  ['زلابية', 'زولابيا', 'لقمة القاضي', 'لقيمات'],
  ['فتة', 'فته'],
  ['شوربة', 'شوربه', 'حساء'],
  ['بانيه', 'اسكالوب', 'كريسبي'],
  ['كرنب', 'ملفوف'],
  ['قرنبيط', 'زهرة', 'زهره'],
  ['باذنجان', 'بتنجان'],
  ['طماطم', 'صلصة', 'صلصه'],
  ['برجر', 'برغر', 'همبرجر'],
  ['بيتزا', 'بتزا'],
  ['كريب', 'فطيرة', 'فطيره'],
  ['خلية نحل', 'خليه نحل'],
  ['مناقيش', 'منقوشة', 'منقوشه'],
  ['سمبوسك', 'سمبوسة', 'سمبوسه'],
  ['باتيه', 'كرواسون'],
  ['كوارع', 'مقادم'],
  ['ممبار', 'مومبار', 'فوارغ'],
  ['فريك', 'فريكة', 'فريكه'],
  ['سبانخ', 'سلق'],
];

const NORMALIZED_SYNONYM_MAP: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const group of EGYPTIAN_SYNONYM_GROUPS) {
    const normGroup = Array.from(
      new Set(group.flatMap(item => {
        const n = normalizeArabicSearchTerm(item);
        return [n, stripArabicDefinitePrefix(n)];
      }).filter(Boolean))
    );
    for (const token of normGroup) {
      const existing = map.get(token) || [];
      map.set(token, Array.from(new Set([...existing, ...normGroup])));
    }
  }
  return map;
})();

export function expandEgyptianTokenSynonyms(token: string): string[] {
  const norm = stripArabicDefinitePrefix(normalizeArabicSearchTerm(token));
  if (!norm) return [];
  const syns = NORMALIZED_SYNONYM_MAP.get(norm);
  return syns ? Array.from(new Set([norm, ...syns])) : [norm];
}

/**
 * Extracts meaningful normalized dish words from a search query, stripping
 * Arabic prefixes ("ال", "بال") and generic filler words. Falls back to all
 * normalized tokens if every word was a cooking style/modifier.
 */
export function extractMeaningfulArabicQueryTokens(query: string): string[] {
  const rawTokens = normalizeArabicSearchTerm(query)
    .split(' ')
    .filter(Boolean)
    .map(stripArabicDefinitePrefix)
    .filter(token => token.length >= 2);

  const meaningful = rawTokens.filter(token => !ARABIC_RECIPE_STOP_WORDS.has(token));
  return meaningful.length > 0 ? meaningful : rawTokens;
}

function tokenizeCandidateWords(text: string): Set<string> {
  const words = normalizeArabicSearchTerm(text).split(' ').filter(Boolean);
  const wordSet = new Set<string>();
  for (const word of words) {
    wordSet.add(word);
    wordSet.add(stripArabicDefinitePrefix(word));
  }
  return wordSet;
}

/**
 * Strict word-boundary & Egyptian synonym relevance scoring against a recipe's
 * title, explicit aliases, category tags, and (strict whole-word) ingredients.
 *
 * Returns 0 when unrelated so searching "ديك رومي" will NEVER match "فلفل رومي"
 * or "شكشوكة".
 */
export function scoreRecipeDishRelevance(
  query: string,
  title: string,
  aliases: string[] = [],
  tags: string[] = [],
  ingredientsText = ''
): number {
  const normQuery = normalizeArabicSearchTerm(query);
  if (!normQuery) return 0;

  const normTitle = normalizeArabicSearchTerm(title);
  const titleWithSpaces = ` ${normTitle} `;
  const titleWords = tokenizeCandidateWords(title);

  const normAliases = aliases.map(a => normalizeArabicSearchTerm(a)).filter(Boolean);
  const aliasWordSets = normAliases.map(a => tokenizeCandidateWords(a));

  const normTags = tags.map(t => normalizeArabicSearchTerm(t)).filter(Boolean);
  const tagWordSets = normTags.map(t => tokenizeCandidateWords(t));

  const queryTokens = extractMeaningfulArabicQueryTokens(query);
  if (queryTokens.length === 0) return 0;

  const strippedQuery = queryTokens.join(' ');

  // 1. Exact title or exact alias match -> highest score
  if (normTitle === normQuery || normTitle === strippedQuery) return 100;
  if (normAliases.some(alias => alias === normQuery || alias === strippedQuery)) return 95;

  // 2. Full query phrase appears intact with word boundaries in title or alias
  if (
    titleWithSpaces.includes(` ${normQuery} `) ||
    (strippedQuery && titleWithSpaces.includes(` ${strippedQuery} `))
  ) {
    return 90;
  }

  // 3. Explicit category/tag match (e.g., searching "معجنات", "حلويات", "دواجن")
  const exactCategoryMatch = tagWordSets.some(tagWords =>
    queryTokens.every(token => {
      const syns = expandEgyptianTokenSynonyms(token);
      return syns.some(syn => !syn.includes(' ') && tagWords.has(syn));
    })
  );
  if (exactCategoryMatch) return 88;

  if (
    normAliases.some(alias => {
      const padded = ` ${alias} `;
      return padded.includes(` ${normQuery} `) || (strippedQuery && padded.includes(` ${strippedQuery} `));
    })
  ) {
    return 85;
  }

  // 4. Multi-word or single-word strict token matching (with synonym expansion)
  const tagWords = tokenizeCandidateWords(tags.join(' '));
  const combinedDishWords = new Set<string>([...titleWords, ...tagWords]);
  for (const ws of aliasWordSets) {
    ws.forEach(w => combinedDishWords.add(w));
  }

  const allTokensMatchTitle = queryTokens.every(token => {
    const syns = expandEgyptianTokenSynonyms(token);
    return syns.some(syn => {
      if (syn.includes(' ')) return titleWithSpaces.includes(` ${syn} `);
      return titleWords.has(syn);
    });
  });
  if (allTokensMatchTitle) return 80;

  const allTokensMatchAliases = aliasWordSets.some(aliasWords =>
    queryTokens.every(token => {
      const syns = expandEgyptianTokenSynonyms(token);
      return syns.some(syn => !syn.includes(' ') && aliasWords.has(syn));
    })
  );
  if (allTokensMatchAliases) return 75;

  const allTokensMatchDishMetadata = queryTokens.every(token => {
    const syns = expandEgyptianTokenSynonyms(token);
    return syns.some(syn => {
      if (syn.includes(' ')) {
        return titleWithSpaces.includes(` ${syn} `) || normAliases.some(a => ` ${a} `.includes(` ${syn} `));
      }
      return combinedDishWords.has(syn);
    });
  });
  if (allTokensMatchDishMetadata) return 65;

  // 5. For multi-word queries where >= 2/3 of meaningful tokens match the title
  if (queryTokens.length >= 3) {
    const matchedInTitle = queryTokens.filter(token =>
      expandEgyptianTokenSynonyms(token).some(syn => titleWords.has(syn))
    ).length;
    if (matchedInTitle >= queryTokens.length - 1 && matchedInTitle >= 2) {
      return 50 + matchedInTitle;
    }
  }

  // 6. Strict whole-word ingredient match (ALL meaningful query tokens must exist
  // as complete normalized words/phrases in the ingredients list)
  if (ingredientsText.trim()) {
    const normIngredients = normalizeArabicSearchTerm(ingredientsText);
    const paddedIngredients = ` ${normIngredients} `;
    const ingredientWords = tokenizeCandidateWords(ingredientsText);
    const allTokensMatchIngredients = queryTokens.every(token => {
      const syns = expandEgyptianTokenSynonyms(token);
      return syns.some(syn => {
        if (syn.includes(' ')) return paddedIngredients.includes(` ${syn} `);
        return ingredientWords.has(syn);
      });
    });
    if (allTokensMatchIngredients) {
      return queryTokens.length >= 2 ? 45 : 38;
    }
  }

  return 0;
}

/**
 * Strips leftover Latin/foreign prefixes from translated recipe titles
 * (e.g. "Roast Turkey - ديك رومي مشوي" -> "ديك رومي مشوي").
 */
export function cleanTranslatedArabicTitle(rawTitle: string): string {
  const trimmed = (rawTitle || '').trim();
  if (!trimmed) return '';
  if (!/[\u0600-\u06FF]/.test(trimmed)) return trimmed;

  const cleaned = trimmed
    .replace(/^[A-Za-z0-9\u00C0-\u024F\s'’"().,!?&]+[-–—:|/]+\s*/u, '')
    .replace(/\s*\([A-Za-z0-9\u00C0-\u024F\s'’".,!?-]+\)\s*$/u, '')
    .replace(/^(?:[A-Za-z\u00C0-\u024F'’.-]+\s+)+(?=[\u0600-\u06FF])/u, '')
    .replace(/^[-–—:|/\s]+|[-–—:|/\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || trimmed;
}

