import { Capacitor, CapacitorHttp } from '@capacitor/core';

export const VERIFIED_EGYPT_PRICES_STORAGE_KEY = 'tedbeera_egypt_prices_v4';
export const VERIFIED_EGYPT_LAST_SYNC_KEY = 'tedbeera_egypt_last_sync_v4';
export const VERIFIED_PRICES_UPDATED_EVENT = 'tedbeera_verified_prices_updated';

const STALE_PRICE_CACHE_KEYS = [
  'tedbeera_verified_egypt_prices_v1',
  'tedbeera_verified_egypt_last_sync_v1',
  'tedbeera_verified_egypt_prices_v2',
  'tedbeera_verified_egypt_last_sync_v2',
  'tedbeera_egypt_prices_v1',
  'tedbeera_egypt_prices_v2',
  'tedbeera_egypt_prices_v3',
  'tedbeera_egypt_last_sync_v3',
  'tedbeera_egypt_prices_v3_migrated',
];

export type EgyptPriceSource = 'live_market' | 'user_verified';

export type EgyptProductCategory =
  | 'bakery'
  | 'dairy_eggs'
  | 'vegetables'
  | 'fruits'
  | 'grains_legumes'
  | 'oils_ghee'
  | 'poultry'
  | 'meat'
  | 'seafood'
  | 'spices'
  | 'household_detergents'
  | 'beverages_snacks'
  | 'general';

export interface PriceGuardrailRange {
  min: number;
  max: number;
  category: EgyptProductCategory;
  unitKind: 'small_portion' | 'single_piece' | 'standard_pack';
}

export interface PriceValidationResult {
  isValid: boolean;
  reason?: string;
  bounds: PriceGuardrailRange;
}

export interface EgyptMarketPriceEntry {
  baseUnit: string;
  basePrice: number;
  category: EgyptProductCategory;
  unitOverrides?: Record<string, number>;
  aliases?: string[];
}

export interface VerifiedEgyptPriceRecord {
  normalizedKey: string;
  itemName: string;
  unit: string;
  minPrice: number;
  typicalPrice: number;
  maxPrice: number;
  source: EgyptPriceSource;
  sourceLabel: string;
  fetchedAt: string;
  sampleCount: number;
  category?: EgyptProductCategory;
}

export interface SaveVerifiedPriceInput {
  itemName: string;
  unit: string;
  typicalPrice: number;
  minPrice?: number;
  maxPrice?: number;
  source: EgyptPriceSource;
  sourceLabel?: string;
  fetchedAt?: string;
  sampleCount?: number;
}

export interface FetchMarketPriceOptions {
  fetcher?: (url: string) => Promise<string | null>;
  timeoutMs?: number;
  isOnline?: boolean;
  saveToCache?: boolean;
}

const ARABIC_DIACRITICS_RE = /[\u064B-\u065F\u0670\u0640]/g;
const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function toWesternDigits(input: string): string {
  return String(input || '')
    .replace(/[٠-٩]/g, ch => String(ARABIC_INDIC_DIGITS.indexOf(ch)))
    .replace(/٫/g, '.')
    .replace(/٬/g, ',');
}

