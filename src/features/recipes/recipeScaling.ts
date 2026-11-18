import { formatStructuredIngredientLine, type StructuredIngredient } from './recipeSchema.ts';

export const BASE_RECIPE_SERVINGS = 4;
export const MIN_RECIPE_SERVINGS = 1;
export const MAX_RECIPE_SERVINGS = 50;

export function clampRecipeServings(value: number, fallback = BASE_RECIPE_SERVINGS): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(MIN_RECIPE_SERVINGS, Math.min(MAX_RECIPE_SERVINGS, Math.round(value)));
}

export function getRecipeScaleFactor(
  targetServings: number,
  baseServings = BASE_RECIPE_SERVINGS
): number {
  const safeTarget = clampRecipeServings(targetServings);
  const safeBase = baseServings > 0 && Number.isFinite(baseServings) ? baseServings : BASE_RECIPE_SERVINGS;
  return safeTarget / safeBase;
}

export function formatArabicServingsLabel(servings: number): string {
  const n = clampRecipeServings(servings);
  if (n === 1) return 'فرد واحد';
  if (n === 2) return 'فردين';
  if (n >= 3 && n <= 10) return `${n} أفراد`;
  return `${n} فرداً`;
}

function normalizeDigitsToAscii(input: string): string {
  return input.replace(/[٠-٩]/g, ch => String(ch.charCodeAt(0) - 0x0660));
}

export function parseCulinaryAmount(rawAmount: string): number | null {
  const cleaned = normalizeDigitsToAscii(rawAmount)
    .replace(/,/g, '.')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return null;

  const wordMap: Record<string, number> = {
    ربع: 0.25,
    ثلث: 1 / 3,
    تلت: 1 / 3,
    نصف: 0.5,
    نص: 0.5,
    ثلثين: 2 / 3,
    ثلثان: 2 / 3,
    'ثلاثة أرباع': 0.75,
    'ثلاثة ارباع': 0.75,
    'ثلاث أرباع': 0.75,
    'تلات أرباع': 0.75,
    'تلات ارباع': 0.75,
    واحد: 1,
    واحدة: 1,
    'واحد وربع': 1.25,
    'واحد ونصف': 1.5,
    'واحد ونص': 1.5,
    اثنين: 2,
    اتنين: 2,
    اثنان: 2,
    كوبان: 2,
    كوبين: 2,
    ملعقتان: 2,
    ملعقتين: 2,
    بصلتان: 2,
    بصلتين: 2,
    بيضتان: 2,
    بيضتين: 2,
    حبتان: 2,
    حبتين: 2,
    فصان: 2,
    فصين: 2,
    رغيفان: 2,
    رغيفين: 2,
  };

  if (wordMap[cleaned] !== undefined) {
    return wordMap[cleaned];
  }

  // Handle "<number> ونصف" or "<number> وربع"
  const numWithFractionMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*و\s*(نصف|نص|ربع)$/);
  if (numWithFractionMatch) {
    const whole = Number(numWithFractionMatch[1]);
    const frac = numWithFractionMatch[2] === 'ربع' ? 0.25 : 0.5;
    if (Number.isFinite(whole)) return whole + frac;
  }

  // Standard numbers or mixed fractions like "1 1/2" or "1/2"
  const numericMatch = cleaned.match(/^(\d+\/\d+|\d+(?:\.\d+)?(?:\s+\d+\/\d+)?)$/);
  if (numericMatch) {
    const total = numericMatch[1]
      .trim()
      .split(/\s+/)
      .reduce((acc, part) => {
        if (!part.includes('/')) return acc + Number(part);
        const [num, den] = part.split('/').map(Number);
        return acc + (den ? num / den : 0);
      }, 0);
    return Number.isFinite(total) && total > 0 ? total : null;
  }

  return null;
}

type UnitKind = 'grams' | 'kilograms' | 'milliliters' | 'liters' | 'countable_whole' | 'countable_half' | 'volume';

