/**
 * Safe Test-Ad Verification Mode:
 * - true  -> Forces official Google AdMob sample test IDs (safe during APK verification).
 * - false -> Uses PRODUCTION_ADMOB_CONFIG (fill in real Play Store AdMob IDs + AndroidManifest APPLICATION_ID before release).
 */
export const ADMOB_TEST_MODE = true;

export const GOOGLE_TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
export const GOOGLE_TEST_BANNER_AD_UNIT_ID = 'ca-app-pub-3940256099942544/6300978111';

export const PRODUCTION_ADMOB_CONFIG = {
  // Replace with real Google AdMob App ID & Banner Ad Unit ID before Play Store release
  appId: GOOGLE_TEST_APP_ID,
  bannerAdUnitId: GOOGLE_TEST_BANNER_AD_UNIT_ID,
};

export const ADMOB_CONFIG = {
  appId: ADMOB_TEST_MODE ? GOOGLE_TEST_APP_ID : PRODUCTION_ADMOB_CONFIG.appId,
  bannerAdUnitId: ADMOB_TEST_MODE
    ? GOOGLE_TEST_BANNER_AD_UNIT_ID
    : PRODUCTION_ADMOB_CONFIG.bannerAdUnitId,
  testing: ADMOB_TEST_MODE,
};