export function normalizeArabicText(input: string): string {
  return toWesternDigits(String(input || ''))
    .replace(ARABIC_DIACRITICS_RE, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function normalizeMarketUnit(unit: string): string {
  const norm = normalizeArabicText(unit || 'حبة');
  if (!norm) return 'حبه';
  if (['كيلو', 'كيلوجرام', 'كيلو جرام', 'كجم', 'kg'].includes(norm)) return 'كيلو';
  if (['جرام', 'غرام', 'جم', 'g'].includes(norm)) return 'جرام';
  if (['رغيف', 'ارغفه', 'رغيفه'].includes(norm)) return 'رغيف';
  if (['بيضه', 'بيضات'].includes(norm)) return 'بيضه';
  if (['حبه', 'حبات', 'ثمره', 'ثمرات'].includes(norm)) return 'حبه';
  if (['قطعه', 'قطع', 'شريحه', 'شرائح'].includes(norm)) return 'قطعه';
  if (['علبه', 'علب'].includes(norm)) return 'علبه';
  if (['عبوه', 'عبوات', 'باكو', 'باكيت'].includes(norm)) return 'عبوه';
  if (['زجاجه', 'ازازه', 'زجاجات'].includes(norm)) return 'زجاجه';
  if (['برطمان', 'برطمانات'].includes(norm)) return 'برطمان';
  if (['كرتونه', 'كراتين', 'طبق'].includes(norm)) return 'كرتونه';
  if (['لتر', 'لترات', 'l', 'liter'].includes(norm)) return 'لتر';
  if (['كيس', 'اكياس'].includes(norm)) return 'كيس';
  if (['كوب', 'اكواب', 'كوبايه'].includes(norm)) return 'كوب';
  if (['ملعقه', 'معلقه', 'ملاعق', 'معالق'].includes(norm)) return 'ملعقه';
  if (['فص', 'فصوص'].includes(norm)) return 'فص';
  if (['رشه', 'رشات'].includes(norm)) return 'رشه';
  if (['حزمه', 'حزم', 'ربطه'].includes(norm)) return 'حزمه';
  if (['عود', 'عيدان'].includes(norm)) return 'عود';
  if (['ورقه', 'ورق'].includes(norm)) return 'ورقه';
  return norm;
}

export function normalizeMarketItemKey(itemName: string, unit: string): string {
  return `${normalizeArabicText(itemName)}__${normalizeMarketUnit(unit)}`;
}

const COOKING_ADJECTIVES_RE =
  /(?<=^|\s)(?:سخن|سخنه|ساخن|ساخنه|مسبكه|مسبك|مفروم|مفرومه|مقطع|مقطعه|طازج|طازجه|فريش|مسلوق|مسلوقه|مشوي|مشويه|محمر|محمره|صافي|صافيه|متوسط|متوسطه|كبير|كبيره|صغير|صغيره|ناضج|ناضجه|مهروس|مهروسه|مبشور|مبشوره|شرائح|مكعبات|حلقات|مجفف|مجففه|منقوع|منقوعه|مغسول|مغسوله|متبل|متبله|خالي|خاليه)(?=\s|$)/g;

export function normalizeProductNameForLookup(itemName: string): string {
  const norm = normalizeArabicText(itemName)
    .replace(/(?:^|\s)ال(?=[\u0621-\u064A]{3,})/g, ' ')
    .replace(COOKING_ADJECTIVES_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return norm;
}

function roundEgyptRetailPrice(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value < 2) return Math.round(value * 4) / 4; // 0.25, 0.5, 1, 1.25, 1.5, 1.75
  if (value < 20) return Math.round(value * 2) / 2; // nearest 0.50 EGP (e.g. 2, 5.5, 13, 15)
  return Math.round(value);
}

/**
 * 2026 Egyptian Free-Market (السياحي / الحر) Retail Price Table (200+ everyday items).
 * Strictly excludes subsidized ration-card prices (such as 0.20 EGP subsidized bread).
 */
export const EGYPT_2026_MARKET_PRICES: Record<string, EgyptMarketPriceEntry> = {
  // === 1. Bakery (السياحي / الحر) ===
  'عيش بلدي': { baseUnit: 'رغيف', basePrice: 2, category: 'bakery', unitOverrides: { رغيف: 2, كيس: 10, قطعه: 2, حبه: 2 }, aliases: ['عيش بلدي سخن', 'خبز بلدي', 'عيش'] },
  'عيش سياحي': { baseUnit: 'رغيف', basePrice: 2, category: 'bakery', unitOverrides: { رغيف: 2, كيس: 10 }, aliases: ['خبز سياحي'] },
  'عيش فينو': { baseUnit: 'رغيف', basePrice: 2, category: 'bakery', unitOverrides: { رغيف: 2, كيس: 12 }, aliases: ['فينو', 'خبز فينو'] },
  'عيش شامي': { baseUnit: 'رغيف', basePrice: 2, category: 'bakery', unitOverrides: { رغيف: 2, كيس: 14 }, aliases: ['خبز شامي'] },
  'عيش سن': { baseUnit: 'رغيف', basePrice: 2.5, category: 'bakery', unitOverrides: { رغيف: 2.5, كيس: 18 } },
  'عيش تورتيلا': { baseUnit: 'كيس', basePrice: 45, category: 'bakery', unitOverrides: { رغيف: 6, كيس: 45, عبوه: 45 } },
  'عيش كيزر': { baseUnit: 'رغيف', basePrice: 3, category: 'bakery', unitOverrides: { رغيف: 3, كيس: 18 }, aliases: ['كيزر'] },
  'عيش توست': { baseUnit: 'كيس', basePrice: 45, category: 'bakery', unitOverrides: { كيس: 45, عبوه: 45, قطعه: 3 }, aliases: ['توست', 'توست ابيض', 'توست اسمر'] },
  'بقسماط': { baseUnit: 'كيلو', basePrice: 95, category: 'bakery', unitOverrides: { كيلو: 95, كيس: 25, كوب: 16, قطعه: 2 }, aliases: ['بقسماط مطحون', 'فيجيتار'] },
  'رقاق': { baseUnit: 'كيلو', basePrice: 65, category: 'bakery', unitOverrides: { كيلو: 65, عبوه: 35, قطعه: 6 }, aliases: ['رقاق ناشف', 'رقاق طري'] },
  'جلاش': { baseUnit: 'عبوه', basePrice: 25, category: 'bakery', unitOverrides: { عبوه: 25, كيس: 25, ورقه: 2 }, aliases: ['لفه جلاش'] },
  'كنافه': { baseUnit: 'كيلو', basePrice: 50, category: 'bakery' },
  'قطايف': { baseUnit: 'كيلو', basePrice: 48, category: 'bakery' },
  'سمبوسك': { baseUnit: 'عبوه', basePrice: 32, category: 'bakery', aliases: ['ورق سمبوسك'] },
  'فطير مشلتت': { baseUnit: 'قطعه', basePrice: 65, category: 'bakery', aliases: ['فطير'] },
  'باتيه': { baseUnit: 'قطعه', basePrice: 18, category: 'bakery' },
  'كرواسون': { baseUnit: 'قطعه', basePrice: 20, category: 'bakery' },
  'كريب': { baseUnit: 'رغيف', basePrice: 8, category: 'bakery', aliases: ['عيش كريب'] },

  // === 2. Vegetables (خضروات) ===
  'طماطم': { baseUnit: 'كيلو', basePrice: 10, category: 'vegetables', unitOverrides: { كيلو: 10, حبه: 1.5, كوب: 10, ملعقه: 1 }, aliases: ['طماطم مسبكه', 'طماطم بلدي', 'قوطه'] },
  'صلصه طماطم': { baseUnit: 'برطمان', basePrice: 28, category: 'vegetables', unitOverrides: { برطمان: 28, عبوه: 28, كيس: 6, ملعقه: 2 }, aliases: ['معجون طماطم', 'صلصه'] },
  'بطاطس': { baseUnit: 'كيلو', basePrice: 15, category: 'vegetables', unitOverrides: { كيلو: 15, حبه: 2.5, كوب: 4 } },
  'بصل': { baseUnit: 'كيلو', basePrice: 14, category: 'vegetables', unitOverrides: { كيلو: 14, حبه: 2.5, كوب: 4 }, aliases: ['بصل احمر', 'بصل ابيض'] },
  'بصل اخضر': { baseUnit: 'حزمه', basePrice: 5, category: 'vegetables', unitOverrides: { حزمه: 5, عود: 1 } },
  'ثوم': { baseUnit: 'كيلو', basePrice: 60, category: 'vegetables', unitOverrides: { كيلو: 60, حبه: 5, فص: 1.5, ملعقه: 3 } },
  'خيار': { baseUnit: 'كيلو', basePrice: 18, category: 'vegetables', unitOverrides: { كيلو: 18, حبه: 3 } },
  'فلفل رومي': { baseUnit: 'كيلو', basePrice: 20, category: 'vegetables', unitOverrides: { كيلو: 20, حبه: 3.5 }, aliases: ['فلفل اخضر'] },
  'فلفل الوان': { baseUnit: 'كيلو', basePrice: 45, category: 'vegetables', unitOverrides: { كيلو: 45, حبه: 7.5 } },
  'فلفل حامي': { baseUnit: 'كيلو', basePrice: 22, category: 'vegetables', unitOverrides: { كيلو: 22, حبه: 1 } },
  'باذنجان': { baseUnit: 'كيلو', basePrice: 15, category: 'vegetables', unitOverrides: { كيلو: 15, حبه: 3 }, aliases: ['باذنجان رومي', 'باذنجان عروس'] },
  'كوسه': { baseUnit: 'كيلو', basePrice: 22, category: 'vegetables', unitOverrides: { كيلو: 22, حبه: 3.5 } },
  'جزر': { baseUnit: 'كيلو', basePrice: 15, category: 'vegetables', unitOverrides: { كيلو: 15, حبه: 2.5 } },
  'ليمون': { baseUnit: 'كيلو', basePrice: 35, category: 'vegetables', unitOverrides: { كيلو: 35, حبه: 1.5, ملعقه: 1 } },
  'ملوخيه': { baseUnit: 'كيلو', basePrice: 15, category: 'vegetables', unitOverrides: { كيلو: 15, حزمه: 5, كيس: 22 } },
  'سبانخ': { baseUnit: 'كيلو', basePrice: 20, category: 'vegetables', unitOverrides: { كيلو: 20, حزمه: 6, كيس: 25 } },
  'بقدونس': { baseUnit: 'حزمه', basePrice: 3, category: 'vegetables', unitOverrides: { حزمه: 3, كوب: 3, ملعقه: 0.5 } },
  'شبت': { baseUnit: 'حزمه', basePrice: 3, category: 'vegetables', unitOverrides: { حزمه: 3, كوب: 3, ملعقه: 0.5 } },
  'كزبره خضراء': { baseUnit: 'حزمه', basePrice: 3, category: 'vegetables', unitOverrides: { حزمه: 3, كوب: 3, ملعقه: 0.5 }, aliases: ['كزبره'] },
  'جرجير': { baseUnit: 'حزمه', basePrice: 3, category: 'vegetables' },
  'نعناع اخضر': { baseUnit: 'حزمه', basePrice: 4, category: 'vegetables' },
  'خس': { baseUnit: 'حبه', basePrice: 10, category: 'vegetables', unitOverrides: { حبه: 10, حزمه: 10 } },
  'كابوتشا': { baseUnit: 'حبه', basePrice: 20, category: 'vegetables' },
  'كرنب': { baseUnit: 'حبه', basePrice: 25, category: 'vegetables', aliases: ['ملفوف'] },
  'قرنبيط': { baseUnit: 'حبه', basePrice: 25, category: 'vegetables' },
  'بروكلي': { baseUnit: 'كيلو', basePrice: 45, category: 'vegetables', unitOverrides: { كيلو: 45, حبه: 22 } },
  'بسله': { baseUnit: 'كيلو', basePrice: 35, category: 'vegetables', unitOverrides: { كيلو: 35, كيس: 30, كوب: 7 } },
  'فاصوليا خضراء': { baseUnit: 'كيلو', basePrice: 30, category: 'vegetables', unitOverrides: { كيلو: 30, كيس: 28, كوب: 6 } },
  'باميه': { baseUnit: 'كيلو', basePrice: 65, category: 'vegetables', unitOverrides: { كيلو: 65, كيس: 40 } },
  'قلقاس': { baseUnit: 'كيلو', basePrice: 28, category: 'vegetables' },
  'بطاطا': { baseUnit: 'كيلو', basePrice: 15, category: 'vegetables' },
  'بنجر': { baseUnit: 'كيلو', basePrice: 22, category: 'vegetables', unitOverrides: { كيلو: 22, حبه: 5 } },
  'لفت': { baseUnit: 'كيلو', basePrice: 12, category: 'vegetables' },
  'مشروم': { baseUnit: 'عبوه', basePrice: 65, category: 'vegetables', unitOverrides: { عبوه: 65, علبه: 45, كيلو: 180 } },
  'ذره حلوه': { baseUnit: 'علبه', basePrice: 42, category: 'vegetables', unitOverrides: { علبه: 42, كوب: 14 } },
  'ورق عنب': { baseUnit: 'كيلو', basePrice: 55, category: 'vegetables', unitOverrides: { كيلو: 55, برطمان: 65 } },

  // === 3. Fruits (فواكه) ===
  'موز': { baseUnit: 'كيلو', basePrice: 25, category: 'fruits', unitOverrides: { كيلو: 25, حبه: 3.5 } },
  'تفاح': { baseUnit: 'كيلو', basePrice: 65, category: 'fruits', unitOverrides: { كيلو: 65, حبه: 11 }, aliases: ['تفاح احمر', 'تفاح اخضر'] },
  'برتقال': { baseUnit: 'كيلو', basePrice: 18, category: 'fruits', unitOverrides: { كيلو: 18, حبه: 3 }, aliases: ['برتقال بسره', 'برتقال بلدي'] },
  'يوسفي': { baseUnit: 'كيلو', basePrice: 20, category: 'fruits', unitOverrides: { كيلو: 20, حبه: 3 } },
  'جوافه': { baseUnit: 'كيلو', basePrice: 25, category: 'fruits', unitOverrides: { كيلو: 25, حبه: 4 } },
  'فراوله': { baseUnit: 'كيلو', basePrice: 35, category: 'fruits' },
  'مانجو': { baseUnit: 'كيلو', basePrice: 55, category: 'fruits', unitOverrides: { كيلو: 55, حبه: 15 } },
  'عنب': { baseUnit: 'كيلو', basePrice: 45, category: 'fruits' },
  'بطيخ': { baseUnit: 'حبه', basePrice: 65, category: 'fruits', unitOverrides: { حبه: 65, كيلو: 15 } },
  'شمام': { baseUnit: 'كيلو', basePrice: 20, category: 'fruits', aliases: ['كنتالوب'] },
  'رمان': { baseUnit: 'كيلو', basePrice: 28, category: 'fruits', unitOverrides: { كيلو: 28, حبه: 6 } },
  'بلح': { baseUnit: 'كيلو', basePrice: 55, category: 'fruits', aliases: ['تمر', 'بلح اسود', 'عجوه'] },
  'خوخ': { baseUnit: 'كيلو', basePrice: 45, category: 'fruits', unitOverrides: { كيلو: 45, حبه: 6 } },
  'كمثري': { baseUnit: 'كيلو', basePrice: 55, category: 'fruits', unitOverrides: { كيلو: 55, حبه: 8 } },
  'مشمش': { baseUnit: 'كيلو', basePrice: 55, category: 'fruits' },
  'برقوق': { baseUnit: 'كيلو', basePrice: 50, category: 'fruits' },
  'تين': { baseUnit: 'كيلو', basePrice: 45, category: 'fruits' },
  'كيوي': { baseUnit: 'كيلو', basePrice: 110, category: 'fruits', unitOverrides: { كيلو: 110, حبه: 12 } },
  'افوكادو': { baseUnit: 'حبه', basePrice: 35, category: 'fruits' },

  // === 4. Grains, Legumes, Pasta, Flour & Sugar ===
  'عدس اصفر': { baseUnit: 'كيلو', basePrice: 65, category: 'grains_legumes', unitOverrides: { كيلو: 65, كوب: 13, كيس: 35, جرام: 0.065 } },
  'عدس بجبه': { baseUnit: 'كيلو', basePrice: 60, category: 'grains_legumes', unitOverrides: { كيلو: 60, كوب: 12, كيس: 32, جرام: 0.06 } },
  'ارز مصري': { baseUnit: 'كيلو', basePrice: 30, category: 'grains_legumes', unitOverrides: { كيلو: 30, كوب: 6, كيس: 30, جرام: 0.03 }, aliases: ['ارز', 'رز', 'رز مصري'] },
  'ارز بسمتي': { baseUnit: 'كيلو', basePrice: 85, category: 'grains_legumes', unitOverrides: { كيلو: 85, كوب: 17, كيس: 85 } },
  'سكر': { baseUnit: 'كيلو', basePrice: 32, category: 'grains_legumes', unitOverrides: { كيلو: 32, كيس: 32, كوب: 6.5, ملعقه: 1 }, aliases: ['سكر ابيض', 'سكر بودره'] },
  'دقيق': { baseUnit: 'كيلو', basePrice: 26, category: 'grains_legumes', unitOverrides: { كيلو: 26, كيس: 26, كوب: 5, ملعقه: 1 }, aliases: ['دقيق ابيض', 'دقيق اسمر'] },
  'مكرونه': { baseUnit: 'كيلو', basePrice: 30, category: 'grains_legumes', unitOverrides: { كيلو: 30, كيس: 15, عبوه: 15, كوب: 6, جرام: 0.03 }, aliases: ['اسباجتي', 'مكرونه قلم', 'مكرونه فرن', 'مكرونه خواتم'] },
  'شعريه': { baseUnit: 'كيلو', basePrice: 30, category: 'grains_legumes', unitOverrides: { كيلو: 30, كيس: 15, كوب: 6 }, aliases: ['شعيريه'] },
  'لسان عصفور': { baseUnit: 'كيلو', basePrice: 30, category: 'grains_legumes', unitOverrides: { كيلو: 30, كيس: 15, كوب: 6 } },
  'فول تدميس': { baseUnit: 'كيلو', basePrice: 55, category: 'grains_legumes', unitOverrides: { كيلو: 55, علبه: 18, كوب: 11, كيس: 28 }, aliases: ['فول', 'فول مدمس', 'فول مدشوش'] },
  'حمص': { baseUnit: 'كيلو', basePrice: 75, category: 'grains_legumes', unitOverrides: { كيلو: 75, كوب: 15, علبه: 32 }, aliases: ['حمص الشام'] },
  'لوبيا': { baseUnit: 'كيلو', basePrice: 70, category: 'grains_legumes', unitOverrides: { كيلو: 70, كوب: 14, كيس: 35 } },
  'فاصوليا بيضاء': { baseUnit: 'كيلو', basePrice: 75, category: 'grains_legumes', unitOverrides: { كيلو: 75, كوب: 15, كيس: 38 }, aliases: ['فاصوليا'] },
  'فريك': { baseUnit: 'كيلو', basePrice: 65, category: 'grains_legumes', unitOverrides: { كيلو: 65, كوب: 13 } },
  'برغل': { baseUnit: 'كيلو', basePrice: 60, category: 'grains_legumes', unitOverrides: { كيلو: 60, كوب: 12 } },
  'سميد': { baseUnit: 'كيلو', basePrice: 45, category: 'grains_legumes', unitOverrides: { كيلو: 45, كيس: 25, كوب: 9 }, aliases: ['دقيق بسبوسه', 'سيميولينا'] },
  'نشا': { baseUnit: 'كيس', basePrice: 12, category: 'grains_legumes', unitOverrides: { كيس: 12, كيلو: 45, ملعقه: 1 }, aliases: ['نشا ذره'] },
  'شوفان': { baseUnit: 'عبوه', basePrice: 45, category: 'grains_legumes', unitOverrides: { عبوه: 45, كيلو: 95, كوب: 15 } },
  'ترمس': { baseUnit: 'كيلو', basePrice: 65, category: 'grains_legumes' },
  'ذره فشار': { baseUnit: 'كيلو', basePrice: 60, category: 'grains_legumes', unitOverrides: { كيلو: 60, كيس: 30, كوب: 12 }, aliases: ['فشار'] },
  'كورن فليكس': { baseUnit: 'عبوه', basePrice: 85, category: 'grains_legumes' },

  // === 5. Oils, Ghee & Vinegar ===
  'زيت طعام': { baseUnit: 'زجاجه', basePrice: 65, category: 'oils_ghee', unitOverrides: { زجاجه: 65, لتر: 78, كوب: 13, ملعقه: 2.5 }, aliases: ['زيت', 'زيت قليه', 'زيت خليط'] },
  'زيت عباد الشمس': { baseUnit: 'زجاجه', basePrice: 72, category: 'oils_ghee', unitOverrides: { زجاجه: 72, لتر: 85, كوب: 14, ملعقه: 2.5 } },
  'زيت ذره': { baseUnit: 'زجاجه', basePrice: 82, category: 'oils_ghee', unitOverrides: { زجاجه: 82, لتر: 95, كوب: 16, ملعقه: 3 } },
  'زيت زيتون': { baseUnit: 'زجاجه', basePrice: 220, category: 'oils_ghee', unitOverrides: { زجاجه: 220, لتر: 250, كوب: 45, ملعقه: 8 } },
  'سمنه': { baseUnit: 'علبه', basePrice: 95, category: 'oils_ghee', unitOverrides: { علبه: 95, كيلو: 105, كوب: 20, ملعقه: 4 }, aliases: ['سمن', 'سمنه نباتي'] },
  'سمنه بلدي': { baseUnit: 'كيلو', basePrice: 320, category: 'oils_ghee', unitOverrides: { كيلو: 320, علبه: 240, ملعقه: 12 }, aliases: ['سمن بلدي'] },
  'خل': { baseUnit: 'زجاجه', basePrice: 18, category: 'oils_ghee', unitOverrides: { زجاجه: 18, لتر: 18, كوب: 4, ملعقه: 0.5 }, aliases: ['خل ابيض', 'خل تفاح'] },

  // === 6. Dairy & Eggs ===
  'بيض': { baseUnit: 'كرتونه', basePrice: 165, category: 'dairy_eggs', unitOverrides: { كرتونه: 165, بيضه: 5.5, حبه: 5.5, قطعه: 5.5 }, aliases: ['بيض احمر', 'بيض ابيض', 'بيض بلدي', 'كرتونه بيض'] },
  'لبن': { baseUnit: 'لتر', basePrice: 38, category: 'dairy_eggs', unitOverrides: { لتر: 38, عبوه: 42, زجاجه: 40, كيس: 22, كوب: 7.5, ملعقه: 1 }, aliases: ['حليب', 'لبن حليب'] },
  'لبن بودره': { baseUnit: 'عبوه', basePrice: 95, category: 'dairy_eggs', unitOverrides: { عبوه: 95, كيس: 15, ملعقه: 4 } },
  'زبادي': { baseUnit: 'علبه', basePrice: 7, category: 'dairy_eggs', unitOverrides: { علبه: 7, كوب: 7, قطعه: 7 }, aliases: ['زبادي بلدي', 'زبادي طبيعي'] },
  'لبن رايب': { baseUnit: 'زجاجه', basePrice: 28, category: 'dairy_eggs', unitOverrides: { زجاجه: 28, عبوه: 28, كوب: 7 } },
  'جبنه بيضاء': { baseUnit: 'عبوه', basePrice: 45, category: 'dairy_eggs', unitOverrides: { عبوه: 45, علبه: 45, كيلو: 95 }, aliases: ['جبنه فيتا', 'جبنه', 'جبنه اسطنبولي', 'جبنه براميلي'] },
  'جبنه قريش': { baseUnit: 'كيلو', basePrice: 85, category: 'dairy_eggs', unitOverrides: { كيلو: 85, قطعه: 18 } },
  'جبنه رومي': { baseUnit: 'كيلو', basePrice: 240, category: 'dairy_eggs', unitOverrides: { كيلو: 240, عبوه: 65, قطعه: 15 }, aliases: ['جبنه تركي'] },
  'جبنه شيدر': { baseUnit: 'كيلو', basePrice: 210, category: 'dairy_eggs', unitOverrides: { كيلو: 210, عبوه: 55, قطعه: 12 } },
  'جبنه موتزاريلا': { baseUnit: 'كيلو', basePrice: 190, category: 'dairy_eggs', unitOverrides: { كيلو: 190, كيس: 55, عبوه: 55, كوب: 35 } },
  'جبنه نستو': { baseUnit: 'علبه', basePrice: 32, category: 'dairy_eggs', unitOverrides: { علبه: 32, قطعه: 4 }, aliases: ['جبنه مثلثات'] },
  'جبنه كريمي': { baseUnit: 'برطمان', basePrice: 75, category: 'dairy_eggs', unitOverrides: { برطمان: 75, علبه: 55, ملعقه: 4 } },
  'لبنه': { baseUnit: 'عبوه', basePrice: 55, category: 'dairy_eggs', unitOverrides: { عبوه: 55, كيلو: 160 } },
  'زبده': { baseUnit: 'كيلو', basePrice: 220, category: 'dairy_eggs', unitOverrides: { كيلو: 220, عبوه: 65, ملعقه: 8, قطعه: 15 }, aliases: ['زبده صفراء', 'زبده بلدي'] },
  'قشطه': { baseUnit: 'علبه', basePrice: 45, category: 'dairy_eggs', unitOverrides: { علبه: 45, كيلو: 180, ملعقه: 4 } },
  'كريمه طبخ': { baseUnit: 'عبوه', basePrice: 65, category: 'dairy_eggs', unitOverrides: { عبوه: 65, لتر: 210, كوب: 35 }, aliases: ['كريمه خفق', 'كريم شانتيه'] },

  // === 7. Poultry (دواجن) ===
  'فراخ بيضاء': { baseUnit: 'كيلو', basePrice: 95, category: 'poultry', unitOverrides: { كيلو: 95, حبه: 165 }, aliases: ['فراخ', 'دجاج', 'فرخه'] },
  'فراخ بلدي': { baseUnit: 'كيلو', basePrice: 125, category: 'poultry' },
  'بانيه': { baseUnit: 'كيلو', basePrice: 195, category: 'poultry', unitOverrides: { كيلو: 195, قطعه: 30 }, aliases: ['صدور فراخ', 'فراخ بانيه', 'فيليه دجاج'] },
  'اوراك فراخ': { baseUnit: 'كيلو', basePrice: 105, category: 'poultry', aliases: ['وراك', 'وراك فراخ'] },
  'دبابيس فراخ': { baseUnit: 'كيلو', basePrice: 120, category: 'poultry' },
  'اجنحه فراخ': { baseUnit: 'كيلو', basePrice: 75, category: 'poultry', aliases: ['اجنحه'] },
  'كبد وقوانص': { baseUnit: 'كيلو', basePrice: 105, category: 'poultry', aliases: ['كبد فراخ'] },
  'شيش طاووق': { baseUnit: 'كيلو', basePrice: 185, category: 'poultry' },
  'بط': { baseUnit: 'كيلو', basePrice: 145, category: 'poultry' },
  'حمام': { baseUnit: 'حبه', basePrice: 80, category: 'poultry', unitOverrides: { حبه: 80, قطعه: 80 } },
  'ارانب': { baseUnit: 'كيلو', basePrice: 135, category: 'poultry' },
  'صدور رومي': { baseUnit: 'كيلو', basePrice: 210, category: 'poultry', aliases: ['ديك رومي', 'تركي مدخن'] },

  // === 8. Red Meat & Processed Meats (لحوم) ===
  'لحمه بلدي': { baseUnit: 'كيلو', basePrice: 380, category: 'meat', unitOverrides: { كيلو: 380, كوب: 75, قطعه: 45 }, aliases: ['لحمه', 'لحم', 'لحم بقري'] },
  'لحمه مفرومه': { baseUnit: 'كيلو', basePrice: 350, category: 'meat', unitOverrides: { كيلو: 350, عبوه: 175, كوب: 70 }, aliases: ['مفروم', 'لحم مفروم'] },
  'لحمه ضاني': { baseUnit: 'كيلو', basePrice: 410, category: 'meat' },
  'كبده بلدي': { baseUnit: 'كيلو', basePrice: 360, category: 'meat', aliases: ['كبده'] },
  'سجق بلدي': { baseUnit: 'كيلو', basePrice: 320, category: 'meat', aliases: ['سجق'] },
  'كفته': { baseUnit: 'كيلو', basePrice: 340, category: 'meat' },
  'بفتيك': { baseUnit: 'كيلو', basePrice: 410, category: 'meat', aliases: ['استيك', 'اسكالوب'] },
  'برجر': { baseUnit: 'عبوه', basePrice: 120, category: 'meat', unitOverrides: { عبوه: 120, كيس: 120, قطعه: 20 } },
  'لانشون': { baseUnit: 'كيلو', basePrice: 180, category: 'meat', unitOverrides: { كيلو: 180, عبوه: 55 } },
  'بسطرمه': { baseUnit: 'كيلو', basePrice: 440, category: 'meat' },
  'سوسيس': { baseUnit: 'عبوه', basePrice: 85, category: 'meat', aliases: ['هوت دوج'] },

  // === 9. Seafood (أسماك ومأكولات بحرية) ===
  'سمك بلطي': { baseUnit: 'كيلو', basePrice: 85, category: 'seafood', aliases: ['بلطي', 'سمك'] },
  'سمك بوري': { baseUnit: 'كيلو', basePrice: 165, category: 'seafood', aliases: ['بوري'] },
  'سمك ماكريل': { baseUnit: 'كيلو', basePrice: 130, category: 'seafood', aliases: ['ماكريل'] },
  'فيليه سمك': { baseUnit: 'كيلو', basePrice: 195, category: 'seafood' },
  'سردين': { baseUnit: 'كيلو', basePrice: 95, category: 'seafood' },
  'رنجه': { baseUnit: 'كيلو', basePrice: 130, category: 'seafood' },
  'جمبري': { baseUnit: 'كيلو', basePrice: 360, category: 'seafood' },
  'سبيط': { baseUnit: 'كيلو', basePrice: 290, category: 'seafood', aliases: ['كاليماري'] },
  'تونه': { baseUnit: 'علبه', basePrice: 55, category: 'seafood', unitOverrides: { علبه: 55, عبوه: 55 } },

  // === 10. Spices, Herbs & Baking Additives (توابل) ===
  'ملح': { baseUnit: 'كيس', basePrice: 5, category: 'spices', unitOverrides: { كيس: 5, كيلو: 10, ملعقه: 0.25, رشه: 0.1 } },
  'فلفل اسود': { baseUnit: 'عبوه', basePrice: 25, category: 'spices', unitOverrides: { عبوه: 25, كيس: 20, كيلو: 360, ملعقه: 2, رشه: 0.5 } },
  'كمون': { baseUnit: 'عبوه', basePrice: 22, category: 'spices', unitOverrides: { عبوه: 22, كيس: 18, كيلو: 320, ملعقه: 2, رشه: 0.5 } },
  'كزبره ناشفه': { baseUnit: 'عبوه', basePrice: 18, category: 'spices', unitOverrides: { عبوه: 18, كيلو: 220, ملعقه: 1.5, رشه: 0.5 } },
  'بابريكا': { baseUnit: 'عبوه', basePrice: 20, category: 'spices', unitOverrides: { عبوه: 20, ملعقه: 1.5, رشه: 0.5 } },
  'كركم': { baseUnit: 'عبوه', basePrice: 18, category: 'spices', unitOverrides: { عبوه: 18, ملعقه: 1.5, رشه: 0.5 } },
  'كاري': { baseUnit: 'عبوه', basePrice: 20, category: 'spices', unitOverrides: { عبوه: 20, ملعقه: 1.5, رشه: 0.5 } },
  'قرفه': { baseUnit: 'عبوه', basePrice: 22, category: 'spices', unitOverrides: { عبوه: 22, ملعقه: 1.5, عود: 4, رشه: 0.5 } },
  'زنجبيل': { baseUnit: 'عبوه', basePrice: 22, category: 'spices', unitOverrides: { عبوه: 22, ملعقه: 1.5, رشه: 0.5 }, aliases: ['جنزبيل'] },
  'شطه': { baseUnit: 'عبوه', basePrice: 15, category: 'spices', unitOverrides: { عبوه: 15, ملعقه: 1, رشه: 0.25 } },
  'بهارات': { baseUnit: 'عبوه', basePrice: 25, category: 'spices', unitOverrides: { عبوه: 25, ملعقه: 2, رشه: 0.5 }, aliases: ['توابل', 'بهارات فراخ', 'بهارات لحمه', 'سبع بهارات'] },
  'زعتر': { baseUnit: 'عبوه', basePrice: 20, category: 'spices', unitOverrides: { عبوه: 20, ملعقه: 1.5, رشه: 0.5 } },
  'سماق': { baseUnit: 'عبوه', basePrice: 22, category: 'spices', unitOverrides: { عبوه: 22, ملعقه: 1.5 } },
  'حبهان': { baseUnit: 'عبوه', basePrice: 45, category: 'spices', unitOverrides: { عبوه: 45, فص: 1.5 } },
  'ورق لورا': { baseUnit: 'عبوه', basePrice: 15, category: 'spices', unitOverrides: { عبوه: 15, ورقه: 0.5 } },
  'قرنفل': { baseUnit: 'عبوه', basePrice: 25, category: 'spices', unitOverrides: { عبوه: 25, حبه: 0.5 } },
  'جوزه الطيب': { baseUnit: 'حبه', basePrice: 12, category: 'spices', unitOverrides: { حبه: 12, رشه: 1 } },
  'مرقه دجاج': { baseUnit: 'علبه', basePrice: 20, category: 'spices', unitOverrides: { علبه: 20, قطعه: 2.5, حبه: 2.5 }, aliases: ['ماجي', 'مكعب مرقه'] },
  'بيكنج بودر': { baseUnit: 'كيس', basePrice: 5, category: 'spices', unitOverrides: { كيس: 5, ملعقه: 2 } },
  'فانيليا': { baseUnit: 'كيس', basePrice: 3, category: 'spices', unitOverrides: { كيس: 3, عبوه: 12, ملعقه: 1 } },
  'خميره': { baseUnit: 'كيس', basePrice: 6, category: 'spices', unitOverrides: { كيس: 6, ملعقه: 2.5 }, aliases: ['خميره فوريه'] },
  'سمسم': { baseUnit: 'كيس', basePrice: 25, category: 'spices', unitOverrides: { كيس: 25, كيلو: 150, ملعقه: 2 } },

  // === 11. Beverages, Breakfast & Pantry Extras ===
  'شاي': { baseUnit: 'عبوه', basePrice: 55, category: 'beverages_snacks', unitOverrides: { عبوه: 55, علبه: 55, كيلو: 220, ملعقه: 1 }, aliases: ['شاي اسود', 'شاي فتله'] },
  'قهوه': { baseUnit: 'عبوه', basePrice: 95, category: 'beverages_snacks', unitOverrides: { عبوه: 95, كيلو: 380, ملعقه: 3 }, aliases: ['بن', 'بن تركي'] },
  'نسكافيه': { baseUnit: 'برطمان', basePrice: 95, category: 'beverages_snacks', unitOverrides: { برطمان: 95, كيس: 8, عبوه: 95 } },
  'كاكاو': { baseUnit: 'عبوه', basePrice: 55, category: 'beverages_snacks', unitOverrides: { عبوه: 55, ملعقه: 2 } },
  'عسل ابيض': { baseUnit: 'برطمان', basePrice: 135, category: 'beverages_snacks', unitOverrides: { برطمان: 135, كيلو: 190, ملعقه: 4 }, aliases: ['عسل نحل'] },
  'عسل اسود': { baseUnit: 'برطمان', basePrice: 45, category: 'beverages_snacks', unitOverrides: { برطمان: 45, كيلو: 60, ملعقه: 1.5 } },
  'طحينه': { baseUnit: 'برطمان', basePrice: 85, category: 'beverages_snacks', unitOverrides: { برطمان: 85, كيلو: 165, ملعقه: 3.5 } },
  'مربي': { baseUnit: 'برطمان', basePrice: 45, category: 'beverages_snacks', unitOverrides: { برطمان: 45, ملعقه: 2 }, aliases: ['مربي فراوله', 'مربي مشمش'] },
  'حلاوه طحينيه': { baseUnit: 'علبه', basePrice: 75, category: 'beverages_snacks', unitOverrides: { علبه: 75, كيلو: 155 } },
  'عصير': { baseUnit: 'علبه', basePrice: 28, category: 'beverages_snacks', unitOverrides: { علبه: 28, لتر: 32, زجاجه: 25 } },
  'مياه معدنيه': { baseUnit: 'زجاجه', basePrice: 8, category: 'beverages_snacks', unitOverrides: { زجاجه: 8, لتر: 8, كرتونه: 90 } },
  'ينسون': { baseUnit: 'عبوه', basePrice: 25, category: 'beverages_snacks' },
  'نعناع ناشف': { baseUnit: 'عبوه', basePrice: 18, category: 'beverages_snacks' },
  'كركديه': { baseUnit: 'عبوه', basePrice: 35, category: 'beverages_snacks', unitOverrides: { عبوه: 35, كيلو: 140 } },
  'زبيب': { baseUnit: 'كيلو', basePrice: 160, category: 'beverages_snacks', unitOverrides: { كيلو: 160, عبوه: 45, كوب: 30 } },
  'جوز هند': { baseUnit: 'كيلو', basePrice: 150, category: 'beverages_snacks', unitOverrides: { كيلو: 150, عبوه: 40, كوب: 25 } },
  'سوداني': { baseUnit: 'كيلو', basePrice: 110, category: 'beverages_snacks', unitOverrides: { كيلو: 110, عبوه: 30 }, aliases: ['فول سوداني'] },
  'بسكويت': { baseUnit: 'عبوه', basePrice: 15, category: 'beverages_snacks', aliases: ['بسكوت'] },
  'شوكولاته': { baseUnit: 'عبوه', basePrice: 45, category: 'beverages_snacks', unitOverrides: { عبوه: 45, قطعه: 25 }, aliases: ['شوكولاته خام'] },
  'كاتشب': { baseUnit: 'زجاجه', basePrice: 42, category: 'beverages_snacks', unitOverrides: { زجاجه: 42, ملعقه: 1.5 } },
  'مايونيز': { baseUnit: 'برطمان', basePrice: 48, category: 'beverages_snacks', unitOverrides: { برطمان: 48, زجاجه: 48, ملعقه: 2 } },
  'مسطرده': { baseUnit: 'زجاجه', basePrice: 42, category: 'beverages_snacks' },
  'مخلل': { baseUnit: 'برطمان', basePrice: 30, category: 'beverages_snacks', unitOverrides: { برطمان: 30, كيلو: 45 } },
  'زيتون مخلل': { baseUnit: 'كيلو', basePrice: 95, category: 'beverages_snacks', unitOverrides: { كيلو: 95, برطمان: 55 } },

  // === 12. Household Detergents & Care (منظفات) ===
  'مسحوق غسيل': { baseUnit: 'كيس', basePrice: 165, category: 'household_detergents', unitOverrides: { كيس: 165, عبوه: 165, كيلو: 95 }, aliases: ['اريال', 'برسيل', 'تايد', 'اوكسي'] },
  'سائل مواعين': { baseUnit: 'زجاجه', basePrice: 45, category: 'household_detergents', unitOverrides: { زجاجه: 45, لتر: 55, عبوه: 45 }, aliases: ['بريل', 'فيري', 'صابون مواعين'] },
  'كلور': { baseUnit: 'زجاجه', basePrice: 28, category: 'household_detergents', unitOverrides: { زجاجه: 28, لتر: 28 } },
  'ديتول': { baseUnit: 'زجاجه', basePrice: 95, category: 'household_detergents', unitOverrides: { زجاجه: 95, عبوه: 95 }, aliases: ['مطهر'] },
  'داوني': { baseUnit: 'زجاجه', basePrice: 75, category: 'household_detergents', aliases: ['منعم ملابس'] },
  'مناديل': { baseUnit: 'علبه', basePrice: 35, category: 'household_detergents', unitOverrides: { علبه: 35, عبوه: 65, كيس: 65 }, aliases: ['مناديل ورق', 'مناديل سحب', 'مناديل مطبخ'] },
  'صابون': { baseUnit: 'قطعه', basePrice: 22, category: 'household_detergents', unitOverrides: { قطعه: 22, زجاجه: 45, عبوه: 65 }, aliases: ['صابون يد', 'صابونه'] },
  'شامبو': { baseUnit: 'زجاجه', basePrice: 115, category: 'household_detergents' },
  'شاور جل': { baseUnit: 'زجاجه', basePrice: 95, category: 'household_detergents' },
  'معجون اسنان': { baseUnit: 'عبوه', basePrice: 55, category: 'household_detergents' },
  'سلك مواعين': { baseUnit: 'عبوه', basePrice: 18, category: 'household_detergents', aliases: ['ليفه مواعين', 'اسفنج مواعين'] },
  'اكياس قمامه': { baseUnit: 'عبوه', basePrice: 35, category: 'household_detergents', unitOverrides: { عبوه: 35, كيس: 35 } },
  'معطر جو': { baseUnit: 'عبوه', basePrice: 65, category: 'household_detergents' },
  'منظف زجاج': { baseUnit: 'زجاجه', basePrice: 45, category: 'household_detergents', aliases: ['جلانس'] },
  'فويل': { baseUnit: 'عبوه', basePrice: 55, category: 'household_detergents', aliases: ['ورق فويل', 'استرتش غذائي', 'ورق زبده'] },
};

// Build fast normalized index across keys & aliases for EGYPT_2026_MARKET_PRICES
interface IndexedMarketEntry {
  canonicalName: string;
  normalizedPattern: string;
  entry: EgyptMarketPriceEntry;
}

const MARKET_LOOKUP_INDEX: IndexedMarketEntry[] = (() => {
  const list: IndexedMarketEntry[] = [];
  for (const [key, entry] of Object.entries(EGYPT_2026_MARKET_PRICES)) {
    list.push({
      canonicalName: key,
      normalizedPattern: normalizeProductNameForLookup(key),
      entry,
    });
    if (entry.aliases) {
      for (const alias of entry.aliases) {
        list.push({
          canonicalName: key,
          normalizedPattern: normalizeProductNameForLookup(alias),
          entry,
        });
      }
    }
  }
  // Sort longest pattern first so "فلفل اسود" beats "فلفل" and "لحمه مفرومه" beats "لحمه"
  return list.sort((a, b) => b.normalizedPattern.length - a.normalizedPattern.length);
})();

export function findEgypt2026PriceEntry(itemName: string): { canonicalName: string; entry: EgyptMarketPriceEntry } | null {
  const normCleaned = normalizeProductNameForLookup(itemName);
  const normRaw = normalizeArabicText(itemName);
  if (!normCleaned && !normRaw) return null;

  // 1. Exact match (cleaned or raw)
  for (const item of MARKET_LOOKUP_INDEX) {
    if (item.normalizedPattern === normCleaned || item.normalizedPattern === normRaw) {
      return { canonicalName: item.canonicalName, entry: item.entry };
    }
  }

  // 2. Substring match on longest canonical pattern (e.g., "عيش بلدي سخن" contains "عيش بلدي")
  for (const item of MARKET_LOOKUP_INDEX) {
    if (item.normalizedPattern.length >= 2 && (normCleaned.includes(item.normalizedPattern) || normRaw.includes(item.normalizedPattern))) {
      return { canonicalName: item.canonicalName, entry: item.entry };
    }
  }

  // 3. Token overlap fallback
  const tokens = normCleaned.split(/\s+/).filter(t => t.length >= 2);
  if (tokens.length > 0) {
    for (const item of MARKET_LOOKUP_INDEX) {
      const patternTokens = item.normalizedPattern.split(/\s+/);
      if (patternTokens.every(pt => tokens.includes(pt))) {
        return { canonicalName: item.canonicalName, entry: item.entry };
      }
    }
  }

  return null;
}

export function resolvePriceFromEntryForUnit(entry: EgyptMarketPriceEntry, unit: string): number {
  const normUnit = normalizeMarketUnit(unit);
  const normBase = normalizeMarketUnit(entry.baseUnit);

  if (entry.unitOverrides && entry.unitOverrides[normUnit] !== undefined) {
    return roundEgyptRetailPrice(entry.unitOverrides[normUnit]);
  }
  if (normUnit === normBase) {
    return roundEgyptRetailPrice(entry.basePrice);
  }

  // Automatic unit scaling from baseUnit
  const base = entry.basePrice;
  if (normUnit === 'جرام') {
    if (normBase === 'كيلو' || normBase === 'لتر') return Math.max(0.01, Math.round((base / 1000) * 1000) / 1000);
    return Math.max(0.01, Math.round((base / 500) * 1000) / 1000);
  }
  if (normUnit === 'كوب') return Math.max(0.5, roundEgyptRetailPrice(base / 5));
  if (normUnit === 'ملعقه') return Math.max(0.25, roundEgyptRetailPrice(base / 25));
  if (normUnit === 'فص') return Math.max(0.25, roundEgyptRetailPrice(base / 40));
  if (normUnit === 'رشه' || normUnit === 'عود' || normUnit === 'ورقه') return Math.max(0.25, roundEgyptRetailPrice(base / 50));
  if (normUnit === 'حبه') {
    if (entry.category === 'vegetables' || entry.category === 'fruits') {
      return Math.max(0.5, roundEgyptRetailPrice(base / 6));
    }
    if (entry.category === 'bakery') return Math.min(10, roundEgyptRetailPrice(base));
  }
  if (normUnit === 'حزمه' && (normBase === 'كيلو')) {
    return Math.max(2, roundEgyptRetailPrice(base / 4));
  }
  if ((normUnit === 'كيس' || normUnit === 'عبوه' || normUnit === 'علبه') && normBase === 'كيلو') {
    return roundEgyptRetailPrice(base * 0.5);
  }
  return roundEgyptRetailPrice(base);
}

export function lookupEgypt2026MarketPrice(itemName: string, unit: string): VerifiedEgyptPriceRecord | null {
  const cleanName = itemName.trim();
  const cleanUnit = (unit || 'حبة').trim() || 'حبة';
  if (!cleanName) return null;

  const matched = findEgypt2026PriceEntry(cleanName);
  if (!matched) return null;

  const typicalPrice = resolvePriceFromEntryForUnit(matched.entry, cleanUnit);
  if (!Number.isFinite(typicalPrice) || typicalPrice <= 0) return null;

  return {
    normalizedKey: normalizeMarketItemKey(cleanName, cleanUnit),
    itemName: cleanName,
    unit: cleanUnit,
    minPrice: typicalPrice,
    typicalPrice,
    maxPrice: typicalPrice,
    source: 'live_market',
    sourceLabel: 'سعر السوق المصري 2026',
    fetchedAt: new Date().toISOString(),
    sampleCount: 1,
    category: matched.entry.category,
  };
}

function getStorage(): Storage | null {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

let staleCachesPurgedOnce = false;

export function purgeStalePriceCaches(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    for (const staleKey of STALE_PRICE_CACHE_KEYS) {
      storage.removeItem(staleKey);
    }
  } catch {
    // Ignore storage errors gracefully
  }
}

function ensureStaleCachesPurged(): void {
  if (staleCachesPurgedOnce) return;
  staleCachesPurgedOnce = true;
  purgeStalePriceCaches();
}

function notifyVerifiedPricesUpdated() {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(VERIFIED_PRICES_UPDATED_EVENT));
    }
  } catch {
    // Safe no-op in non-DOM test environments
  }
}

