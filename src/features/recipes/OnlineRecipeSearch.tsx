import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { ArrowRight, Mic, MicOff, Volume2, VolumeX, Search, X } from 'lucide-react';
import { normalizeArabicSearchTerm as normalize, matchesArabicSearchAlias } from './arabicSearch';
import { isRelevantRecipe } from './recipeValidation';
import { RECIPES, type Recipe } from '../../data/seedData';
import { EgyptianRecipeSpeechPlayer, buildEgyptianRecipeSpeechSegments } from './recipeSpeech';
import { RecipeIllustration } from '../../components/RecipeIllustration';

interface RecipeVoicePlugin {
  request(): Promise<{ granted: boolean }>;
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  speak(options: { text: string }): Promise<void>;
  stopSpeaking(): Promise<void>;
  addListener(eventName: 'speechResult', listener: (event: { transcript?: string }) => void): Promise<{ remove(): Promise<void> }>;
  addListener(eventName: 'speechError', listener: (event: { error?: string }) => void): Promise<{ remove(): Promise<void> }>;
  addListener(eventName: 'speechPlaybackStatus', listener: (event: { status?: string }) => void): Promise<{ remove(): Promise<void> }>;
}
const recipeVoice = registerPlugin<RecipeVoicePlugin>('MicrophonePermission');

export type CuisineTier = 'egyptian' | 'arab' | 'international';

type OnlineRecipe = {
  title: string;
  servings: number;
  pageId: number;
  url: string;
  extract: string;
  cuisine?: CuisineTier;
  imageUrl?: string;
  imageLicense?: string;
  imageCredit?: string;
};

type MealDbMeal = {
  idMeal: string;
  strMeal: string;
  strArea?: string;
  strMealThumb?: string;
  strInstructions?: string;
  strSource?: string;
  [key: string]: string | undefined;
};

const SAVED_KEY = 'tadbeera_online_recipes_v1';
const MEAL_DB_API = 'https://www.themealdb.com/api/json/v1/1/search.php';
const MEAL_DB_FILTER_API = 'https://www.themealdb.com/api/json/v1/1/filter.php';
const MEAL_DB_LOOKUP_API = 'https://www.themealdb.com/api/json/v1/1/lookup.php';
const WIKIBOOKS_API = 'https://en.wikibooks.org/w/api.php';

const CUISINE_PRIORITY: Record<CuisineTier, number> = {
  egyptian: 0,
  arab: 1,
  international: 2,
};

export const CUISINE_BADGE_META: Record<CuisineTier, { label: string; className: string }> = {
  egyptian: {
    label: '🇪🇬 مصري',
    className: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  },
  arab: {
    label: '🌍 عربي',
    className: 'bg-amber-50 text-amber-800 border border-amber-200',
  },
  international: {
    label: '🌐 عالمي',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
  },
};

const ARAB_AREAS = new Set([
  'moroccan',
  'tunisian',
  'algerian',
  'lebanese',
  'syrian',
  'palestinian',
  'jordanian',
  'iraqi',
  'saudi',
  'saudi arabian',
  'emirati',
  'kuwaiti',
  'qatari',
  'bahraini',
  'omani',
  'yemeni',
  'libyan',
  'sudanese',
  'middle eastern',
  'arabian',
  'turkish',
]);

const ENGLISH_SYNONYM_PAIRS: Record<string, string[]> = {
  shrimp: ['prawns'],
  prawns: ['shrimp'],
  prawn: ['shrimp', 'prawns'],
  squid: ['calamari'],
  calamari: ['squid'],
  eggplant: ['aubergine'],
  aubergine: ['eggplant'],
  zucchini: ['courgette'],
  courgette: ['zucchini'],
  cilantro: ['coriander'],
  coriander: ['cilantro'],
  beef: ['lamb'],
  lamb: ['beef'],
  fish: ['salmon', 'cod'],
};

const ARABIC_STOP_WORDS = new Set([
  'في', 'على', 'من', 'الي', 'إلى', 'عن', 'مع', 'بال', 'و', 'او', 'أو',
  'طريقه', 'طريقة', 'عمل', 'وصفه', 'وصفة', 'اكله', 'أكلة', 'عايز', 'عاوزه', 'عايزة',
  'مقلي', 'مقرمش', 'مشوي', 'مسلوق', 'بالفرن', 'في الفرن', 'صينيه', 'صينية', 'طاجن',
]);

const ARABIC_ALIASES: Array<{ terms: string[]; englishTerms: string[] }> = [
  // Seafood & Shrimp
  { terms: ['جمبري', 'الجمبري', 'جمبرى', 'روبيان', 'قريدس'], englishTerms: ['shrimp', 'prawns'] },
  { terms: ['جمبري مقلي', 'جمبري بانيه', 'جمبري اسكندراني', 'طاجن جمبري', 'ملوخية بالجمبري', 'كبسة جمبري', 'صيادية بالجمبري'], englishTerms: ['shrimp', 'prawns'] },
  { terms: ['كابوريا', 'سلطعون'], englishTerms: ['crab'] },
  { terms: ['سبيط', 'كاليماري', 'حبار'], englishTerms: ['squid', 'calamari'] },
  { terms: ['سمك', 'اسماك', 'سمك مشوي', 'سمك مقلي', 'فيليه سمك', 'سمك فيليه'], englishTerms: ['fish', 'salmon', 'cod'] },
  { terms: ['تونة', 'تونه'], englishTerms: ['tuna'] },
  // Poultry & Meat
  { terms: ['فراخ', 'دجاج', 'صدور فراخ', 'فراخ مشوية', 'بانيه', 'شاورما فراخ'], englishTerms: ['chicken'] },
  { terms: ['لحمة', 'لحم', 'لحم مفروم', 'كفتة', 'كفته', 'شاورما لحمة'], englishTerms: ['beef', 'lamb'] },
  { terms: ['سجق اسكندراني', 'سجق', 'سجق شرقي'], englishTerms: ['egyptian sausage', 'sausage'] },
  { terms: ['كبدة اسكندراني', 'كبدة إسكندراني', 'كبدة', 'كبدة بالردة'], englishTerms: ['alexandrian liver', 'liver'] },
  // Vegetables & Pantry Staples
  { terms: ['بطاطس', 'بطاطا'], englishTerms: ['potatoes', 'potato'] },
  { terms: ['باذنجان', 'بتنجان'], englishTerms: ['eggplant', 'aubergine'] },
  { terms: ['كوسة', 'كوسه'], englishTerms: ['zucchini', 'courgette'] },
  { terms: ['طماطم', 'صلصة طماطم'], englishTerms: ['tomato'] },
  { terms: ['سبانخ'], englishTerms: ['spinach'] },
  { terms: ['مشروم', 'فطر'], englishTerms: ['mushroom'] },
  { terms: ['أرز', 'ارز', 'رز'], englishTerms: ['rice'] },
  { terms: ['مكرونة', 'مكرونه', 'باستا'], englishTerms: ['pasta', 'spaghetti'] },
  { terms: ['بيض'], englishTerms: ['eggs', 'egg'] },
  { terms: ['شوربة', 'شوربه'], englishTerms: ['soup'] },
  // Egyptian & Arab Classics
  { terms: ['فايش', 'عيش فايش', 'فايش صعيدي', 'فايش ناشف'], englishTerms: ['egyptian faysh bread'] },
  { terms: ['شابورة', 'شابوره', 'عيش شابورة', 'بقسماط'], englishTerms: ['egyptian shaboura rusk'] },
  { terms: ['عيش شمسي', 'عيش بلدي', 'عيش فلاحي'], englishTerms: ['egyptian bread'] },
  { terms: ['فطير مشلتت', 'فطير', 'فطير فلاحي'], englishTerms: ['egyptian feteer meshaltet'] },
  { terms: ['حواوشي', 'حواوشى', 'عيش باللحمة'], englishTerms: ['egyptian hawawshi'] },
  { terms: ['كحك', 'كحك العيد', 'كعك'], englishTerms: ['egyptian kahk'] },
  { terms: ['غريبة', 'غريبه'], englishTerms: ['egyptian ghorayeba cookies'] },
  { terms: ['بيتي فور', 'بيتى فور', 'بتيفور'], englishTerms: ['petit four cookies'] },
  { terms: ['كنافة', 'كنافه'], englishTerms: ['kunafa'] },
  { terms: ['قطايف', 'قطايف بالقشطة', 'قطايف بالمكسرات'], englishTerms: ['qatayef'] },
  { terms: ['عيش فينو', 'فينو', 'قرص', 'قرص طرية', 'قرص بالعجوة'], englishTerms: ['egyptian bakery bread'] },
  { terms: ['رز بلبن', 'أرز باللبن', 'مهلبية', 'عاشوراء'], englishTerms: ['egyptian rice pudding'] },
  { terms: ['عدس', 'شوربة عدس'], englishTerms: ['egyptian lentil soup', 'lentils'] },
  { terms: ['بامية', 'بامية باللحمة'], englishTerms: ['egyptian okra stew', 'okra'] },
  { terms: ['بسلة', 'بسلة بالجزر'], englishTerms: ['egyptian peas and carrots stew', 'peas'] },
  { terms: ['طاجن', 'طاجن بطاطس', 'طاجن لحمة'], englishTerms: ['egyptian casserole', 'tagine'] },
  { terms: ['شوربة لسان عصفور', 'لسان عصفور', 'شوربه لسان عصفور'], englishTerms: ['orzo soup'] },
  { terms: ['بصارة', 'بصاره'], englishTerms: ['egyptian bessara'] },
  { terms: ['زلابية', 'لقمة القاضي', 'لقيمات'], englishTerms: ['zalabia'] },
  { terms: ['بسبوسة', 'بسبوسه', 'هريسة'], englishTerms: ['basbousa'] },
  { terms: ['فول مدمس', 'فول', 'فول بلدي'], englishTerms: ['egyptian ful medames', 'beans'] },
  { terms: ['رز معمر', 'أرز معمر'], englishTerms: ['egyptian baked rice'] },
  { terms: ['مسقعة مصرية', 'مسقعة باللحمة', 'مسقعة'], englishTerms: ['egyptian moussaka', 'moussaka'] },
  { terms: ['فتة مصرية', 'فتة باللحمة', 'فتة', 'فته'], englishTerms: ['egyptian fatta meat rice'] },
  { terms: ['سمبوسك', 'سمبوسة', 'سمبوسه'], englishTerms: ['samosa'] },
  { terms: ['كبسة', 'كبسه', 'كبسة دجاج', 'كبسة فراخ'], englishTerms: ['kabsa'] },
  { terms: ['مقلوبة', 'مقلوبه'], englishTerms: ['maqluba'] },
  { terms: ['شاورما'], englishTerms: ['shawarma', 'chicken'] },
  { terms: ['كشري', 'كشرى', 'كشري مصري'], englishTerms: ['egyptian koshari'] },
  { terms: ['ملوخية', 'ملوخيه'], englishTerms: ['egyptian molokhia'] },
  { terms: ['محشي', 'محشى', 'محشي مشكل', 'كرنب', 'ورق عنب', 'كوسة محشية', 'باذنجان محشي'], englishTerms: ['egyptian mahshi stuffed vegetables'] },
  { terms: ['حمام محشي', 'حمام بالفريك', 'حمام صعيدي'], englishTerms: ['egyptian stuffed pigeon freekeh'] },
  { terms: ['مكرونة بشاميل', 'بشاميل', 'مكرونه بالبشاميل'], englishTerms: ['egyptian macaroni bechamel'] },
  { terms: ['رقاق', 'رقاق باللحمة', 'صينية رقاق'], englishTerms: ['egyptian roqaq meat pie'] },
  { terms: ['ام علي', 'أم علي', 'طاجن ام علي'], englishTerms: ['egyptian om ali dessert'] },
  { terms: ['طعمية', 'طعميه', 'فلافل'], englishTerms: ['egyptian taameya falafel', 'falafel'] },
];
 