function classifyUnitAndIngredient(unit: string, name: string): UnitKind {
  const u = unit.trim();
  const n = name.trim();

  if (/^(?:جم|جرام|غ|غرام|g|grams?)$/i.test(u)) {
    return 'grams';
  }
  if (/^(?:كيلو|كجم|كيلوجرام|كغ|kg|kilograms?)$/i.test(u)) {
    return 'kilograms';
  }
  if (/^(?:مل|مللي|ملليلتر|ml)$/i.test(u)) {
    return 'milliliters';
  }
  if (/^(?:لتر|لترات|l|liters?)$/i.test(u)) {
    return 'liters';
  }
  if (/كوب|أكواب|اكواب|ملعقة|ملاعق|فنجان/.test(u)) {
    return 'volume';
  }

  const combined = `${u} ${n}`;
  if (/بيض|بيضة|بيضات|فص|فصوص|عود|أعواد|ورقة|ورق لورا|دبوس|دبابيس|زوج|أزواج/.test(combined)) {
    return 'countable_whole';
  }
  if (
    /^(?:حبة|حبات|ثمرة|ثمرات|بصلة|بصلات|رغيف|أرغفة|قطعة|قطع|قرن|قرون|حزمة|ربطة|علبة|كيس|شريحة|شرائح|سمكة|بطة|دجاجة|فرخة|أرنب|ليمونة|برتقالة)$/.test(
      u
    ) ||
    (!u && /بصل|ثوم|بيض|رغيف|ليمون|طماطم|بطاطس|فلفل/.test(n))
  ) {
    return 'countable_half';
  }

  return 'volume';
}

function formatCleanDecimalOrWord(value: number, options: { allowDualCup?: boolean; unit?: string } = {}): {
  amountText: string;
  unitText: string;
} {
  const unitText = (options.unit || '').trim();

  // Normalize canonical unit singular when pairing with numbers/fractions
  const canonicalUnit = unitText
    .replace(/^أكواب$|^اكواب$/, 'كوب')
    .replace(/^ملاعق كبيرة$|^ملعقتان كبيرتان$|^ملعقتين كبيرتين$/, 'ملعقة كبيرة')
    .replace(/^ملاعق صغيرة$|^ملعقتان صغيرتان$|^ملعقتين صغيرتين$/, 'ملعقة صغيرة')
    .replace(/^ملاعق$/, 'ملعقة')
    .replace(/^فصوص$/, 'فص')
    .replace(/^حبات$/, 'حبة');

  if (options.allowDualCup && Math.abs(value - 2) < 0.01 && canonicalUnit === 'كوب') {
    return { amountText: 'كوبان', unitText: '' };
  }

  if (Math.abs(value - 0.25) < 0.04) {
    return { amountText: 'ربع', unitText: canonicalUnit };
  }
  if (Math.abs(value - 1 / 3) < 0.04) {
    return { amountText: 'ثلث', unitText: canonicalUnit };
  }
  if (Math.abs(value - 0.5) < 0.04) {
    return { amountText: 'نصف', unitText: canonicalUnit };
  }
  if (Math.abs(value - 2 / 3) < 0.04) {
    return { amountText: 'ثلثين', unitText: canonicalUnit };
  }
  if (Math.abs(value - 0.75) < 0.04) {
    return { amountText: 'ثلاثة أرباع', unitText: canonicalUnit };
  }

  const roundedHalf = Math.round(value * 2) / 2;
  const cleanNum = Number.isInteger(roundedHalf) ? String(roundedHalf) : roundedHalf.toFixed(1);
  return { amountText: cleanNum, unitText: canonicalUnit };
}

function roundGramsSmart(grams: number): { amount: string; unit: string } {
  if (grams >= 1000) {
    const kg = grams / 1000;
    const roundedKg = Math.round(kg * 2) / 2;
    const finalKg = roundedKg >= 1 ? roundedKg : 1;
    const amountStr = Number.isInteger(finalKg) ? String(finalKg) : finalKg.toFixed(1);
    return { amount: amountStr, unit: 'كيلو' };
  }

  if (grams <= 10) {
    return { amount: String(Math.max(5, Math.round(grams / 5) * 5)), unit: 'جرام' };
  }
  if (grams <= 100) {
    return { amount: String(Math.round(grams / 5) * 5), unit: 'جرام' };
  }
  if (grams <= 300) {
    return { amount: String(Math.round(grams / 25) * 25), unit: 'جرام' };
  }
  return { amount: String(Math.round(grams / 25) * 25), unit: 'جرام' };
}

function roundMillilitersSmart(ml: number): { amount: string; unit: string } {
  if (ml >= 1000) {
    const liters = ml / 1000;
    const roundedLiters = Math.round(liters * 2) / 2;
    const finalLiters = roundedLiters >= 1 ? roundedLiters : 1;
    const amountStr = Number.isInteger(finalLiters) ? String(finalLiters) : finalLiters.toFixed(1);
    return { amount: amountStr, unit: 'لتر' };
  }
  if (ml <= 100) {
    return { amount: String(Math.max(10, Math.round(ml / 10) * 10)), unit: 'مللي' };
  }
  return { amount: String(Math.round(ml / 25) * 25), unit: 'مللي' };
}

