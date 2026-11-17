import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EGYPT_2026_MARKET_PRICES,
  VERIFIED_EGYPT_PRICES_STORAGE_KEY,
  classifyEgyptProductCategory,
  extractEgpPricesFromText,
  fetchRealEgyptMarketPrice,
  filterPriceOutliers,
  getAllVerifiedEgyptPrices,
  getLastMarketSyncTimestamp,
  getVerifiedEgyptPrice,
  lookupEgypt2026MarketPrice,
  normalizeMarketItemKey,
  normalizeProductNameForLookup,
  purgeStalePriceCaches,
  saveVerifiedEgyptPrice,
  validatePriceForUnit,
} from '../src/services/egyptMarketPriceService.ts';

function installMockLocalStorage(initialEntries: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initialEntries));
  const mockStorage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    configurable: true,
    writable: true,
  });
  return store;
}

test('verified price cache starts empty under v4 and purges stale v1/v2/v3 caches including 10 EGP bread', () => {
  const store = installMockLocalStorage({
    tedbeera_verified_egypt_prices_v1: JSON.stringify({
      bad_bread: { itemName: 'عيش بلدي سخن', unit: 'رغيف', typicalPrice: 523 },
    }),
    tedbeera_verified_egypt_prices_v2: JSON.stringify({ stale: true }),
    tedbeera_egypt_prices_v3: JSON.stringify({
      bad_v3_bread: { itemName: 'عيش بلدى سخن', unit: 'رغيف', typicalPrice: 10 },
    }),
    tedbeera_egypt_prices_v3_migrated: '1',
  });
  purgeStalePriceCaches();

  assert.equal(VERIFIED_EGYPT_PRICES_STORAGE_KEY, 'tedbeera_egypt_prices_v4');
  assert.equal(store.has('tedbeera_verified_egypt_prices_v1'), false);
  assert.equal(store.has('tedbeera_verified_egypt_prices_v2'), false);
  assert.equal(store.has('tedbeera_egypt_prices_v3'), false);
  assert.equal(store.has('tedbeera_egypt_prices_v3_migrated'), false);
  assert.deepEqual(getAllVerifiedEgyptPrices(), {});
  assert.equal(getVerifiedEgyptPrice('عدس أصفر', 'كيلو'), null);
  assert.equal(getVerifiedEgyptPrice('عيش بلدى سخن', 'رغيف'), null);
});

test('EGYPT_2026_MARKET_PRICES covers 200+ free-market items and strips Arabic cooking adjectives accurately', () => {
  assert.ok(Object.keys(EGYPT_2026_MARKET_PRICES).length >= 200);
  assert.equal(normalizeProductNameForLookup('عيش بلدى سخن'), 'عيش بلدي');
  assert.equal(normalizeProductNameForLookup('طماطم مسبكة'), 'طماطم');
  assert.equal(normalizeProductNameForLookup('العدس الأصفر المسلوق'), 'عدس اصفر');

  // Bread must use free-market السياحي/الحر price (2 EGP/loaf), NEVER 0.20 ration or 10 EGP fallback
  const bread = lookupEgypt2026MarketPrice('عيش بلدى سخن', 'رغيف');
  assert.ok(bread);
  assert.equal(bread.typicalPrice, 2);
  assert.equal(bread.source, 'live_market');

  // Tomatoes ("طماطم مسبكة") must resolve immediately to 10 EGP/kg and 1.5 EGP/حبة (4 حبة = 6 ج.م)
  const tomatoPiece = lookupEgypt2026MarketPrice('طماطم مسبكة', 'حبة');
  assert.ok(tomatoPiece);
  assert.equal(tomatoPiece.typicalPrice, 1.5);
  const tomatoKilo = lookupEgypt2026MarketPrice('طماطم مسبكة', 'كيلو');
  assert.ok(tomatoKilo);
  assert.equal(tomatoKilo.typicalPrice, 10);

  // Yellow lentils: 65 EGP/kg -> 13 EGP/cup
  const lentilsCup = lookupEgypt2026MarketPrice('عدس أصفر', 'كوب');
  assert.ok(lentilsCup);
  assert.equal(lentilsCup.typicalPrice, 13);

  // Unknown item returns null (not a random/max boundary number)
  assert.equal(lookupEgypt2026MarketPrice('صنف غير متوفر في الجدول', 'عبوة'), null);
});

