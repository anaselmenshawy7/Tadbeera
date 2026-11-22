/**
 * Tedbeera — Rewarded Ad Service
 * Android requests the real AdMob rewarded unit only after UMP consent.
 * Browser preview keeps a clearly labelled local simulation.
 */
import { Capacitor } from '@capacitor/core';
import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';
import { ADMOB_CONFIG } from '../config/admobConfig';
import { initializeAdMobWithConsent } from './admobConsentService';

export const REWARDED_AD_UNIT_ID = ADMOB_CONFIG.rewardedAdUnitId;

export interface AdReward {
  type: string;
  amount: number;
}
export interface RewardedAdCallbacks {
  onUserEarnedReward: (reward: AdReward) => void;
  onDismissedWithoutReward: () => void;
  onError: (error: string) => void;
  onAdOpened?: () => void;
}
export interface RewardedAdService {
  isNative(): boolean;
  getAdUnitId(): string;
  prepareAd(): Promise<boolean>;
  isReady(): boolean;
  show(callbacks: RewardedAdCallbacks): Promise<void>;
  cleanup(): void;
}

class CapacitorNativeRewardedAdAdapter implements RewardedAdService {
  private isAdLoaded = false;
  private listeners: Array<{ remove: () => Promise<void> }> = [];
  private activeCallbacks: RewardedAdCallbacks | null = null;

  isNative(): boolean { return true; }
  getAdUnitId(): string { return REWARDED_AD_UNIT_ID; }

  async prepareAd(): Promise<boolean> {
    try {
      const consent = await initializeAdMobWithConsent();
      if (!consent.canRequestAds) {
        this.isAdLoaded = false;
        console.warn('AdMob rewarded ad blocked: UMP consent not granted.');
        return false;
      }
      await AdMob.prepareRewardVideoAd({ adId: REWARDED_AD_UNIT_ID, isTesting: ADMOB_CONFIG.testing });
      this.isAdLoaded = true;
      return true;
    } catch (error) {
      this.isAdLoaded = false;
      console.warn('AdMob rewarded ad preparation failed:', error);
      return false;
    }
  }

  isReady(): boolean { return this.isAdLoaded; }

  async show(callbacks: RewardedAdCallbacks): Promise<void> {
    this.activeCallbacks = callbacks;
    let settled = false;
    try {
      if (!this.isAdLoaded && !(await this.prepareAd())) {
        callbacks.onError('إعلان المكافأة غير متاح حالياً. حاول مرة أخرى لاحقاً.');
        this.activeCallbacks = null;
        return;
      }
      this.cleanupListeners();
      const rewardHandle = await AdMob.addListener(RewardAdPluginEvents.Rewarded, rewardItem => {
        if (settled) return;
        settled = true;
        this.activeCallbacks?.onUserEarnedReward({
          type: rewardItem?.type || 'weekly_plan_unlock',
          amount: rewardItem?.amount || 1,
        });
      });
      this.listeners.push(rewardHandle);
      const dismissedHandle = await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        if (settled) return;
        settled = true;
        this.activeCallbacks?.onDismissedWithoutReward();
      });
      this.listeners.push(dismissedHandle);
      const failedHandle = await AdMob.addListener(RewardAdPluginEvents.FailedToShow, error => {
        if (settled) return;
        settled = true;
        this.activeCallbacks?.onError(error?.message || 'تعذر عرض إعلان المكافأة.');
      });
      this.listeners.push(failedHandle);

      callbacks.onAdOpened?.();
      const rewardItem = await AdMob.showRewardVideoAd();
      if (!settled && rewardItem && rewardItem.amount > 0) {
        settled = true;
        callbacks.onUserEarnedReward({
          type: rewardItem.type || 'weekly_plan_unlock',
          amount: rewardItem.amount,
        });
      } else if (!settled) {
        settled = true;
        callbacks.onDismissedWithoutReward();
      }
    } catch (error) {
      if (!settled) {
        settled = true;
        callbacks.onError(error instanceof Error ? error.message : 'حدث خطأ أثناء عرض إعلان المكافأة.');
      }
    } finally {
      this.isAdLoaded = false;
      this.cleanupListeners();
      this.activeCallbacks = null;
    }
  }

  private cleanupListeners(): void {
    this.listeners.forEach(handle => { void handle.remove().catch(() => undefined); });
    this.listeners = [];
  }
  cleanup(): void {
    this.cleanupListeners();
    this.isAdLoaded = false;
    this.activeCallbacks = null;
  }
}

class WebPreviewRewardedAdAdapter implements RewardedAdService {
  private activeCallbacks: RewardedAdCallbacks | null = null;
  isNative(): boolean { return false; }
  getAdUnitId(): string { return 'web-preview-simulation'; }
  async prepareAd(): Promise<boolean> { return true; }
  isReady(): boolean { return true; }

  async show(callbacks: RewardedAdCallbacks): Promise<void> {
    this.activeCallbacks = callbacks;
    callbacks.onAdOpened?.();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tedbeera_open_reward_simulation', {
        detail: {
          previewMode: true,
          featureName: 'جدول وجبات الأسبوع التوفيري الكامل مع جدول التسوق المجمع',
        },
      }));
    }
  }
  completeSimulation(): void {
    if (!this.activeCallbacks) return;
    this.activeCallbacks.onUserEarnedReward({ type: 'weekly_plan_unlock', amount: 1 });
    this.activeCallbacks = null;
  }
  cancelSimulation(): void {
    if (!this.activeCallbacks) return;
    this.activeCallbacks.onDismissedWithoutReward();
    this.activeCallbacks = null;
  }
  cleanup(): void { this.activeCallbacks = null; }
}

let cachedService: RewardedAdService | null = null;
let webSimulationAdapterInstance: WebPreviewRewardedAdAdapter | null = null;

export function getRewardedAdService(): RewardedAdService {
  if (cachedService) return cachedService;
  const isNative = Capacitor.isNativePlatform() || Capacitor.getPlatform() === 'android';
  const hasAdMobPlugin = Capacitor.isPluginAvailable('AdMob');
  if (isNative && hasAdMobPlugin) {
    console.info('AdMob Rewarded: Using native Android AdMob adapter.');
    cachedService = new CapacitorNativeRewardedAdAdapter();
  } else {
    if (isNative && !hasAdMobPlugin) {
      console.warn('AdMob Rewarded Diagnostics: Running on native Android but AdMob plugin is not available. Falling back to web simulation or check capacitor plugin registration.');
    }
    webSimulationAdapterInstance = new WebPreviewRewardedAdAdapter();
    cachedService = webSimulationAdapterInstance;
  }
  return cachedService;
}

export function getWebSimulationAdapter(): WebPreviewRewardedAdAdapter | null {
  if (!webSimulationAdapterInstance) {
    const service = getRewardedAdService();
    if (!service.isNative()) webSimulationAdapterInstance = service as WebPreviewRewardedAdAdapter;
  }
  return webSimulationAdapterInstance;
}