const CATEGORY_KEYWORDS: Array<{ category: EgyptProductCategory; keywords: string[] }> = [
  {
    category: 'bakery',
    keywords: [
      'عيش', 'خبز', 'فينو', 'توست', 'كيزر', 'شامي', 'بقسماط', 'باتيه',
      'كرواسون', 'فطير', 'رقاق', 'جلاش', 'سمبوسك', 'كريب',
    ],
  },
  {
    category: 'poultry',
    keywords: [
      'فراخ', 'فرخه', 'دجاج', 'بانيه', 'اوراك', 'وراك', 'صدور', 'دبوس', 'اجنحه',
      'كبد وقوانص', 'بط', 'حمام', 'سمان', 'رومي', 'شيش طاووق',
    ],
  },
  {
    category: 'seafood',
    keywords: [
      'سمك', 'بلطي', 'بوري', 'ماكريل', 'جمبري', 'كاليماري', 'سبيط',
      'تونه', 'سردين', 'رنجه', 'فسيخ', 'فيليه سمك', 'كابوريا',
    ],
  },
  {
    category: 'meat',
    keywords: [
      'لحم', 'لحمه', 'مفروم', 'كفته', 'سجق', 'بفتيك', 'استيك', 'كبده', 'كلاوي',
      'موزه', 'عرق', 'بسطرمه', 'لانشون', 'برجر', 'سوسيس',
    ],
  },
  {
    category: 'dairy_eggs',
    keywords: [
      'بيض', 'لبن', 'حليب', 'زبادي', 'رايب', 'جبن', 'جبنه', 'قشطه', 'زبده',
      'كريمه', 'موتزاريلا', 'شيدر', 'فيتا', 'قريش', 'لبنه',
    ],
  },
  {
    category: 'oils_ghee',
    keywords: [
      'زيت', 'سمن', 'سمنه', 'زيتون', 'ذره', 'عباد الشمس', 'زيت قلي', 'خل',
    ],
  },
  {
    category: 'household_detergents',
    keywords: [
      'صابون', 'مسحوق', 'اريال', 'برسيل', 'تايد', 'اوكسي', 'كلور', 'ديتول',
      'معطر', 'شامبو', 'مناديل', 'بريل', 'فيري', 'سلك', 'اسفنج', 'منظف', 'فوط',
      'شاور', 'معجون اسنان', 'داوني', 'فانيش', 'فويل',
    ],
  },
  {
    category: 'spices',
    keywords: [
      'ملح', 'فلفل اسود', 'كمون', 'كزبره ناشفه', 'بابريكا', 'كركم', 'قرفه',
      'حبهان', 'لورا', 'زعتر', 'بهارات', 'توابل', 'شطه', 'سماق', 'قرنفل',
      'مرقه', 'ماجي', 'كاري', 'جنزبيل', 'زنجبيل', 'جوزه الطيب', 'فانيليا', 'بيكنج بودر', 'خميره',
    ],
  },
  {
    category: 'vegetables',
    keywords: [
      'طماطم', 'بصل', 'بطاطس', 'خيار', 'فلفل', 'باذنجان', 'كوسه', 'جزر', 'ثوم',
      'ملوخيه', 'سبانخ', 'كرنب', 'قرنبيط', 'بسله', 'فاصوليا خضراء', 'ليمون',
      'بقدونس', 'شبت', 'كزبره', 'جرجير', 'خس', 'قلقاس', 'باميه', 'بطاطا', 'بروكلي', 'مشروم',
    ],
  },
  {
    category: 'fruits',
    keywords: [
      'تفاح', 'موز', 'برتقال', 'يوسفي', 'مانجو', 'فراوله', 'عنب', 'بطيخ',
      'جوافه', 'رمان', 'بلح', 'تمر', 'خوخ', 'كمثري', 'مشمش', 'برقوق', 'كيوي', 'كنتالوب', 'تين',
    ],
  },
  {
    category: 'grains_legumes',
    keywords: [
      'ارز', 'رز', 'مكرونه', 'عدس', 'فول', 'حمص', 'لوبيا', 'فاصوليا', 'دقيق',
      'سكر', 'شوفان', 'برغل', 'فريك', 'نشا', 'شعيريه', 'لسان عصفور', 'سميد', 'ترمس',
    ],
  },
  {
    category: 'beverages_snacks',
    keywords: [
      'شاي', 'قهوه', 'نسكافيه', 'عصير', 'مياه', 'بسكويت', 'شوكولاته', 'عسل',
      'مربي', 'حلاوه', 'طحينه', 'كاكاو', 'كركديه', 'ينسون', 'نعناع',
    ],
  },
];

