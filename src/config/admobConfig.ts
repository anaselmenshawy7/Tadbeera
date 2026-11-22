/** AdMob configuration for Tedbeera (Production & Google Test IDs). */
export const ADMOB_PRODUCTION_CONFIG = {
  appId: 'ca-app-pub-5850155159288546~1189923507',
  bannerAdUnitId: 'ca-app-pub-5850155159288546/5695098547',
  interstitialAdUnitId: 'ca-app-pub-5850155159288546/7263331085',
  rewardedAdUnitId: 'ca-app-pub-5850155159288546/9991894210',
} as const;

export const ADMOB_TEST_CONFIG = {
  appId: 'ca-app-pub-3940256099942544~3347511713',
  bannerAdUnitId: 'ca-app-pub-3940256099942544/6300978111',
  interstitialAdUnitId: 'ca-app-pub-3940256099942544/1033173712',
  rewardedAdUnitId: 'ca-app-pub-3940256099942544/5224354917',
} as const;

export const ADMOB_TEST_MODE = import.meta.env.DEV;

export const ADMOB_CONFIG = {
  appId: ADMOB_TEST_MODE ? ADMOB_TEST_CONFIG.appId : ADMOB_PRODUCTION_CONFIG.appId,
  bannerAdUnitId: ADMOB_TEST_MODE ? ADMOB_TEST_CONFIG.bannerAdUnitId : ADMOB_PRODUCTION_CONFIG.bannerAdUnitId,
  interstitialAdUnitId: ADMOB_TEST_MODE ? ADMOB_TEST_CONFIG.interstitialAdUnitId : ADMOB_PRODUCTION_CONFIG.interstitialAdUnitId,
  rewardedAdUnitId: ADMOB_TEST_MODE ? ADMOB_TEST_CONFIG.rewardedAdUnitId : ADMOB_PRODUCTION_CONFIG.rewardedAdUnitId,
  testing: ADMOB_TEST_MODE,
} as const;

