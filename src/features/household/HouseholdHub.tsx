import { useEffect, useState } from 'react';
import { Bell, BellOff, CalendarClock, CheckCircle2, Plus, Sparkles, Trash2, Volume2 } from 'lucide-react';
import { householdTasksRepository } from './householdTaskRepository';
import { sortHouseholdTasks, type HouseholdTask } from './householdTaskModels';
import { savingsGoalsRepository } from '../savings/savingsRepository';
import { getSavingsProgress, type SavingsGoal } from '../savings/savingsModels';
import { customRemindersRepository } from './customReminderRepository';
import {
  REMINDER_LEAD_TIME_OPTIONS,
  REMINDER_SOUND_OPTIONS,
  REMINDER_TITLE_SUGGESTIONS,
  computeReminderAlertDate,
  formatArabicShortDate,
  formatArabicTime12h,
  getLeadTimeLabel,
  getReminderSoundOption,
  resolveReminderSoundProfile,
  sortCustomReminders,
  stableNotificationId,
  type CustomReminder,
  type ReminderLeadMinutes,
  type ReminderSoundProfile,
} from './customReminderModels';
import {
  getChannelIdForSoundProfile,
  getLocalNotificationService,
} from '../../services/localNotificationService';
import {
  isAlarmLoopActive,
  previewReminderSound,
  stopReminderSoundPreview,
} from '../../services/reminderSoundPreview';

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const defaultTimePlusHour = () => {
  const next = new Date(Date.now() + 60 * 60 * 1000);
  return `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`;
};

export interface HouseholdHubProps {
  onNotify?: (message: string) => void;
}