export function classifyEgyptProductCategory(itemName: string): EgyptProductCategory {
  const fromTable = findEgypt2026PriceEntry(itemName);
  if (fromTable) return fromTable.entry.category;

  const norm = normalizeArabicText(itemName);
  if (!norm) return 'general';

  if (norm.includes('فلفل اسود') || norm.includes('فلفل ابيض')) return 'spices';
  if (norm.includes('فلفل رومي') || norm.includes('فلفل الوان') || norm.includes('فلفل اخضر') || norm.includes('فلفل حامي')) {
    return 'vegetables';
  }

  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.keywords.some(kw => norm.includes(kw))) {
      return entry.category;
    }
  }
  return 'general';
}

const SMALL_PORTION_UNITS = new Set(['كوب', 'ملعقه', 'فص', 'رشه', 'حزمه', 'عود', 'ورقه']);
const SINGLE_PIECE_UNITS = new Set(['رغيف', 'بيضه', 'قطعه']);

export function getGuardrailRangeForItem(itemName: string, unit: string): PriceGuardrailRange {
  const category = classifyEgyptProductCategory(itemName);
  const normName = normalizeArabicText(itemName);
  const normUnit = normalizeMarketUnit(unit);

  // 1. Free-market bakery loaves (السياحي / الحر): strictly 1 to 6 EGP (excludes 0.20 ration price and avoids 10+ multipacks)
  if (normUnit === 'رغيف') {
    return { min: 1, max: 6, category: 'bakery', unitKind: 'single_piece' };
  }
  if (normUnit === 'بيضه' || (normName.includes('بيض') && (normUnit === 'حبه' || normUnit === 'قطعه'))) {
    return { min: 3, max: 12, category: 'dairy_eggs', unitKind: 'single_piece' };
  }
  if (normName.includes('زبادي') && (normUnit === 'علبه' || normUnit === 'كوب' || normUnit === 'قطعه')) {
    return { min: 3, max: 15, category: 'dairy_eggs', unitKind: 'single_piece' };
  }
  if (normUnit === 'قطعه') {
    if (category === 'bakery' || category === 'dairy_eggs') {
      return { min: 1, max: 18, category, unitKind: 'single_piece' };
    }
    if (category === 'meat' || category === 'seafood' || category === 'poultry') {
      return { min: 15, max: 180, category, unitKind: 'single_piece' };
    }
    if (category === 'household_detergents') {
      return { min: 5, max: 55, category, unitKind: 'single_piece' };
    }
    return { min: 1, max: 45, category, unitKind: 'single_piece' };
  }

  // 2. Small kitchen portions
  if (normUnit === 'حزمه') {
    return { min: 1, max: 15, category, unitKind: 'small_portion' };
  }
  if (normUnit === 'فص' || normUnit === 'رشه' || normUnit === 'عود' || normUnit === 'ورقه') {
    return { min: 0.1, max: 8, category, unitKind: 'small_portion' };
  }
  if (normUnit === 'ملعقه') {
    return { min: 0.25, max: 15, category, unitKind: 'small_portion' };
  }
  if (normUnit === 'كوب') {
    if (category === 'meat' || category === 'seafood' || category === 'poultry') {
      return { min: 15, max: 130, category, unitKind: 'small_portion' };
    }
    if (category === 'oils_ghee') {
      return { min: 8, max: 55, category, unitKind: 'small_portion' };
    }
    if (category === 'dairy_eggs') {
      return { min: 4, max: 45, category, unitKind: 'small_portion' };
    }
    if (category === 'grains_legumes' || category === 'vegetables' || category === 'fruits') {
      return { min: 1, max: 30, category, unitKind: 'small_portion' };
    }
    return { min: 0.5, max: 40, category, unitKind: 'small_portion' };
  }
  if (normUnit === 'حبه') {
    if (category === 'vegetables' || category === 'fruits') {
      return { min: 0.5, max: 15, category, unitKind: 'small_portion' };
    }
    if (category === 'bakery') {
      return { min: 1, max: 10, category, unitKind: 'single_piece' };
    }
    if (category === 'poultry') {
      return { min: 35, max: 220, category, unitKind: 'standard_pack' };
    }
    if (category === 'household_detergents') {
      return { min: 5, max: 60, category, unitKind: 'single_piece' };
    }
    return { min: 0.5, max: 65, category, unitKind: 'small_portion' };
  }

  // 3. Gram units
  if (normUnit === 'جرام') {
    if (category === 'meat' || category === 'seafood') return { min: 0.1, max: 1.5, category, unitKind: 'small_portion' };
    if (category === 'spices') return { min: 0.05, max: 2, category, unitKind: 'small_portion' };
    return { min: 0.01, max: 1, category, unitKind: 'small_portion' };
  }

  // 4. Standard retail packs & kilos/liters
  switch (category) {
    case 'bakery':
      return { min: 2, max: 95, category, unitKind: 'standard_pack' };
    case 'vegetables':
    case 'fruits':
      return { min: 5, max: 85, category, unitKind: 'standard_pack' };
    case 'grains_legumes':
      return { min: 12, max: 120, category, unitKind: 'standard_pack' };
    case 'oils_ghee':
      if (normName.includes('خل')) return { min: 10, max: 45, category, unitKind: 'standard_pack' };
      return { min: 45, max: 350, category, unitKind: 'standard_pack' };
    case 'poultry':
      return { min: 35, max: 220, category, unitKind: 'standard_pack' };
    case 'dairy_eggs':
      if (normUnit === 'علبه' || normUnit === 'كيس') {
        return { min: 15, max: 220, category, unitKind: 'standard_pack' };
      }
      return { min: 30, max: 250, category, unitKind: 'standard_pack' };
    case 'seafood':
      if (normUnit === 'علبه') return { min: 20, max: 150, category, unitKind: 'standard_pack' };
      return { min: 60, max: 650, category, unitKind: 'standard_pack' };
    case 'meat':
      return { min: 150, max: 650, category, unitKind: 'standard_pack' };
    case 'spices':
      if (normUnit === 'كيلو') return { min: 10, max: 450, category, unitKind: 'standard_pack' };
      return { min: 2, max: 120, category, unitKind: 'standard_pack' };
    case 'household_detergents':
      return { min: 10, max: 350, category, unitKind: 'standard_pack' };
    case 'beverages_snacks':
      return { min: 5, max: 250, category, unitKind: 'standard_pack' };
    case 'general':
    default:
      return { min: 2, max: 350, category: 'general', unitKind: 'standard_pack' };
  }
}

