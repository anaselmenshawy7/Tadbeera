import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeMonthlyFinance, isFinanceTransaction } from '../src/features/finance/financeModels';
import { getLowStockItems, getExpiringInventoryItems, isInventoryItem } from '../src/features/inventory/inventoryModels';
import { sortHouseholdTasks, isHouseholdTask } from '../src/features/household/householdTaskModels';
import { getSavingsProgress, isSavingsGoal } from '../src/features/savings/savingsModels';
import {
  ARABIC_WEEKDAY_OPTIONS,
  REMINDER_REPEAT_OPTIONS,
  REMINDER_SOUND_OPTIONS,
  formatMinuteKey,
  formatReminderScheduleBadge,
  getNextOccurrenceTimestamp,
  getReminderSoundOption,
  isCustomReminder,
  normalizeRepeatDays,
  resolveReminderRepeatType,
  resolveReminderSoundProfile,
} from '../src/features/household/customReminderModels';

test('monthly finance summary ignores other months and computes balance', () => {
  const summary = summarizeMonthlyFinance([
    { id: '1', type: 'income', amount: 10000, categoryId: 'salary', description: 'راتب', date: '2026-10-01' },
    { id: '2', type: 'expense', amount: 2500, categoryId: 'food', description: 'طعام', date: '2026-10-02' },
    { id: '3', type: 'expense', amount: 500, categoryId: 'food', description: 'قديم', date: '2026-09-30' }
  ], '2026-10');
  assert.equal(summary.income, 10000);
  assert.equal(summary.expenses, 2500);
  assert.equal(summary.balance, 7500);
  assert.equal(summary.savingsRate, 75);
});

test('inventory validators and low-stock/expiry selectors work', () => {
  const items = [
    { id: 'a', name: 'أرز', quantity: 1, unit: 'كيلو' as const, minimumQuantity: 2, updatedAt: '2026-10-01', expiresOn: null },
    { id: 'b', name: 'لبن', quantity: 4, unit: 'لتر' as const, minimumQuantity: 1, updatedAt: '2026-10-01', expiresOn: '2026-10-31' }
  ];
  assert.equal(isInventoryItem(items[0]), true);
  assert.equal(isInventoryItem({ ...items[0], quantity: Number.NaN }), false);
  assert.deepEqual(getLowStockItems(items).map(x => x.id), ['a']);
  assert.deepEqual(getExpiringInventoryItems(items, 7, new Date('2026-10-30T12:00:00Z')).map(x => x.id), ['b']);
  assert.deepEqual(getExpiringInventoryItems(items, 0, new Date(2026, 9, 30, 23, 59)).map(x => x.id), []);
});

test('household tasks sort pending before completed and validate shape', () => {
  const tasks = [
    { id: 'done', title: 'منتهية', notes: '', dueDate: null, completed: true, createdAt: '2026-10-01' },
    { id: 'later', title: 'لاحقًا', notes: '', dueDate: '2026-11-01', completed: false, createdAt: '2026-10-01' },
    { id: 'soon', title: 'قريب', notes: '', dueDate: '2026-10-31', completed: false, createdAt: '2026-10-01' }
  ];
  assert.equal(isHouseholdTask(tasks[0]), true);
  assert.deepEqual(sortHouseholdTasks(tasks).map(x => x.id), ['soon', 'later', 'done']);
  const undated = [
    { id: 'b', title: 'ب', notes: '', dueDate: null, completed: false, createdAt: '2026-10-02' },
    { id: 'a', title: 'أ', notes: '', dueDate: null, completed: false, createdAt: '2026-10-01' }
  ];
  assert.deepEqual(sortHouseholdTasks(undated).map(x => x.id), ['a', 'b']);
});

test('savings progress is bounded and marks completed goals', () => {
  const goal = { id: 'g1', title: 'طوارئ', targetAmount: 1000, currentAmount: 1200, targetDate: null, createdAt: '2026-10-01' };
  assert.equal(isSavingsGoal(goal), true);
  assert.deepEqual(getSavingsProgress(goal), { saved: 1000, remaining: 0, percentage: 100, isComplete: true });
  assert.equal(isFinanceTransaction({ id: 'x', type: 'expense', amount: -1, categoryId: 'x', description: '', date: '2026-10-01' }), false);
});