const LOCAL_RECIPES: Array<{ terms: string[]; recipe: OnlineRecipe }> = [
  // Egyptian Seafood & Shrimp Dishes
  {
    terms: ['جمبري', 'روبيان', 'قريدس', 'جمبري اسكندراني', 'shrimp', 'prawns'],
    recipe: {
      title: 'جمبري إسكندراني بالثوم والفلفل والليمون',
      servings: 4,
      pageId: 900101,
      cuisine: 'egyptian',
      url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): 500 جم جمبري مقشر ومنظف، 6 فصوص ثوم مفروم، 2 حبة فلفل رومي وألوان، فلفل حار حسب الرغبة، عصير 2 ليمونة، ملعقة صغيرة كمون، ملعقة صغيرة كزبرة ناشفة، ملح وفلفل أسود، 3 ملاعق كبيرة زيت.\n\nالطريقة: اغسل الجمبري بالماء والليمون وصفّه جيداً. سخّن الزيت في طاسة واسعة على نار عالية ثم أضف نصف كمية الثوم وقلّب سريعاً. أضف الجمبري وتبّله بالكمون والكزبرة والملح والفلفل وقلّبه 3 دقائق حتى يتغير لونه للبرتقالي. أضف الفلفل الرومي والحار وباقي الثوم وعصير الليمون وقلّب دقيقتين فقط وقدّمه ساخناً مع العيش البلدي أو الأرز الصيادية.',
    },
  },
  {
    terms: ['جمبري', 'طاجن جمبري', 'جمبري بالفرن', 'طاجن', 'shrimp', 'prawns'],
    recipe: {
      title: 'طاجن جمبري بالفرن بالصلصة والبطاطس',
      servings: 4,
      pageId: 900102,
      cuisine: 'egyptian',
      url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): 500 جم جمبري منظف، 3 حبات طماطم معصورة، 2 بصلة شرائح، 2 حبة بطاطس حلقات رفيعة، 2 حبة فلفل رومي، 4 فصوص ثوم، نصف حزمة شبت وكرفس، ملعقة صغيرة كمون، ملح وفلفل وزيت.\n\nالطريقة: شوّح البصل والثوم والفلفل في الزيت ثم أضف عصير الطماطم والكمون والملح واترك الصلصة تتسبك 10 دقائق. رص حلقات البطاطس في طاجن فخار واسكب فوقها نصف الصلصة وأدخلها فرن ساخن 15 دقيقة. أضف الجمبري المتبل بالثوم والليمون والشبت ومعه باقي الصلصة وأعد الطاجن للفرن 12 دقيقة حتى ينضج تماماً.',
    },
  },
  {
    terms: ['جمبري', 'ملوخية بالجمبري', 'ملوخية', 'shrimp', 'prawns', 'molokhia'],
    recipe: {
      title: 'ملوخية بالجمبري على الطريقة المصرية',
      servings: 4,
      pageId: 900103,
      cuisine: 'egyptian',
      url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): 400 جم جمبري مقشر، 500 جم ملوخية خضراء مفرومة، 3.5 كوب مرقة قشر جمبري أو سمك، 6 فصوص ثوم مفروم، ملعقة كبيرة كزبرة ناشفة، ملعقة كبيرة سمن أو زيت، ملح وكمون.\n\nالطريقة: اغلي قشر الجمبري مع بصلة وورق لورا وكمون 15 دقيقة ثم صفّ المرقة. سخّن المرقة وأضف الجمبري 3 دقائق ثم أضف الملوخية وقلّب على نار هادئة دون غليان قوي. حمّر الثوم والكزبرة في السمن ثم اسكب التقلية على الملوخية وقدّمها مع الأرز الأبيض.',
    },
  },
  {
    terms: ['جمبري', 'جمبري مقلي', 'جمبري بانيه', 'shrimp', 'prawns', 'fried shrimp'],
    recipe: {
      title: 'جمبري مقلي مقرمش على الطريقة المصرية',
      servings: 4,
      pageId: 900104,
      cuisine: 'egyptian',
      url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): 500 جم جمبري مقشر، 1.5 كوب دقيق، 3 ملاعق كبيرة نشا، 4 فصوص ثوم مهروس، عصير ليمونة، ملعقة صغيرة كمون، نصف ملعقة صغيرة كركم وبابريكا، ملح، وزيت للقلي.\n\nالطريقة: تبّل الجمبري بالثوم والليمون والكمون والملح والبابريكا واتركه 15 دقيقة. اخلط الدقيق والنشا والكمون والكركم ورشة ملح. اغطّ الجمبري بخليط الدقيق جيداً ثم اقله في زيت ساخن 2 إلى 3 دقائق حتى يصبح ذهبياً ومقرمشاً، وصفّه وقدّمه مع الطحينة.',
    },
  },
  {
    terms: ['جمبري', 'ارز صيادية', 'أرز صيادية', 'صيادية بالجمبري', 'صيادية', 'shrimp', 'prawns', 'rice'],
    recipe: {
      title: 'أرز صيادية بالجمبري والبصل المكرمل',
      servings: 4,
      pageId: 900105,
      cuisine: 'egyptian',
      url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): 400 جم جمبري منظف، 2 كوب أرز مصري، 2 بصلة كبيرة مفرومة، 3 ملاعق كبيرة زيت، ملعقة صغيرة كمون، رشة قرفة، ملح وماء ساخن.\n\nالطريقة: حمّر البصل في الزيت حتى يكتسب لوناً بنياً غامقاً دون احتراق. أضف كوبين ونصف ماء ساخن والكمون والقرفة والملح واتركه يغلي. شوّح الجمبري دقيقتين مع فص ثوم في طاسة جانبية. أضف الأرز إلى ماء البصل وعندما يتشرب وزّع الجمبري على الوجه وهدّئ النار 15 دقيقة حتى ينضج.',
    },
  },
  {
    terms: ['سبيط', 'كاليماري', 'حبار', 'squid', 'calamari'],
    recipe: {
      title: 'سبيط (كاليماري) مقلي مقرمش بالدقيق والكمون',
      servings: 4,
      pageId: 900106,
      cuisine: 'egyptian',
      url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): 500 جم سبيط أو كاليماري مقطع حلقات، 4 فصوص ثوم، عصير ليمونة، ملعقة صغيرة كمون، 1.5 كوب دقيق، ملعقتان كبيرتان نشا، ملح وزيت للقلي.\n\nالطريقة: تبّل حلقات السبيط بالثوم والليمون والكمون والملح 20 دقيقة. غلّف الحلقات بخليط الدقيق والنشا واقلها في زيت ساخن 2 إلى 3 دقائق فقط حتى تصبح ذهبية ومقرمشة دون أن تتيبس.',
    },
  },
  // Arab Seafood & Classic Dishes
  {
    terms: ['جمبري', 'كبسة جمبري', 'كبسة', 'shrimp', 'prawns', 'kabsa'],
    recipe: {
      title: 'كبسة جمبري خليجية بالبهارات واللومي',
      servings: 4,
      pageId: 900107,
      cuisine: 'arab',
      url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): 500 جم جمبري مقشر، 2 كوب أرز بسمتي منقوع، 2 حبة طماطم، ملعقة معجون طماطم، بصلة مفرومة، 3 فصوص ثوم، حبة لومي، ملعقة كبيرة بهارات كبسة، هيل وقرفة، ملح وزيت.\n\nالطريقة: شوّح البصل والثوم واللومي والبهارات الصحيحة في الزيت. أضف الطماطم والصلصة والجمبري وبهارات الكبسة وقلّب 3 دقائق ثم ارفع الجمبري جانباً. أضف 3 أكواب ماء ساخن والأرز واتركه على نار هادئة حتى ينضج، ثم أعد الجمبري على الوجه 5 دقائق وقدّمه.',
    },
  },
  {
    terms: ['جمبري', 'سمك', 'طاجن سمك', 'سمك وجمبري', 'طاجن مغربي', 'shrimp', 'prawns', 'fish', 'tagine'],
    recipe: {
      title: 'طاجن سمك وجمبري مغربي بالشرمولة',
      servings: 4,
      pageId: 900108,
      cuisine: 'arab',
      url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): 600 جم سمك فيليه وجمبري، حزمة كزبرة وبقدونس مفرومين، 5 فصوص ثوم، عصير ليمونة، حبتا طماطم، جزرة وفلفل ألوان شرائح، ملعقة كمون وبابريكا، 3 ملاعق زيت زيتون وملح.\n\nالطريقة: اخلط الكزبرة والبقدونس والثوم والكمون والبابريكا والليمون وزيت الزيتون لعمل تتبيلة الشرمولة. تبّل السمك والجمبري بنصف التتبيلة. رص الجزر والطماطم والفلفل في الطاجن مع باقي التتبيلة ونصف كوب ماء، ثم رتّب السمك والجمبري على الوجه وغطّ الطاجن 20 دقيقة حتى ينضج.',
    },
  },
  {
    terms: ['شاورما', 'شاورما فراخ', 'shawarma', 'chicken'],
    recipe: {
      title: 'شاورما فراخ سوري بالثومية في الطاسة',
      servings: 4,
      pageId: 900109,
      cuisine: 'arab',
      url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): 500 جم صدور أو أوراك فراخ شرائح، 3 ملاعق كبيرة زبادي، ملعقتان كبيرتان خل، عصير ليمونة، 3 فصوص ثوم، ملعقة كبيرة بهارات شاورما وبابريكا، عيش صاج أو شامي ومخلل خيار.\n\nالطريقة: تبّل الفراخ بالزبادي والخل والليمون والثوم والبهارات نصف ساعة. شوّح الفراخ في طاسة ساخنة حتى تتحمر وتنضج. افرد الثومية على الخبز وضع الفراخ والمخلل ولفّها وحمّصها على الجريل.',
    },
  },
  {
    terms: ['مقلوبة', 'مقلوبه', 'maqluba'],
    recipe: {
      title: 'مقلوبة خضار وفراخ شامية بالبهارات',
      servings: 4,
      pageId: 900110,
      cuisine: 'arab',
      url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): 500 جم قطع فراخ، 2 كوب أرز بسمتي أو مصري، باذنجان وبطاطس شرائح، حبة طماطم شرائح، ملعقة كبيرة بهارات مقلوبة وقرفة وكركم وهيل، ملح وزيت.\n\nالطريقة: اسلق الفراخ مع البصل والبهارات واحتفظ بالمرقة ثم حمّرها خفيفاً. اشوِ أو حمّر شرائح الباذنجان والبطاطس. رص الطماطم ثم الفراخ ثم الخضار ثم الأرز المتبل في الحلة، اسكب المرقة الساخنة واتركها على نار هادئة 25 دقيقة ثم اقلبها في طبق التقديم.',
    },
  },
  {
    terms: ['سمبوسك', 'سمبوسة', 'سمبوسه', 'samosa'],
    recipe: {
      title: 'سمبوسك مقرمش بحشوة اللحمة', servings: 4, pageId: 900010, cuisine: 'arab',
      url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): 2 كوب دقيق، نصف كوب ماء دافئ تقريبًا، ملعقة كبيرة زيت، نصف ملعقة صغيرة ملح. للحشوة: 250 جم لحم مفروم، بصلة صغيرة مفرومة، ملح وفلفل وبهارات، ملعقة زيت.\n\nطريقة التحضير: اخلط الدقيق والملح والزيت، ثم أضف الماء تدريجيًا واعجن حتى تتكون عجينة ناعمة. غطّ العجينة واتركها ترتاح 20 دقيقة. شوّح البصل في الزيت ثم أضف اللحم والبهارات وقلّب حتى ينضج تمامًا واترك الحشوة تبرد. افرد العجينة وقطّعها دوائر أو شرائط، ضع مقدارًا من الحشوة واغلقها جيدًا. اقْلِ السمبوسك في زيت متوسط السخونة حتى يصبح ذهبيًا ومقرمشًا، ثم صفّه وقدّمه.'
    },
  },
  {
    terms: ['كبسة', 'كبسه', 'kabsa'],
    recipe: {
      title: 'كبسة دجاج',
      servings: 4,
      pageId: 900001,
      cuisine: 'arab',
      url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): دجاجة مقطعة، 2 كوب أرز بسمتي، بصلة مفرومة، 2 حبة طماطم، ملعقة معجون طماطم، 2 فص ثوم، لومي، ورق غار، قرفة، حبهان، بهارات كبسة، ملح وفلفل وزيت.\n\nالطريقة: شوّح البصل في الزيت حتى يذبل، ثم أضف الثوم والطماطم ومعجون الطماطم والبهارات. أضف الدجاج والماء واتركه حتى ينضج. ارفع الدجاج وحمّره حسب الرغبة، ثم أضف الأرز المغسول إلى المرق واضبط كمية السائل واتركه على نار هادئة حتى ينضج. قدّم الأرز مع الدجاج.',
    },
  },
  {
    terms: ['كشري', 'koshari', 'koshary'],
    recipe: {
      title: 'كشري مصري',
      servings: 4,
      pageId: 900002,
      cuisine: 'egyptian',
      url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): كوب أرز، كوب عدس بجبة، كوب مكرونة صغيرة، نصف كوب شعرية، حمص مسلوق، بصلتان، عصير طماطم، ثوم، خل، كمون، ملح وزيت.\n\nالطريقة: اسلق العدس حتى يقارب النضج، ثم أضف الأرز والشعرية المحمرة والماء والملح حتى ينضجوا. اسلق المكرونة والحمص. حضّر صلصة الطماطم بالثوم والخل والكمون، وحمّر البصل شرائح حتى يصبح مقرمشًا. قدّم الأرز والعدس ثم المكرونة والحمص والصلصة والبصل.',
    },
  },
  {
    terms: ['محشي', 'محشى', 'محشي كرنب', 'محشي ملفوف', 'كرنب', 'ملفوف', 'ورق كرنب', 'ورق ملفوف', 'stuffed cabbage'],
    recipe: {
      title: 'محشي كرنب وخضار مصري',
      servings: 4,
      pageId: 900007,
      cuisine: 'egyptian',
      url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): كرنب متوسط، كوب ونصف أرز مصري مغسول، بصلة كبيرة مفرومة، 2 كوب عصير طماطم، ملعقة صلصة، حزمة شبت وبقدونس وكزبرة خضراء، 3 فصوص ثوم، ملح وفلفل وكمون وكسبرة ناشفة ونعناع ناشف، ملعقتان زيت أو سمن، وشوربة أو ماء ساخن. ويمكن استخدام نفس الخلطة للكوسة والباذنجان والفلفل وورق العنب.\n\nالطريقة: اسلق أوراق الكرنب في ماء مغلي حتى تلين ثم قطّعها قطعًا مناسبة. اخلط الأرز مع البصل والخضرة والثوم وعصير الطماطم والصلصة والتوابل والزيت. احشِ الأوراق بكمية مناسبة من الخلطة ولفّها دون إحكام شديد حتى يتمدد الأرز. رصّ المحشي في حلة، وأضف شوربة ساخنة حتى تقترب من تغطيته. اتركه يغلي ثم هدّئ النار حتى ينضج الأرز والكرنب. لا تملأ الورق أكثر من اللازم.'
    },
  },
  {
    terms: ['ورق عنب', 'محشي ورق عنب', 'دوالي', 'grape leaves'],
    recipe: {
      title: 'ورق عنب محشي',
      servings: 4,
      pageId: 900008,
      cuisine: 'egyptian',
      url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): نصف كيلو ورق عنب، كوب أرز مصري مغسول، بصلة مفرومة، 2 كوب عصير طماطم، شبت وبقدونس وكزبرة خضراء، عصير ليمونة، زيت، ملح وفلفل وكمون ونعناع ناشف.\n\nالطريقة: اسلق ورق العنب سريعًا حتى يلين. اخلط الأرز مع البصل والخضرة والطماطم والتوابل والزيت. ضع مقدارًا صغيرًا من الحشوة على كل ورقة واطوِ الجانبين ثم لفها. رصّ اللفائف في حلة، أضف شوربة أو ماءً ساخنًا وعصير الليمون، واتركها على نار هادئة حتى ينضج الأرز.'
    },
  },
  {
    terms: ['كوسة محشية', 'كوسه محشيه', 'باذنجان محشي', 'فلفل محشي', 'محشي كوسة', 'محشي باذنجان', 'stuffed zucchini'],
    recipe: {
      title: 'محشي كوسة وباذنجان وفلفل',
      servings: 4,
      pageId: 900009,
      cuisine: 'egyptian',
      url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): كيلو كوسة وباذنجان وفلفل مناسب للحشو، كوب ونصف أرز مصري، بصلة مفرومة، 2 كوب عصير طماطم، شبت وبقدونس وكزبرة خضراء، ثوم، ملح وفلفل وكمون وكسبرة ناشفة، زيت أو سمن، وشوربة ساخنة.\n\nالطريقة: اغسل الخضار وفرّغ الكوسة والباذنجان برفق مع ترك جدار مناسب، وجهّز الفلفل بإزالة البذور. اخلط الأرز مع البصل والخضرة والطماطم والثوم والتوابل والزيت. احشِ الخضار حتى ثلثيه فقط، ثم رصّه في حلة وأضف الشوربة الساخنة. اتركه يغلي ثم هدّئ النار حتى ينضج الأرز والخضار.'
    },
  },
  {
    terms: ['ملوخية', 'molokhia'],
    recipe: {
      title: 'ملوخية مصرية',
      servings: 4,
      pageId: 900003,
      cuisine: 'egyptian',
      url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): نصف كيلو ملوخية مفرومة، 4 أكواب شوربة دجاج أو لحم، 5 فصوص ثوم، ملعقة كزبرة ناشفة، ملعقة سمن، ملح.\n\nالطريقة: سخّن الشوربة حتى الغليان ثم أضف الملوخية وقلّب على نار هادئة دون تركها تغلي بقوة. حمّر الثوم والكزبرة في السمن حتى تظهر الرائحة، ثم أضف التقلية إلى الملوخية وقلّب وقدّمها ساخنة.',
    },
  },
  {
    terms: ['شكشوكة', 'shakshuka'],
    recipe: {
      title: 'شكشوكة بالبيض',
      servings: 2,
      pageId: 900004,
      cuisine: 'egyptian',
      url: 'https://www.themealdb.com/',
      extract: 'المكونات (2 أفراد): 4 بيضات، 2 طماطم، فلفلة، بصلة صغيرة، فص ثوم، ملح، فلفل، كمون وملعقة زيت.\n\nالطريقة: شوّح البصل والفلفل في الزيت، ثم أضف الثوم والطماطم والتوابل واترك الخليط حتى يتسبك. اصنع فراغات صغيرة واكسر البيض فيها، غطِّ المقلاة حتى ينضج البيض حسب الرغبة.',
    },
  },
  {
    terms: ['طعمية', 'فلافل', 'falafel'],
    recipe: {
      title: 'طعمية مصرية',
      servings: 4,
      pageId: 900005,
      cuisine: 'egyptian',
      url: 'https://www.themealdb.com/',
      extract: 'المكونات: 500 جم فول مدشوش منقوع، بصلة، حزمة بقدونس، حزمة كزبرة خضراء، شبت، 4 فصوص ثوم، كمون، كزبرة ناشفة، ملح وسمسم.\n\nالطريقة: صفِّ الفول وافرمه مع البصل والخضرة والثوم. أضف التوابل واخلط حتى تتماسك العجينة. شكّل أقراصًا، زيّن بالسمسم واقلِ في زيت ساخن حتى تصبح ذهبية. تُطهى جيدًا من الداخل.',
    },
  },
  {
    terms: ['مكرونة بشاميل', 'بشاميل', 'macaroni bechamel'],
    recipe: {
      title: 'مكرونة بالبشاميل',
      servings: 4,
      pageId: 900006,
      cuisine: 'egyptian',
      url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): نصف كيلو مكرونة قلم، 300 جم لحم مفروم، بصلة، 3 ملاعق دقيق، 3 ملاعق زبدة، 3 أكواب حليب، ملح وفلفل وجوزة الطيب.\n\nالطريقة: اسلق المكرونة نصف سلقة. شوّح البصل واللحم وتبّله. حضّر البشاميل بتحمير الدقيق في الزبدة ثم أضف الحليب تدريجيًا مع التقليب. ضع طبقة بشاميل ثم المكرونة واللحم وباقي البشاميل، واخبز حتى يحمر الوجه.',
    },
  },
  {
    terms: ['شوربة لسان عصفور', 'لسان عصفور', 'orzo soup'],
    recipe: { title: 'شوربة لسان عصفور مصرية', servings: 4, pageId: 900011, cuisine: 'egyptian', url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): كوب لسان عصفور، ملعقة سمن أو زيت، 5 أكواب شوربة دجاج أو لحم، ملح وفلفل، ورشة حبهان حسب الرغبة.\n\nطريقة التحضير: سخّن السمن في حلة على نار متوسطة. أضف لسان العصفور وقلّبه حتى يصبح ذهبي اللون. أضف الشوربة الساخنة تدريجيًا مع التقليب. اتركه على نار هادئة من 10 إلى 15 دقيقة حتى ينضج. اضبط الملح والفلفل وقدّمه ساخنًا.' }
  },
  {
    terms: ['بصارة', 'بصاره', 'egyptian bessara'],
    recipe: { title: 'بصارة مصرية', servings: 4, pageId: 900012, cuisine: 'egyptian', url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): 2 كوب فول مدشوش منقوع، بصلة، 4 فصوص ثوم، حزمة كزبرة خضراء، شبت، ملح وكمون، ملعقة كزبرة ناشفة، وبصل للتقلية.\n\nطريقة التحضير: صفّي الفول المدشوش وضعه في حلة مع البصل والثوم والماء. اتركه حتى ينضج تمامًا. أضف الكزبرة والشبت والكمون والملح، ثم اخلط المكونات بالخلاط حتى يصبح القوام ناعمًا. حمّر شرائح البصل في قليل من الزيت حتى تصبح ذهبية. قدّم البصارة ساخنة مع البصل المحمّر.' }
  },
  {
    terms: ['زلابية', 'لقمة القاضي', 'zalabia'],
    recipe: { title: 'زلابية مصرية', servings: 4, pageId: 900013, cuisine: 'egyptian', url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): 2 كوب دقيق، ملعقة صغيرة خميرة فورية، ملعقة صغيرة سكر، رشة ملح، نحو كوب ونصف ماء دافئ، وزيت للقلي. للشربات: كوب سكر ونصف كوب ماء وعصرة ليمون.\n\nطريقة التحضير: اخلط الدقيق والخميرة والسكر والملح. أضف الماء تدريجيًا حتى تحصل على عجينة لينة. غطّها واتركها تختمر حتى يتضاعف حجمها. حضّر الشربات بغلي السكر والماء ثم أضف الليمون واتركه يبرد. شكّل كرات صغيرة بملعقة مبللة واقلها في زيت متوسط الحرارة حتى تصبح ذهبية. صفّها ثم ضعها في الشربات البارد.' }
  },
  {
    terms: ['بسبوسة', 'بسبوسه', 'basbousa'],
    recipe: { title: 'بسبوسة مصرية', servings: 8, pageId: 900014, cuisine: 'egyptian', url: 'https://www.themealdb.com/',
      extract: 'المكونات (8 أفراد): 2 كوب سميد، نصف كوب سكر، نصف كوب سمن مذاب، كوب زبادي، ملعقة صغيرة بيكنج بودر، لوز للتزيين. للشربات: كوب ونصف سكر، كوب ماء، عصرة ليمون.\n\nطريقة التحضير: اخلط السميد والسكر والبيكنج بودر. أضف السمن وافركه برفق، ثم أضف الزبادي وقلّب دون عجن زائد. افرد الخليط في صينية مدهونة وقطّعه وزيّنه باللوز. اخبزه في فرن متوسط الحرارة حتى يحمر الوجه. اسقِ البسبوسة بالشربات الساخن فور خروجها من الفرن واتركها تبرد.' }
  },
  {
    terms: ['فايش', 'عيش فايش', 'فايش صعيدي', 'egyptian faysh bread'],
    recipe: { title: 'فايش صعيدي', servings: 8, pageId: 900020, cuisine: 'egyptian', url: 'https://www.themealdb.com/',
      extract: 'المكونات (8 أفراد): كيلو دقيق، كوب حليب دافئ، نصف كوب سمن أو زبدة، ملعقتان كبيرتان سكر، ملعقة كبيرة خميرة فورية، ملعقة صغيرة محلب، نصف ملعقة صغيرة كركم اختياري، ورشة ملح، وماء دافئ حسب الحاجة.\n\nطريقة التحضير: ذوّب الخميرة والسكر في الحليب الدافئ واتركهما دقائق حتى تنشط الخميرة. اخلط الدقيق والملح والمحلب والكركم. أضف السمن وخليط الخميرة واعجن مع إضافة الماء تدريجيًا حتى تتكون عجينة متماسكة وطرية. غطّ العجين واتركه يختمر حتى يتضاعف. شكّل العجين أصابع أو أرغفة طويلة واتركها ترتاح. اخبزها في فرن متوسط الحرارة حتى تنضج ويصبح لونها ذهبيًا فاتحًا. اتركها تبرد تمامًا ثم قطّعها شرائح طولية وأعد الشرائح إلى فرن هادئ حتى تجف وتقرمش. اترك الفايش يبرد واحفظه في علبة محكمة.' }
  },
  {
    terms: ['شابورة', 'شابوره', 'عيش شابورة', 'بقسماط', 'egyptian shaboura rusk'],
    recipe: { title: 'شابورة مصرية مقرمشة', servings: 8, pageId: 900021, cuisine: 'egyptian', url: 'https://www.themealdb.com/',
      extract: 'المكونات (8 أفراد): 4 أكواب دقيق، نصف كوب سكر، نصف كوب زيت أو زبدة، 2 بيضة، نصف كوب حليب دافئ تقريبًا، ملعقة كبيرة خميرة فورية، ملعقة صغيرة يانسون أو شمر، رشة ملح، وملعقة صغيرة فانيليا.\n\nطريقة التحضير: اخلط الخميرة مع الحليب الدافئ وملعقة من السكر واتركها حتى تنشط. اخفق البيض مع باقي السكر والزيت والفانيليا. أضف الدقيق واليانسون والملح ثم خليط الخميرة واعجن حتى تحصل على عجينة لينة متماسكة. غطّ العجين واتركه يختمر حتى يتضاعف. شكّل أصابع متساوية ورصّها في صينية واتركها ترتاح. اخبزها في فرن متوسط حتى تتماسك ويصبح لونها ذهبيًا خفيفًا. اتركها تبرد ثم قطّعها شرائح، ورصّ الشرائح مرة أخرى في الصينية وحمّصها في فرن هادئ حتى تجف وتصبح مقرمشة من الجانبين.' }
  },
  {
    terms: ['فطير مشلتت', 'فطير', 'فطير فلاحي', 'egyptian feteer meshaltet'],
    recipe: { title: 'فطير مشلتت فلاحي', servings: 6, pageId: 900022, cuisine: 'egyptian', url: 'https://www.themealdb.com/',
      extract: 'المكونات (6 أفراد): كيلو دقيق، نحو كوبين ماء دافئ حسب الحاجة، ملعقة صغيرة ملح، وسمن بلدي أو زبدة مذابة للفرد.\n\nطريقة التحضير: اخلط الدقيق والملح وأضف الماء تدريجيًا واعجن جيدًا حتى تصبح العجينة ناعمة ومرنة. قسّمها كرات وادهنها بالزيت واتركها ترتاح نصف ساعة على الأقل. افرد كل كرة على سطح مدهون حتى تصبح رقيقة جدًا وشفافة. ادهنها بالسمن واطوِ الأطراف للداخل مع إضافة السمن بين الطبقات. كرر الفرد والطي للحصول على طبقات متعددة. ضع الفطيرة في صينية مدهونة وافردها برفق. اخبزها في فرن ساخن حتى تنتفخ وتحمر. قدّمها ساخنة مع العسل أو الجبن.' }
  },
  {
    terms: ['حواوشي', 'حواوشى', 'عيش باللحمة', 'egyptian hawawshi'],
    recipe: { title: 'حواوشي إسكندراني', servings: 4, pageId: 900023, cuisine: 'egyptian', url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): 500 جرام لحم مفروم، 4 أرغفة خبز بلدي، بصلة كبيرة مفرومة ناعمًا، فلفل أخضر، فلفل حار حسب الرغبة، ملح وفلفل أسود وبهارات، ورشة قرفة، وملعقة زيت.\n\nطريقة التحضير: اخلط اللحم مع البصل والفلفل والتوابل والزيت جيدًا. افتح كل رغيف من الجانب ووزع الحشوة بطبقة رقيقة ومتساوية. ادهن الخبز بقليل من الزيت. ضع الأرغفة في فرن ساخن على درجة متوسطة مع تقليبها حتى ينضج اللحم تمامًا ويتحمص الخبز من الجانبين. يمكن تسويته في طاسة ثقيلة مغطاة على نار هادئة مع التقليب. تأكد من تمام نضج اللحم قبل التقديم.' }
  },
  {
    terms: ['كبدة اسكندراني', 'كبدة إسكندراني', 'كبدة', 'alexandrian liver'],
    recipe: { title: 'كبدة إسكندراني', servings: 4, pageId: 900024, cuisine: 'egyptian', url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): نصف كيلو كبدة شرائح، 5 فصوص ثوم مفروم، فلفل أخضر وأحمر، فلفل حار حسب الرغبة، عصير ليمونة، كمون وكزبرة ناشفة وملح وفلفل، وملعقتان زيت.\n\nطريقة التحضير: سخّن الزيت في طاسة واسعة على نار عالية. أضف الثوم وقلّبه سريعًا دون أن يحترق. أضف شرائح الكبدة وقلّبها حتى يتغير لونها. أضف الفلفل والتوابل واستمر في التقليب حتى تنضج الكبدة تمامًا. أضف عصير الليمون في النهاية وقدّمها ساخنة مع الخبز البلدي.' }
  },
  {
    terms: ['كحك', 'كحك العيد', 'egyptian kahk'],
    recipe: { title: 'كحك العيد المصري', servings: 10, pageId: 900025, cuisine: 'egyptian', url: 'https://www.themealdb.com/',
      extract: 'المكونات (10 أفراد): كيلو دقيق، نصف كيلو سمن، ملعقة كبيرة سمسم، ملعقة صغيرة رائحة كحك، ملعقة صغيرة خميرة، رشة ملح، ونحو كوب ماء أو حليب دافئ. للحشو اختياريًا: ملبن أو عجوة أو مكسرات.\n\nطريقة التحضير: سخّن السمن حتى يصبح دافئًا وليس ساخنًا. اخلط الدقيق والسمسم ورائحة الكحك والخميرة والملح. أضف السمن وافركه مع الدقيق حتى يتشربه. أضف الماء أو الحليب تدريجيًا واعجن بخفة حتى تتماسك العجينة. شكّل كرات واحشها حسب الرغبة ثم انقشها. رص الكحك في صينية واخبزه في فرن متوسط حتى ينضج دون أن يغمق لونه كثيرًا. اتركه يبرد تمامًا ثم رش السكر البودرة.' }
  },
  {
    terms: ['غريبة', 'غريبه', 'egyptian ghorayeba cookies'],
    recipe: { title: 'غريبة مصرية', servings: 8, pageId: 900026, cuisine: 'egyptian', url: 'https://www.themealdb.com/',
      extract: 'المكونات (8 أفراد): 3 أكواب دقيق، كوب سمن بدرجة حرارة الغرفة، كوب سكر بودرة، ورشة فانيليا، وفستق أو لوز للتزيين.\n\nطريقة التحضير: اخفق السمن مع السكر البودرة حتى يصبح الخليط كريميًا وفاتح اللون. أضف الفانيليا ثم الدقيق تدريجيًا وقلّب حتى تتكون عجينة ناعمة. شكّل كرات صغيرة واضغط عليها برفق وضع حبة فستق في المنتصف. رص القطع في صينية واترك مسافات بسيطة. اخبزها في فرن هادئ حتى تتماسك مع الحفاظ على لونها الفاتح. اتركها تبرد قبل نقلها.' }
  },
  {
    terms: ['بيتي فور', 'بيتى فور', 'بتيفور', 'petit four cookies'],
    recipe: { title: 'بيتي فور مصري', servings: 8, pageId: 900027, cuisine: 'egyptian', url: 'https://www.themealdb.com/',
      extract: 'المكونات (8 أفراد): 3 أكواب دقيق، كوب زبدة طرية، ثلاثة أرباع كوب سكر بودرة، بيضتان، ملعقة صغيرة فانيليا، وملعقة صغيرة بيكنج بودر. للتزيين: مربى وشوكولاتة وجوز هند.\n\nطريقة التحضير: اخفق الزبدة مع السكر حتى يصبح الخليط هشًا. أضف البيض والفانيليا واخلط جيدًا. أضف الدقيق والبيكنج بودر تدريجيًا حتى تتكون عجينة طرية قابلة للتشكيل. ضع العجينة في كيس حلواني وشكّل وحدات صغيرة في صينية. اخبزها في فرن متوسط الحرارة حتى تنضج دون أن يتغير لونها كثيرًا. اتركها تبرد ثم الصق كل قطعتين بالمربى وزيّنها بالشوكولاتة أو جوز الهند.' }
  },
  {
    terms: ['كنافة', 'كنافه', 'kunafa'],
    recipe: { title: 'كنافة مصرية بالقشطة', servings: 8, pageId: 900028, cuisine: 'egyptian', url: 'https://www.themealdb.com/',
      extract: 'المكونات (8 أفراد): نصف كيلو كنافة، كوب سمن مذاب، كوبان حليب، ملعقتان نشا، ملعقتان سكر، فانيليا. للشربات: كوبان سكر، كوب ماء، عصرة ليمون.\n\nطريقة التحضير: فتّت الكنافة وقلّبها مع السمن. حضّر القشطة بتذويب النشا في قليل من الحليب ثم أضف باقي الحليب والسكر وقلّب على النار حتى يثخن القوام ثم أضف الفانيليا. افرد نصف الكنافة في صينية واضغطها، وزع القشطة مع ترك الحواف، ثم غطها بباقي الكنافة. اخبزها حتى تصبح ذهبية. اسقها بالشربات الدافئ بعد خروجها واتركها تهدأ قبل التقطيع.' }
  },
  {
    terms: ['كفتة', 'كفته', 'كفتة مشوية'],
    recipe: {
      title: 'كفتة مشوية مصرية في الطاسة أو الفرن',
      servings: 4,
      pageId: 900111,
      cuisine: 'egyptian',
      url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): 500 جم لحم مفروم بنسبة دهن بسيطة، بصلة كبيرة مبشورة ومصفاة، 3 ملاعق بقدونس مفروم، ملعقة صغيرة بهارات لحمة، ملح وفلفل أسود.\n\nالطريقة: اعجن اللحم مع البصل المصفى والبقدونس والتوابل جيداً 5 دقائق حتى يتماسك. صبّع الكفتة على أسياخ أو أعواد خشبية وادهنها بماء البصل. اشوها في فرن ساخن أو طاسة جريل مع التقليب حتى تنضج وتتحمر، وقدمها مع الطحينة والعيش البلدي.',
    },
  },
  {
    terms: ['بامية', 'بامية باللحمة', 'طاجن بامية'],
    recipe: {
      title: 'طاجن بامية باللحمة والصلصة المصرية',
      servings: 4,
      pageId: 900112,
      cuisine: 'egyptian',
      url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): 500 جم بامية مقمعة، 400 جم لحم مكعبات، 2.5 كوب عصير طماطم، بصلة مفرومة، 4 فصوص ثوم، ملعقة كزبرة ناشفة، ملعقة سمن، ملح وفلفل.\n\nالطريقة: شوّح البصل واللحم في السمن ثم أضف ماء مغلي واتركه يقترب من النضج. أضف عصير الطماطم والبامية والملح والفلفل واتركها تتسبك. حضّر طشة الثوم والكزبرة وأضفها للطاجن، ثم أدخله الفرن 15 دقيقة.',
    },
  },
  {
    terms: ['رز معمر', 'أرز معمر', 'ارز معمر'],
    recipe: {
      title: 'أرز معمر فلاحي بالسمن والقشطة',
      servings: 4,
      pageId: 900113,
      cuisine: 'egyptian',
      url: 'https://www.themealdb.com/',
      extract: 'المكونات (4 أفراد): 2 كوب أرز مصري مغسول ومنقوع، 3 أكواب لبن ساخن، نصف كوب قشطة بلدي، ملعقتان كبيرتان سمن بلدي، ملح.\n\nالطريقة: اخلط الأرز المصفى مع السمن والملح في طاجن فخار مدهون. اسكب اللبن الساخن ووزّع القشطة على الوجه. أدخل الطاجن فرن ساخن على الشواية قليلاً حتى يحمر الوجه ثم هدّئ الفرن حتى يتشرب الأرز اللبن وينضج تماماً.',
    },
  },
];

