export type ShoppingCategory = 'Groceries' | 'Household Cleaning' | 'Kitchen Tools' | 'General Shopping';

export interface AffiliatePartnerDeal {
  id: string;
  partnerName: string;
  shortName: string;
  storeCategory: ShoppingCategory;
  supportedCategories: ShoppingCategory[];
  isActive: boolean;
  conditions: string;
  officialUrl: string;
  affiliateTrackingUrl: string | null;
  description: string;
  displayPriority: number; // 1 = highest
}

export const AFFILIATE_PARTNERS_CONFIG: AffiliatePartnerDeal[] = [
  {
    id: 'noon',
    partnerName: 'نون مصر (Noon Egypt)',
    shortName: 'نون مصر',
    storeCategory: 'General Shopping',
    supportedCategories: ['Groceries', 'Household Cleaning', 'Kitchen Tools', 'General Shopping'],
    isActive: true,
    conditions: 'قسم السوبرماركت، المنظفات، وأدوات المطبخ مع خيارات توصيل سريع.',
    officialUrl: 'https://www.noon.com/egypt-ar/',
    affiliateTrackingUrl: 'https://www.noon.com/egypt-ar/',
    description: 'تصفح قسم البقالة، المنظفات، واحتياجات المطبخ المتنوعة مع التوصيل للبيت.',
    displayPriority: 1,
  },
  {
    id: 'amazon',
    partnerName: 'أمازون مصر (Amazon.eg)',
    shortName: 'أمازون مصر',
    storeCategory: 'Groceries',
    supportedCategories: ['Groceries', 'Household Cleaning', 'Kitchen Tools', 'General Shopping'],
    isActive: true,
    conditions: 'سوبرماركت أونلاين للسلع الغذائية، خزين البيت، ومنتجات التنظيف.',
    officialUrl: 'https://www.amazon.eg/',
    affiliateTrackingUrl: 'https://www.amazon.eg/',
    description: 'اطلب خزين البيت، السلع الأساسية، ومنظفات الغسيل والأسطح بسهولة.',
    displayPriority: 2,
  },
  {
    id: 'carrefour',
    partnerName: 'كارفور مصر (Carrefour Egypt)',
    shortName: 'كارفور مصر',
    storeCategory: 'Groceries',
    supportedCategories: ['Groceries', 'Household Cleaning', 'Kitchen Tools'],
    isActive: true,
    conditions: 'عروض السوبرماركت اليومية والأسبوعية على الخضار، اللحوم، والبقالة.',
    officialUrl: 'https://www.carrefouregypt.com/mafegy/ar/',
    affiliateTrackingUrl: 'https://www.carrefouregypt.com/mafegy/ar/',
    description: 'تصفح عروض السوبرماركت الأسبوعية وكل مستلزمات المطبخ المصري.',
    displayPriority: 3,
  },
  {
    id: 'talabat',
    partnerName: 'طلبات مارت (Talabat Mart)',
    shortName: 'طلبات مارت',
    storeCategory: 'Groceries',
    supportedCategories: ['Groceries', 'Household Cleaning'],
    isActive: true,
    conditions: 'توصيل سريع للمقاضي اليومية والنواقص الطارئة من السوبرماركت.',
    officialUrl: 'https://www.talabat.com/egypt',
    affiliateTrackingUrl: 'https://www.talabat.com/egypt',
    description: 'اطلب النواقص اليومية والمقاضي السريعة بتوصيل مباشر حتى باب البيت.',
    displayPriority: 4,
  },
];

export function getActiveStoreLinks(): AffiliatePartnerDeal[] {
  return AFFILIATE_PARTNERS_CONFIG.filter(deal => deal.isActive).sort(
    (a, b) => a.displayPriority - b.displayPriority,
  );
}

export function getActiveVerifiedDeals(): AffiliatePartnerDeal[] {
  return getActiveStoreLinks();
}

export function matchDealsForShoppingItems(_itemsCount: number): AffiliatePartnerDeal[] {
  return getActiveStoreLinks();
}