export function validatePriceForUnit(
  itemName: string,
  unit: string,
  price: number | null | undefined
): PriceValidationResult {
  const bounds = getGuardrailRangeForItem(itemName, unit);
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    return { isValid: false, reason: 'invalid_number', bounds };
  }
  if (price < bounds.min || price > bounds.max) {
    return {
      isValid: false,
      reason: `out_of_bounds (${price} not in ${bounds.min}..${bounds.max})`,
      bounds,
    };
  }
  return { isValid: true, bounds };
}

export function scalePriceForSmallUnit(
  itemName: string,
  unit: string,
  fetchedRetailMedian: number
): number {
  const normUnit = normalizeMarketUnit(unit);
  const normName = normalizeArabicText(itemName);
  const category = classifyEgyptProductCategory(itemName);
  const bounds = getGuardrailRangeForItem(itemName, unit);

  let divisor = 1;
  if (normUnit === 'كوب' && fetchedRetailMedian >= 12) {
    divisor = 5;
  } else if (normUnit === 'ملعقه' && fetchedRetailMedian >= 10) {
    divisor = 25;
  } else if (normUnit === 'فص' && fetchedRetailMedian >= 8) {
    divisor = 40;
  } else if ((normUnit === 'رشه' || normUnit === 'عود' || normUnit === 'ورقه') && fetchedRetailMedian >= 6) {
    divisor = 50;
  } else if (
    (normUnit === 'بيضه' || (normName.includes('بيض') && (normUnit === 'حبه' || normUnit === 'قطعه'))) &&
    fetchedRetailMedian >= 50
  ) {
    divisor = 30;
  } else if (normUnit === 'حبه' && (category === 'vegetables' || category === 'fruits') && fetchedRetailMedian >= 5) {
    divisor = 6;
  } else if (normUnit === 'جرام' && fetchedRetailMedian > bounds.max) {
    divisor = 1000;
  }

  if (divisor > 1) {
    return roundEgyptRetailPrice(fetchedRetailMedian / divisor);
  }
  return roundEgyptRetailPrice(fetchedRetailMedian);
}