function readSaved(): OnlineRecipe[] {
  try {
    const value = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    return Array.isArray(value)
      ? value.filter(item => item && typeof item.title === 'string').map(item => ({
          ...item,
          cuisine: item.cuisine || detectMealDbCuisineTier(undefined, item.title),
        }))
      : [];
  } catch {
    return [];
  }
}

function scaleArabicRecipeExtract(extract: string, baseServings: number, familySize: number): string {
  const ratio = Math.max(1, Math.min(30, Math.round(familySize))) / Math.max(1, baseServings);
  const splitAt = extract.indexOf('الطريقة:');
  const ingredients = splitAt >= 0 ? extract.slice(0, splitAt) : extract;
  const method = splitAt >= 0 ? extract.slice(splitAt) : '';
  const scaledIngredients = ingredients.replace(/\d+\/\d+|\d+(?:\.\d+)?(?:\s+\d+\/\d+)?/g, value => {
    const amount = value.trim().split(/\s+/).reduce((total, part) => {
      if (!part.includes('/')) return total + Number(part);
      const [numerator, denominator] = part.split('/').map(Number);
      return total + (denominator ? numerator / denominator : 0);
    }, 0);
    return String(Math.round(amount * ratio * 100) / 100);
  });
  return `${scaledIngredients}${method}`;
}

