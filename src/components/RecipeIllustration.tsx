export type RecipeArtworkKind =
  | 'shrimp'
  | 'calamari'
  | 'fish'
  | 'molokhia'
  | 'bamia'
  | 'shawarma'
  | 'maqluba'
  | 'koshary'
  | 'hawawshi'
  | 'fatta'
  | 'mahshi'
  | 'bechamel'
  | 'foul'
  | 'egg'
  | 'soup'
  | 'potatoes'
  | 'meat'
  | 'dessert'
  | 'salad'
  | 'pasta'
  | 'wallet'
  | 'sparkle'
  | 'home';

const ARTWORK_PHOTOS: Record<RecipeArtworkKind, string> = {
  shrimp: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=80',
  calamari: 'https://images.unsplash.com/photo-1626804475297-41608ea09aeb?w=800&auto=format&fit=crop&q=80',
  fish: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
  molokhia: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=800&auto=format&fit=crop&q=80',
  bamia: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=800&auto=format&fit=crop&q=80',
  shawarma: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800&auto=format&fit=crop&q=80',
  maqluba: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80',
  koshary: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80',
  hawawshi: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&auto=format&fit=crop&q=80',
  fatta: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop&q=80',
  mahshi: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
  bechamel: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281298?w=800&auto=format&fit=crop&q=80',
  foul: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&auto=format&fit=crop&q=80',
  egg: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&auto=format&fit=crop&q=80',
  soup: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&auto=format&fit=crop&q=80',
  potatoes: 'https://images.unsplash.com/photo-1518492104633-130d0cc84637?w=800&auto=format&fit=crop&q=80',
  meat: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
  dessert: 'https://images.unsplash.com/photo-1579372786545-d24232daf58c?w=800&auto=format&fit=crop&q=80',
  salad: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80',
  pasta: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281298?w=800&auto=format&fit=crop&q=80',
  wallet: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
  sparkle: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop&q=80',
  home: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&auto=format&fit=crop&q=80'
};

export function resolveRecipeArtworkKind(
  recipeName = '',
  fallbackType = 'koshari',
  recipeId = ''
): RecipeArtworkKind {
  const haystack = `${recipeId} ${recipeName} ${fallbackType}`.toLowerCase();

  if (/جمبري|روبيان|قريدس|shrimp|prawn/.test(haystack)) return 'shrimp';
  if (/سبيط|كاليماري|calamari|squid/.test(haystack)) return 'calamari';
  if (/سمك|صيادية|تونة|fish|tuna/.test(haystack)) return 'fish';
  if (/ملوخية|molokhia/.test(haystack)) return 'molokhia';
  if (/بامية|bamia|okra/.test(haystack)) return 'bamia';
  if (/شاورما|shawarma/.test(haystack)) return 'shawarma';
  if (/مقلوبة|كبسة|maqluba|kabsa/.test(haystack)) return 'maqluba';
  if (/حواوشي|hawawshi/.test(haystack)) return 'hawawshi';
  if (/فتة|fatta/.test(haystack)) return 'fatta';
  if (/محشي|كرنب|ورق عنب|mahshi/.test(haystack)) return 'mahshi';
  if (/بشاميل|رقاق|bechamel|roqaq/.test(haystack)) return 'bechamel';
  if (/أم علي|بسبوسة|كنافة|حلويات|om_ali|dessert/.test(haystack)) return 'dessert';
  if (/فول|طعمية|فلافل|بصارة|foul|taameya|bessara/.test(haystack)) return 'foul';
  if (/شكشوكة|بيض|عجة|egg|shakshouka/.test(haystack)) return 'egg';
  if (/كشري|أرز|رز|koshary/.test(haystack)) return 'koshary';
  if (/شوربة|عدس|soup|lentil/.test(haystack)) return 'soup';
  if (/سلطة|salad/.test(haystack)) return 'salad';
  if (/مكرونة|باستا|pasta|macaroni/.test(haystack)) return 'pasta';
  if (/بطاطس|مسقعة|باذنجان|potato|moussaka/.test(haystack)) return 'potatoes';
  if (/لحمة|لحم|فراخ|دجاج|حمام|كفتة|أرانب|meat|chicken|pigeon|rabbit/.test(haystack)) return 'meat';

  if (fallbackType === 'wallet' || fallbackType === 'sparkle' || fallbackType === 'home') {
    return fallbackType as RecipeArtworkKind;
  }
  return 'koshary';
}

export function RecipeIllustration({
  type = 'koshari',
  recipeName = '',
  recipeId = '',
  className = 'w-full h-full',
  imageUrl = '',
}: {
  type?: string;
  recipeName?: string;
  recipeId?: string;
  className?: string;
  imageUrl?: string;
}) {
  const kind = resolveRecipeArtworkKind(recipeName, type, recipeId);
  const photoUrl = imageUrl || ARTWORK_PHOTOS[kind] || 'https://images.unsplash.com/photo-1545247960-40e9808381dd?w=800&auto=format&fit=crop&q=80';

  return (
    <img
      src={photoUrl}
      alt={recipeName || 'طبق شهي'}
      className={`object-cover ${className}`}
      onError={(e) => {
        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1545247960-40e9808381dd?w=800&auto=format&fit=crop&q=80';
      }}
    />
  );
}