test('custom reminder sound profiles validate safely and keep legacy compatibility', () => {
  assert.deepEqual(
    REMINDER_SOUND_OPTIONS.map(o => [o.value, o.channelId]),
    [
      ['alarm', 'tedbeera_alarm'],
      ['gentle', 'tedbeera_gentle'],
      ['vibrate', 'tedbeera_vibrate'],
    ]
  );

  const legacyReminder = {
    id: 'rem-1',
    notificationId: 1200,
    title: 'أصحي جوزي من النوم',
    date: '2026-11-20',
    time: '06:30',
    leadMinutes: 5,
    enabled: true,
    createdAt: '2026-11-17T10:00:00.000Z',
  };
  assert.equal(isCustomReminder(legacyReminder), true);
  assert.equal(resolveReminderSoundProfile(undefined), 'gentle');
  assert.equal(resolveReminderRepeatType(undefined), 'once');
  assert.equal(getReminderSoundOption(undefined).badgeLabel, '🎵 رنة هادئة');

  assert.equal(isCustomReminder({ ...legacyReminder, soundProfile: 'alarm', repeatType: 'daily' }), true);
  assert.equal(
    isCustomReminder({ ...legacyReminder, soundProfile: 'vibrate', repeatType: 'weekly', repeatDays: [0, 2, 4] }),
    true
  );
  assert.equal(isCustomReminder({ ...legacyReminder, soundProfile: 'invalid_sound' }), false);
  assert.equal(isCustomReminder({ ...legacyReminder, repeatType: 'hourly' }), false);
  assert.equal(isCustomReminder({ ...legacyReminder, repeatType: 'weekly', repeatDays: [7] }), false);
  assert.equal(getReminderSoundOption('alarm').channelId, 'tedbeera_alarm');
  assert.equal(getReminderSoundOption('vibrate').badgeLabel, '📳 اهتزاز فقط');
});

test('recurring reminder schedules calculate deterministic next occurrences and prevent same-minute loops', () => {
  assert.deepEqual(
    REMINDER_REPEAT_OPTIONS.map(o => o.value),
    ['once', 'daily', 'weekly']
  );
  assert.deepEqual(
    ARABIC_WEEKDAY_OPTIONS.map(d => [d.label, d.value]),
    [
      ['السبت', 6],
      ['الأحد', 0],
      ['الإثنين', 1],
      ['الثلاثاء', 2],
      ['الأربعاء', 3],
      ['الخميس', 4],
      ['الجمعة', 5],
    ]
  );

  // Tuesday Nov 17, 2026 at 02:30 AM local
  const nowBefore = new Date(2026, 10, 17, 2, 30, 0, 0);
  const dailyReminder = {
    date: '2026-11-17',
    time: '02:44',
    leadMinutes: 5 as const, // target alert at 02:39
    repeatType: 'daily' as const,
  };

  // 1. Daily before alert time -> today at 02:39
  const nextToday = getNextOccurrenceTimestamp(dailyReminder, nowBefore);
  assert.equal(nextToday, new Date(2026, 10, 17, 2, 39, 0, 0).getTime());

  // 2. Daily after alert time -> tomorrow (Wed Nov 18) at 02:39
  const nowAfter = new Date(2026, 10, 17, 2, 40, 0, 0);
  const nextTomorrow = getNextOccurrenceTimestamp(dailyReminder, nowAfter);
  assert.equal(nextTomorrow, new Date(2026, 10, 18, 2, 39, 0, 0).getTime());

  // 3. Same-minute dismiss guard: even if clock is 02:38:59 (before 02:39:00), matching lastTriggeredMinuteKey skips today
  const sameMinuteGuard = getNextOccurrenceTimestamp(
    {
      ...dailyReminder,
      lastTriggeredMinuteKey: formatMinuteKey(new Date(2026, 10, 17, 2, 39, 0, 0)),
    },
    new Date(2026, 10, 17, 2, 38, 30, 0)
  );
  assert.equal(sameMinuteGuard, new Date(2026, 10, 18, 2, 39, 0, 0).getTime());

  // 4. Weekly: Tuesday Nov 17, 2026 -> selected Sun (0), Thu (4) -> nearest is Thursday Nov 19 at 02:44
  const weeklyNext = getNextOccurrenceTimestamp(
    {
      date: '2026-11-17',
      time: '02:44',
      leadMinutes: 0,
      repeatType: 'weekly',
      repeatDays: [0, 4],
    },
    nowBefore
  );
  assert.equal(weeklyNext, new Date(2026, 10, 19, 2, 44, 0, 0).getTime());

  // 5. Weekly midnight crossover: Saturday Nov 21, 2026 at 23:30 with Sunday 00:15 event & 30m lead -> Saturday 23:45
  const saturdayNight = new Date(2026, 10, 21, 23, 30, 0, 0);
  const crossMidnight = getNextOccurrenceTimestamp(
    {
      date: '2026-11-21',
      time: '00:15',
      leadMinutes: 30,
      repeatType: 'weekly',
      repeatDays: [0], // Sunday
    },
    saturdayNight
  );
  assert.equal(crossMidnight, new Date(2026, 10, 21, 23, 45, 0, 0).getTime());

  // 6. Schedule badge formatting
  assert.equal(
    formatReminderScheduleBadge({
      date: '2026-11-17',
      time: '02:44',
      repeatType: 'daily',
    }),
    'يومياً • الساعة 2:44 ص'
  );
  assert.equal(
    formatReminderScheduleBadge({
      date: '2026-11-17',
      time: '02:44',
      repeatType: 'weekly',
      repeatDays: normalizeRepeatDays([4, 0, 2]),
    }),
    'كل: الأحد، الثلاثاء، الخميس • 2:44 ص'
  );
});