function hasArabic(value: string): boolean {
  const arabicLetters = (value.match(/[\u0600-\u06FF]/g) || []).length;
  const latinLetters = (value.match(/[A-Za-z]/g) || []).length;
  return arabicLetters > 0 && latinLetters <= Math.max(4, Math.floor(arabicLetters * 0.2));
}

function normalizeRecipeLineBreaks(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    // Some providers return the two characters "\n" instead of real line breaks.
    .replace(/\\r\\n|\\n|\\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trim();
}

function stripRecipeListPrefix(value: string): string {
  let cleaned = value.trim();
  // Strip repeated list markers (e.g. "1. 1. Step") so the UI owns numbering.
  for (let pass = 0; pass < 3; pass += 1) {
    const next = cleaned
      .replace(/^\s*[٠-٩\d]+\s*[.)、:-]\s*/, '')
      .replace(/^\s*[•*▪◦-]\s*/, '')
      .trim();
    if (next === cleaned) break;
    cleaned = next;
  }
  return cleaned;
}

function parseRecipeSections(extract: string, familySize: number, baseServings: number): { ingredients: string[]; steps: string[] } {
  const normalized = normalizeRecipeLineBreaks(extract);
  const separator = normalized.match(/(?:طريقة التحضير|الطريقة)(?:\s+خطوة بخطوة)?\s*[:：]?/);
  const splitIndex = separator?.index ?? -1;
  const ingredientsText = splitIndex >= 0 ? normalized.slice(0, splitIndex) : '';
  const methodText = splitIndex >= 0 ? normalized.slice(splitIndex + separator![0].length) : normalized;
  const ingredients = scaleArabicRecipeExtract(ingredientsText, baseServings, familySize)
    .replace(/^\s*المقادير محسوبة[^\n]*\n?/gm, '')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/^\s*المكونات(?:\s+المطلوبة)?(?:\s*\([^)]*\))?\s*[:：]?/,'')
    .split(/[\n،,؛]+/)
    .map(item => stripRecipeListPrefix(item))
    .filter(item => item.length > 1);
  const steps = methodText
    .replace(/^\s*#{1,6}\s*/gm, '')
    .split(/\n+|(?<=[.!؟])\s+/)
    .map(step => stripRecipeListPrefix(step))
    .filter(step => step.length > 2);
  return { ingredients, steps };
}