function roundVolumeSmart(val: number): number {
  if (val <= 0.3) return 0.25;
  if (val < 0.39) return 1 / 3;
  if (val < 0.62) return 0.5;
  if (val < 0.7) return 2 / 3;
  if (val < 0.87) return 0.75;
  return Math.max(1, Math.round(val * 2) / 2);
}

/**
 * Scales a structured ingredient from `baseServings` (default 4) to `targetServings`
 * applying smart culinary rounding:
 * - Countable items round to whole or logical half (minimum 1)
 * - Weights >= 1000g automatically convert to kilograms (كيلو)
 * - Volumes >= 1000ml automatically convert to liters (لتر)
 * - Fractions format cleanly (ربع, نصف, كوبان, 1.5, 2.5) with zero ugly decimals
 */
export function scaleStructuredIngredient(
  item: StructuredIngredient,
  targetServings: number,
  baseServings = BASE_RECIPE_SERVINGS
): StructuredIngredient {
  const safeTarget = clampRecipeServings(targetServings);
  const safeBase = baseServings > 0 ? baseServings : BASE_RECIPE_SERVINGS;
  const scaleFactor = safeTarget / safeBase;

  const parsedAmount = parseCulinaryAmount(item.amount);
  if (parsedAmount === null) {
    return { ...item };
  }

  // If scaleFactor is 1, only normalize >=1000g to كيلو if needed, otherwise keep exact 4-serving item
  if (Math.abs(scaleFactor - 1) < 1e-6) {
    const kind = classifyUnitAndIngredient(item.unit, item.name);
    if (kind === 'grams' && parsedAmount >= 1000) {
      const converted = roundGramsSmart(parsedAmount);
      return { ...item, amount: converted.amount, unit: converted.unit };
    }
    return { ...item };
  }

  const rawScaled = parsedAmount * scaleFactor;
  const kind = classifyUnitAndIngredient(item.unit, item.name);

  if (kind === 'grams') {
    const converted = roundGramsSmart(rawScaled);
    return { ...item, amount: converted.amount, unit: converted.unit };
  }

  if (kind === 'kilograms') {
    const totalGrams = rawScaled * 1000;
    if (totalGrams < 1000) {
      if (Math.abs(rawScaled - 0.25) < 0.05) {
        return { ...item, amount: 'ربع', unit: 'كيلو' };
      }
      if (Math.abs(rawScaled - 0.5) < 0.06) {
        return { ...item, amount: 'نصف', unit: 'كيلو' };
      }
      const g = roundGramsSmart(totalGrams);
      return { ...item, amount: g.amount, unit: g.unit };
    }
    const g = roundGramsSmart(totalGrams);
    return { ...item, amount: g.amount, unit: g.unit };
  }

  if (kind === 'milliliters') {
    const converted = roundMillilitersSmart(rawScaled);
    return { ...item, amount: converted.amount, unit: converted.unit };
  }

  if (kind === 'liters') {
    const totalMl = rawScaled * 1000;
    const converted = roundMillilitersSmart(totalMl);
    return { ...item, amount: converted.amount, unit: converted.unit };
  }

  if (kind === 'countable_whole') {
    const whole = Math.max(1, Math.round(rawScaled));
    const canonicalUnit = item.unit.replace(/^فصوص$/, 'فص').replace(/^حبات$/, 'حبة');
    return { ...item, amount: String(whole), unit: canonicalUnit };
  }

  if (kind === 'countable_half') {
    const rounded =
      rawScaled <= 1
        ? 1
        : rawScaled < 4
        ? Math.max(1, Math.round(rawScaled * 2) / 2)
        : Math.round(rawScaled);
    const amountStr = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    const canonicalUnit = item.unit.replace(/^حبات$/, 'حبة').replace(/^ثمرات$/, 'ثمرة');
    return { ...item, amount: amountStr, unit: canonicalUnit };
  }

  // Volume / cups / spoons / general measures
  const snapped = roundVolumeSmart(rawScaled);
  const formatted = formatCleanDecimalOrWord(snapped, {
    allowDualCup: true,
    unit: item.unit,
  });
  return {
    ...item,
    amount: formatted.amountText,
    unit: formatted.unitText,
  };
}