export function getAllVerifiedEgyptPrices(): Record<string, VerifiedEgyptPriceRecord> {
  ensureStaleCachesPurged();
  const storage = getStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(VERIFIED_EGYPT_PRICES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const validMap: Record<string, VerifiedEgyptPriceRecord> = {};
    let hadCorruptedEntries = false;

    for (const [key, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object') {
        hadCorruptedEntries = true;
        continue;
      }
      const rec = value as Partial<VerifiedEgyptPriceRecord>;
      if (
        typeof rec.typicalPrice === 'number' &&
        Number.isFinite(rec.typicalPrice) &&
        rec.typicalPrice > 0 &&
        (rec.source === 'live_market' || rec.source === 'user_verified') &&
        typeof rec.fetchedAt === 'string' &&
        typeof rec.itemName === 'string'
      ) {
        const unitStr = typeof rec.unit === 'string' && rec.unit.trim() ? rec.unit.trim() : 'حبة';
        const validation = validatePriceForUnit(rec.itemName, unitStr, rec.typicalPrice);
        if (rec.source !== 'user_verified' && !validation.isValid) {
          hadCorruptedEntries = true;
          continue;
        }
        validMap[key] = {
          normalizedKey: typeof rec.normalizedKey === 'string' ? rec.normalizedKey : key,
          itemName: rec.itemName,
          unit: unitStr,
          minPrice:
            typeof rec.minPrice === 'number' && Number.isFinite(rec.minPrice) && rec.minPrice > 0
              ? rec.minPrice
              : rec.typicalPrice,
          typicalPrice: rec.typicalPrice,
          maxPrice:
            typeof rec.maxPrice === 'number' && Number.isFinite(rec.maxPrice) && rec.maxPrice > 0
              ? rec.maxPrice
              : rec.typicalPrice,
          source: rec.source,
          sourceLabel:
            rec.source === 'user_verified'
              ? 'سعرك المسجل'
              : typeof rec.sourceLabel === 'string' && rec.sourceLabel.trim()
                ? rec.sourceLabel
                : 'سعر السوق المصري 2026',
          fetchedAt: rec.fetchedAt,
          sampleCount: typeof rec.sampleCount === 'number' && rec.sampleCount > 0 ? rec.sampleCount : 1,
          category: validation.bounds.category,
        };
      } else {
        hadCorruptedEntries = true;
      }
    }

    if (hadCorruptedEntries) {
      try {
        storage.setItem(VERIFIED_EGYPT_PRICES_STORAGE_KEY, JSON.stringify(validMap));
      } catch {
        // Ignore quota error
      }
    }

    return validMap;
  } catch {
    return {};
  }
}