async function translateText(value: string, source: 'ar' | 'en', target: 'ar' | 'en'): Promise<string> {
  const text = value.trim();
  if (!text || source === target) return text;
  const sentences = text.match(/[^.!?。！？\n]+[.!?。！？\n]*/g) || [text];
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current.length + sentence.length > 1200 && current) {
      chunks.push(current);
      current = sentence;
    } else current += sentence;
  }
  if (current) chunks.push(current);

  const translated: string[] = [];
  for (const chunk of chunks) {
    try {
      const url = new URL('https://translate.googleapis.com/translate_a/single');
      url.search = new URLSearchParams({ client: 'gtx', sl: source, tl: target, dt: 't', q: chunk }).toString();
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('translation-failed');
      const data = await response.json();
      const output = Array.isArray(data?.[0])
        ? data[0].map((part: unknown[]) => typeof part?.[0] === 'string' ? part[0] : '').join('')
        : '';
      if (!output.trim()) throw new Error('empty-translation');
      if (target === 'ar' && !hasArabic(output)) throw new Error('arabic-translation-unavailable');
      translated.push(output);
    } catch (error) {
      if (target === 'ar') throw error;
      translated.push(chunk);
    }
  }
  return translated.join('');
}

function stripArabicPrepositionPrefix(word: string): string {
  const cleaned = normalize(word);
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.startsWith('بال') && cleaned.length > 4) return cleaned.slice(3);
  if (cleaned.startsWith('وال') && cleaned.length > 4) return cleaned.slice(3);
  if (cleaned.startsWith('كال') && cleaned.length > 4) return cleaned.slice(3);
  if (cleaned.startsWith('لل') && cleaned.length > 3) return cleaned.slice(2);
  if (cleaned.startsWith('ال') && cleaned.length > 3) return cleaned.slice(2);
  return cleaned;
}

function expandEnglishSynonyms(terms: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const add = (value: string) => {
    const clean = value.trim().toLowerCase();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      result.push(clean);
    }
  };
  for (const raw of terms) {
    add(raw);
    const words = raw.trim().toLowerCase().split(/\s+/);
    for (const word of words) {
      const synonyms = ENGLISH_SYNONYM_PAIRS[word];
      if (synonyms) {
        for (const syn of synonyms) add(syn);
      }
    }
  }
  return result;
}