const KNOWN_UNIT_PATTERN =
  'كيلوجرام|كيلو|كجم|جرام|جم|غ|ملليلتر|مللي|مل|لتر|أكواب|اكواب|كوبان|كوبين|كوب|ملاعق\\s+كبيرة|ملعقتان\\s+كبيرتان|ملعقتين\\s+كبيرتين|ملعقة\\s+كبيرة|ملاعق\\s+صغيرة|ملعقتان\\s+صغيرتان|ملعقتين\\s+صغيرتين|ملعقة\\s+صغيرة|ملاعق|ملعقة|فصوص|فصان|فصين|فص|حبات|حبتان|حبتين|حبة|ثمرات|ثمرة|بيضات|بيضتان|بيضتين|بيضة|بصلات|بصلتان|بصلتين|بصلة|أرغفة|رغيفان|رغيفين|رغيف|دبابيس|دبوس|أزواج|زوج|شرائح|شريحة|قطع|قطعة|أعواد|عودان|عودين|عود|قرون|قرن|حزمة|ربطة|علبة|كيس|بطة|دجاجة|فرخة|أرنب|سمكة|ليمونة|برتقالة';

/**
 * Scales a free-text Arabic ingredient line (from the built-in local catalog or seedData)
 * from `baseServings` (default 4) to `targetServings`.
 */