export function revalidateVerifiedPriceCache(): void {
  ensureStaleCachesPurged();
  getAllVerifiedEgyptPrices();
}

export function getVerifiedEgyptPrice(itemName: string, unit: string): VerifiedEgyptPriceRecord | null {
  const cleanName = itemName.trim();
  if (!cleanName) return null;
  const key = normalizeMarketItemKey(cleanName, unit || 'حبة');
  const all = getAllVerifiedEgyptPrices();
  return all[key] || null;
}

export function saveVerifiedEgyptPrice(input: SaveVerifiedPriceInput): VerifiedEgyptPriceRecord | null {
  ensureStaleCachesPurged();
  const cleanName = input.itemName.trim();
  const cleanUnit = (input.unit || 'حبة').trim() || 'حبة';
  if (!cleanName || !Number.isFinite(input.typicalPrice) || input.typicalPrice <= 0) {
    return null;
  }

  const typicalPrice = roundEgyptRetailPrice(input.typicalPrice);
  const validation = validatePriceForUnit(cleanName, cleanUnit, typicalPrice);

  if (input.source === 'live_market' && !validation.isValid) {
    return null;
  }
  if (typicalPrice <= 0 || typicalPrice > 10000) {
    return null;
  }

  const normalizedKey = normalizeMarketItemKey(cleanName, cleanUnit);
  const minPrice = roundEgyptRetailPrice(
    typeof input.minPrice === 'number' && input.minPrice > 0 ? Math.min(input.minPrice, typicalPrice) : typicalPrice
  );
  const maxPrice = roundEgyptRetailPrice(
    typeof input.maxPrice === 'number' && input.maxPrice > 0 ? Math.max(input.maxPrice, typicalPrice) : typicalPrice
  );
  const fetchedAt = input.fetchedAt || new Date().toISOString();
  const sourceLabel =
    input.source === 'user_verified'
      ? 'سعرك المسجل'
      : input.sourceLabel?.trim() || 'سعر السوق المصري 2026';

  const record: VerifiedEgyptPriceRecord = {
    normalizedKey,
    itemName: cleanName,
    unit: cleanUnit,
    minPrice,
    typicalPrice,
    maxPrice,
    source: input.source,
    sourceLabel,
    fetchedAt,
    sampleCount: input.sampleCount && input.sampleCount > 0 ? input.sampleCount : 1,
    category: validation.bounds.category,
  };

  const storage = getStorage();
  if (storage) {
    try {
      const current = getAllVerifiedEgyptPrices();
      current[normalizedKey] = record;
      storage.setItem(VERIFIED_EGYPT_PRICES_STORAGE_KEY, JSON.stringify(current));
      if (input.source === 'live_market') {
        storage.setItem(VERIFIED_EGYPT_LAST_SYNC_KEY, fetchedAt);
      }
      notifyVerifiedPricesUpdated();
    } catch {
      // Ignore quota errors gracefully
    }
  }

  return record;
}

export function removeVerifiedEgyptPrice(itemName: string, unit: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const key = normalizeMarketItemKey(itemName, unit || 'حبة');
    const current = getAllVerifiedEgyptPrices();
    if (key in current) {
      delete current[key];
      storage.setItem(VERIFIED_EGYPT_PRICES_STORAGE_KEY, JSON.stringify(current));
      notifyVerifiedPricesUpdated();
    }
  } catch {
    // Ignore storage errors
  }
}

export function getLastMarketSyncTimestamp(): string | null {
  ensureStaleCachesPurged();
  const storage = getStorage();
  if (storage) {
    try {
      const storedSync = storage.getItem(VERIFIED_EGYPT_LAST_SYNC_KEY);
      if (storedSync && !Number.isNaN(Date.parse(storedSync))) {
        return storedSync;
      }
    } catch {
      // Fallback to scanning cached records
    }
  }

  const all = getAllVerifiedEgyptPrices();
  let latest: string | null = null;
  for (const record of Object.values(all)) {
    if (record.source !== 'live_market') continue;
    if (!latest || record.fetchedAt > latest) {
      latest = record.fetchedAt;
    }
  }
  return latest;
}

export function recordMarketSyncTimestamp(isoTimestamp = new Date().toISOString()): string {
  ensureStaleCachesPurged();
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(VERIFIED_EGYPT_LAST_SYNC_KEY, isoTimestamp);
    } catch {
      // Ignore storage error
    }
  }
  return isoTimestamp;
}

function stripMarkup(rawText: string): string {
  return toWesternDigits(String(rawText || ''))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripWeightAndVolumeNumbers(text: string): string {
  return text
    .replace(
      /(?<!\d)\d+(?:[.,]\d+)?\s*(?:جم|جرام|غرام|g|gr|gm|مل|مللي|ملي|ml|لتر|لترات|liter|l|كجم|كيلو\s*جرام|كيلوجرام|كيلو|kg|كيس|أكياس|اكياس|قطعه|قطعة|قطع|قرص|اقراص|أقراص|كبسوله|كبسولة|رول|منديل|مناديل|%)(?![\w\u0600-\u06FF])/gi,
      ' '
    )
    .replace(/(?<!\d)\d+\s*[x×*]\s*\d+(?:\s*(?:جم|جرام|مل|ml|g|kg))?(?![\w\u0600-\u06FF])/gi, ' ');
}

function parseMatchedPrice(rawNumber: string): number | null {
  const cleaned = rawNumber.replace(/,/g, '').trim();
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0.25 || parsed >= 10000) {
    return null;
  }
  if (Number.isInteger(parsed) && parsed >= 2020 && parsed <= 2035) {
    return null;
  }
  return Math.round(parsed * 100) / 100;
}

const RETAIL_SOURCE_PATTERNS: Array<{ label: string; patterns: RegExp[] }> = [
  { label: 'كارفور مصر', patterns: [/carrefour\s*egypt|carrefouregypt|كارفور/i] },
  { label: 'طلبات مارت', patterns: [/talabat|طلبات\s*مارت|طلبات/i] },
  { label: 'نون مصر', patterns: [/noon\.com|نون\s*مصر|نون/i] },
  { label: 'أمازون مصر', patterns: [/amazon\.eg|أمازون\s*مصر|امازون/i] },
  { label: 'هايبر وان', patterns: [/hyperone|هايبر\s*وان/i] },
  { label: 'بوابة الأسعار المحلية', patterns: [/مجلس\s*الوزراء|بوابه?\s*الاسعار|التموين/i] },
];

export function detectEgyptianRetailSources(text: string): string[] {
  const normalized = normalizeArabicText(text);
  const found: string[] = [];
  for (const entry of RETAIL_SOURCE_PATTERNS) {
    if (entry.patterns.some(rx => rx.test(normalized) || rx.test(text))) {
      found.push(entry.label);
    }
  }
  return found;
}

const BULK_PACK_CONTEXT_RE =
  /(?:بالجمله|جمله|بالطن|طن|شكاره|شيكاره|كرتونه\s*\d+|سعر\s*الطن|عرض\s*التوفير\s*\d+\s*كيلو|(?<!\d)(?:5|10|20|25|50)\s*(?:كيلو|كجم|kg|لتر|ارغفه|رغيف)(?![\w\u0600-\u06FF]))/i;

