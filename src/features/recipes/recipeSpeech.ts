export interface NativeRecipeSpeechBridge {
  speak(options: { text: string }): Promise<void>;
  stopSpeaking(): Promise<void>;
}

const ARABIC_ORDINAL_STEPS = [
  'الأولى',
  'التانية',
  'التالتة',
  'الرابعة',
  'الخامسة',
  'السادسة',
  'السابعة',
  'التامنة',
  'التاسعة',
  'العاشرة',
];

function convertMixedAndPlainFractions(input: string): string {
  let text = input
    .replace(/½/g, ' نص ')
    .replace(/¼/g, ' ربع ')
    .replace(/¾/g, ' تلات أرباع ')
    .replace(/⅓/g, ' تلت ')
    .replace(/⅔/g, ' تلتين ')
    .replace(/⅛/g, ' تمن ');

  // Mixed numbers like "1 1/2" or "2 1/4"
  text = text
    .replace(/(\d+)\s+1\s*\/\s*2\b/g, '$1 ونص')
    .replace(/(\d+)\s+1\s*\/\s*4\b/g, '$1 وربع')
    .replace(/(\d+)\s+3\s*\/\s*4\b/g, '$1 وتلات أرباع')
    .replace(/(\d+)\s+1\s*\/\s*3\b/g, '$1 وتلت')
    .replace(/(\d+)\s+2\s*\/\s*3\b/g, '$1 وتلتين');

  // Standalone fractions
  text = text
    .replace(/(^|\s)1\s*\/\s*2(?=\s|$|[،.])/g, '$1نص')
    .replace(/(^|\s)1\s*\/\s*4(?=\s|$|[،.])/g, '$1ربع')
    .replace(/(^|\s)3\s*\/\s*4(?=\s|$|[،.])/g, '$1تلات أرباع')
    .replace(/(^|\s)1\s*\/\s*3(?=\s|$|[،.])/g, '$1تلت')
    .replace(/(^|\s)2\s*\/\s*3(?=\s|$|[،.])/g, '$1تلتين')
    .replace(/(\d+)\s*\/\s*(\d+)/g, '$1 على $2');

  // Common decimal fractions like "0.5", "1.5", "2.25", "1.75"
  text = text
    .replace(/(^|\s)0?[.,]5(?=\s|$|[،.])/g, '$1نص')
    .replace(/(^|\s)0?[.,]25(?=\s|$|[،.])/g, '$1ربع')
    .replace(/(^|\s)0?[.,]75(?=\s|$|[،.])/g, '$1تلات أرباع')
    .replace(/(\d+)[.,]5(?=\s|$|[،.])/g, '$1 ونص')
    .replace(/(\d+)[.,]25(?=\s|$|[،.])/g, '$1 وربع')
    .replace(/(\d+)[.,]75(?=\s|$|[،.])/g, '$1 وتلات أرباع');

  return text;
}

/**
 * Converts recipe measurements, abbreviations, and symbols into warm,
 * naturally spoken Egyptian Arabic phrasing.
 */