export function scaleArabicIngredientLine(
  rawLine: string,
  targetServings: number,
  baseServings = BASE_RECIPE_SERVINGS
): string {
  const line = rawLine.trim();
  if (!line) return line;

  const safeTarget = clampRecipeServings(targetServings);
  const safeBase = baseServings > 0 ? baseServings : BASE_RECIPE_SERVINGS;
  if (safeTarget === safeBase) {
    return line;
  }

  // Handle section prefixes like "للحشوة: ..." or "للصوص: ..."
  const sectionPrefixMatch = line.match(/^((?:للحشوة|للصوص|للتتبيلة|للوجه|للشربات|للدقة|للبشاميل)\s*[:：]\s*)(.+)$/);
  if (sectionPrefixMatch) {
    return `${sectionPrefixMatch[1]}${scaleArabicIngredientLine(sectionPrefixMatch[2], safeTarget, safeBase)}`;
  }

  // Case 1: seedData format "أرز مصري — 2 كوب"
  const dashParts = line.split(/\s*—\s*/);
  if (dashParts.length === 2) {
    const [itemName, qtyPart] = dashParts;
    const qtyMatch = normalizeDigitsToAscii(qtyPart).match(
      new RegExp(`^(\\d+(?:\\.\\d+)?(?:\\/\\d+)?|نصف|نص|ربع|ثلث)\\s*(${KNOWN_UNIT_PATTERN})?(.*)$`)
    );
    if (qtyMatch) {
      const amount = qtyMatch[1];
      const unit = (qtyMatch[2] || '').trim();
      const rest = (qtyMatch[3] || '').trim();
      const scaled = scaleStructuredIngredient(
        { name: itemName.trim(), amount, unit: unit || 'حبة', notes: rest || undefined },
        safeTarget,
        safeBase
      );
      return formatStructuredIngredientLine(scaled);
    }
  }

  const normalized = normalizeDigitsToAscii(line);

  // Case 2: Dual Arabic forms at the start of the line (e.g. "ملعقتان كبيرتان سمن بلدي", "كوبان مرقة", "بصلتان مفرومتان")
  const dualMatch = normalized.match(
    /^(ملعقتان\s+كبيرتان|ملعقتين\s+كبيرتين|ملعقتان\s+صغيرتان|ملعقتين\s+صغيرتين|ملعقتان|ملعقتين|كوبان|كوبين|بصلتان|بصلتين|بيضتان|بيضتين|حبتان|حبتين|فصان|فصين|رغيفان|رغيفين|عودان|عودين)\s+(.+)$/
  );
  if (dualMatch) {
    const dualWord = dualMatch[1];
    const restName = dualMatch[2].trim();
    let unit = 'حبة';
    if (/ملعقت.*كبير/.test(dualWord)) unit = 'ملعقة كبيرة';
    else if (/ملعقت.*صغير/.test(dualWord)) unit = 'ملعقة صغيرة';
    else if (/ملعقت/.test(dualWord)) unit = 'ملعقة';
    else if (/كوب/.test(dualWord)) unit = 'كوب';
    else if (/بصل/.test(dualWord)) unit = 'بصلة';
    else if (/بيض/.test(dualWord)) unit = 'بيضة';
    else if (/فص/.test(dualWord)) unit = 'فص';
    else if (/رغيف/.test(dualWord)) unit = 'رغيف';
    else if (/عود/.test(dualWord)) unit = 'عود';

    const scaled = scaleStructuredIngredient(
      { name: restName, amount: '2', unit },
      safeTarget,
      safeBase
    );
    return formatStructuredIngredientLine(scaled);
  }

  // Case 3: "<number or Arabic fraction> <unit> <name>" (e.g. "500 جم لحم مفروم", "نصف كوب لبن", "1.5 كوب فريك", "2 بصلة كبيرة")
  const leadingQtyMatch = normalized.match(
    new RegExp(
      `^(ثلاثة\\s+أرباع|ثلاث\\s+أرباع|تلات\\s+أرباع|نصف|نص|ربع|ثلثين|ثلث|واحد\\s+ونصف|واحد\\s+وربع|\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?)\\s+(${KNOWN_UNIT_PATTERN})\\s+(.+)$`
    )
  );
  if (leadingQtyMatch) {
    const rawAmt = leadingQtyMatch[1];
    const rawUnit = leadingQtyMatch[2];
    const restName = leadingQtyMatch[3].trim();
    const scaled = scaleStructuredIngredient(
      { name: restName, amount: rawAmt, unit: rawUnit },
      safeTarget,
      safeBase
    );
    return formatStructuredIngredientLine(scaled);
  }

  // Case 4: "<unit> ونصف <name>" or "<unit> وربع <name>" (e.g. "كوب ونصف دقيق", "ملعقة كبيرة ونصف سمن")
  const unitAndHalfMatch = normalized.match(
    new RegExp(`^(${KNOWN_UNIT_PATTERN})\\s+و\\s*(نصف|نص|ربع)\\s+(.+)$`)
  );
  if (unitAndHalfMatch) {
    const rawUnit = unitAndHalfMatch[1];
    const fracWord = unitAndHalfMatch[2];
    const restName = unitAndHalfMatch[3].trim();
    const baseAmt = fracWord === 'ربع' ? '1.25' : '1.5';
    const scaled = scaleStructuredIngredient(
      { name: restName, amount: baseAmt, unit: rawUnit },
      safeTarget,
      safeBase
    );
    return formatStructuredIngredientLine(scaled);
  }

  // Case 5: Implicit 1 with leading singular unit or countable noun (e.g. "كوب مرقة دجاج", "ملعقة كبيرة سمن", "ملعقة صغيرة كمون", "بصلة كبيرة مفرومة", "بيضة مخفوقة", "حزمة شبت")
  const implicitOneMatch = normalized.match(
    /^(كوب|ملعقة\s+كبيرة|ملعقة\s+صغيرة|ملعقة|كيلو|بصلة|بيضة|رغيف|حزمة|ربطة|علبة|كيس|ليمونة|برتقالة)\s+(.+)$/
  );
  if (implicitOneMatch) {
    const rawUnit = implicitOneMatch[1];
    const restName = implicitOneMatch[2].trim();
    const scaled = scaleStructuredIngredient(
      { name: restName, amount: '1', unit: rawUnit },
      safeTarget,
      safeBase
    );
    return formatStructuredIngredientLine(scaled);
  }

  // Case 6: "عصير 2 ليمونة" or "عصير ليمونة كبيرة"
  const juiceCountMatch = normalized.match(/^عصير\s+(\d+(?:\.\d+)?)\s*(ليمونة|ليمونات|برتقالة|برتقالات)(.*)$/);
  if (juiceCountMatch) {
    const scaled = scaleStructuredIngredient(
      { name: juiceCountMatch[3].trim(), amount: juiceCountMatch[1], unit: juiceCountMatch[2] },
      safeTarget,
      safeBase
    );
    const qtyUnit = [scaled.amount, scaled.unit, scaled.name].filter(Boolean).join(' ').trim();
    return `عصير ${qtyUnit}`;
  }
  const juiceSingleMatch = normalized.match(/^عصير\s+(ليمونة|برتقالة)(.*)$/);
  if (juiceSingleMatch) {
    const scaled = scaleStructuredIngredient(
      { name: juiceSingleMatch[2].trim(), amount: '1', unit: juiceSingleMatch[1] },
      safeTarget,
      safeBase
    );
    const qtyUnit = [scaled.amount, scaled.unit, scaled.name].filter(Boolean).join(' ').trim();
    return `عصير ${qtyUnit}`;
  }

  // Case 7: Leading number without standard unit (e.g. "8 دبابيس فراخ", "4 حمام زغاليل")
  const bareNumberMatch = normalized.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (bareNumberMatch) {
    const rawAmt = bareNumberMatch[1];
    const restName = bareNumberMatch[2].trim();
    const scaled = scaleStructuredIngredient(
      { name: restName, amount: rawAmt, unit: '' },
      safeTarget,
      safeBase
    );
    return formatStructuredIngredientLine(scaled);
  }

  return line;
}
