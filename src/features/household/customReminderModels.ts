export type ReminderLeadMinutes = 0 | 5 | 15 | 30 | 60;

export type ReminderSoundProfile = 'alarm' | 'gentle' | 'vibrate';

export type ReminderRepeatType = 'once' | 'daily' | 'weekly';

export const CUSTOM_REMINDERS_UPDATED_EVENT = 'tedbeeraCustomRemindersUpdated';

export interface ReminderSoundOption {
  value: ReminderSoundProfile;
  channelId: 'tedbeera_alarm' | 'tedbeera_gentle' | 'tedbeera_vibrate';
  label: string;
  emoji: string;
  badgeLabel: string;
  description: string;
}

export const REMINDER_SOUND_OPTIONS: ReadonlyArray<ReminderSoundOption> = [
  {
    value: 'alarm',
    channelId: 'tedbeera_alarm',
    label: 'منبه قوي',
    emoji: '🔔',
    badgeLabel: '🔔 منبه قوي',
    description: 'نغمة منبه واضحة واهتزاز قوي للصحيان والمواعيد المهمة',
  },
  {
    value: 'gentle',
    channelId: 'tedbeera_gentle',
    label: 'رنة هادئة',
    emoji: '🎵',
    badgeLabel: '🎵 رنة هادئة',
    description: 'رنة لطيفة لمهام البيت والمشاوير اليومية',
  },
  {
    value: 'vibrate',
    channelId: 'tedbeera_vibrate',
    label: 'اهتزاز فقط',
    emoji: '📳',
    badgeLabel: '📳 اهتزاز فقط',
    description: 'تنبيه صامت بالاهتزاز فقط بدون صوت',
  },
];

export const REMINDER_REPEAT_OPTIONS: ReadonlyArray<{
  value: ReminderRepeatType;
  label: string;
}> = [
  { value: 'once', label: 'مرة واحدة' },
  { value: 'daily', label: 'كل يوم' },
  { value: 'weekly', label: 'أيام محددة' },
];

export const ARABIC_WEEKDAY_OPTIONS: ReadonlyArray<{
  value: number;
  label: string;
}> = [
  { value: 6, label: 'السبت' },
  { value: 0, label: 'الأحد' },
  { value: 1, label: 'الإثنين' },
  { value: 2, label: 'الثلاثاء' },
  { value: 3, label: 'الأربعاء' },
  { value: 4, label: 'الخميس' },
  { value: 5, label: 'الجمعة' },
];

export interface CustomReminder {
  id: string;
  notificationId: number;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  leadMinutes: ReminderLeadMinutes;
  soundProfile?: ReminderSoundProfile;
  repeatType?: ReminderRepeatType;
  repeatDays?: number[]; // 0 = Sun .. 6 = Sat
  lastTriggeredMinuteKey?: string; // YYYY-MM-DDTHH:mm
  enabled: boolean;
  createdAt: string;
}

export function isReminderSoundProfile(value: unknown): value is ReminderSoundProfile {
  return value === 'alarm' || value === 'gentle' || value === 'vibrate';
}

export function resolveReminderSoundProfile(value?: unknown): ReminderSoundProfile {
  return isReminderSoundProfile(value) ? value : 'gentle';
}

export function isReminderRepeatType(value: unknown): value is ReminderRepeatType {
  return value === 'once' || value === 'daily' || value === 'weekly';
}

export function resolveReminderRepeatType(value?: unknown): ReminderRepeatType {
  return isReminderRepeatType(value) ? value : 'once';
}

export function normalizeRepeatDays(days?: unknown): number[] {
  if (!Array.isArray(days)) return [];
  const unique = new Set<number>();
  for (const d of days) {
    if (typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6) {
      unique.add(d);
    }
  }
  const rtlOrder = new Map(ARABIC_WEEKDAY_OPTIONS.map((opt, idx) => [opt.value, idx]));
  return Array.from(unique).sort((a, b) => (rtlOrder.get(a) ?? a) - (rtlOrder.get(b) ?? b));
}

export function getReminderSoundOption(profile?: unknown): ReminderSoundOption {
  const resolved = resolveReminderSoundProfile(profile);
  return REMINDER_SOUND_OPTIONS.find(opt => opt.value === resolved) || REMINDER_SOUND_OPTIONS[1];
}