export function expandArabicAliasesToEnglishTerms(term: string): string[] {
  const normalizedQuery = normalize(term);
  const words = normalizedQuery.split(' ').filter(Boolean).map(stripArabicPrepositionPrefix);
  const strippedQuery = words.join(' ');
  const collected: string[] = [];

  for (const alias of ARABIC_ALIASES) {
    const directHit = alias.terms.some(
      item => matchesArabicSearchAlias(term, item) || matchesArabicSearchAlias(strippedQuery, item)
    );
    const tokenHit = alias.terms.some(item => {
      const normalizedItem = normalize(item);
      if (!normalizedItem || normalizedItem.includes(' ')) return false;
      const itemBase = stripArabicPrepositionPrefix(normalizedItem);
      return words.some(w => !ARABIC_STOP_WORDS.has(w) && (w === normalizedItem || w === itemBase));
    });
    if (directHit || tokenHit) {
      collected.push(...alias.englishTerms);
    }
  }

  return expandEnglishSynonyms(collected);
}

export function detectMealDbCuisineTier(strArea?: string, title = ''): CuisineTier {
  const area = (strArea || '').trim().toLowerCase();
  const normalizedTitle = normalize(title);

  if (area === 'egyptian') return 'egyptian';
  if (
    /مصري|اسكندراني|إسكندراني|صعيدي|فلاحي|بورسعيدي|كشري|ملوخيه|طعميه|فول مدمس|حواوشي|فطير مشلتت|بصاره|بسبوسه|كنافه|ام علي|رقاق/.test(normalizedTitle) ||
    /\begyptian\b|\bkoshari\b|\bmolokhia\b|\bhawawshi\b|\bfeteer\b|\btaameya\b|\bful medames\b/.test(normalizedTitle)
  ) {
    return 'egyptian';
  }

  if (ARAB_AREAS.has(area)) return 'arab';
  if (
    /عربي|خليجي|شامي|سوري|لبناني|مغربي|تونسي|سعودي|يمني|عراقي|فلسطيني|اردني|كبسه|مقلوبه|شاورما|شرموله|طاجن/.test(normalizedTitle) ||
    /\bmoroccan\b|\blebanese\b|\bsyrian\b|\bsaudi\b|\btunisian\b|\bturkish\b|\bkabsa\b|\bshawarma\b|\bmaqluba\b|\btagine\b/.test(normalizedTitle)
  ) {
    return 'arab';
  }

  return 'international';
}

function getCoreRecipeKey(title: string): string {
  const norm = normalize(title)
    .replace(/(?:علي|على)\s+الطريق[هة]\s+\S+(?:\s+\S+)?/g, '')
    .replace(/بالطريق[هة]\s+\S+(?:\s+\S+)?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = norm.split(/\s+/).filter(Boolean);
  return tokens.slice(0, 3).join('_') || norm;
}

export function sortAndDedupeOnlineRecipes<T extends { title: string; cuisine?: CuisineTier }>(recipes: T[]): T[] {
  const sorted = [...recipes].sort((a, b) => {
    const rankA = CUISINE_PRIORITY[a.cuisine || 'international'];
    const rankB = CUISINE_PRIORITY[b.cuisine || 'international'];
    return rankA - rankB;
  });
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const recipe of sorted) {
    const exactKey = normalize(recipe.title);
    const coreKey = getCoreRecipeKey(recipe.title);
    if (!exactKey || seen.has(exactKey) || seen.has(coreKey)) continue;
    seen.add(exactKey);
    seen.add(coreKey);
    deduped.push(recipe);
  }
  return deduped;
}

async function getEnglishSearchTerms(term: string): Promise<string[]> {
  const aliasMatches = expandArabicAliasesToEnglishTerms(term);
  const terms: string[] = [...aliasMatches];

  if (hasArabic(term)) {
    try {
      const translated = await translateText(term, 'ar', 'en');
      if (translated.trim()) {
        terms.push(translated.trim());
        // Extract significant English content tokens if full phrase is multi-word
        const tokens = translated
          .toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(tok => tok.length > 2 && !['with', 'and', 'the', 'style', 'dish', 'recipe', 'fried', 'baked', 'grilled'].includes(tok));
        terms.push(...tokens);
      }
    } catch {
      // Keep alias-expanded terms even if translation endpoint throttles
    }
  } else {
    terms.push(term.trim());
    const tokens = term
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(tok => tok.length > 2);
    terms.push(...tokens);
  }

  return expandEnglishSynonyms(terms).slice(0, 5);
}

export function scaleMeasure(measure: string, familySize: number, baseServings = 4): string {
  const match = measure.match(/^\s*(\d+\/\d+|\d+(?:\.\d+)?(?:\s+\d+\/\d+)?)(.*)$/);
  if (!match) return measure;
  const amount = match[1].trim().split(/\s+/).reduce((total, part) => {
    if (!part.includes('/')) return total + Number(part);
    const [numerator, denominator] = part.split('/').map(Number);
    return total + (denominator ? numerator / denominator : 0);
  }, 0);
  if (!Number.isFinite(amount) || amount <= 0) return measure;
  return (Math.round(amount * Math.max(1, Math.min(30, Math.round(familySize))) / baseServings * 100) / 100).toString() + ' ' + match[2].trim();
}

function extractMealIngredientNames(meal: MealDbMeal): string {
  const parts: string[] = [];
  for (let index = 1; index <= 20; index += 1) {
    const ingredient = meal[`strIngredient${index}`]?.trim();
    if (ingredient) parts.push(ingredient);
  }
  return parts.join(' ');
}

