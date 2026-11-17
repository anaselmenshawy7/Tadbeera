export type ReminderLeadMinutes = 0 | 5 | 15 | 30 | 60;

export interface CustomReminder {
  id: string;
  notificationId: number;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  leadMinutes: ReminderLeadMinutes;
  enabled: boolean;
  createdAt: string;
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
    typeof r.enabled === 'boolean' &&
    typeof r.createdAt === 'string'
  );
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

export function sortCustomReminders(reminders: CustomReminder[]): CustomReminder[] {
  return [...reminders].sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    const keyA = `${a.date}T${a.time}`;
    const keyB = `${b.date}T${b.time}`;
    return keyA.localeCompare(keyB) || a.createdAt.localeCompare(b.createdAt);
  });
}