export const REMINDER_LEAD_TIME_OPTIONS: ReadonlyArray<{ value: ReminderLeadMinutes; label: string }> = [
  { value: 0, label: 'في نفس الميعاد' },
  { value: 5, label: 'قبلها بـ 5 دقائق' },
  { value: 15, label: 'قبلها بـ 15 دقيقة' },
  { value: 30, label: 'قبلها بـ 30 دقيقة' },
  { value: 60, label: 'قبلها بساعة' },
];

export const REMINDER_TITLE_SUGGESTIONS: ReadonlyArray<string> = [
  'أصحي جوزي من النوم',
  'عندي مشوار',
  'أنزل أشتري طلبات',
  'تنظيف البيت',
];

export function stableNotificationId(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return 1000 + (Math.abs(hash) % 1_900_000_000);
}

export function isCustomReminder(value: unknown): value is CustomReminder {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<CustomReminder>;
  const validSoundProfile = r.soundProfile === undefined || isReminderSoundProfile(r.soundProfile);
  const validRepeatType = r.repeatType === undefined || isReminderRepeatType(r.repeatType);
  const validRepeatDays =
    r.repeatDays === undefined ||
    (Array.isArray(r.repeatDays) &&
      r.repeatDays.every(d => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6));
  const validLastTriggered =
    r.lastTriggeredMinuteKey === undefined || typeof r.lastTriggeredMinuteKey === 'string';
  return (
    typeof r.id === 'string' &&
    r.id.trim().length > 0 &&
    typeof r.notificationId === 'number' &&
    Number.isInteger(r.notificationId) &&
    r.notificationId >= 1000 &&
    typeof r.title === 'string' &&
    r.title.trim().length > 0 &&
    typeof r.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
    typeof r.time === 'string' &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(r.time) &&
    typeof r.leadMinutes === 'number' &&
    [0, 5, 15, 30, 60].includes(r.leadMinutes) &&
    validSoundProfile &&
    validRepeatType &&
    validRepeatDays &&
    validLastTriggered &&
    typeof r.enabled === 'boolean' &&
    typeof r.createdAt === 'string'
  );
}

export function formatMinuteKey(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

/**
 * Computes the exact local Date when the device notification should fire
 * by subtracting leadMinutes from the scheduled event date & time.
 * E.g. 06:00 with 5 min lead -> 05:55; 15:00 with 60 min lead -> 14:00.
 */
export function computeReminderAlertDate(
  dateStr: string,
  timeStr: string,
  leadMinutes: number
): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeStr)) {
    return null;
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  const eventDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (Number.isNaN(eventDate.getTime())) return null;
  const safeLead = Number.isFinite(leadMinutes) && leadMinutes >= 0 ? leadMinutes : 0;
  return new Date(eventDate.getTime() - safeLead * 60 * 1000);
}

/**
 * Deterministic next upcoming alert timestamp (in epoch ms) for once, daily, or weekly reminders.
 * Accounts for leadMinutes and prevents same-minute re-triggers via lastTriggeredMinuteKey.
 */