export function extractEgpPricesFromText(
  rawText: string,
  itemName: string,
  unit: string
): { prices: number[]; matchedRetailers: string[] } {
  const strippedMarkup = stripMarkup(rawText);
  if (!strippedMarkup) return { prices: [], matchedRetailers: [] };

  const matchedRetailers = detectEgyptianRetailSources(strippedMarkup);
  const cleanText = stripWeightAndVolumeNumbers(strippedMarkup);
  const normalizedText = normalizeArabicText(cleanText);
  const normUnit = normalizeMarketUnit(unit);
  const itemTokens = normalizeProductNameForLookup(itemName)
    .split(/\s+/)
    .filter(token => token.length >= 2 && !['من', 'في', 'على', 'او', 'و'].includes(token));

  const suffixRegex =
    /(\d{1,4}(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:جنيه(?:ا|اً| مصري(?:ا|اً)?)?|ج\.\s*م\.?|ج\s+م|egp|l\.?\s*e\.?)(?![\w\u0600-\u06FF])/gi;
  const prefixRegex =
    /(?:egp|l\.?\s*e\.?|ج\.\s*م\.?|ج\s+م)\s*[:\-]?\s*(\d{1,4}(?:,\d{3})*(?:\.\d{1,2})?)(?![\d.%])/gi;

  const contextualMatches: number[] = [];
  const pageMatches: number[] = [];

  const collectMatch = (matchIndex: number, matchLen: number, rawNum: string, rawSliceAfter: string) => {
    if (/^\s*(%|جم|جرام|غرام|مل|مللي|لتر|كيلو|كجم|kg|g|ml|l(?![\w\u0600-\u06FF]))/i.test(rawSliceAfter)) return;
    const val = parseMatchedPrice(rawNum);
    if (val === null) return;

    const leftSep = Math.max(
      cleanText.lastIndexOf('|', matchIndex),
      cleanText.lastIndexOf('\n', matchIndex)
    );
    const rightPipe = cleanText.indexOf('|', matchIndex + matchLen);
    const rightNl = cleanText.indexOf('\n', matchIndex + matchLen);
    const rightCandidates = [rightPipe, rightNl].filter(i => i !== -1);
    const rightSep = rightCandidates.length > 0 ? Math.min(...rightCandidates) : cleanText.length;

    const clauseStart = Math.max(leftSep + 1, matchIndex - 70);
    const clauseEnd = Math.min(rightSep, matchIndex + matchLen + 45);
    const localClause = normalizeArabicText(cleanText.slice(clauseStart, clauseEnd));

    if (normUnit !== 'كرتونه' && BULK_PACK_CONTEXT_RE.test(localClause)) {
      return;
    }

    const windowStart = Math.max(leftSep + 1, matchIndex - 140);
    const windowEnd = Math.min(rightSep, matchIndex + matchLen + 140);
    const contextWindow = normalizeArabicText(cleanText.slice(windowStart, windowEnd));

    const hasContextMatch =
      itemTokens.length > 0 && itemTokens.some(token => contextWindow.includes(token));

    if (hasContextMatch) {
      contextualMatches.push(val);
    } else {
      pageMatches.push(val);
    }
  };

  for (const match of cleanText.matchAll(suffixRegex)) {
    const idx = match.index ?? 0;
    collectMatch(idx, match[0].length, match[1], cleanText.slice(idx + match[0].length, idx + match[0].length + 14));
  }

  for (const match of cleanText.matchAll(prefixRegex)) {
    const idx = match.index ?? 0;
    collectMatch(idx, match[0].length, match[1], cleanText.slice(idx + match[0].length, idx + match[0].length + 14));
  }

  if (contextualMatches.length > 0) {
    return { prices: contextualMatches, matchedRetailers };
  }

  const pageMentionsItem =
    itemTokens.length > 0 && itemTokens.some(token => normalizedText.includes(token));
  if (pageMentionsItem && pageMatches.length > 0) {
    return { prices: pageMatches, matchedRetailers };
  }

  return { prices: [], matchedRetailers };
}

function getMedian(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function filterPriceOutliers(rawPrices: number[]): number[] {
  const cleaned = rawPrices
    .filter(p => typeof p === 'number' && Number.isFinite(p) && p >= 0.25 && p < 10000)
    .sort((a, b) => a - b);

  if (cleaned.length === 0) return [];
  if (cleaned.length === 1) return cleaned;
  if (cleaned.length === 2) {
    if (cleaned[1] / cleaned[0] > 4) {
      return [];
    }
    return cleaned;
  }

  const median = getMedian(cleaned);

  if (cleaned.length === 3) {
    return cleaned.filter(p => p >= median / 3.5 && p <= median * 3.5);
  }

  const lowerHalf = cleaned.slice(0, Math.floor(cleaned.length / 2));
  const upperHalf = cleaned.slice(Math.ceil(cleaned.length / 2));
  const q1 = getMedian(lowerHalf);
  const q3 = getMedian(upperHalf);
  const iqr = q3 - q1;
  const lowerBound = Math.max(0.25, q1 - 1.5 * iqr);
  const upperBound = q3 + 1.5 * iqr;

  return cleaned.filter(
    p => p >= lowerBound && p <= upperBound && p >= median / 4 && p <= median * 4
  );
}

function buildEgyptSearchEndpoints(itemName: string, unit: string): string[] {
  const cleanName = itemName.trim();
  const normUnit = normalizeMarketUnit(unit);
  const queryUnit = SMALL_PORTION_UNITS.has(normUnit) && normUnit !== 'حزمه' && normUnit !== 'حبه'
    ? ''
    : SINGLE_PIECE_UNITS.has(normUnit) || normUnit === 'حزمه'
      ? unit.trim()
      : normUnit === 'حبه'
        ? ''
        : unit.trim();

  const unitPhrase = queryUnit ? `${queryUnit} ` : '';
  const retailQuery = `${unitPhrase}${cleanName} سعر مصر`;
  const shoppingQuery = `سعر ${unitPhrase}${cleanName} في مصر جنيه`;
  const catalogKeyword = `${unitPhrase}${cleanName}`.trim();

  const targets = [
    `https://www.google.com/search?q=${encodeURIComponent(shoppingQuery)}&tbm=shop&gl=eg&hl=ar`,
    `https://www.google.com/search?q=${encodeURIComponent(retailQuery)}&gl=eg&hl=ar`,
    `https://www.carrefouregypt.com/mafegy/ar/v4/search?keyword=${encodeURIComponent(catalogKeyword)}`,
    `https://www.noon.com/egypt-ar/search/?q=${encodeURIComponent(catalogKeyword)}`,
    `https://www.talabat.com/egypt/search?q=${encodeURIComponent(catalogKeyword)}`,
  ];

  if (Capacitor.isNativePlatform()) {
    return targets;
  }

  return targets.map(target => `https://r.jina.ai/${target}`);
}

async function defaultHttpFetcher(url: string, timeoutMs: number): Promise<string | null> {
  if (Capacitor.isNativePlatform() && !url.startsWith('https://r.jina.ai/')) {
    try {
      const response = await CapacitorHttp.get({
        url,
        connectTimeout: timeoutMs,
        readTimeout: timeoutMs,
        headers: {
          'Accept-Language': 'ar-EG,ar;q=0.9,en;q=0.7',
          Accept: 'text/html,application/json,text/plain;q=0.9,*/*;q=0.5',
        },
      });
      if (response.status >= 200 && response.status < 400) {
        return typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data || '');
      }
      return null;
    } catch {
      return null;
    }
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller?.signal,
      headers: {
        Accept: 'text/plain, text/html, application/json;q=0.9',
      },
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text || null;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function resolveReliableLiveCandidates(
  cleanName: string,
  cleanUnit: string,
  rawPrices: number[],
  retailerSet: Set<string>,
  saveToCache: boolean
): VerifiedEgyptPriceRecord | null {
  const tableRef = lookupEgypt2026MarketPrice(cleanName, cleanUnit);
  const anchorPrice = tableRef?.typicalPrice ?? null;

  const isNearAnchorIfPresent = (price: number) => {
    if (!anchorPrice) return true;
    // Reject distorted bulk/multipack or ration anomalies deviating >2.2x from verified 2026 free-market anchor
    return price >= anchorPrice * 0.45 && price <= anchorPrice * 2.25;
  };

  const filtered = filterPriceOutliers(rawPrices);
  if (filtered.length > 0) {
    const rawMedian = getMedian(filtered);
    const scaledTypical = scalePriceForSmallUnit(cleanName, cleanUnit, rawMedian);
    const validation = validatePriceForUnit(cleanName, cleanUnit, scaledTypical);
    if (validation.isValid && isNearAnchorIfPresent(scaledTypical)) {
      const scaledAll = filtered
        .map(p => scalePriceForSmallUnit(cleanName, cleanUnit, p))
        .filter(p => validatePriceForUnit(cleanName, cleanUnit, p).isValid && isNearAnchorIfPresent(p))
        .sort((a, b) => a - b);

      const minPrice = scaledAll.length > 0 ? roundEgyptRetailPrice(scaledAll[0]) : scaledTypical;
      const maxPrice = scaledAll.length > 0 ? roundEgyptRetailPrice(scaledAll[scaledAll.length - 1]) : scaledTypical;
      const retailersList = Array.from(retailerSet);
      const sourceLabel =
        retailersList.length > 0
          ? `سعر السوق المصري (${retailersList.slice(0, 2).join(' • ')})`
          : 'سعر السوق المصري المحدّث';
      const fetchedAt = new Date().toISOString();

      if (saveToCache) {
        return (
          saveVerifiedEgyptPrice({
            itemName: cleanName,
            unit: cleanUnit,
            minPrice,
            typicalPrice: scaledTypical,
            maxPrice,
            source: 'live_market',
            sourceLabel,
            fetchedAt,
            sampleCount: filtered.length,
          }) || null
        );
      }

      return {
        normalizedKey: normalizeMarketItemKey(cleanName, cleanUnit),
        itemName: cleanName,
        unit: cleanUnit,
        minPrice,
        typicalPrice: scaledTypical,
        maxPrice,
        source: 'live_market',
        sourceLabel,
        fetchedAt,
        sampleCount: filtered.length,
        category: validation.bounds.category,
      };
    }
  }

  // Secondary check: direct unscaled candidates that pass unit guardrails AND 2026 anchor sanity
  const directValid = rawPrices
    .filter(p => validatePriceForUnit(cleanName, cleanUnit, p).isValid && isNearAnchorIfPresent(p))
    .sort((a, b) => a - b);

  if (directValid.length > 0) {
    const cleanDirect = filterPriceOutliers(directValid);
    const candidates = cleanDirect.length > 0 ? cleanDirect : directValid;
    const directTypical = roundEgyptRetailPrice(getMedian(candidates));
    const directCheck = validatePriceForUnit(cleanName, cleanUnit, directTypical);
    if (directCheck.isValid && isNearAnchorIfPresent(directTypical)) {
      const minDirect = roundEgyptRetailPrice(candidates[0]);
      const maxDirect = roundEgyptRetailPrice(candidates[candidates.length - 1]);
      const retailersList = Array.from(retailerSet);
      const sourceLabel =
        retailersList.length > 0
          ? `سعر السوق المصري (${retailersList.slice(0, 2).join(' • ')})`
          : 'سعر السوق المصري المحدّث';
      const fetchedAt = new Date().toISOString();

      if (saveToCache) {
        return (
          saveVerifiedEgyptPrice({
            itemName: cleanName,
            unit: cleanUnit,
            minPrice: minDirect,
            typicalPrice: directTypical,
            maxPrice: maxDirect,
            source: 'live_market',
            sourceLabel,
            fetchedAt,
            sampleCount: candidates.length,
          }) || null
        );
      }

      return {
        normalizedKey: normalizeMarketItemKey(cleanName, cleanUnit),
        itemName: cleanName,
        unit: cleanUnit,
        minPrice: minDirect,
        typicalPrice: directTypical,
        maxPrice: maxDirect,
        source: 'live_market',
        sourceLabel,
        fetchedAt,
        sampleCount: candidates.length,
        category: directCheck.bounds.category,
      };
    }
  }

  return null;
}

export async function fetchRealEgyptMarketPrice(
  itemName: string,
  unit: string,
  options: FetchMarketPriceOptions = {}
): Promise<VerifiedEgyptPriceRecord | null> {
  ensureStaleCachesPurged();
  const cleanName = itemName.trim();
  const cleanUnit = (unit || 'حبة').trim() || 'حبة';
  if (!cleanName) return null;

  const isOnline =
    typeof options.isOnline === 'boolean'
      ? options.isOnline
      : typeof navigator !== 'undefined'
        ? navigator.onLine !== false
        : true;

  const saveToCache = options.saveToCache !== false;

  if (isOnline) {
    const timeoutMs = options.timeoutMs ?? 4500;
    const fetcher = options.fetcher
      ? options.fetcher
      : (url: string) => defaultHttpFetcher(url, timeoutMs);

    const endpoints = buildEgyptSearchEndpoints(cleanName, cleanUnit);
    const settled = await Promise.allSettled(endpoints.map(url => fetcher(url)));

    const rawPrices: number[] = [];
    const retailerSet = new Set<string>();

    for (const outcome of settled) {
      if (outcome.status !== 'fulfilled' || !outcome.value) continue;
      const extracted = extractEgpPricesFromText(outcome.value, cleanName, cleanUnit);
      if (extracted.prices.length > 0) {
        rawPrices.push(...extracted.prices);
        extracted.matchedRetailers.forEach(r => retailerSet.add(r));
      }
    }

    if (rawPrices.length > 0) {
      const liveResolved = resolveReliableLiveCandidates(
        cleanName,
        cleanUnit,
        rawPrices,
        retailerSet,
        saveToCache
      );
      if (liveResolved) {
        return liveResolved;
      }
    }
  }

  // Fallback seamlessly to the verified 2026 Egyptian Free-Market Retail Price Table (never upper-bound guardrails)
  const market2026 = lookupEgypt2026MarketPrice(cleanName, cleanUnit);
  if (market2026) {
    if (saveToCache) {
      return (
        saveVerifiedEgyptPrice({
          itemName: cleanName,
          unit: cleanUnit,
          minPrice: market2026.minPrice,
          typicalPrice: market2026.typicalPrice,
          maxPrice: market2026.maxPrice,
          source: 'live_market',
          sourceLabel: market2026.sourceLabel,
          fetchedAt: market2026.fetchedAt,
          sampleCount: 1,
        }) || market2026
      );
    }
    return market2026;
  }

  return null;
}

export function formatMarketSyncDateTime(isoTimestamp: string | null): string {
  if (!isoTimestamp) return '';
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return date.toLocaleString('ar-EG', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }
}