async function mapMeal(meal: MealDbMeal, _familySize: number): Promise<OnlineRecipe> {
  const ingredients: string[] = [];
  for (let index = 1; index <= 20; index += 1) {
    const ingredient = meal[`strIngredient${index}`]?.trim();
    const measure = meal[`strMeasure${index}`]?.trim();
    if (ingredient) ingredients.push(`• ${ingredient}${measure ? ` — ${measure}` : ''}`);
  }
  const instructions = (meal.strInstructions || '').replace(/\r/g, '').trim();
  const rawExtract = `${ingredients.length ? `المكونات:\n${ingredients.join('\n')}\n\n` : ''}طريقة التحضير:\n${instructions || 'راجع صفحة المصدر للتعليمات.'}`;
  const [arabicTitle, arabicExtract] = await Promise.all([
    translateText(meal.strMeal, 'en', 'ar'),
    translateText(rawExtract, 'en', 'ar'),
  ]);
  if (!hasArabic(arabicTitle) || !hasArabic(arabicExtract)) throw new Error('تعذر تجهيز الوصفة باللغة العربية.');
  return {
    title: arabicTitle,
    servings: 4,
    pageId: Number(meal.idMeal),
    cuisine: detectMealDbCuisineTier(meal.strArea, meal.strMeal),
    url: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`,
    imageUrl: meal.strMealThumb,
    imageCredit: 'TheMealDB',
    imageLicense: 'راجع مصدر الوصفة الأصلي وشروط استخدام الصورة',
    extract: arabicExtract || rawExtract,
  };
}

function localSeedRecipeToOnline(recipe: Recipe, familySize: number): OnlineRecipe {
  const scaledIngredients = recipe.ingredients.map(item => {
    const ratio = Math.max(1, Math.min(30, Math.round(familySize))) / Math.max(1, recipe.baseServings);
    const quantity = item.baseAmount > 0
      ? `${Math.round(item.baseAmount * ratio * 100) / 100} ${item.unit}`
      : item.quantity;
    return `• ${item.name} — ${quantity}`;
  });
  return {
    title: recipe.name,
    servings: recipe.baseServings,
    pageId: 910000 + Math.abs(recipe.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)),
    cuisine: recipe.cuisine || detectMealDbCuisineTier(undefined, `${recipe.name} ${recipe.tags.join(' ')}`),
    url: 'https://www.themealdb.com/',
    imageUrl: recipe.imageUrl || undefined,
    imageCredit: recipe.imageUrl ? 'صورة الوصفة المحفوظة في تدبيرة' : undefined,
    extract: `المكونات (المقادير الأساسية لـ ${recipe.baseServings} أفراد):\n${scaledIngredients.join('\n')}\n\nطريقة التحضير:\n${recipe.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`,
  };
}

function findBundledEgyptianRecipes(term: string): OnlineRecipe[] {
  const normalized = normalize(term);
  const queryWords = normalized
    .split(' ')
    .filter(Boolean)
    .map(stripArabicPrepositionPrefix)
    .filter(word => word.length > 2 && !ARABIC_STOP_WORDS.has(word));
  const strippedNormalized = queryWords.join(' ');

  return RECIPES.filter(recipe => {
    const haystack = [recipe.name, ...recipe.tags, ...recipe.ingredients.map(item => item.name)]
      .map(normalize)
      .join(' ');
    if (haystack.includes(normalized) || (strippedNormalized && haystack.includes(strippedNormalized))) {
      return true;
    }
    return queryWords.some(word => haystack.includes(word));
  }).slice(0, 14).map(recipe => localSeedRecipeToOnline(recipe, 4));
}

function findCuratedLocalMatches(term: string, bundledMatches: OnlineRecipe[]): OnlineRecipe[] {
  const normalized = normalize(term);
  const queryWords = normalized
    .split(' ')
    .filter(Boolean)
    .map(stripArabicPrepositionPrefix)
    .filter(word => word.length > 2 && !ARABIC_STOP_WORDS.has(word));
  const strippedQuery = queryWords.join(' ');

  return LOCAL_RECIPES.filter(item => {
    if (item.terms.some(alias => matchesArabicSearchAlias(term, alias) || matchesArabicSearchAlias(strippedQuery, alias))) {
      return true;
    }
    return queryWords.some(word =>
      item.terms.some(alias => {
        const aliasBase = stripArabicPrepositionPrefix(normalize(alias));
        return aliasBase === word;
      })
    );
  }).map(item => {
    const bundledPhoto = bundledMatches.find(recipe =>
      normalize(recipe.title) === normalize(item.recipe.title)
    )?.imageUrl;
    return {
      ...item.recipe,
      cuisine: item.recipe.cuisine || detectMealDbCuisineTier(undefined, item.recipe.title),
      imageUrl: item.recipe.imageUrl || bundledPhoto,
    };
  });
}

export function OnlineRecipeSearch({ familySize = 4, onBack }: { familySize?: number; onBack?: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OnlineRecipe[]>([]);
  const [selected, setSelected] = useState<OnlineRecipe | null>(null);
  const [saved, setSaved] = useState<OnlineRecipe[]>(readSaved);
  const [showSaved, setShowSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Record<number, boolean>>({});
  const recognitionRef = useRef<any>(null);
  const voiceListenersRef = useRef<Array<{ remove(): Promise<void> }>>([]);
  const speechPlayerRef = useRef<EgyptianRecipeSpeechPlayer | null>(null);

  if (!speechPlayerRef.current) {
    speechPlayerRef.current = new EgyptianRecipeSpeechPlayer(recipeVoice);
  }

  useEffect(() => {
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(saved)); } catch { /* storage may be full */ }
  }, [saved]);

  const searchForTerm = async (rawTerm: string) => {
    const term = rawTerm.trim();
    if (!term || loading) return;
    setLoading(true);
    setError('');
    setSelected(null);
    setShowSaved(false);
    setResults([]);

    try {
      const englishTerms = await getEnglishSearchTerms(term);
      const bundledMatches = findBundledEgyptianRecipes(term);
      const curatedMatches = findCuratedLocalMatches(term, bundledMatches);

      // Query both name search (search.php?s=) and ingredient filter (filter.php?i=)
      // across expanded synonyms, then hydrate full details via lookup.php?i=.
      const fullMealsById = new Map<string, MealDbMeal>();
      const ingredientStubIds: string[] = [];
      const seenStubIds = new Set<string>();

      const singleWordTerms = englishTerms.filter(t => !t.includes(' ')).slice(0, 3);
      const searchRequests = englishTerms.slice(0, 4).map(async qTerm => {
        const mealUrl = new URL(MEAL_DB_API);
        mealUrl.searchParams.set('s', qTerm);
        const res = await fetch(mealUrl.toString());
        if (!res.ok) return [] as MealDbMeal[];
        const data = await res.json();
        return (Array.isArray(data?.meals) ? data.meals : []) as MealDbMeal[];
      });

      const filterRequests = singleWordTerms.map(async ingredientTerm => {
        const filterUrl = new URL(MEAL_DB_FILTER_API);
        filterUrl.searchParams.set('i', ingredientTerm);
        const res = await fetch(filterUrl.toString());
        if (!res.ok) return [] as Array<{ idMeal: string }>;
        const data = await res.json();
        return (Array.isArray(data?.meals) ? data.meals : []) as Array<{ idMeal: string }>;
      });

      const [searchSettled, filterSettled] = await Promise.all([
        Promise.allSettled(searchRequests),
        Promise.allSettled(filterRequests),
      ]);

      for (const outcome of searchSettled) {
        if (outcome.status === 'fulfilled') {
          for (const meal of outcome.value) {
            if (meal?.idMeal && !fullMealsById.has(meal.idMeal)) {
              fullMealsById.set(meal.idMeal, meal);
            }
          }
        }
      }

      for (const outcome of filterSettled) {
        if (outcome.status === 'fulfilled') {
          for (const stub of outcome.value) {
            if (stub?.idMeal && !fullMealsById.has(stub.idMeal) && !seenStubIds.has(stub.idMeal)) {
              seenStubIds.add(stub.idMeal);
              ingredientStubIds.push(stub.idMeal);
            }
          }
        }
      }

      if (ingredientStubIds.length > 0) {
        const lookupSettled = await Promise.allSettled(
          ingredientStubIds.slice(0, 8).map(async idMeal => {
            const lookupUrl = new URL(MEAL_DB_LOOKUP_API);
            lookupUrl.searchParams.set('i', idMeal);
            const res = await fetch(lookupUrl.toString());
            if (!res.ok) return null;
            const data = await res.json();
            return Array.isArray(data?.meals) && data.meals[0] ? (data.meals[0] as MealDbMeal) : null;
          })
        );
        for (const outcome of lookupSettled) {
          if (outcome.status === 'fulfilled' && outcome.value?.idMeal) {
            fullMealsById.set(outcome.value.idMeal, outcome.value);
          }
        }
      }

      const combinedQuery = englishTerms.join(' ');
      const relevantMeals = Array.from(fullMealsById.values()).filter(meal => {
        const searchableText = `${extractMealIngredientNames(meal)} ${meal.strInstructions || ''}`;
        return englishTerms.some(qTerm => isRelevantRecipe(qTerm, meal.strMeal || '', searchableText))
          || isRelevantRecipe(combinedQuery, meal.strMeal || '', searchableText);
      });

      const translatedOnlineSettled = await Promise.allSettled(
        relevantMeals.slice(0, 8).map(meal => mapMeal(meal, familySize))
      );
      let onlineResults: OnlineRecipe[] = translatedOnlineSettled.flatMap(item =>
        item.status === 'fulfilled' ? [item.value] : []
      );

      let merged = sortAndDedupeOnlineRecipes([
        ...curatedMatches,
        ...bundledMatches,
        ...onlineResults,
      ]);

      if (!merged.length && englishTerms.length > 0) {
        const primaryEnglish = englishTerms[0];
        const wikiUrl = new URL(WIKIBOOKS_API);
        wikiUrl.search = new URLSearchParams({
          action: 'query',
          list: 'search',
          srsearch: `"${primaryEnglish}" recipe OR cookbook`,
          srlimit: '8',
          format: 'json',
          origin: '*',
        }).toString();
        const wikiResponse = await fetch(wikiUrl.toString());
        if (wikiResponse.ok) {
          const wikiData = await wikiResponse.json();
          const hits = (wikiData.query?.search || []) as Array<{ title: string; pageid: number; snippet?: string }>;
          const recipeHits = hits.filter(hit =>
            /cookbook:/i.test(hit.title) &&
            englishTerms.some(qTerm => isRelevantRecipe(qTerm, hit.title, hit.snippet || ''))
          );
          if (recipeHits.length) {
            const pageUrl = new URL(WIKIBOOKS_API);
            pageUrl.search = new URLSearchParams({
              action: 'query', prop: 'extracts', explaintext: '1', exchars: '7000',
              pageids: recipeHits.slice(0, 8).map(hit => String(hit.pageid)).join('|'),
              format: 'json', origin: '*',
            }).toString();
            const pageResponse = await fetch(pageUrl.toString());
            if (pageResponse.ok) {
              const pageData = await pageResponse.json();
              const wikiPages = (Object.values(pageData.query?.pages || {}) as Array<{ pageid: number; title: string; extract?: string }>)
                .filter(page => (page.extract || '').trim().length > 100 &&
                  englishTerms.some(qTerm => isRelevantRecipe(qTerm, page.title, page.extract || '')) &&
                  /ingredient|ingredients|method|preheat|cook|bake|fry|mix|stir|serve/i.test(page.extract || '') &&
                  /ingredient|flour|salt|oil|water|onion|tomato|meat|chicken|egg|rice|sugar|milk|shrimp|fish/i.test(page.extract || '')
                );
              const translatedPages = await Promise.allSettled(wikiPages.map(async page => {
                const [title, extract] = await Promise.all([
                  translateText(page.title.replace(/^Cookbook:/i, '').replace(/_/g, ' '), 'en', 'ar'),
                  translateText((page.extract || '').trim(), 'en', 'ar'),
                ]);
                if (!hasArabic(title) || !hasArabic(extract)) throw new Error('تعذر ترجمة الوصفة إلى العربية.');
                return {
                  title,
                  servings: 4,
                  pageId: page.pageid,
                  cuisine: detectMealDbCuisineTier(undefined, page.title),
                  url: `https://en.wikibooks.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
                  extract: `المقادير محسوبة لـ ${familySize} أفراد تقريبًا.\n\n${extract}`,
                };
              }));
              onlineResults = translatedPages.flatMap(item =>
                item.status === 'fulfilled' ? [item.value] : [],
              );
              merged = sortAndDedupeOnlineRecipes(onlineResults);
            }
          }
        }
      }

      if (!merged.length) {
        setError('ملقيناش وصفة عربية مطابقة حاليًا. جرّب اسم أكلة تانية أو استخدم الوصفات المصرية الجاهزة. مش هنعرض وصفة بالإنجليزي.');
        return;
      }

      setResults(merged);
    } catch {
      const fallbackBundledMatches = findBundledEgyptianRecipes(term);
      const fallbackCuratedMatches = findCuratedLocalMatches(term, fallbackBundledMatches);
      const fallbackLocalMatches = sortAndDedupeOnlineRecipes([
        ...fallbackCuratedMatches,
        ...fallbackBundledMatches,
      ]);
      if (fallbackLocalMatches.length) {
        setResults(fallbackLocalMatches);
      } else {
        setError('تعذر الاتصال بمكتبة الوصفات المجانية. تأكد من الإنترنت وحاول مرة أخرى؛ تقدر تستخدم الوصفات المحفوظة بدون اتصال.');
      }
    } finally {
      setLoading(false);
    }
  };

  const search = (event: React.FormEvent) => {
    event.preventDefault();
    void searchForTerm(query);
  };

  const stopVoiceSearch = async () => {
    try {
      recognitionRef.current?.stop?.();
      recognitionRef.current = null;
      if (Capacitor.isNativePlatform()) await recipeVoice.stopListening();
    } catch { /* recognition may already have stopped */ }
    setVoiceListening(false);
  };

  const startVoiceSearch = async () => {
    if (voiceListening) {
      await stopVoiceSearch();
      return;
    }
    setVoiceMessage('');
    try {
      if (Capacitor.isNativePlatform()) {
        const permission = await recipeVoice.request();
        if (!permission.granted) {
          setVoiceMessage('اسمح لتدبيرة باستخدام الميكروفون من إعدادات الجهاز ثم حاول مرة أخرى.');
          return;
        }
        voiceListenersRef.current.forEach(listener => { void listener.remove(); });
        voiceListenersRef.current = [];
        const resultListener = await recipeVoice.addListener('speechResult', event => {
          const transcript = (event.transcript || '').trim();
          setVoiceListening(false);
          if (!transcript) {
            setVoiceMessage('ملقطناش كلام واضح. اضغط على الميكروفون وجرب تاني.');
            return;
          }
          setQuery(transcript);
          setVoiceMessage(`سمعت: ${transcript}`);
          void searchForTerm(transcript);
        });
        const errorListener = await recipeVoice.addListener('speechError', event => {
          setVoiceListening(false);
          const reason = event.error === 'no-speech' ? 'ملقطناش صوت. اتكلم بوضوح وجرب تاني.' :
            event.error === 'network' ? 'خدمة التعرف على الكلام محتاجة إنترنت.' :
            event.error === 'not-allowed' ? 'إذن الميكروفون غير متاح. فعّله من إعدادات التطبيق.' :
            'تعذر تشغيل الميكروفون. تأكد من توفر خدمة التعرف على الكلام على جهازك.';
          setVoiceMessage(reason);
        });
        voiceListenersRef.current = [resultListener, errorListener];
        await recipeVoice.startListening();
        setVoiceListening(true);
        setVoiceMessage('بتسمعك دلوقتي… قول اسم الأكلة 🎙️');
        return;
      }

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setVoiceMessage('البحث الصوتي غير مدعوم في المتصفح الحالي. استخدم الكتابة أو افتح التطبيق على جهاز يدعم التعرف على الكلام.');
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-EG';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => {
        setVoiceListening(true);
        setVoiceMessage('بتسمعك دلوقتي… قول اسم الأكلة 🎙️');
      };
      recognition.onresult = (event: any) => {
        const transcript = (event.results?.[0]?.[0]?.transcript || '').trim();
        setVoiceListening(false);
        if (transcript) {
          setQuery(transcript);
          setVoiceMessage(`سمعت: ${transcript}`);
          void searchForTerm(transcript);
        } else {
          setVoiceMessage('ملقطناش كلام واضح. جرب تاني.');
        }
      };
      recognition.onerror = (event: any) => {
        setVoiceListening(false);
        setVoiceMessage(event.error === 'not-allowed' ? 'فعّل إذن الميكروفون من إعدادات الجهاز.' : 'تعذر سماع طلبك. حاول مرة أخرى.');
      };
      recognition.onend = () => setVoiceListening(false);
      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setVoiceListening(false);
      setVoiceMessage('مش قادرين نشغل الميكروفون دلوقتي. راجع الإذن وحاول تاني.');
    }
  };

  const stopRecipeSpeech = async () => {
    await speechPlayerRef.current?.stop();
    setSpeaking(false);
  };

  const closeSelectedModal = () => {
    void stopRecipeSpeech();
    setSelected(null);
  };

  const speakRecipe = async (recipe: OnlineRecipe) => {
    const sections = parseRecipeSections(recipe.extract, familySize, recipe.servings || 4);
    const segments = buildEgyptianRecipeSpeechSegments(
      recipe.title,
      familySize,
      sections.ingredients,
      sections.steps
    );
    await speechPlayerRef.current?.speakSegments(segments, {
      isNative: Capacitor.isNativePlatform(),
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: (msg) => {
        setSpeaking(false);
        setVoiceMessage(msg);
      },
    });
  };

  useEffect(() => {
    if (!selected) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        void speechPlayerRef.current?.stop();
        setSpeaking(false);
        setSelected(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected]);

  useEffect(() => {
    let playbackListener: { remove(): Promise<void> } | undefined;
    if (Capacitor.isNativePlatform()) {
      void recipeVoice.addListener('speechPlaybackStatus', event => {
        if (event.status === 'completed' || event.status === 'stopped' || event.status === 'error') setSpeaking(false);
        if (event.status === 'speaking') setSpeaking(true);
      }).then(listener => { playbackListener = listener; });
    }
    return () => {
      try { recognitionRef.current?.stop?.(); } catch {}
      void speechPlayerRef.current?.stop();
      voiceListenersRef.current.forEach(listener => { void listener.remove(); });
      if (playbackListener) void playbackListener.remove();
      if (Capacitor.isNativePlatform()) {
        void recipeVoice.stopListening();
      }
    };
  }, []);

  const saveRecipe = (recipe: OnlineRecipe) => {
    setSaved(current => current.some(item => item.pageId === recipe.pageId) ? current : [recipe, ...current]);
  };
  const removeSaved = (pageId: number) => setSaved(current => current.filter(item => item.pageId !== pageId));
  const currentItems = showSaved ? saved : results;

  return (
    <section dir="rtl" className="min-h-full space-y-3" aria-label="البحث الصوتي عن الوصفات أونلاين">
      <div className="flex items-center gap-2">
        {onBack && <button type="button" onClick={onBack} className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700"><ArrowRight className="h-4 w-4" /> رجوع</button>}
        <div className="min-w-0 flex-1 rounded-2xl bg-gradient-to-l from-[#EEF6EC] to-white p-3">
          <h3 className="text-base font-black text-gray-900">مساعد الوصفات الصوتي 🎙️</h3>
          <p className="mt-1 text-[11px] leading-5 text-gray-600">ابحث بالكلام أو الكتابة، واسمع المكونات وطريقة التحضير بالعربي.</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-gray-500">لأسرة من {familySize} أفراد</span>
        <button type="button" onClick={() => { setShowSaved(value => !value); setSelected(null); }}
          className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">
          {showSaved ? 'نتائج البحث' : 'المحفوظات'} ({saved.length})
        </button>
      </div>

      {!showSaved && (
        <form onSubmit={search} className="flex gap-2">
          <input value={query} onChange={event => setQuery(event.target.value)}
            placeholder="قول أو اكتب اسم الأكلة..." maxLength={80}
            className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-emerald-500" />
          <button type="button" onClick={() => void startVoiceSearch()} disabled={loading}
            aria-label={voiceListening ? 'إيقاف الاستماع' : 'البحث بالصوت'}
            className={`rounded-xl px-3 py-2 text-white disabled:opacity-50 ${voiceListening ? 'bg-red-600' : 'bg-[#667B58]'}`}>
            {voiceListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <button type="submit" disabled={loading || !query.trim()}
            className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
            {loading ? 'جاري البحث…' : <><Search className="inline h-4 w-4 ml-1" /> ابحث</>}
          </button>
        </form>
      )}

      {voiceMessage && <p role="status" className="rounded-xl bg-[#F1F5EC] p-3 text-xs leading-6 text-[#1E5631]">{voiceMessage}</p>}
      {error && <p role="status" className="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900">{error}</p>}

      {currentItems.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {currentItems.map(item => {
            const badge = CUISINE_BADGE_META[item.cuisine || 'international'];
            const hasImage = Boolean(item.imageUrl) && !brokenImages[item.pageId];
            return (
              <button
                key={item.pageId}
                type="button"
                onClick={() => setSelected(item)}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-right transition hover:border-emerald-400 active:scale-[0.99] ${
                  selected?.pageId === item.pageId
                    ? 'border-emerald-500 bg-emerald-50/70 shadow-xs'
                    : 'border-[#E6DFCE] bg-white shadow-2xs'
                }`}
              >
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#F3EBDD]">
                  {hasImage ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={() => setBrokenImages(prev => ({ ...prev, [item.pageId]: true }))}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <RecipeIllustration recipeName={item.title} className="h-full w-full" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 flex-1 text-xs font-extrabold leading-5 text-gray-900 line-clamp-2">
                      {item.title}
                    </span>
                    <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                  <span className="mt-1 block text-[10px] font-medium text-[#626B49]">
                    اضغط لعرض المقادير والطريقة كاملة ←
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (() => {
        const badge = CUISINE_BADGE_META[selected.cuisine || 'international'];
        const sections = parseRecipeSections(selected.extract, familySize, selected.servings || 4);
        const hasValidImage = Boolean(selected.imageUrl) && !brokenImages[selected.pageId];
        const hasExternalSource = Boolean(selected.url) && selected.url !== 'https://www.themealdb.com/';

        const modalNode = (
          <div
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="online-recipe-fullscreen-title"
            className="fixed inset-0 z-[100] bg-[#F8F3E9] flex flex-col overflow-hidden"
          >
            {/* Sticky Top Header */}
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E4DECF] bg-[#FBF8F1]/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-sm">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${badge.className}`}>
                    {badge.label}
                  </span>
                  <span className="text-[11px] font-semibold text-[#68745F]">
                    لأسرة من {familySize} أفراد
                  </span>
                </div>
                <h4
                  id="online-recipe-fullscreen-title"
                  className="mt-1 text-base font-black leading-snug text-[#1E5631] line-clamp-2"
                >
                  {selected.title}
                </h4>
              </div>
              <button
                type="button"
                onClick={closeSelectedModal}
                aria-label="إغلاق"
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-[#DFD7C5] bg-white text-[#43523D] shadow-2xs transition hover:bg-[#F3EDE0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E5631]"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            {/* Full-Screen Scrollable Recipe Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              <div className="mx-auto max-w-2xl space-y-4">
                <div className="overflow-hidden rounded-2xl border border-[#E4DECF] bg-white shadow-xs">
                  {hasValidImage ? (
                    <img
                      src={selected.imageUrl}
                      alt={selected.title}
                      referrerPolicy="no-referrer"
                      onError={() => setBrokenImages(prev => ({ ...prev, [selected.pageId]: true }))}
                      className="h-56 w-full object-cover sm:h-64"
                    />
                  ) : (
                    <div className="flex h-48 w-full items-center justify-center bg-[#F3EBDD] p-4">
                      <RecipeIllustration recipeName={selected.title} className="h-36 w-36" />
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2.5 text-xs font-bold text-emerald-900">
                  المقادير والكميات محسوبة ومضبوطة لـ {familySize} أفراد
                </div>

                {sections.ingredients.length > 0 && (
                  <section className="rounded-2xl border border-[#E4DECF] bg-white p-4 shadow-2xs">
                    <h5 className="mb-2.5 text-sm font-black text-[#1E5631]">المكونات المطلوبة</h5>
                    <ul className="space-y-2 text-sm leading-7 text-gray-800">
                      {sections.ingredients.map((ingredient, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#626B49]" aria-hidden="true" />
                          <span>{ingredient}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section className="rounded-2xl border border-[#E4DECF] bg-white p-4 shadow-2xs">
                  <h5 className="mb-3 text-sm font-black text-[#1E5631]">طريقة التحضير خطوة بخطوة</h5>
                  <ol className="space-y-3 text-sm leading-7 text-gray-800">
                    {sections.steps.map((step, index) => (
                      <li key={index} className="flex items-start gap-3 rounded-xl border border-[#EFE9DA] bg-[#FBF8F1] p-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#626B49] text-xs font-extrabold text-white">
                          {['١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '١٠'][index] || String(index + 1)}
                        </span>
                        <span className="min-w-0 flex-1">{step}</span>
                      </li>
                    ))}
                  </ol>
                </section>

                {selected.imageUrl && !brokenImages[selected.pageId] && (
                  <p className="text-[10px] leading-5 text-gray-500">
                    الصورة: {selected.imageCredit || 'TheMealDB'} — {selected.imageLicense || 'راجع المصدر الأصلي'}
                  </p>
                )}
              </div>
            </div>

            {/* Sticky Bottom Controls Bar */}
            <footer className="shrink-0 border-t border-[#E4DECF] bg-[#FBF8F1]/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-sm">
              <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void (speaking ? stopRecipeSpeech() : speakRecipe(selected))}
                  className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white transition ${
                    speaking ? 'bg-red-600 hover:bg-red-700' : 'bg-[#1E5631] hover:bg-[#2E7D32]'
                  }`}
                >
                  {speaking ? <><VolumeX className="h-4 w-4 shrink-0" /> إيقاف الاستماع</> : <><Volume2 className="h-4 w-4 shrink-0" /> اسمع الوصفة</>}
                </button>
                <button
                  type="button"
                  onClick={() => saveRecipe(selected)}
                  className="min-h-[44px] rounded-xl border border-[#DFC98E] bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-900 transition hover:bg-amber-100"
                >
                  {saved.some(item => item.pageId === selected.pageId) ? '✓ محفوظة' : '☆ احفظ الوصفة'}
                </button>
                {showSaved && (
                  <button
                    type="button"
                    onClick={() => {
                      removeSaved(selected.pageId);
                      closeSelectedModal();
                    }}
                    className="min-h-[44px] rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                  >
                    حذف
                  </button>
                )}
                {hasExternalSource && (
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[44px] items-center rounded-xl border border-[#D7E2CF] bg-[#F1F5EC] px-3 py-2 text-xs font-bold text-[#1E5631] hover:bg-[#E4ECD9]"
                  >
                    المصدر ↗
                  </a>
                )}
                <button
                  type="button"
                  onClick={closeSelectedModal}
                  className="min-h-[44px] rounded-xl border border-[#DFD7C5] bg-white px-4 py-2 text-xs font-bold text-[#43523D] hover:bg-[#F3EDE0]"
                >
                  إغلاق
                </button>
              </div>
            </footer>
          </div>
        );

        return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
      })()}

      {!loading && showSaved && saved.length === 0 && <p className="rounded-xl bg-gray-50 p-4 text-center text-xs text-gray-500">لسه مفيش وصفات أونلاين محفوظة.</p>}
      {!loading && !showSaved && results.length === 0 && !error && <p className="text-[10px] leading-5 text-gray-400">اكتب اسم الأكلة بالعربي أو الإنجليزي، وهندور في مكتبة الوصفات المجانية.</p>}
    </section>
  );
}
