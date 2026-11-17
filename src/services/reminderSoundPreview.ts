import { Capacitor, registerPlugin } from '@capacitor/core';
import type { ReminderSoundProfile } from '../features/household/customReminderModels';
import { pickNaturalEgyptianFemaleVoice } from '../features/recipes/recipeSpeech';

interface NativeSpeechPlugin {
  speak(options: { text: string }): Promise<void>;
  stopSpeaking(): Promise<void>;
}

const nativeSpeech = registerPlugin<NativeSpeechPlugin>('MicrophonePermission');

export interface SoundPreviewResult {
  played: boolean;
  message: string;
}

export interface ActiveAlarmPayload {
  id?: number;
  title: string;
  displayTitle: string;
  phrase: string;
  isPreview?: boolean;
}

export const ALARM_TRIGGER_EVENT = 'tedbeeraTriggerAlarmOverlay';
export const ALARM_DISMISS_EVENT = 'tedbeeraDismissAlarmOverlay';
export const ALARM_REPEAT_INTERVAL_MS = 4000;
export const ALARM_VIBRATION_PATTERN = [600, 300, 600, 300, 800];

let activeAudioCtx: AudioContext | null = null;
let activeStopTimeout: ReturnType<typeof setTimeout> | null = null;
let alarmLoopInterval: ReturnType<typeof setInterval> | null = null;
let alarmSpeechTimeout: ReturnType<typeof setTimeout> | null = null;
let alarmLoopActive = false;

function getAudioContextConstructor(): (new () => AudioContext) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: new () => AudioContext;
    webkitAudioContext?: new () => AudioContext;
  };
  return w.AudioContext || w.webkitAudioContext || null;
}

export function buildEgyptianAlarmPhrase(reminderTitle?: string): string {
  const cleanTitle = (reminderTitle || '').trim();
  if (!cleanTitle || /صحي.*جوز|جوزي/i.test(cleanTitle)) {
    return 'يلا قومي صحي جوزك دلوقتي!';
  }
  return `يلا قومي، ميعاد: ${cleanTitle} دلوقتي!`;
}

export function buildAlarmDisplayTitle(reminderTitle?: string): string {
  const cleanTitle = (reminderTitle || '').trim();
  if (!cleanTitle || /صحي.*جوز|جوزي/i.test(cleanTitle)) {
    return 'يلا قومي صحي جوزك ⏰';
  }
  return `${cleanTitle} ⏰`;
}

function stopAudioAndSpeechOnly(): void {
  if (activeStopTimeout !== null) {
    clearTimeout(activeStopTimeout);
    activeStopTimeout = null;
  }
  if (alarmSpeechTimeout !== null) {
    clearTimeout(alarmSpeechTimeout);
    alarmSpeechTimeout = null;
  }
  if (activeAudioCtx) {
    try {
      void activeAudioCtx.close();
    } catch {
      // ignore close errors
    }
    activeAudioCtx = null;
  }
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  } catch {
    // ignore speech cleanup errors
  }
  if (typeof window !== 'undefined' && Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('MicrophonePermission')) {
    void nativeSpeech.stopSpeaking().catch(() => {});
  }
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(0);
    }
  } catch {
    // ignore vibration stop errors
  }
}

export function isAlarmLoopActive(): boolean {
  return alarmLoopActive;
}

export function stopPersistentAlarmLoop(): void {
  const wasActive = alarmLoopActive;
  alarmLoopActive = false;
  if (alarmLoopInterval !== null) {
    clearInterval(alarmLoopInterval);
    alarmLoopInterval = null;
  }
  stopAudioAndSpeechOnly();
  if (wasActive && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ALARM_DISMISS_EVENT));
  }
}

export function stopReminderSoundPreview(): void {
  if (alarmLoopActive) {
    stopPersistentAlarmLoop();
    return;
  }
  stopAudioAndSpeechOnly();
}

async function playLoudAlarmCycleChime(): Promise<boolean> {
  const Ctor = getAudioContextConstructor();
  if (!Ctor) return false;

  if (activeAudioCtx) {
    try {
      void activeAudioCtx.close();
    } catch {
      // ignore close errors
    }
    activeAudioCtx = null;
  }

  const ctx = new Ctor();
  activeAudioCtx = ctx;
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  const now = ctx.currentTime;
  const pulses = [
    { start: 0.0, freq: 987.77, dur: 0.14 },
    { start: 0.16, freq: 1318.51, dur: 0.14 },
    { start: 0.32, freq: 987.77, dur: 0.14 },
    { start: 0.48, freq: 1318.51, dur: 0.18 },
  ];

  for (const pulse of pulses) {
    const oscPrimary = ctx.createOscillator();
    const oscHarmonic = ctx.createOscillator();
    const gain = ctx.createGain();

    oscPrimary.type = 'sawtooth';
    oscPrimary.frequency.setValueAtTime(pulse.freq, now + pulse.start);
    oscHarmonic.type = 'triangle';
    oscHarmonic.frequency.setValueAtTime(pulse.freq * 1.5, now + pulse.start);

    gain.gain.setValueAtTime(0.001, now + pulse.start);
    gain.gain.linearRampToValueAtTime(1.0, now + pulse.start + 0.015);
    gain.gain.setValueAtTime(1.0, now + pulse.start + Math.max(0.02, pulse.dur - 0.03));
    gain.gain.exponentialRampToValueAtTime(0.001, now + pulse.start + pulse.dur);

    oscPrimary.connect(gain);
    oscHarmonic.connect(gain);
    gain.connect(ctx.destination);

    oscPrimary.start(now + pulse.start);
    oscHarmonic.start(now + pulse.start);
    oscPrimary.stop(now + pulse.start + pulse.dur + 0.02);
    oscHarmonic.stop(now + pulse.start + pulse.dur + 0.02);
  }

  if (activeStopTimeout !== null) {
    clearTimeout(activeStopTimeout);
  }
  activeStopTimeout = setTimeout(() => {
    if (activeAudioCtx === ctx) {
      void ctx.close().catch(() => {});
      activeAudioCtx = null;
    }
  }, 850);

  return true;
}