test('saves and normalizes Arabic item names & units under tedbeera_egypt_prices_v4', () => {
  const store = installMockLocalStorage();
  const saved = saveVerifiedEgyptPrice({
    itemName: 'أرز مصري',
    unit: 'كجم',
    typicalPrice: 30,
    source: 'user_verified',
  });

  assert.ok(saved);
  assert.ok(store.has('tedbeera_egypt_prices_v4'));

  const retrieved = getVerifiedEgyptPrice('ارز مصري', 'كيلو');
  assert.ok(retrieved);
  assert.equal(retrieved.typicalPrice, 30);
  assert.equal(retrieved.source, 'user_verified');
  assert.equal(retrieved.sourceLabel, 'سعرك المسجل');
  assert.equal(normalizeMarketItemKey('أرز مصري', 'كجم'), normalizeMarketItemKey('ارز مصري', 'كيلو'));
});

test('extractEgpPricesFromText discards weight/volume numbers and wholesale packs cleanly', () => {
  const snippet = `
    كارفور مصر 2026: عدس أصفر الضحى 500 جم بسعر 62 جنيه |
    طلبات مارت: عدس أصفر الضحى 1 كجم EGP 65.00 خصم 15% |
    نون مصر: عدس أصفر شيكارة 50 كجم بالجملة 2800 جنيه |
    أمازون مصر: عدس أصفر 1000 جرام 68 ج.م
  `;
  const extracted = extractEgpPricesFromText(snippet, 'عدس أصفر', 'كيلو');
  assert.deepEqual([...extracted.prices].sort((a, b) => a - b), [62, 65, 68]);
  assert.ok(extracted.matchedRetailers.includes('كارفور مصر'));
  assert.ok(extracted.matchedRetailers.includes('طلبات مارت'));
  assert.ok(extracted.matchedRetailers.includes('نون مصر'));
  assert.ok(extracted.matchedRetailers.includes('أمازون مصر'));
});

test('universal category classification and unit guardrails enforce free-market Egyptian bounds', () => {
  assert.equal(classifyEgyptProductCategory('عيش بلدى سخن'), 'bakery');
  assert.equal(classifyEgyptProductCategory('طماطم مسبكة'), 'vegetables');
  assert.equal(classifyEgyptProductCategory('فلفل أسود'), 'spices');
  assert.equal(classifyEgyptProductCategory('بريل غسيل أطباق'), 'household_detergents');
  assert.equal(classifyEgyptProductCategory('لحمة مفرومة'), 'meat');
  assert.equal(classifyEgyptProductCategory('سمك بلطي'), 'seafood');

  // Bread per loaf (free-market السياحي/الحر 1..6 EGP): rejects 0.20 ration, 10 EGP multipack, and 523 EGP
  assert.equal(validatePriceForUnit('عيش بلدي سخن', 'رغيف', 0.2).isValid, false);
  assert.equal(validatePriceForUnit('عيش بلدي سخن', 'رغيف', 10).isValid, false);
  assert.equal(validatePriceForUnit('عيش بلدي سخن', 'رغيف', 523).isValid, false);
  assert.equal(validatePriceForUnit('عيش بلدي سخن', 'رغيف', 2).isValid, true);
  assert.equal(validatePriceForUnit('عيش فينو', 'رغيف', 2).isValid, true);

  // Vegetables/fruits (5–85 EGP/kg)
  assert.equal(validatePriceForUnit('طماطم مسبكة', 'كيلو', 10).isValid, true);
  assert.equal(validatePriceForUnit('طماطم', 'كيلو', 450).isValid, false);

  // Grains/legumes (12–120 EGP/kg)
  assert.equal(validatePriceForUnit('عدس أصفر', 'كيلو', 65).isValid, true);
  assert.equal(validatePriceForUnit('عدس أصفر', 'كيلو', 4).isValid, false);

  // Oils/ghee (45–350 EGP)
  assert.equal(validatePriceForUnit('زيت عباد الشمس', 'لتر', 85).isValid, true);
  assert.equal(validatePriceForUnit('زيت عباد الشمس', 'لتر', 10).isValid, false);

  // Meat (150–650 EGP/kg) and Seafood (60–650 EGP/kg)
  assert.equal(validatePriceForUnit('لحمة بلدي', 'كيلو', 380).isValid, true);
  assert.equal(validatePriceForUnit('لحمة بلدي', 'كيلو', 40).isValid, false);
  assert.equal(validatePriceForUnit('سمك بلطي', 'كيلو', 85).isValid, true);
});