export function getNextOccurrenceTimestamp(
  reminder: Pick<
    CustomReminder,
    'date' | 'time' | 'leadMinutes' | 'repeatType' | 'repeatDays' | 'lastTriggeredMinuteKey'
  >,
  now: Date | number = new Date()
): number | null {
  const timeMatch = reminder.time.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!timeMatch) return null;

  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const safeLead =
    Number.isFinite(reminder.leadMinutes) && reminder.leadMinutes >= 0 ? reminder.leadMinutes : 0;
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const nowDate = new Date(nowMs);
  const repeatType = resolveReminderRepeatType(reminder.repeatType);
  const blockedMinuteKey = reminder.lastTriggeredMinuteKey;

  if (repeatType === 'once') {
    const alertDate = computeReminderAlertDate(reminder.date, reminder.time, safeLead);
    if (!alertDate) return null;
    if (alertDate.getTime() <= nowMs) return null;
    if (blockedMinuteKey && formatMinuteKey(alertDate) === blockedMinuteKey) return null;
    return alertDate.getTime();
  }

  if (repeatType === 'daily') {
    for (let dayOffset = 0; dayOffset <= 2; dayOffset++) {
      const eventDate = new Date(
        nowDate.getFullYear(),
        nowDate.getMonth(),
        nowDate.getDate() + dayOffset,
        hours,
        minutes,
        0,
        0
      );
      const alertMs = eventDate.getTime() - safeLead * 60 * 1000;
      if (alertMs <= nowMs) continue;
      if (blockedMinuteKey && formatMinuteKey(alertMs) === blockedMinuteKey) continue;
      return alertMs;
    }
    return null;
  }

  // repeatType === 'weekly'
  const selectedDays = normalizeRepeatDays(reminder.repeatDays);
  if (selectedDays.length === 0) return null;
  const selectedDaySet = new Set(selectedDays);

  for (let dayOffset = 0; dayOffset <= 8; dayOffset++) {
    const eventDate = new Date(
      nowDate.getFullYear(),
      nowDate.getMonth(),
      nowDate.getDate() + dayOffset,
      hours,
      minutes,
      0,
      0
    );
    if (!selectedDaySet.has(eventDate.getDay())) continue;
    const alertMs = eventDate.getTime() - safeLead * 60 * 1000;
    if (alertMs <= nowMs) continue;
    if (blockedMinuteKey && formatMinuteKey(alertMs) === blockedMinuteKey) continue;
    return alertMs;
  }

  return null;
}

export function getNextOccurrenceDate(
  reminder: Pick<
    CustomReminder,
    'date' | 'time' | 'leadMinutes' | 'repeatType' | 'repeatDays' | 'lastTriggeredMinuteKey'
  >,
  now: Date | number = new Date()
): Date | null {
  const ts = getNextOccurrenceTimestamp(reminder, now);
  return ts !== null ? new Date(ts) : null;
}

export function formatReminderScheduleBadge(
  reminder: Pick<CustomReminder, 'date' | 'time' | 'repeatType' | 'repeatDays'>
): string {
  const repeatType = resolveReminderRepeatType(reminder.repeatType);
  const formattedTime = formatArabicTime12h(reminder.time);

  if (repeatType === 'daily') {
    return `يومياً • الساعة ${formattedTime}`;
  }

  if (repeatType === 'weekly') {
    const days = normalizeRepeatDays(reminder.repeatDays);
    if (days.length === 0) {
      return `أيام محددة • ${formattedTime}`;
    }
    const labelMap = new Map(ARABIC_WEEKDAY_OPTIONS.map(opt => [opt.value, opt.label]));
    const names = days.map(d => labelMap.get(d) || '').filter(Boolean);
    return `كل: ${names.join('، ')} • ${formattedTime}`;
  }

  return `${formatArabicShortDate(reminder.date)} • ${formattedTime}`;
}

export function formatArabicTime12h(dateOrTime: Date | string): string {
  let hours = 0;
  let minutes = 0;
  if (typeof dateOrTime === 'string') {
    const match = dateOrTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match) return dateOrTime;
    hours = Number(match[1]);
    minutes = Number(match[2]);
  } else {
    hours = dateOrTime.getHours();
    minutes = dateOrTime.getMinutes();
  }
  const period = hours >= 12 ? 'م' : 'ص';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function formatArabicShortDate(date: Date | string): string {
  if (typeof date === 'string') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    const [y, m, d] = date.split('-').map(Number);
    return `${d}/${m}/${y}`;
  }
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

export function getLeadTimeLabel(leadMinutes: number): string {
  const found = REMINDER_LEAD_TIME_OPTIONS.find(o => o.value === leadMinutes);
  return found ? found.label : `قبلها بـ ${leadMinutes} دقيقة`;
}

export function sortCustomReminders(reminders: CustomReminder[], now: number = Date.now()): CustomReminder[] {
  return [...reminders].sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    const nextA = getNextOccurrenceTimestamp(a, now) ?? Number.MAX_SAFE_INTEGER;
    const nextB = getNextOccurrenceTimestamp(b, now) ?? Number.MAX_SAFE_INTEGER;
    if (nextA !== nextB) return nextA - nextB;
    const keyA = `${a.date}T${a.time}`;
    const keyB = `${b.date}T${b.time}`;
    return keyA.localeCompare(keyB) || a.createdAt.localeCompare(b.createdAt);
  });
}