async function playGentleChime(): Promise<boolean> {
  const Ctor = getAudioContextConstructor();
  if (!Ctor) return false;

  const ctx = new Ctor();
  activeAudioCtx = ctx;
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  const now = ctx.currentTime;
  const notes = [
    { start: 0.0, freq: 523.25, dur: 0.34 },
    { start: 0.16, freq: 659.25, dur: 0.42 },
    { start: 0.34, freq: 783.99, dur: 0.55 },
  ];

  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(note.freq, now + note.start);

    gain.gain.setValueAtTime(0.0001, now + note.start);
    gain.gain.exponentialRampToValueAtTime(0.16, now + note.start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + note.start);
    osc.stop(now + note.start + note.dur + 0.02);
  }

  activeStopTimeout = setTimeout(() => {
    if (activeAudioCtx === ctx) {
      void ctx.close().catch(() => {});
      activeAudioCtx = null;
    }
  }, 1050);

  return true;
}

async function speakLoudEgyptianAlarmPhrase(phrase: string): Promise<void> {
  if (typeof window !== 'undefined' && Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('MicrophonePermission')) {
    try {
      await nativeSpeech.speak({ text: phrase });
      return;
    } catch {
      // Fall back to Web Speech API if native TTS is unavailable
    }
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const voices = window.speechSynthesis.getVoices();
      const preferred = pickNaturalEgyptianFemaleVoice(voices);
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.lang = preferred?.lang || 'ar-EG';
      if (preferred) {
        utterance.voice = preferred;
      }
      utterance.volume = 1.0;
      utterance.rate = 0.96;
      utterance.pitch = 1.12;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore speech synthesis errors on unsupported browsers
    }
  }
}

function runSingleAlarmCycle(phrase: string): void {
  if (!alarmLoopActive) return;

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ALARM_VIBRATION_PATTERN);
    }
  } catch {
    // ignore vibration errors
  }

  void playLoudAlarmCycleChime().catch(() => {});

  if (alarmSpeechTimeout !== null) {
    clearTimeout(alarmSpeechTimeout);
  }
  alarmSpeechTimeout = setTimeout(() => {
    if (!alarmLoopActive) return;
    void speakLoudEgyptianAlarmPhrase(phrase);
  }, 680);
}

export function startPersistentAlarmLoop(options: {
  id?: number;
  title?: string;
  isPreview?: boolean;
} = {}): ActiveAlarmPayload {
  if (alarmLoopInterval !== null) {
    clearInterval(alarmLoopInterval);
    alarmLoopInterval = null;
  }
  stopAudioAndSpeechOnly();

  const cleanTitle = (options.title || '').trim() || 'أصحي جوزي من النوم';
  const payload: ActiveAlarmPayload = {
    id: options.id,
    title: cleanTitle,
    displayTitle: buildAlarmDisplayTitle(options.title),
    phrase: buildEgyptianAlarmPhrase(options.title),
    isPreview: Boolean(options.isPreview),
  };

  alarmLoopActive = true;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<ActiveAlarmPayload>(ALARM_TRIGGER_EVENT, {
        detail: payload,
      })
    );
  }

  runSingleAlarmCycle(payload.phrase);

  alarmLoopInterval = setInterval(() => {
    if (!alarmLoopActive) return;
    runSingleAlarmCycle(payload.phrase);
  }, ALARM_REPEAT_INTERVAL_MS);

  return payload;
}

export async function previewReminderSound(
  profile: ReminderSoundProfile,
  customTitle?: string
): Promise<SoundPreviewResult> {
  if (profile === 'alarm') {
    if (isAlarmLoopActive()) {
      stopPersistentAlarmLoop();
      return {
        played: false,
        message: 'تم إيقاف تجربة المنبه القوي 🛑',
      };
    }

    startPersistentAlarmLoop({
      title: customTitle,
      isPreview: true,
    });
    return {
      played: true,
      message: 'المنبه القوي شغّال دلوقتي بصوت عالٍ ومتكرر حتى تضغطي إيقاف المنبه 🔔🔊',
    };
  }

  stopReminderSoundPreview();

  if (profile === 'vibrate') {
    const vibrated =
      typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
        ? navigator.vibrate([180, 90, 180])
        : false;
    return {
      played: vibrated,
      message: vibrated
        ? 'تمت تجربة الاهتزاز فقط (تنبيه صامت بدون صوت) 📳'
        : 'تم اختيار وضع الاهتزاز فقط بدون صوت 📳',
    };
  }

  // gentle
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(80);
  }
  let gentlePlayed = false;
  try {
    gentlePlayed = await playGentleChime();
  } catch {
    gentlePlayed = false;
  }
  return {
    played: gentlePlayed,
    message: 'بتسمعي دلوقتي الرنة الهادئة للتذكير 🎵',
  };
}