test('filterPriceOutliers strips statistical anomalies using IQR & median bounds', () => {
  const filtered = filterPriceOutliers([2, 58, 60, 63, 66, 990]);
  assert.deepEqual(filtered, [58, 60, 63, 66]);
});

test('fetchRealEgyptMarketPrice scales small kitchen portions proportionally and rejects distorted live bread prices', async () => {
  installMockLocalStorage();

  // 1. Cup of yellow lentils: retail returns ~65 EGP/kg -> scaled 65 / 5 = 13 EGP/cup
  const cupResult = await fetchRealEgyptMarketPrice('عدس أصفر', 'كوب', {
    isOnline: true,
    fetcher: async (url: string) => {
      if (url.includes('carrefour')) return 'كارفور مصر: عدس أصفر 1 كجم بسعر 65 جنيه';
      if (url.includes('noon')) return 'نون مصر: عدس أصفر 60 ج.م';
      if (url.includes('talabat')) return 'طلبات مارت: عدس أصفر EGP 70';
      return null;
    },
  });

  assert.ok(cupResult);
  assert.equal(cupResult.source, 'live_market');
  assert.notEqual(cupResult.sourceLabel, 'سعرك المسجل');
  assert.equal(cupResult.typicalPrice, 13);

  // 2. Corrupted/multipack bread snippets (10 EGP or 523 EGP) fall back cleanly to 2 EGP free-market loaf price
  const distortedBreadResult = await fetchRealEgyptMarketPrice('عيش بلدى سخن', 'رغيف', {
    isOnline: true,
    fetcher: async () => 'عرض عيش بلدي سخن عبوة 10 جنيه - جملة 523 جنيه',
  });
  assert.ok(distortedBreadResult);
  assert.equal(distortedBreadResult.typicalPrice, 2);
  assert.equal(distortedBreadResult.source, 'live_market');

  // 3. Valid live bread snippets resolve accurately
  const mixedBreadResult = await fetchRealEgyptMarketPrice('عيش بلدى سخن', 'رغيف', {
    isOnline: true,
    fetcher: async (url: string) => {
      if (url.includes('talabat')) return 'طلبات مارت: رغيف عيش بلدي سخن 2 جنيه';
      if (url.includes('carrefour')) return 'كارفور مصر: عيش بلدي رغيف 2.5 ج.م';
      if (url.includes('google')) return 'عيش بلدي سخن رغيف 2 جنيه - عرض 523 جنيه';
      return null;
    },
  });
  assert.ok(mixedBreadResult);
  assert.equal(mixedBreadResult.source, 'live_market');
  assert.ok(mixedBreadResult.typicalPrice >= 1 && mixedBreadResult.typicalPrice <= 6);
  assert.equal(getLastMarketSyncTimestamp(), mixedBreadResult.fetchedAt);
});

test('fetchRealEgyptMarketPrice falls back to EGYPT_2026_MARKET_PRICES when CORS blocks live fetch, and returns null only for unknown items', async () => {
  installMockLocalStorage();

  // Simulates CORS-blocked browser preview or offline mode for everyday Egyptian items
  const corsBlockedTomato = await fetchRealEgyptMarketPrice('طماطم مسبكة', 'حبة', {
    isOnline: true,
    fetcher: async () => null,
  });
  assert.ok(corsBlockedTomato);
  assert.equal(corsBlockedTomato.typicalPrice, 1.5);
  assert.equal(corsBlockedTomato.source, 'live_market');

  const offlineEggs = await fetchRealEgyptMarketPrice('بيض أحمر', 'كرتونة', {
    isOnline: false,
    fetcher: async () => null,
  });
  assert.ok(offlineEggs);
  assert.equal(offlineEggs.typicalPrice, 165);

  const unknownItem = await fetchRealEgyptMarketPrice('صنف غير متوفر إطلاقاً', 'عبوة', {
    isOnline: true,
    fetcher: async () => 'لا توجد نتائج حالياً في الصفحة',
  });
  assert.equal(unknownItem, null);
  assert.equal(getVerifiedEgyptPrice('صنف غير متوفر إطلاقاً', 'عبوة'), null);
});