export function HouseholdHub({ onNotify }: HouseholdHubProps) {
  const [reminders, setReminders] = useState<CustomReminder[]>(() =>
    sortCustomReminders(customRemindersRepository.read())
  );
  const [tasks, setTasks] = useState<HouseholdTask[]>(() =>
    sortHouseholdTasks(householdTasksRepository.read())
  );
  const [goals, setGoals] = useState<SavingsGoal[]>(() => savingsGoalsRepository.read());

  // Custom Smart Reminder Form State
  const [remTitle, setRemTitle] = useState('');
  const [remDate, setRemDate] = useState(() => todayKey());
  const [remTime, setRemTime] = useState(() => defaultTimePlusHour());
  const [remLead, setRemLead] = useState<ReminderLeadMinutes>(5);
  const [remSound, setRemSound] = useState<ReminderSoundProfile>('gentle');
  const [isPreviewingSound, setIsPreviewingSound] = useState(false);
  const [remStatusMsg, setRemStatusMsg] = useState<string | null>(null);

  // Household Task Form State (with optional date/time & lead-time scheduling)
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskDueTime, setTaskDueTime] = useState('');
  const [taskLead, setTaskLead] = useState<ReminderLeadMinutes>(15);

  // Savings Goals Form State
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [contributions, setContributions] = useState<Record<string, string>>({});

  const persistReminders = (next: CustomReminder[]) => {
    const sorted = sortCustomReminders(next);
    setReminders(sorted);
    customRemindersRepository.write(sorted);
  };

  const persistTasks = (next: HouseholdTask[]) => {
    const sorted = sortHouseholdTasks(next);
    setTasks(sorted);
    householdTasksRepository.write(sorted);
  };

  const persistGoals = (next: SavingsGoal[]) => {
    setGoals(next);
    savingsGoalsRepository.write(next);
  };

  // Sync active future reminders and scheduled tasks on mount
  useEffect(() => {
    const svc = getLocalNotificationService();
    const now = Date.now();
    for (const r of reminders) {
      if (!r.enabled) continue;
      const alertDate = computeReminderAlertDate(r.date, r.time, r.leadMinutes);
      if (alertDate && alertDate.getTime() > now) {
        const soundProfile = resolveReminderSoundProfile(r.soundProfile);
        void svc.scheduleOneOffNotification({
          id: r.notificationId,
          title: `تذكير: ${r.title}`,
          body: `الميعاد ${formatArabicTime12h(r.time)} (${getLeadTimeLabel(r.leadMinutes)})`,
          triggerAt: alertDate,
          soundProfile,
          channelId: getChannelIdForSoundProfile(soundProfile),
          alarmTitle: r.title,
        });
      }
    }
    for (const t of tasks) {
      if (t.completed || !t.dueDate || !t.dueTime || !t.notificationId) continue;
      const alertDate = computeReminderAlertDate(t.dueDate, t.dueTime, t.leadMinutes ?? 0);
      if (alertDate && alertDate.getTime() > now) {
        void svc.scheduleOneOffNotification({
          id: t.notificationId,
          title: `مهمة البيت: ${t.title}`,
          body: `موعدها الساعة ${formatArabicTime12h(t.dueTime)}`,
          triggerAt: alertDate,
          soundProfile: 'gentle',
          channelId: getChannelIdForSoundProfile('gentle'),
          alarmTitle: t.title,
        });
      }
    }
    return () => {
      if (!isAlarmLoopActive()) {
        stopReminderSoundPreview();
      }
    };
  }, []);

  const previewAlertDate = computeReminderAlertDate(remDate, remTime, remLead);
  const selectedSoundOption = getReminderSoundOption(remSound);

  const handlePreviewSound = async () => {
    setIsPreviewingSound(true);
    try {
      const result = await previewReminderSound(remSound, remTitle);
      onNotify?.(result.message);
    } finally {
      if (remSound === 'alarm') {
        setIsPreviewingSound(isAlarmLoopActive());
      } else {
        setTimeout(() => setIsPreviewingSound(false), 950);
      }
    }
  };

  const handleAddReminder = async () => {
    const title = remTitle.trim();
    if (!title) {
      onNotify?.('اكتبي اسم التذكير أو اختاري من الاقتراحات الأول');
      return;
    }
    if (!remDate || !remTime) {
      onNotify?.('اختاري التاريخ والميعاد للتنبيه');
      return;
    }
    const alertDate = computeReminderAlertDate(remDate, remTime, remLead);
    if (!alertDate) {
      onNotify?.('تأكدي من صحة التاريخ والميعاد');
      return;
    }

    const id = crypto.randomUUID();
    const notificationId = stableNotificationId(id);
    const newReminder: CustomReminder = {
      id,
      notificationId,
      title,
      date: remDate,
      time: remTime,
      leadMinutes: remLead,
      soundProfile: remSound,
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    persistReminders([newReminder, ...reminders]);
    setRemTitle('');

    const svc = getLocalNotificationService();
    const result = await svc.scheduleOneOffNotification({
      id: notificationId,
      title: `تذكير من تدبيرة: ${title} 🔔`,
      body: `الميعاد ${formatArabicTime12h(remTime)} — ${getLeadTimeLabel(remLead)}`,
      triggerAt: alertDate,
      soundProfile: remSound,
      channelId: getChannelIdForSoundProfile(remSound),
      alarmTitle: title,
    });
    const alertText = `هيوصلك الإشعار ${formatArabicShortDate(alertDate)} الساعة ${formatArabicTime12h(alertDate)}`;
    setRemStatusMsg(`${result.message} (${alertText})`);
    onNotify?.(result.scheduled ? `تم حفظ التنبيه (${selectedSoundOption.label})! ${alertText}` : result.message);
  };

  const handleToggleReminder = async (reminder: CustomReminder) => {
    const nextEnabled = !reminder.enabled;
    persistReminders(
      reminders.map(r => (r.id === reminder.id ? { ...r, enabled: nextEnabled } : r))
    );
    const svc = getLocalNotificationService();
    if (nextEnabled) {
      const alertDate = computeReminderAlertDate(reminder.date, reminder.time, reminder.leadMinutes);
      if (alertDate && alertDate.getTime() > Date.now()) {
        const soundProfile = resolveReminderSoundProfile(reminder.soundProfile);
        const res = await svc.scheduleOneOffNotification({
          id: reminder.notificationId,
          title: `تذكير من تدبيرة: ${reminder.title} 🔔`,
          body: `الميعاد ${formatArabicTime12h(reminder.time)} — ${getLeadTimeLabel(reminder.leadMinutes)}`,
          triggerAt: alertDate,
          soundProfile,
          channelId: getChannelIdForSoundProfile(soundProfile),
          alarmTitle: reminder.title,
        });
        onNotify?.(res.message);
      } else {
        onNotify?.('ميعاد التذكير عدّى، عدّلي الوقت أو أضيفي تذكير جديد');
      }
    } else {
      await svc.cancelOneOffNotification(reminder.notificationId);
      onNotify?.('تم إيقاف التنبيه مؤقتاً');
    }
  };

  const handleDeleteReminder = async (reminder: CustomReminder) => {
    await getLocalNotificationService().cancelOneOffNotification(reminder.notificationId);
    persistReminders(reminders.filter(r => r.id !== reminder.id));
    onNotify?.('تم حذف التذكير');
  };

  const addTask = async () => {
    const title = taskTitle.trim();
    if (!title) return;
    const id = crypto.randomUUID();
    const hasDateTime = Boolean(taskDueDate && taskDueTime);
    const notificationId = hasDateTime ? stableNotificationId(`task_${id}`) : undefined;

    const newTask: HouseholdTask = {
      id,
      title,
      notes: '',
      dueDate: taskDueDate || null,
      dueTime: taskDueDate && taskDueTime ? taskDueTime : null,
      leadMinutes: hasDateTime ? taskLead : undefined,
      notificationId,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    persistTasks([...tasks, newTask]);
    setTaskTitle('');
    setTaskDueDate('');
    setTaskDueTime('');

    if (hasDateTime && notificationId) {
      const alertDate = computeReminderAlertDate(taskDueDate, taskDueTime, taskLead);
      if (alertDate && alertDate.getTime() > Date.now()) {
        const res = await getLocalNotificationService().scheduleOneOffNotification({
          id: notificationId,
          title: `مهمة البيت: ${title} ✅`,
          body: `موعد المهمة ${formatArabicTime12h(taskDueTime)}`,
          triggerAt: alertDate,
        });
        onNotify?.(
          res.scheduled
            ? `تمت إضافة المهمة وهيوصلك إشعارها الساعة ${formatArabicTime12h(alertDate)}`
            : res.message
        );
        return;
      }
    }
    onNotify?.('تمت إضافة المهمة لقائمة البيت ✅');
  };

  const handleToggleTask = async (task: HouseholdTask, completed: boolean) => {
    persistTasks(tasks.map(t => (t.id === task.id ? { ...t, completed } : t)));
    if (task.notificationId) {
      const svc = getLocalNotificationService();
      if (completed) {
        await svc.cancelOneOffNotification(task.notificationId);
      } else if (task.dueDate && task.dueTime) {
        const alertDate = computeReminderAlertDate(task.dueDate, task.dueTime, task.leadMinutes ?? 0);
        if (alertDate && alertDate.getTime() > Date.now()) {
          await svc.scheduleOneOffNotification({
            id: task.notificationId,
            title: `مهمة البيت: ${task.title} ✅`,
            body: `موعد المهمة ${formatArabicTime12h(task.dueTime)}`,
            triggerAt: alertDate,
          });
        }
      }
    }
  };

  const handleDeleteTask = async (task: HouseholdTask) => {
    if (task.notificationId) {
      await getLocalNotificationService().cancelOneOffNotification(task.notificationId);
    }
    persistTasks(tasks.filter(t => t.id !== task.id));
  };

  const addGoal = () => {
    const title = goalTitle.trim();
    const targetAmount = Number(goalTarget);
    if (!title || !Number.isFinite(targetAmount) || targetAmount <= 0) return;
    persistGoals([
      ...goals,
      {
        id: crypto.randomUUID(),
        title,
        targetAmount,
        currentAmount: 0,
        targetDate: null,
        createdAt: new Date().toISOString(),
      },
    ]);
    setGoalTitle('');
    setGoalTarget('');
  };

  const addContribution = (goal: SavingsGoal) => {
    const amount = Number(contributions[goal.id] || 0);
    if (!Number.isFinite(amount) || amount <= 0) return;
    persistGoals(
      goals.map(g => (g.id === goal.id ? { ...g, currentAmount: g.currentAmount + amount } : g))
    );
    setContributions(prev => ({ ...prev, [goal.id]: '' }));
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="rounded-2xl border border-[#DCE5D3] bg-[#F1F5EC] p-3.5">
        <h3 className="font-extrabold text-sm text-[#1E5631]">البيت والمواعيد 🏠</h3>
        <p className="mt-1 text-[11px] text-[#5C6650]">
          تنبيهاتك الخاصة، مهام البيت اليومية، وأهداف التحويش — كلها محفوظة على موبايلك وتنبهك في ميعادها.
        </p>
      </div>

      {/* 1. Custom Smart Reminders (التنبيهات والتذكيرات الخاصة) */}
      <section className="rounded-2xl border border-[#E4DECF] bg-white p-3.5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-[#EEF6EE] text-[#1E5631] flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </span>
            <div>
              <h4 className="font-extrabold text-sm text-[#1E5631]">التنبيهات والتذكيرات الخاصة</h4>
              <p className="text-[11px] text-gray-500">إضافة تنبيه جديد بميعاده وإشعار أوتوماتيك قبله</p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-[#1E5631] bg-[#EEF6EE] px-2 py-0.5 rounded-lg">
            {reminders.filter(r => r.enabled).length} شغّال
          </span>
        </div>

        {/* Title Suggestions */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-[#5C6650] flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            اختيارات سريعة:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {REMINDER_TITLE_SUGGESTIONS.map(suggestion => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setRemTitle(suggestion);
                  if (suggestion === 'أصحي جوزي من النوم') {
                    setRemSound('alarm');
                  }
                }}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition ${
                  remTitle === suggestion
                    ? 'bg-[#1E5631] text-white border-[#1E5631]'
                    : 'bg-[#F8F5ED] text-[#4B553F] border-[#E4DECF] hover:border-[#1E5631]'
                }`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Add New Reminder Form */}
        <div className="rounded-xl border border-[#EFE9DA] bg-[#FCFBF7] p-3 space-y-2.5">
          <div className="text-xs font-extrabold text-[#454A3C]">إضافة تنبيه جديد</div>
          <input
            type="text"
            value={remTitle}
            onChange={e => setRemTitle(e.target.value)}
            placeholder="مثال: أصحي جوزي من النوم / عندي مشوار"
            maxLength={90}
            className="w-full rounded-xl border border-[#DDD5C3] bg-white p-2.5 text-xs focus:outline-none focus:border-[#1E5631]"
          />

          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-bold text-gray-600">
              التاريخ
              <input
                type="date"
                value={remDate}
                min={todayKey()}
                onChange={e => setRemDate(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-[#DDD5C3] bg-white p-2 text-xs focus:outline-none focus:border-[#1E5631]"
              />
            </label>
            <label className="text-[11px] font-bold text-gray-600">
              الميعاد
              <input
                type="time"
                value={remTime}
                onChange={e => setRemTime(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-[#DDD5C3] bg-white p-2 text-xs focus:outline-none focus:border-[#1E5631]"
              />
            </label>
          </div>

          <label className="block text-[11px] font-bold text-gray-600">
            إمتى يوصلك الإشعار؟
            <select
              value={remLead}
              onChange={e => setRemLead(Number(e.target.value) as ReminderLeadMinutes)}
              className="mt-1 block w-full rounded-xl border border-[#DDD5C3] bg-white p-2.5 text-xs font-bold text-[#1E5631] focus:outline-none focus:border-[#1E5631]"
            >
              {REMINDER_LEAD_TIME_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {/* Sound Profile Selector + Preview */}
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-gray-600">نوع صوت التنبيه</span>
              <button
                type="button"
                onClick={() => void handlePreviewSound()}
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-extrabold transition ${
                  isPreviewingSound
                    ? 'border-[#1E5631] bg-[#1E5631] text-white'
                    : 'border-[#D4C7AE] bg-white hover:bg-[#FAF6EC] text-[#1E5631]'
                }`}
              >
                <Volume2 className="w-3 h-3 shrink-0" />
                <span>جرّب الصوت 🔊</span>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="نوع صوت التنبيه">
              {REMINDER_SOUND_OPTIONS.map(option => {
                const isSelected = remSound === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setRemSound(option.value)}
                    className={`rounded-xl border px-2 py-2 text-[11px] font-extrabold transition flex items-center justify-center gap-1 ${
                      isSelected
                        ? option.value === 'alarm'
                          ? 'bg-[#FFF3E0] border-[#D97706] text-[#9A3412] shadow-xs'
                          : option.value === 'vibrate'
                            ? 'bg-[#EEF2F6] border-[#64748B] text-[#334155] shadow-xs'
                            : 'bg-[#EEF6EE] border-[#1E5631] text-[#1E5631] shadow-xs'
                        : 'bg-white border-[#DDD5C3] text-gray-600 hover:border-[#1E5631]/60'
                    }`}
                  >
                    <span>{option.emoji}</span>
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-500">{selectedSoundOption.description}</p>
          </div>

          {previewAlertDate && (
            <div className="rounded-lg bg-[#EEF6EE] border border-[#DCE5D3] px-2.5 py-1.5 text-[11px] text-[#1E5631] font-bold flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 shrink-0" />
              <span>
                الميعاد: {formatArabicTime12h(remTime)} ← الإشعار هيوصلك الساعة{' '}
                {formatArabicTime12h(previewAlertDate)} ({formatArabicShortDate(previewAlertDate)})
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleAddReminder()}
            className="w-full min-h-[42px] rounded-xl bg-[#1E5631] hover:bg-[#2E7D32] text-white text-xs font-extrabold py-2.5 px-3 transition flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>حفظ وتفعيل التنبيه</span>
          </button>

          {remStatusMsg && (
            <p className="text-[11px] font-semibold text-[#1E5631] bg-[#F1F5EC] rounded-lg p-2">
              {remStatusMsg}
            </p>
          )}
        </div>

        {/* Reminders List */}
        {reminders.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-2">
            لسه مفيش تنبيهات خاصة. ضيفي ميعاد مهم فوق وهنفكرك قبله أوتوماتيك.
          </p>
        ) : (
          <div className="space-y-2">
            {reminders.map(reminder => {
              const alertDate = computeReminderAlertDate(
                reminder.date,
                reminder.time,
                reminder.leadMinutes
              );
              const isPast = alertDate ? alertDate.getTime() <= Date.now() : false;
              const soundOption = getReminderSoundOption(reminder.soundProfile);
              const soundBadgeClass =
                soundOption.value === 'alarm'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : soundOption.value === 'vibrate'
                    ? 'bg-slate-100 text-slate-700 border-slate-200'
                    : 'bg-[#EEF6EE] text-[#1E5631] border-[#DCE5D3]';
              return (
                <div
                  key={reminder.id}
                  className={`rounded-xl border p-3 transition ${
                    reminder.enabled
                      ? 'border-[#DCE5D3] bg-[#FAFDF8]'
                      : 'border-gray-200 bg-gray-50 opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <strong className="text-xs font-extrabold text-gray-900">
                          {reminder.title}
                        </strong>
                        <span
                          className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${soundBadgeClass}`}
                        >
                          {soundOption.badgeLabel}
                        </span>
                        {isPast && reminder.enabled && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            عدّى ميعاده
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-600">
                        الميعاد: <span className="font-bold text-gray-800">{formatArabicShortDate(reminder.date)} • {formatArabicTime12h(reminder.time)}</span>
                      </div>
                      {alertDate && (
                        <div className="text-[11px] font-bold text-[#1E5631] flex items-center gap-1">
                          <Bell className="w-3 h-3 shrink-0" />
                          <span>
                            الإشعار: {formatArabicShortDate(alertDate)} الساعة {formatArabicTime12h(alertDate)} ({getLeadTimeLabel(reminder.leadMinutes)})
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleToggleReminder(reminder)}
                        className={`p-2 rounded-lg border text-xs transition ${
                          reminder.enabled
                            ? 'border-[#1E5631] bg-[#EEF6EE] text-[#1E5631]'
                            : 'border-gray-300 bg-white text-gray-500'
                        }`}
                        title={reminder.enabled ? 'إيقاف التنبيه' : 'تفعيل التنبيه'}
                        aria-label={reminder.enabled ? 'إيقاف التنبيه' : 'تفعيل التنبيه'}
                      >
                        {reminder.enabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteReminder(reminder)}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition"
                        title="حذف التنبيه"
                        aria-label="حذف التنبيه"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. Household Tasks (مهام البيت) */}
      <section className="rounded-2xl border border-[#E4DECF] bg-white p-3.5 space-y-3 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-[#F4EEE2] text-[#765B3A] flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </span>
          <div>
            <h4 className="font-extrabold text-sm text-[#1E5631]">مهام البيت ✅</h4>
            <p className="text-[11px] text-gray-500">اكتبي مهامك اليومية ولو حددتيلها ميعاد وساعة هنفكرك أوتوماتيك</p>
          </div>
        </div>

        <div className="space-y-2">
          <input
            value={taskTitle}
            onChange={e => setTaskTitle(e.target.value)}
            placeholder="مثال: ترتيب المطبخ / غسيل الستاير"
            maxLength={100}
            className="w-full rounded-xl border border-[#DDD5C3] p-2.5 text-xs focus:outline-none focus:border-[#1E5631]"
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-gray-600 font-semibold">
              التاريخ (اختياري)
              <input
                type="date"
                value={taskDueDate}
                min={todayKey()}
                onChange={e => setTaskDueDate(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-[#DDD5C3] p-2 text-xs focus:outline-none focus:border-[#1E5631]"
                aria-label="تاريخ المهمة"
              />
            </label>
            <label className="text-[11px] text-gray-600 font-semibold">
              الساعة (اختياري للتنبيه)
              <input
                type="time"
                value={taskDueTime}
                onChange={e => setTaskDueTime(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-[#DDD5C3] p-2 text-xs focus:outline-none focus:border-[#1E5631]"
                aria-label="ساعة المهمة"
              />
            </label>
          </div>

          {taskDueDate && taskDueTime && (
            <label className="block text-[11px] font-bold text-gray-600">
              إمتى يوصلك إشعار المهمة؟
              <select
                value={taskLead}
                onChange={e => setTaskLead(Number(e.target.value) as ReminderLeadMinutes)}
                className="mt-1 block w-full rounded-xl border border-[#DDD5C3] bg-white p-2 text-xs font-bold text-[#1E5631] focus:outline-none focus:border-[#1E5631]"
              >
                {REMINDER_LEAD_TIME_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <button
          type="button"
          onClick={() => void addTask()}
          className="w-full min-h-[40px] rounded-xl bg-[#1E5631] hover:bg-[#2E7D32] p-2 text-xs font-bold text-white transition"
        >
          إضافة مهمة
        </button>

        {tasks.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-1">ضيفي أول مهمة للبيت.</p>
        ) : (
          tasks.map(task => {
            const taskAlert =
              task.dueDate && task.dueTime
                ? computeReminderAlertDate(task.dueDate, task.dueTime, task.leadMinutes ?? 0)
                : null;
            return (
              <div key={task.id} className="flex items-start gap-2 border-t border-[#EFE9DA] pt-2.5 text-xs">
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={e => void handleToggleTask(task, e.target.checked)}
                  className="mt-1"
                />
                <span className={task.completed ? 'flex-1 text-gray-400 line-through' : 'flex-1'}>
                  <strong className="block text-gray-900">{task.title}</strong>
                  <small className="block text-gray-500 mt-0.5">
                    {task.dueDate
                      ? `${formatArabicShortDate(task.dueDate)}${task.dueTime ? ` • ${formatArabicTime12h(task.dueTime)}` : ''}`
                      : 'بدون موعد محدد'}
                  </small>
                  {taskAlert && !task.completed && (
                    <small className="block text-[#1E5631] font-bold mt-0.5">
                      🔔 الإشعار: {formatArabicShortDate(taskAlert)} الساعة {formatArabicTime12h(taskAlert)} ({getLeadTimeLabel(task.leadMinutes ?? 0)})
                    </small>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => void handleDeleteTask(task)}
                  className="text-red-600 font-semibold px-1"
                >
                  حذف
                </button>
              </div>
            );
          })
        )}
      </section>

      {/* 3. Savings Goals (أهداف التوفير) */}
      <section className="rounded-2xl border border-[#E4DECF] bg-white p-3.5 space-y-3 shadow-xs">
        <h4 className="font-extrabold text-sm text-[#1E5631]">أهداف التوفير (التحويش) 🪙</h4>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={goalTitle}
            onChange={e => setGoalTitle(e.target.value)}
            placeholder="اسم الهدف"
            maxLength={70}
            className="rounded-xl border border-[#DDD5C3] p-2 text-xs min-w-0 focus:outline-none focus:border-[#1E5631]"
          />
          <input
            value={goalTarget}
            onChange={e => setGoalTarget(e.target.value)}
            type="number"
            min="1"
            placeholder="المبلغ بالجنيه"
            className="rounded-xl border border-[#DDD5C3] p-2 text-xs min-w-0 focus:outline-none focus:border-[#1E5631]"
          />
        </div>
        <button
          type="button"
          onClick={addGoal}
          className="w-full min-h-[40px] rounded-xl bg-[#1E5631] hover:bg-[#2E7D32] p-2 text-xs font-bold text-white transition"
        >
          إنشاء هدف توفير
        </button>
        {goals.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-1">حدد هدفًا مثل مصاريف المدرسة أو جهاز جديد.</p>
        ) : (
          goals.map(goal => {
            const progress = getSavingsProgress(goal);
            return (
              <div key={goal.id} className="space-y-2 border-t border-[#EFE9DA] pt-2">
                <div className="flex justify-between gap-2 text-xs tabular-nums">
                  <strong>{goal.title}</strong>
                  <span>
                    {Math.round(progress.saved)} / {goal.targetAmount} ج.م ({progress.percentage}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-[#2E7D32]" style={{ width: progress.percentage + '%' }} />
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    value={contributions[goal.id] || ''}
                    onChange={e => setContributions(prev => ({ ...prev, [goal.id]: e.target.value }))}
                    placeholder="إضافة مبلغ"
                    className="min-w-0 flex-1 rounded-xl border border-[#DDD5C3] p-2 text-xs focus:outline-none focus:border-[#1E5631]"
                  />
                  <button
                    type="button"
                    onClick={() => addContribution(goal)}
                    className="min-h-[38px] rounded-xl bg-[#2E7D32] hover:bg-[#1E5631] px-3 text-xs font-bold text-white transition"
                  >
                    ادخار
                  </button>
                  <button
                    type="button"
                    onClick={() => persistGoals(goals.filter(g => g.id !== goal.id))}
                    className="text-xs text-red-600 font-semibold px-1"
                  >
                    حذف
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
