import { useEffect, useState } from 'react';
import { Bell, BellOff, CalendarClock, Plus, Repeat, Sparkles, Trash2, Volume2 } from 'lucide-react';
import {
  AlarmBell3DIcon,
  Household3DIcon,
  SavingsGold3DIcon,
  Tasks3DIcon,
} from '../../components/Tadbeera3DIcons';
import { householdTasksRepository } from './householdTaskRepository';
import { sortHouseholdTasks, type HouseholdTask } from './householdTaskModels';
import { savingsGoalsRepository } from '../savings/savingsRepository';
import { getSavingsProgress, type SavingsGoal } from '../savings/savingsModels';
import { customRemindersRepository } from './customReminderRepository';
import {
  ARABIC_WEEKDAY_OPTIONS,
  CUSTOM_REMINDERS_UPDATED_EVENT,
  REMINDER_LEAD_TIME_OPTIONS,
  REMINDER_REPEAT_OPTIONS,
  REMINDER_SOUND_OPTIONS,
  REMINDER_TITLE_SUGGESTIONS,
  computeReminderAlertDate,
  formatArabicShortDate,
  formatArabicTime12h,
  formatReminderScheduleBadge,
  getLeadTimeLabel,
  getNextOccurrenceDate,
  getReminderSoundOption,
  normalizeRepeatDays,
  resolveReminderRepeatType,
  resolveReminderSoundProfile,
  sortCustomReminders,
  stableNotificationId,
  type CustomReminder,
  type ReminderLeadMinutes,
  type ReminderRepeatType,
  type ReminderSoundProfile,
} from './customReminderModels';
import {
  getChannelIdForSoundProfile,
  getLocalNotificationService,
  scheduleCustomReminder,
  syncAllActiveCustomReminders,
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
  const [remRepeatType, setRemRepeatType] = useState<ReminderRepeatType>('once');
  const [remRepeatDays, setRemRepeatDays] = useState<number[]>([]);
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

  // Sync active future/recurring reminders and scheduled tasks on mount, plus listen for dismiss updates
  useEffect(() => {
    const svc = getLocalNotificationService();
    const now = Date.now();
    void syncAllActiveCustomReminders(now);

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

    const handleRepoUpdated = () => {
      setReminders(sortCustomReminders(customRemindersRepository.read()));
    };
    window.addEventListener(CUSTOM_REMINDERS_UPDATED_EVENT, handleRepoUpdated);

    return () => {
      window.removeEventListener(CUSTOM_REMINDERS_UPDATED_EVENT, handleRepoUpdated);
      if (!isAlarmLoopActive()) {
        stopReminderSoundPreview();
      }
    };
  }, []);

  const previewAlertDate = getNextOccurrenceDate({
    date: remDate,
    time: remTime,
    leadMinutes: remLead,
    repeatType: remRepeatType,
    repeatDays: remRepeatDays,
  });
  const selectedSoundOption = getReminderSoundOption(remSound);

  const toggleRepeatWeekday = (dayValue: number) => {
    setRemRepeatDays(prev =>
      prev.includes(dayValue)
        ? prev.filter(d => d !== dayValue)
        : normalizeRepeatDays([...prev, dayValue])
    );
  };

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
    if (!remTime) {
      onNotify?.('اختاري الميعاد للتنبيه');
      return;
    }
    if (remRepeatType === 'once' && !remDate) {
      onNotify?.('اختاري التاريخ والميعاد للتنبيه');
      return;
    }
    const normalizedDays = normalizeRepeatDays(remRepeatDays);
    if (remRepeatType === 'weekly' && normalizedDays.length === 0) {
      onNotify?.('اختاري يوماً واحداً على الأقل لتكرار التنبيه');
      return;
    }

    const effectiveDate = remRepeatType === 'once' ? remDate : todayKey();
    const id = crypto.randomUUID();
    const notificationId = stableNotificationId(id);
    const newReminder: CustomReminder = {
      id,
      notificationId,
      title,
      date: effectiveDate,
      time: remTime,
      leadMinutes: remLead,
      soundProfile: remSound,
      repeatType: remRepeatType,
      ...(remRepeatType === 'weekly' ? { repeatDays: normalizedDays } : {}),
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    const alertDate = getNextOccurrenceDate(newReminder);
    if (!alertDate) {
      onNotify?.('تأكدي من أن التاريخ والميعاد في المستقبل');
      return;
    }

    persistReminders([newReminder, ...reminders]);
    setRemTitle('');

    const result = await scheduleCustomReminder(newReminder);
    const alertText = `هيوصلك الإشعار القادم ${formatArabicShortDate(alertDate)} الساعة ${formatArabicTime12h(alertDate)}`;
    setRemStatusMsg(`${result.message} (${alertText})`);
    onNotify?.(result.scheduled ? `تم حفظ التنبيه (${selectedSoundOption.label})! ${alertText}` : result.message);
  };

  const handleToggleReminder = async (reminder: CustomReminder) => {
    const nextEnabled = !reminder.enabled;
    const updatedReminder: CustomReminder = { ...reminder, enabled: nextEnabled };
    persistReminders(
      reminders.map(r => (r.id === reminder.id ? updatedReminder : r))
    );
    const svc = getLocalNotificationService();
    if (nextEnabled) {
      const nextDate = getNextOccurrenceDate(updatedReminder);
      if (nextDate) {
        const res = await scheduleCustomReminder(updatedReminder);
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
    <div className="space-y-4 overflow-x-hidden" dir="rtl">
      {/* Soft-3D Household Hero Banner with Custom Miniature House & Alarm Bell Illustration */}
      <div className="clay-card-soft rounded-[28px] p-4 bg-gradient-to-br from-[#FFF1E8] via-[#FADDE4] to-[#F3DCE2] flex items-center gap-3">
        <span className="clay-icon-well w-13 h-13 rounded-2xl flex items-center justify-center shrink-0">
          <Household3DIcon className="w-10 h-10" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-black text-base text-[#4A353B]">البيت والمواعيد 🏠</h3>
            <span className="rounded-lg bg-[#A8B8A0]/25 border border-[#A8B8A0]/45 px-2 py-0.5 text-[10px] font-extrabold text-[#4A353B]">
              منظم بدون نت
            </span>
          </div>
          <p className="mt-0.5 text-[11px] leading-5 text-[#4A353B]/80">
            تنبيهاتك الخاصة، مهام البيت اليومية، وأهداف التحويش — كلها محفوظة على موبايلك وتنبهك في ميعادها.
          </p>
        </div>
      </div>

      {/* 1. Household Tasks (مهام البيت) */}
      <section className="clay-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="clay-icon-well w-10 h-10 rounded-2xl flex items-center justify-center shrink-0">
              <Tasks3DIcon className="w-7 h-7" />
            </span>
            <div className="min-w-0">
              <h4 className="font-extrabold text-sm text-[#4A353B]">مهام البيت ✅</h4>
              <p className="text-[11px] text-[#8E757C]">اكتبي مهامك اليومية ولو حددتيلها ميعاد وساعة هنفكرك أوتوماتيك</p>
            </div>
          </div>
          <span className="shrink-0 rounded-lg bg-[#A8B8A0]/25 border border-[#A8B8A0]/45 px-2 py-0.5 text-[10px] font-extrabold text-[#4A353B] tabular-nums">
            {tasks.filter(t => !t.completed).length} متبقية
          </span>
        </div>

        <div className="space-y-2">
          <input
            value={taskTitle}
            onChange={e => setTaskTitle(e.target.value)}
            placeholder="مثال: ترتيب المطبخ / غسيل الستاير"
            maxLength={100}
            className="clay-inset w-full text-[#4A353B] p-2.5 text-xs focus:outline-none focus:border-[#D47E93]"
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-[#8E757C] font-semibold min-w-0">
              التاريخ (اختياري)
              <input
                type="date"
                value={taskDueDate}
                min={todayKey()}
                onChange={e => setTaskDueDate(e.target.value)}
                className="clay-inset mt-1 block w-full text-[#4A353B] p-2 text-xs focus:outline-none focus:border-[#D47E93]"
                aria-label="تاريخ المهمة"
              />
            </label>
            <label className="text-[11px] text-[#8E757C] font-semibold min-w-0">
              الساعة (اختياري للتنبيه)
              <input
                type="time"
                value={taskDueTime}
                onChange={e => setTaskDueTime(e.target.value)}
                className="clay-inset mt-1 block w-full text-[#4A353B] p-2 text-xs focus:outline-none focus:border-[#D47E93]"
                aria-label="ساعة المهمة"
              />
            </label>
          </div>

          {taskDueDate && taskDueTime && (
            <label className="block text-[11px] font-bold text-[#8E757C]">
              إمتى يوصلك إشعار المهمة؟
              <select
                value={taskLead}
                onChange={e => setTaskLead(Number(e.target.value) as ReminderLeadMinutes)}
                className="clay-inset mt-1 block w-full p-2 text-xs font-bold text-[#C96D84] focus:outline-none focus:border-[#D47E93]"
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
          className="clay-btn-primary w-full min-h-[42px] p-2.5 text-xs font-extrabold flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة مهمة</span>
        </button>

        {tasks.length === 0 ? (
          <div className="clay-card-cream p-3 text-center text-xs text-[#8E757C]">ضيفي أول مهمة للبيت.</div>
        ) : (
          <div className="space-y-2">
            {tasks.map(task => {
              const taskAlert =
                task.dueDate && task.dueTime
                  ? computeReminderAlertDate(task.dueDate, task.dueTime, task.leadMinutes ?? 0)
                  : null;
              return (
                <div
                  key={task.id}
                  className={`flex items-start gap-2.5 p-3 text-xs rounded-2xl transition ${
                    task.completed ? 'clay-inset opacity-75' : 'clay-card-cream'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={e => void handleToggleTask(task, e.target.checked)}
                    className="mt-1 accent-[#D47E93] h-4 w-4 cursor-pointer shrink-0"
                  />
                  <span className={`min-w-0 flex-1 ${task.completed ? 'text-[#8E757C] line-through' : ''}`}>
                    <strong className="block text-[#4A353B] break-words">{task.title}</strong>
                    <small className="block text-[#8E757C] mt-0.5">
                      {task.dueDate
                        ? `${formatArabicShortDate(task.dueDate)}${task.dueTime ? ` • ${formatArabicTime12h(task.dueTime)}` : ''}`
                        : 'بدون موعد محدد'}
                    </small>
                    {taskAlert && !task.completed && (
                      <small className="block text-[#C96D84] font-bold mt-0.5">
                        🔔 الإشعار: {formatArabicShortDate(taskAlert)} الساعة {formatArabicTime12h(taskAlert)} ({getLeadTimeLabel(task.leadMinutes ?? 0)})
                      </small>
                    )}
                  </span>
                  {task.completed && (
                    <span className="shrink-0 rounded-lg bg-[#A8B8A0]/25 border border-[#A8B8A0]/45 px-2 py-0.5 text-[10px] font-extrabold text-[#4A353B]">
                      تمت ✓
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDeleteTask(task)}
                    className="text-red-600 font-semibold px-1.5 py-0.5 rounded-lg hover:bg-red-50 shrink-0"
                  >
                    حذف
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. Savings Goals (أهداف التوفير) */}
      <section className="clay-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="clay-icon-well w-10 h-10 rounded-2xl flex items-center justify-center shrink-0">
              <SavingsGold3DIcon className="w-7 h-7" />
            </span>
            <div className="min-w-0">
              <h4 className="font-extrabold text-sm text-[#4A353B]">أهداف التوفير (التحويش) 🪙</h4>
              <p className="text-[11px] text-[#8E757C]">حوشي خطوة بخطوة وتابعي نسبة تحقيق كل هدف</p>
            </div>
          </div>
          {goals.length > 0 && (
            <span className="shrink-0 rounded-lg bg-[#D9AE72]/20 border border-[#D9AE72]/45 px-2 py-0.5 text-[10px] font-extrabold text-[#4A353B] tabular-nums">
              {goals.length} أهداف
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input
            value={goalTitle}
            onChange={e => setGoalTitle(e.target.value)}
            placeholder="اسم الهدف"
            maxLength={70}
            className="clay-inset text-[#4A353B] p-2.5 text-xs min-w-0 focus:outline-none focus:border-[#D47E93]"
          />
          <input
            value={goalTarget}
            onChange={e => setGoalTarget(e.target.value)}
            type="number"
            min="1"
            placeholder="المبلغ بالجنيه"
            className="clay-inset text-[#4A353B] p-2.5 text-xs min-w-0 focus:outline-none focus:border-[#D47E93]"
          />
        </div>
        <button
          type="button"
          onClick={addGoal}
          className="clay-btn-primary w-full min-h-[42px] p-2.5 text-xs font-extrabold"
        >
          إنشاء هدف توفير
        </button>
        {goals.length === 0 ? (
          <div className="clay-card-cream p-3 text-center text-xs text-[#8E757C]">حدد هدفًا مثل مصاريف المدرسة أو جهاز جديد.</div>
        ) : (
          <div className="space-y-2.5">
            {goals.map(goal => {
              const progress = getSavingsProgress(goal);
              const isCompleted = progress.percentage >= 100;
              return (
                <div key={goal.id} className="clay-card-cream p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs tabular-nums text-[#4A353B]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <strong className="truncate">{goal.title}</strong>
                      {isCompleted && (
                        <span className="shrink-0 rounded-lg bg-[#A8B8A0]/25 border border-[#A8B8A0]/50 px-1.5 py-0.5 text-[10px] font-extrabold text-[#4A353B]">
                          اكتمل 🎉
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 font-extrabold text-[#C96D84]">
                      {Math.round(progress.saved)} / {goal.targetAmount} ج.م ({progress.percentage}%)
                    </span>
                  </div>
                  <div className="clay-inset h-2.5 rounded-full overflow-hidden p-0.5">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${progress.percentage}%`,
                        background: isCompleted
                          ? 'linear-gradient(90deg, #A8B8A0 0%, #8FA385 100%)'
                          : 'linear-gradient(90deg, #D9AE72 0%, #D47E93 100%)',
                      }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      value={contributions[goal.id] || ''}
                      onChange={e => setContributions(prev => ({ ...prev, [goal.id]: e.target.value }))}
                      placeholder="إضافة مبلغ"
                      className="clay-inset min-w-0 flex-1 text-[#4A353B] p-2 text-xs focus:outline-none focus:border-[#D47E93]"
                    />
                    <button
                      type="button"
                      onClick={() => addContribution(goal)}
                      className="clay-btn-primary min-h-[38px] px-3.5 text-xs font-extrabold shrink-0"
                    >
                      ادخار
                    </button>
                    <button
                      type="button"
                      onClick={() => persistGoals(goals.filter(g => g.id !== goal.id))}
                      className="text-xs text-red-600 font-semibold px-1.5 shrink-0"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Custom Smart Reminders (التنبيهات والتذكيرات الخاصة) */}
      <section className="clay-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="clay-icon-well w-10 h-10 rounded-2xl flex items-center justify-center shrink-0">
              <AlarmBell3DIcon className="w-7 h-7" />
            </span>
            <div className="min-w-0">
              <h4 className="font-extrabold text-sm text-[#4A353B]">التنبيهات والتذكيرات الخاصة</h4>
              <p className="text-[11px] text-[#8E757C]">إضافة تنبيه جديد بميعاده وإشعار أوتوماتيك قبله</p>
            </div>
          </div>
          <span className="shrink-0 text-[11px] font-extrabold text-[#4A353B] bg-[#A8B8A0]/25 border border-[#A8B8A0]/45 px-2.5 py-0.5 rounded-lg tabular-nums">
            {reminders.filter(r => r.enabled).length} شغّال
          </span>
        </div>

        {/* Title Suggestions */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-[#8E757C] flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#D9AE72]" />
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
                className={`clay-tactile px-2.5 py-1.5 rounded-xl text-[11px] font-bold ${
                  remTitle === suggestion
                    ? 'clay-btn-primary'
                    : 'clay-btn-secondary text-[#4A353B]'
                }`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Add New Reminder Form */}
        <div className="clay-inset p-3.5 space-y-2.5">
          <div className="text-xs font-extrabold text-[#4A353B]">إضافة تنبيه جديد</div>
          <input
            type="text"
            value={remTitle}
            onChange={e => setRemTitle(e.target.value)}
            placeholder="مثال: أصحي جوزي من النوم / عندي مشوار"
            maxLength={90}
            className="clay-inset w-full bg-white text-[#4A353B] p-2.5 text-xs focus:outline-none focus:border-[#D47E93]"
          />

          {/* Repeat Schedule 3-Pill Selector */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-[#8E757C] flex items-center gap-1">
              <Repeat className="w-3.5 h-3.5 text-[#C96D84]" />
              تكرار التنبيه
            </span>
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="تكرار التنبيه">
              {REMINDER_REPEAT_OPTIONS.map(option => {
                const isSelected = remRepeatType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setRemRepeatType(option.value)}
                    className={`clay-tactile rounded-xl px-2 py-2 text-[11px] font-extrabold ${
                      isSelected
                        ? 'clay-btn-primary'
                        : 'clay-btn-secondary text-[#8E757C]'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {remRepeatType === 'once' ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-bold text-[#8E757C] min-w-0">
                التاريخ
                <input
                  type="date"
                  value={remDate}
                  min={todayKey()}
                  onChange={e => setRemDate(e.target.value)}
                  className="clay-inset mt-1 block w-full bg-white text-[#4A353B] p-2 text-xs focus:outline-none focus:border-[#D47E93]"
                />
              </label>
              <label className="text-[11px] font-bold text-[#8E757C] min-w-0">
                الميعاد
                <input
                  type="time"
                  value={remTime}
                  onChange={e => setRemTime(e.target.value)}
                  className="clay-inset mt-1 block w-full bg-white text-[#4A353B] p-2 text-xs focus:outline-none focus:border-[#D47E93]"
                />
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-[#8E757C]">
                الميعاد
                <input
                  type="time"
                  value={remTime}
                  onChange={e => setRemTime(e.target.value)}
                  className="clay-inset mt-1 block w-full bg-white text-[#4A353B] p-2 text-xs focus:outline-none focus:border-[#D47E93]"
                />
              </label>

              {remRepeatType === 'weekly' && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-[#8E757C] block">
                    اختاري أيام الأسبوع:
                  </span>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="أيام الأسبوع للتكرار">
                    {ARABIC_WEEKDAY_OPTIONS.map(day => {
                      const isDaySelected = remRepeatDays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          aria-pressed={isDaySelected}
                          onClick={() => toggleRepeatWeekday(day.value)}
                          className={`clay-tactile rounded-xl px-2.5 py-1.5 text-[11px] font-extrabold ${
                            isDaySelected
                              ? 'clay-btn-primary'
                              : 'clay-btn-secondary text-[#4A353B]'
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <label className="block text-[11px] font-bold text-[#8E757C]">
            إمتى يوصلك الإشعار؟
            <select
              value={remLead}
              onChange={e => setRemLead(Number(e.target.value) as ReminderLeadMinutes)}
              className="clay-inset mt-1 block w-full bg-white p-2.5 text-xs font-bold text-[#C96D84] focus:outline-none focus:border-[#D47E93]"
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
              <span className="text-[11px] font-bold text-[#8E757C]">نوع صوت التنبيه</span>
              <button
                type="button"
                onClick={() => void handlePreviewSound()}
                className={`clay-tactile inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-extrabold ${
                  isPreviewingSound
                    ? 'clay-btn-primary'
                    : 'clay-btn-secondary text-[#C96D84]'
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
                    className={`clay-tactile rounded-xl px-2 py-2 text-[11px] font-extrabold flex items-center justify-center gap-1 ${
                      isSelected
                        ? option.value === 'alarm'
                          ? 'clay-btn-gold'
                          : option.value === 'vibrate'
                            ? 'clay-btn-secondary border-[#8E757C] text-[#4A353B]'
                            : 'clay-btn-primary'
                        : 'clay-btn-secondary text-[#8E757C]'
                    }`}
                  >
                    <span>{option.emoji}</span>
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-[#8E757C]">{selectedSoundOption.description}</p>
          </div>

          {previewAlertDate ? (
            <div className="clay-card-cream px-3 py-2 text-[11px] text-[#4A353B] font-bold flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 shrink-0 text-[#C96D84]" />
              <span className="min-w-0">
                الميعاد: {formatArabicTime12h(remTime)} ← الإشعار القادم هيوصلك الساعة{' '}
                {formatArabicTime12h(previewAlertDate)} ({formatArabicShortDate(previewAlertDate)})
              </span>
            </div>
          ) : remRepeatType === 'weekly' && remRepeatDays.length === 0 ? (
            <div className="clay-card-cream px-3 py-2 text-[11px] text-[#8E757C] font-bold">
              اختاري يوماً واحداً على الأقل علشان نحسب ميعاد الإشعار القادم.
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void handleAddReminder()}
            className="clay-btn-primary w-full min-h-[44px] text-xs font-extrabold py-2.5 px-3 flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>حفظ وتفعيل التنبيه</span>
          </button>

          {remStatusMsg && (
            <p className="text-[11px] font-semibold text-[#4A353B] bg-[#A8B8A0]/20 border border-[#A8B8A0]/40 rounded-xl p-2.5">
              {remStatusMsg}
            </p>
          )}
        </div>

        {/* Reminders List */}
        {reminders.length === 0 ? (
          <div className="clay-card-cream p-3 text-xs text-[#8E757C] text-center">
            لسه مفيش تنبيهات خاصة. ضيفي ميعاد مهم فوق وهنفكرك قبله أوتوماتيك.
          </div>
        ) : (
          <div className="space-y-2.5">
            {reminders.map(reminder => {
              const repeatType = resolveReminderRepeatType(reminder.repeatType);
              const nextAlertDate = getNextOccurrenceDate(reminder);
              const oneOffAlertDate =
                repeatType === 'once'
                  ? computeReminderAlertDate(reminder.date, reminder.time, reminder.leadMinutes)
                  : nextAlertDate;
              const isPast =
                repeatType === 'once' && oneOffAlertDate
                  ? oneOffAlertDate.getTime() <= Date.now()
                  : false;
              const soundOption = getReminderSoundOption(reminder.soundProfile);
              const soundBadgeClass =
                soundOption.value === 'alarm'
                  ? 'bg-[#D9AE72]/25 text-[#4A353B] border-[#D9AE72]/55'
                  : soundOption.value === 'vibrate'
                    ? 'bg-[#FFF8FA] text-[#8E757C] border-[#F3DCE2]'
                    : 'bg-[#A8B8A0]/25 text-[#4A353B] border-[#A8B8A0]/45';
              const scheduleBadge = formatReminderScheduleBadge(reminder);

              return (
                <div
                  key={reminder.id}
                  className={`p-3.5 transition ${
                    reminder.enabled
                      ? 'clay-card-cream'
                      : 'clay-inset opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <strong className="text-xs font-extrabold text-[#4A353B] break-words">
                          {reminder.title}
                        </strong>
                        <span
                          className={`inline-flex items-center rounded-lg border px-1.5 py-0.5 text-[10px] font-bold ${soundBadgeClass}`}
                        >
                          {soundOption.badgeLabel}
                        </span>
                        {isPast && reminder.enabled && (
                          <span className="text-[10px] font-bold text-[#C96D84] bg-[#FADDE4] px-1.5 py-0.5 rounded-lg">
                            عدّى ميعاده
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="inline-flex items-center gap-1 rounded-lg border border-[#F3DCE2] bg-[#FADDE4]/70 px-2 py-0.5 text-[11px] font-extrabold text-[#4A353B]">
                          <Repeat className="w-3 h-3 shrink-0 text-[#C96D84]" />
                          <span>{scheduleBadge}</span>
                        </span>
                      </div>

                      {oneOffAlertDate && (
                        <div className="text-[11px] font-bold text-[#C96D84] flex items-center gap-1">
                          <Bell className="w-3 h-3 shrink-0" />
                          <span>
                            {repeatType === 'once' ? 'الإشعار:' : 'الإشعار القادم:'}{' '}
                            {formatArabicShortDate(oneOffAlertDate)} الساعة {formatArabicTime12h(oneOffAlertDate)} ({getLeadTimeLabel(reminder.leadMinutes)})
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={reminder.enabled}
                        onClick={() => void handleToggleReminder(reminder)}
                        className={`clay-tactile inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold ${
                          reminder.enabled
                            ? 'clay-btn-primary'
                            : 'clay-btn-secondary text-[#8E757C]'
                        }`}
                        title={reminder.enabled ? 'إيقاف التنبيه مؤقتاً' : 'تفعيل التنبيه'}
                        aria-label={reminder.enabled ? 'مفعّل — إيقاف التنبيه' : 'متوقف — تفعيل التنبيه'}
                      >
                        {reminder.enabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
                        <span>{reminder.enabled ? 'مفعّل' : 'متوقف'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteReminder(reminder)}
                        className="p-2 rounded-xl text-red-600 hover:bg-red-50 transition"
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
    </div>
  );
}