export function humanizeArabicRecipeSpeech(value: string): string {
  if (!value) return '';
  let text = value
    .replace(/[•*_#`~|]/g, ' ')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/—|–/g, ' ');

  text = convertMixedAndPlainFractions(text);

  text = text
    // Tablespoon / Teaspoon abbreviations
    .replace(/(^|\s)م\s*\.?\s*ك\.?(?=\s|$|[،.])/g, '$1معلقة كبيرة')
    .replace(/(^|\s)م\s*\.?\s*ص\.?(?=\s|$|[،.])/g, '$1معلقة صغيرة')
    .replace(/(^|\s)ملاعق كبيرة(?=\s|$|[،.])/g, '$1معالق كبيرة')
    .replace(/(^|\s)ملعقة كبيرة(?=\s|$|[،.])/g, '$1معلقة كبيرة')
    .replace(/(^|\s)ملعقة صغيرة(?=\s|$|[،.])/g, '$1معلقة صغيرة')
    // Weight / volume abbreviations
    .replace(/(^|\s)كجم\.?(?=\s|$|[،.])/g, '$1كيلو جرام')
    .replace(/(^|\s)جم\.?(?=\s|$|[،.])/g, '$1جرام')
    .replace(/(^|\s)مل\.?(?=\s|$|[،.])/g, '$1مللي')
    .replace(/(^|\s)ج\s*\.?\s*م\.?(?=\s|$|[،.])/g, '$1جنيه')
    // Strip leftover Latin script fragments if Arabic content is already present
    .replace(/\s+/g, ' ')
    .trim();

  if (/[\u0600-\u06FF]/.test(text)) {
    text = text.replace(/\b[A-Za-z]{2,}\b/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return text;
}

export function buildEgyptianRecipeSpeechSegments(
  title: string,
  familySize: number,
  ingredients: string[],
  steps: string[]
): string[] {
  const safeFamily = Math.max(1, Math.round(familySize || 4));
  const cleanTitle = humanizeArabicRecipeSpeech(title);
  const cleanIngredients = ingredients.map(humanizeArabicRecipeSpeech).filter(Boolean);
  const cleanSteps = steps.map(humanizeArabicRecipeSpeech).filter(Boolean);

  const segments: string[] = [
    `يلا نجهز مع بعض وصفة ${cleanTitle}.`,
    `المقادير دي محسوبة لـ ${safeFamily} أفراد.`,
  ];

  if (cleanIngredients.length > 0) {
    segments.push('أول حاجة هنحتاج المكونات دي:');
    cleanIngredients.forEach((item) => {
      segments.push(item);
    });
  }

  if (cleanSteps.length > 0) {
    segments.push('ودلوقتي طريقة التحضير خطوة بخطوة:');
    cleanSteps.forEach((step, index) => {
      const ordinal = ARABIC_ORDINAL_STEPS[index] || `رقم ${index + 1}`;
      segments.push(`الخطوة ${ordinal}: ${step}`);
    });
  }

  segments.push('وبس كده، وصفتنا جاهزة، وبالهنا والشفا!');
  return segments;
}

export function pickNaturalEgyptianFemaleVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (!Array.isArray(voices) || voices.length === 0) return null;

  const arabicVoices = voices.filter((voice) =>
    (voice.lang || '').toLowerCase().startsWith('ar')
  );
  if (arabicVoices.length === 0) return null;

  const scoreVoice = (voice: SpeechSynthesisVoice): number => {
    const lang = (voice.lang || '').toLowerCase().replace('_', '-');
    const name = `${voice.name || ''} ${voice.voiceURI || ''}`.toLowerCase();
    let score = 0;

    if (lang === 'ar-eg') score += 120;
    else if (lang.startsWith('ar-eg')) score += 100;
    else if (lang === 'ar-sa' || lang === 'ar-lb' || lang === 'ar-ae' || lang === 'ar-jo') score += 45;
    else if (lang === 'ar') score += 30;

    if (/(female|woman|hoda|salma|laila|layla|mariam|fatima|noor|amira|zahra|sara|rana|natural|neural)/i.test(name)) {
      score += 75;
    }
    if (/google/i.test(name)) {
      score += 35;
    }
    if (/(male|naayf|tariq|omar|bassam|maged|hamza|karim|shakir)/i.test(name) && !/female/i.test(name)) {
      score -= 55;
    }
    if (!voice.localService) {
      score += 15;
    }

    return score;
  };

  return [...arabicVoices].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] || null;
}

async function resolveSpeechVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const immediate = window.speechSynthesis.getVoices();
  if (immediate.length > 0) return immediate;

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(window.speechSynthesis.getVoices());
    };
    const timer = window.setTimeout(finish, 350);
    const handler = () => {
      window.clearTimeout(timer);
      window.speechSynthesis.removeEventListener?.('voiceschanged', handler);
      finish();
    };
    window.speechSynthesis.addEventListener?.('voiceschanged', handler);
  });
}

export class EgyptianRecipeSpeechPlayer {
  private sessionId = 0;
  private activeTimer: number | null = null;
  private nativeBridge?: NativeRecipeSpeechBridge;

  constructor(nativeBridge?: NativeRecipeSpeechBridge) {
    this.nativeBridge = nativeBridge;
  }

  async stop(): Promise<void> {
    this.sessionId += 1;
    if (this.activeTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }
    try {
      if (this.nativeBridge) {
        await this.nativeBridge.stopSpeaking();
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // Ignore cleanup errors when speech was not active
    }
  }

  async speakSegments(
    segments: string[],
    callbacks: {
      isNative: boolean;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (message: string) => void;
    }
  ): Promise<void> {
    const cleanSegments = segments.map((s) => s.trim()).filter(Boolean);
    if (cleanSegments.length === 0) return;

    await this.stop();
    const mySession = this.sessionId;

    if (callbacks.isNative && this.nativeBridge) {
      try {
        await this.nativeBridge.speak({ text: cleanSegments.join('.\n') });
        if (this.sessionId === mySession) {
          callbacks.onStart?.();
        }
      } catch {
        if (this.sessionId === mySession) {
          callbacks.onError?.('تعذر تشغيل الصوت العربي. تأكد من وجود محرك تحويل النص إلى كلام وصوت عربي على الجهاز.');
        }
      }
      return;
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      callbacks.onError?.('تشغيل الصوت غير مدعوم على هذا الجهاز.');
      return;
    }

    const voices = await resolveSpeechVoices();
    if (this.sessionId !== mySession) return;
    const preferredVoice = pickNaturalEgyptianFemaleVoice(voices);

    callbacks.onStart?.();

    const speakSingleSegment = (text: string): Promise<boolean> =>
      new Promise((resolve) => {
        if (this.sessionId !== mySession) {
          resolve(false);
          return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = preferredVoice?.lang || 'ar-EG';
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
        utterance.rate = 0.93;
        utterance.pitch = 1.08;
        utterance.volume = 1;
        utterance.onend = () => resolve(true);
        utterance.onerror = () => resolve(false);
        window.speechSynthesis.speak(utterance);
      });

    for (let i = 0; i < cleanSegments.length; i += 1) {
      if (this.sessionId !== mySession) return;
      const ok = await speakSingleSegment(cleanSegments[i]);
      if (this.sessionId !== mySession) return;
      if (!ok) {
        callbacks.onError?.('تعذر تشغيل الصوت. تأكد من تثبيت صوت عربي على الجهاز.');
        return;
      }
      if (i < cleanSegments.length - 1) {
        await new Promise<void>((resolve) => {
          this.activeTimer = window.setTimeout(() => {
            this.activeTimer = null;
            resolve();
          }, 200);
        });
      }
    }

    if (this.sessionId === mySession) {
      callbacks.onEnd?.();
    }
  }
}
