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
      className="fixed inset-0 z-[120] flex flex-col items-center justify-between bg-gradient-to-b from-[#4A353B] via-[#5E4049] to-[#3B282D] px-6 py-10 text-white"
    >
      {/* Top Status Pill */}
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F3DCE2]/40 bg-[#D47E93]/35 px-3.5 py-1 text-xs font-extrabold text-[#FADDE4]">
          <BellRing className="h-3.5 w-3.5 animate-pulse" />
          <span>{alarm.isPreview ? 'تجربة منبه تدبيرة القوي' : 'منبه تدبيرة شغّال الآن'}</span>
        </span>
        <div className="flex items-center gap-1.5 text-lg font-extrabold tabular-nums text-[#FADDE4]">
          <Clock className="h-4 w-4 text-[#E8A8B7]" />
          <span>{formatArabicTime12h(now)}</span>
        </div>
      </div>

      {/* Center Animated Ringing Bell + Large Headline */}
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="relative mb-7 flex h-32 w-32 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-[#FADDE4]/20 animate-ping" />
          <span className="absolute inset-3 rounded-full border-2 border-[#E8A8B7]/60 bg-[#D47E93]/25 animate-pulse" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#E8A8B7] to-[#D47E93] text-white shadow-2xl shadow-[#D47E93]/40 animate-bounce">
            <BellRing className="h-12 w-12" />
          </div>
        </div>

        <h2
          id="active-alarm-title"
          className="text-3xl font-black leading-snug tracking-tight text-white drop-shadow-sm"
        >
          {alarm.displayTitle}
        </h2>

        <p className="mt-3 rounded-2xl border border-[#F3DCE2]/25 bg-white/10 px-4 py-2.5 text-sm font-bold text-[#FFF8FA]">
          🔊 {alarm.phrase}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-sm space-y-3">
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-[56px] w-full rounded-2xl bg-red-600 px-6 py-4 text-base font-black text-white shadow-xl shadow-red-950/50 transition hover:bg-red-700 active:scale-[0.98]"
        >
          إيقاف المنبه 🛑
        </button>

        <button
          type="button"
          onClick={onSnooze}
          className="min-h-[48px] w-full rounded-2xl border border-[#F3DCE2]/35 bg-[#FADDE4]/15 px-5 py-3 text-sm font-extrabold text-[#FFF8FA] transition hover:bg-[#FADDE4]/25 active:scale-[0.98]"
        >
          غفوة 5 دقائق 💤
        </button>
      </div>
    </div>
  );
}
