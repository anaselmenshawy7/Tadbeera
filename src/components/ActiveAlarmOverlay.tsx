import { useEffect, useState } from 'react';
import { BellRing, Clock } from 'lucide-react';
import { formatArabicTime12h } from '../features/household/customReminderModels';
import type { ActiveAlarmPayload } from '../services/reminderSoundPreview';

export interface ActiveAlarmOverlayProps {
  alarm: ActiveAlarmPayload | null;
  onDismiss: () => void;
  onSnooze: () => void;
}

export function ActiveAlarmOverlay({ alarm, onDismiss, onSnooze }: ActiveAlarmOverlayProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!alarm) return;
    setNow(new Date());
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, [alarm]);

  if (!alarm) return null;

  return (
    <div
      dir="rtl"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="active-alarm-title"
      className="fixed inset-0 z-[120] flex flex-col items-center justify-between bg-gradient-to-b from-[#172114] via-[#22301C] to-[#11170E] px-6 py-10 text-white"
    >
      {/* Top Status Pill */}
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/20 px-3.5 py-1 text-xs font-extrabold text-amber-200">
          <BellRing className="h-3.5 w-3.5 animate-pulse" />
          <span>{alarm.isPreview ? 'تجربة منبه تدبيرة القوي' : 'منبه تدبيرة شغّال الآن'}</span>
        </span>
        <div className="flex items-center gap-1.5 text-lg font-extrabold tabular-nums text-amber-100/95">
          <Clock className="h-4 w-4 text-amber-300" />
          <span>{formatArabicTime12h(now)}</span>
        </div>
      </div>

      {/* Center Animated Ringing Bell + Large Headline */}
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="relative mb-7 flex h-32 w-32 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
          <span className="absolute inset-3 rounded-full border-2 border-amber-400/50 bg-amber-500/15 animate-pulse" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-2xl shadow-amber-500/40 animate-bounce">
            <BellRing className="h-12 w-12" />
          </div>
        </div>

        <h2
          id="active-alarm-title"
          className="text-3xl font-black leading-snug tracking-tight text-white drop-shadow-sm"
        >
          {alarm.displayTitle}
        </h2>

        <p className="mt-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-bold text-amber-100">
          🔊 {alarm.phrase}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-sm space-y-3">
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-[56px] w-full rounded-2xl bg-red-600 px-6 py-4 text-base font-black text-white shadow-xl shadow-red-900/50 transition hover:bg-red-700 active:scale-[0.98]"
        >
          إيقاف المنبه 🛑
        </button>

        <button
          type="button"
          onClick={onSnooze}
          className="min-h-[48px] w-full rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-white/20 active:scale-[0.98]"
        >
          غفوة 5 دقائق 💤
        </button>
      </div>
    </div>
  );
}
