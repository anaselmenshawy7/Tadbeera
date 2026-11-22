import {
  AdMob,
  AdmobConsentStatus,
} from '@capacitor-community/admob';

export interface AdMobConsentState {
  canRequestAds: boolean;
  privacyOptionsRequired: boolean;
}

let sdkInitialized = false;
let consentFlow: Promise<AdMobConsentState> | null = null;

async function collectConsentAndInitialize(): Promise<AdMobConsentState> {
  let consentInfo = await AdMob.requestConsentInfo();
  if (
    consentInfo.isConsentFormAvailable &&
    consentInfo.status === AdmobConsentStatus.REQUIRED
  ) {
    consentInfo = await AdMob.showConsentForm();
  }
  if (consentInfo.canRequestAds && !sdkInitialized) {
    await AdMob.initialize();
    sdkInitialized = true;
  }
  return {
    canRequestAds: consentInfo.canRequestAds,
    privacyOptionsRequired:
      String(consentInfo.privacyOptionsRequirementStatus) === 'REQUIRED',
  };
}

/** Request UMP consent on each native launch and initialize AdMob only once. */
export function initializeAdMobWithConsent(): Promise<AdMobConsentState> {
  if (!consentFlow) {
    consentFlow = collectConsentAndInitialize().catch(error => {
      consentFlow = null;
      throw error;
    });
  }
  return consentFlow;
}

/** Reopen the UMP privacy controls and immediately apply the updated consent state. */
export async function showAdMobPrivacyOptions(): Promise<AdMobConsentState> {
  await AdMob.showPrivacyOptionsForm();
  const consentInfo = await AdMob.requestConsentInfo();
  if (consentInfo.canRequestAds && !sdkInitialized) {
    await AdMob.initialize();
    sdkInitialized = true;
  }
  if (!consentInfo.canRequestAds) {
    await AdMob.hideBanner().catch(() => undefined);
  }
  const state: AdMobConsentState = {
    canRequestAds: consentInfo.canRequestAds,
    privacyOptionsRequired:
      String(consentInfo.privacyOptionsRequirementStatus) === 'REQUIRED',
  };
  consentFlow = Promise.resolve(state);
  return state;
}
