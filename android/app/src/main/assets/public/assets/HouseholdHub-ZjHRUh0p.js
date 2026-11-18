import { A as sortCustomReminders, C as formatArabicTime12h, D as getReminderSoundOption, E as getNextOccurrenceDate, F as Volume2, I as Trash2, L as Sparkles, O as normalizeRepeatDays, S as formatArabicShortDate, T as getLeadTimeLabel, U as createLucideIcon, X as __toESM, Y as require_react, _ as REMINDER_LEAD_TIME_OPTIONS, a as previewReminderSound, b as REMINDER_TITLE_SUGGESTIONS, d as scheduleCustomReminder, f as syncAllActiveCustomReminders, g as CUSTOM_REMINDERS_UPDATED_EVENT, h as ARABIC_WEEKDAY_OPTIONS, i as isAlarmLoopActive, j as stableNotificationId, k as resolveReminderRepeatType, l as getChannelIdForSoundProfile, m as createLocalRepository, o as stopReminderSoundPreview, p as customRemindersRepository, r as require_jsx_runtime, u as getLocalNotificationService, v as REMINDER_REPEAT_OPTIONS, w as formatReminderScheduleBadge, x as computeReminderAlertDate, y as REMINDER_SOUND_OPTIONS, z as Plus } from "./index-CAWuhwTm.js";
/**
* @license lucide-react v0.546.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var BellOff = createLucideIcon("bell-off", [
	["path", {
		d: "M10.268 21a2 2 0 0 0 3.464 0",
		key: "vwvbt9"
	}],
	["path", {
		d: "M17 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 .258-1.742",
		key: "178tsu"
	}],
	["path", {
		d: "m2 2 20 20",
		key: "1ooewy"
	}],
	["path", {
		d: "M8.668 3.01A6 6 0 0 1 18 8c0 2.687.77 4.653 1.707 6.05",
		key: "1hqiys"
	}]
]);
/**
* @license lucide-react v0.546.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var Bell = createLucideIcon("bell", [["path", {
	d: "M10.268 21a2 2 0 0 0 3.464 0",
	key: "vwvbt9"
}], ["path", {
	d: "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326",
	key: "11g9vi"
}]]);
/**
* @license lucide-react v0.546.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var CalendarClock = createLucideIcon("calendar-clock", [
	["path", {
		d: "M16 14v2.2l1.6 1",
		key: "fo4ql5"
	}],
	["path", {
		d: "M16 2v4",
		key: "4m81vk"
	}],
	["path", {
		d: "M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5",
		key: "1osxxc"
	}],
	["path", {
		d: "M3 10h5",
		key: "r794hk"
	}],
	["path", {
		d: "M8 2v4",
		key: "1cmpym"
	}],
	["circle", {
		cx: "16",
		cy: "16",
		r: "6",
		key: "qoo3c4"
	}]
]);
/**
* @license lucide-react v0.546.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var CircleCheck = createLucideIcon("circle-check", [["circle", {
	cx: "12",
	cy: "12",
	r: "10",
	key: "1mglay"
}], ["path", {
	d: "m9 12 2 2 4-4",
	key: "dzmm74"
}]]);
/**
* @license lucide-react v0.546.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var Repeat = createLucideIcon("repeat", [
	["path", {
		d: "m17 2 4 4-4 4",
		key: "nntrym"
	}],
	["path", {
		d: "M3 11v-1a4 4 0 0 1 4-4h14",
		key: "84bu3i"
	}],
	["path", {
		d: "m7 22-4-4 4-4",
		key: "1wqhfi"
	}],
	["path", {
		d: "M21 13v1a4 4 0 0 1-4 4H3",
		key: "1rx37r"
	}]
]);
// src/features/household/householdTaskModels.ts
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
function isHouseholdTask(value) {
	if (!value || typeof value !== "object") return false;
	const task = value;
	const validDueTime = task.dueTime === void 0 || task.dueTime === null || typeof task.dueTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(task.dueTime);
	const validLead = task.leadMinutes === void 0 || typeof task.leadMinutes === "number" && Number.isFinite(task.leadMinutes) && task.leadMinutes >= 0;
	const validNotificationId = task.notificationId === void 0 || typeof task.notificationId === "number" && Number.isInteger(task.notificationId) && task.notificationId >= 1e3;
	return typeof task.id === "string" && typeof task.title === "string" && task.title.trim().length > 0 && typeof task.notes === "string" && typeof task.completed === "boolean" && typeof task.createdAt === "string" && (task.dueDate === null || typeof task.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) && validDueTime && validLead && validNotificationId;
}
function sortHouseholdTasks(tasks) {
	return [...tasks].sort((a, b) => {
		if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
		if (a.dueDate === null && b.dueDate !== null) return 1;
		if (a.dueDate !== null && b.dueDate === null) return -1;
		if (a.dueDate !== null && b.dueDate !== null) {
			const keyA = `${a.dueDate}T${a.dueTime || "23:59"}`;
			const keyB = `${b.dueDate}T${b.dueTime || "23:59"}`;
			const dueDateOrder = keyA.localeCompare(keyB);
			if (dueDateOrder !== 0) return dueDateOrder;
		}
		return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
	});
}
// src/features/household/householdTaskRepository.ts
var HOUSEHOLD_TASKS_STORAGE_KEY = "tedbeera_household_tasks_v1";
var isTaskList = (value) => Array.isArray(value) && value.every(isHouseholdTask);
var householdTasksRepository = createLocalRepository(HOUSEHOLD_TASKS_STORAGE_KEY, [], isTaskList);
// src/features/savings/savingsModels.ts
function isSavingsGoal(value) {
	if (!value || typeof value !== "object") return false;
	const goal = value;
	return typeof goal.id === "string" && typeof goal.title === "string" && goal.title.trim().length > 0 && typeof goal.targetAmount === "number" && Number.isFinite(goal.targetAmount) && goal.targetAmount > 0 && typeof goal.currentAmount === "number" && Number.isFinite(goal.currentAmount) && goal.currentAmount >= 0 && typeof goal.createdAt === "string" && (goal.targetDate === null || typeof goal.targetDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(goal.targetDate));
}
function getSavingsProgress(goal) {
	return {
		saved: Math.min(goal.currentAmount, goal.targetAmount),
		remaining: Math.max(0, goal.targetAmount - goal.currentAmount),
		percentage: Math.min(100, Math.round(goal.currentAmount / goal.targetAmount * 1e3) / 10),
		isComplete: goal.currentAmount >= goal.targetAmount
	};
}
// src/features/savings/savingsRepository.ts
var SAVINGS_GOALS_STORAGE_KEY = "tedbeera_savings_goals_v1";
var isSavingsGoalList = (value) => Array.isArray(value) && value.every(isSavingsGoal);
var savingsGoalsRepository = createLocalRepository(SAVINGS_GOALS_STORAGE_KEY, [], isSavingsGoalList);
// src/features/household/HouseholdHub.tsx
var import_jsx_runtime = require_jsx_runtime();
var todayKey = () => {
	const now = /* @__PURE__ */ new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
var defaultTimePlusHour = () => {
	const next = new Date(Date.now() + 36e5);
	return `${String(next.getHours()).padStart(2, "0")}:${String(next.getMinutes()).padStart(2, "0")}`;
};
function HouseholdHub({ onNotify }) {
	const [reminders, setReminders] = (0, import_react.useState)(() => sortCustomReminders(customRemindersRepository.read()));
	const [tasks, setTasks] = (0, import_react.useState)(() => sortHouseholdTasks(householdTasksRepository.read()));
	const [goals, setGoals] = (0, import_react.useState)(() => savingsGoalsRepository.read());
	const [remTitle, setRemTitle] = (0, import_react.useState)("");
	const [remDate, setRemDate] = (0, import_react.useState)(() => todayKey());
	const [remTime, setRemTime] = (0, import_react.useState)(() => defaultTimePlusHour());
	const [remLead, setRemLead] = (0, import_react.useState)(5);
	const [remSound, setRemSound] = (0, import_react.useState)("gentle");
	const [remRepeatType, setRemRepeatType] = (0, import_react.useState)("once");
	const [remRepeatDays, setRemRepeatDays] = (0, import_react.useState)([]);
	const [isPreviewingSound, setIsPreviewingSound] = (0, import_react.useState)(false);
	const [remStatusMsg, setRemStatusMsg] = (0, import_react.useState)(null);
	const [taskTitle, setTaskTitle] = (0, import_react.useState)("");
	const [taskDueDate, setTaskDueDate] = (0, import_react.useState)("");
	const [taskDueTime, setTaskDueTime] = (0, import_react.useState)("");
	const [taskLead, setTaskLead] = (0, import_react.useState)(15);
	const [goalTitle, setGoalTitle] = (0, import_react.useState)("");
	const [goalTarget, setGoalTarget] = (0, import_react.useState)("");
	const [contributions, setContributions] = (0, import_react.useState)({});
	const persistReminders = (next) => {
		const sorted = sortCustomReminders(next);
		setReminders(sorted);
		customRemindersRepository.write(sorted);
	};
	const persistTasks = (next) => {
		const sorted = sortHouseholdTasks(next);
		setTasks(sorted);
		householdTasksRepository.write(sorted);
	};
	const persistGoals = (next) => {
		setGoals(next);
		savingsGoalsRepository.write(next);
	};
	(0, import_react.useEffect)(() => {
		const svc = getLocalNotificationService();
		const now = Date.now();
		syncAllActiveCustomReminders(now);
		for (const t of tasks) {
			if (t.completed || !t.dueDate || !t.dueTime || !t.notificationId) continue;
			const alertDate = computeReminderAlertDate(t.dueDate, t.dueTime, t.leadMinutes ?? 0);
			if (alertDate && alertDate.getTime() > now) svc.scheduleOneOffNotification({
				id: t.notificationId,
				title: `مهمة البيت: ${t.title}`,
				body: `موعدها الساعة ${formatArabicTime12h(t.dueTime)}`,
				triggerAt: alertDate,
				soundProfile: "gentle",
				channelId: getChannelIdForSoundProfile("gentle"),
				alarmTitle: t.title
			});
		}
		const handleRepoUpdated = () => {
			setReminders(sortCustomReminders(customRemindersRepository.read()));
		};
		window.addEventListener(CUSTOM_REMINDERS_UPDATED_EVENT, handleRepoUpdated);
		return () => {
			window.removeEventListener(CUSTOM_REMINDERS_UPDATED_EVENT, handleRepoUpdated);
			if (!isAlarmLoopActive()) stopReminderSoundPreview();
		};
	}, []);
	const previewAlertDate = getNextOccurrenceDate({
		date: remDate,
		time: remTime,
		leadMinutes: remLead,
		repeatType: remRepeatType,
		repeatDays: remRepeatDays
	});
	const selectedSoundOption = getReminderSoundOption(remSound);
	const toggleRepeatWeekday = (dayValue) => {
		setRemRepeatDays((prev) => prev.includes(dayValue) ? prev.filter((d) => d !== dayValue) : normalizeRepeatDays([...prev, dayValue]));
	};
	const handlePreviewSound = async () => {
		setIsPreviewingSound(true);
		try {
			const result = await previewReminderSound(remSound, remTitle);
			onNotify?.(result.message);
		} finally {
			if (remSound === "alarm") setIsPreviewingSound(isAlarmLoopActive());
			else setTimeout(() => setIsPreviewingSound(false), 950);
		}
	};
	const handleAddReminder = async () => {
		const title = remTitle.trim();
		if (!title) {
			onNotify?.("اكتبي اسم التذكير أو اختاري من الاقتراحات الأول");
			return;
		}
		if (!remTime) {
			onNotify?.("اختاري الميعاد للتنبيه");
			return;
		}
		if (remRepeatType === "once" && !remDate) {
			onNotify?.("اختاري التاريخ والميعاد للتنبيه");
			return;
		}
		const normalizedDays = normalizeRepeatDays(remRepeatDays);
		if (remRepeatType === "weekly" && normalizedDays.length === 0) {
			onNotify?.("اختاري يوماً واحداً على الأقل لتكرار التنبيه");
			return;
		}
		const effectiveDate = remRepeatType === "once" ? remDate : todayKey();
		const id = crypto.randomUUID();
		const newReminder = {
			id,
			notificationId: stableNotificationId(id),
			title,
			date: effectiveDate,
			time: remTime,
			leadMinutes: remLead,
			soundProfile: remSound,
			repeatType: remRepeatType,
			...remRepeatType === "weekly" ? { repeatDays: normalizedDays } : {},
			enabled: true,
			createdAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		const alertDate = getNextOccurrenceDate(newReminder);
		if (!alertDate) {
			onNotify?.("تأكدي من أن التاريخ والميعاد في المستقبل");
			return;
		}
		persistReminders([newReminder, ...reminders]);
		setRemTitle("");
		const result = await scheduleCustomReminder(newReminder);
		const alertText = `هيوصلك الإشعار القادم ${formatArabicShortDate(alertDate)} الساعة ${formatArabicTime12h(alertDate)}`;
		setRemStatusMsg(`${result.message} (${alertText})`);
		onNotify?.(result.scheduled ? `تم حفظ التنبيه (${selectedSoundOption.label})! ${alertText}` : result.message);
	};
	const handleToggleReminder = async (reminder) => {
		const nextEnabled = !reminder.enabled;
		const updatedReminder = {
			...reminder,
			enabled: nextEnabled
		};
		persistReminders(reminders.map((r) => r.id === reminder.id ? updatedReminder : r));
		const svc = getLocalNotificationService();
		if (nextEnabled) {
			if (getNextOccurrenceDate(updatedReminder)) {
				const res = await scheduleCustomReminder(updatedReminder);
				onNotify?.(res.message);
			} else onNotify?.("ميعاد التذكير عدّى، عدّلي الوقت أو أضيفي تذكير جديد");
		} else {
			await svc.cancelOneOffNotification(reminder.notificationId);
			onNotify?.("تم إيقاف التنبيه مؤقتاً");
		}
	};
	const handleDeleteReminder = async (reminder) => {
		await getLocalNotificationService().cancelOneOffNotification(reminder.notificationId);
		persistReminders(reminders.filter((r) => r.id !== reminder.id));
		onNotify?.("تم حذف التذكير");
	};
	const addTask = async () => {
		const title = taskTitle.trim();
		if (!title) return;
		const id = crypto.randomUUID();
		const hasDateTime = Boolean(taskDueDate && taskDueTime);
		const notificationId = hasDateTime ? stableNotificationId(`task_${id}`) : void 0;
		const newTask = {
			id,
			title,
			notes: "",
			dueDate: taskDueDate || null,
			dueTime: taskDueDate && taskDueTime ? taskDueTime : null,
			leadMinutes: hasDateTime ? taskLead : void 0,
			notificationId,
			completed: false,
			createdAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		persistTasks([...tasks, newTask]);
		setTaskTitle("");
		setTaskDueDate("");
		setTaskDueTime("");
		if (hasDateTime && notificationId) {
			const alertDate = computeReminderAlertDate(taskDueDate, taskDueTime, taskLead);
			if (alertDate && alertDate.getTime() > Date.now()) {
				const res = await getLocalNotificationService().scheduleOneOffNotification({
					id: notificationId,
					title: `مهمة البيت: ${title} ✅`,
					body: `موعد المهمة ${formatArabicTime12h(taskDueTime)}`,
					triggerAt: alertDate
				});
				onNotify?.(res.scheduled ? `تمت إضافة المهمة وهيوصلك إشعارها الساعة ${formatArabicTime12h(alertDate)}` : res.message);
				return;
			}
		}
		onNotify?.("تمت إضافة المهمة لقائمة البيت ✅");
	};
	const handleToggleTask = async (task, completed) => {
		persistTasks(tasks.map((t) => t.id === task.id ? {
			...t,
			completed
		} : t));
		if (task.notificationId) {
			const svc = getLocalNotificationService();
			if (completed) await svc.cancelOneOffNotification(task.notificationId);
			else if (task.dueDate && task.dueTime) {
				const alertDate = computeReminderAlertDate(task.dueDate, task.dueTime, task.leadMinutes ?? 0);
				if (alertDate && alertDate.getTime() > Date.now()) await svc.scheduleOneOffNotification({
					id: task.notificationId,
					title: `مهمة البيت: ${task.title} ✅`,
					body: `موعد المهمة ${formatArabicTime12h(task.dueTime)}`,
					triggerAt: alertDate
				});
			}
		}
	};
	const handleDeleteTask = async (task) => {
		if (task.notificationId) await getLocalNotificationService().cancelOneOffNotification(task.notificationId);
		persistTasks(tasks.filter((t) => t.id !== task.id));
	};
	const addGoal = () => {
		const title = goalTitle.trim();
		const targetAmount = Number(goalTarget);
		if (!title || !Number.isFinite(targetAmount) || targetAmount <= 0) return;
		persistGoals([...goals, {
			id: crypto.randomUUID(),
			title,
			targetAmount,
			currentAmount: 0,
			targetDate: null,
			createdAt: (/* @__PURE__ */ new Date()).toISOString()
		}]);
		setGoalTitle("");
		setGoalTarget("");
	};
	const addContribution = (goal) => {
		const amount = Number(contributions[goal.id] || 0);
		if (!Number.isFinite(amount) || amount <= 0) return;
		persistGoals(goals.map((g) => g.id === goal.id ? {
			...g,
			currentAmount: g.currentAmount + amount
		} : g));
		setContributions((prev) => ({
			...prev,
			[goal.id]: ""
		}));
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		dir: "rtl",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl border border-[#F3DCE2] bg-[#FADDE4]/55 p-3.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "font-extrabold text-sm text-[#4A353B]",
					children: "البيت والمواعيد 🏠"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-[11px] text-[#8E757C]",
					children: "تنبيهاتك الخاصة، مهام البيت اليومية، وأهداف التحويش — كلها محفوظة على موبايلك وتنبهك في ميعادها."
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-2xl border border-[#F3DCE2] bg-[#FFFFFF] p-3.5 space-y-3 shadow-xs",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "w-8 h-8 rounded-xl bg-[#FADDE4] text-[#C96D84] flex items-center justify-center shrink-0",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "w-4 h-4" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
							className: "font-extrabold text-sm text-[#4A353B]",
							children: "مهام البيت ✅"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] text-[#8E757C]",
							children: "اكتبي مهامك اليومية ولو حددتيلها ميعاد وساعة هنفكرك أوتوماتيك"
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: taskTitle,
								onChange: (e) => setTaskTitle(e.target.value),
								placeholder: "مثال: ترتيب المطبخ / غسيل الستاير",
								maxLength: 100,
								className: "w-full rounded-xl border border-[#F3DCE2] bg-[#FFFFFF] text-[#4A353B] p-2.5 text-xs focus:outline-none focus:border-[#D47E93]"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid grid-cols-2 gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "text-[11px] text-[#8E757C] font-semibold",
									children: ["التاريخ (اختياري)", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "date",
										value: taskDueDate,
										min: todayKey(),
										onChange: (e) => setTaskDueDate(e.target.value),
										className: "mt-1 block w-full rounded-xl border border-[#F3DCE2] bg-[#FFFFFF] text-[#4A353B] p-2 text-xs focus:outline-none focus:border-[#D47E93]",
										"aria-label": "تاريخ المهمة"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "text-[11px] text-[#8E757C] font-semibold",
									children: ["الساعة (اختياري للتنبيه)", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "time",
										value: taskDueTime,
										onChange: (e) => setTaskDueTime(e.target.value),
										className: "mt-1 block w-full rounded-xl border border-[#F3DCE2] bg-[#FFFFFF] text-[#4A353B] p-2 text-xs focus:outline-none focus:border-[#D47E93]",
										"aria-label": "ساعة المهمة"
									})]
								})]
							}),
							taskDueDate && taskDueTime && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "block text-[11px] font-bold text-[#8E757C]",
								children: ["إمتى يوصلك إشعار المهمة؟", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
									value: taskLead,
									onChange: (e) => setTaskLead(Number(e.target.value)),
									className: "mt-1 block w-full rounded-xl border border-[#F3DCE2] bg-[#FFFFFF] p-2 text-xs font-bold text-[#C96D84] focus:outline-none focus:border-[#D47E93]",
									children: REMINDER_LEAD_TIME_OPTIONS.map((opt) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: opt.value,
										children: opt.label
									}, opt.value))
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => void addTask(),
						className: "w-full min-h-[40px] rounded-xl bg-[#D47E93] hover:bg-[#C96D84] p-2 text-xs font-bold text-white transition",
						children: "إضافة مهمة"
					}),
					tasks.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-[#8E757C] text-center py-1",
						children: "ضيفي أول مهمة للبيت."
					}) : tasks.map((task) => {
						const taskAlert = task.dueDate && task.dueTime ? computeReminderAlertDate(task.dueDate, task.dueTime, task.leadMinutes ?? 0) : null;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start gap-2 border-t border-[#F3DCE2] pt-2.5 text-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: task.completed,
									onChange: (e) => void handleToggleTask(task, e.target.checked),
									className: "mt-1 accent-[#D47E93]"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: task.completed ? "flex-1 text-[#8E757C] line-through" : "flex-1",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
											className: "block text-[#4A353B]",
											children: task.title
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", {
											className: "block text-[#8E757C] mt-0.5",
											children: task.dueDate ? `${formatArabicShortDate(task.dueDate)}${task.dueTime ? ` • ${formatArabicTime12h(task.dueTime)}` : ""}` : "بدون موعد محدد"
										}),
										taskAlert && !task.completed && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", {
											className: "block text-[#C96D84] font-bold mt-0.5",
											children: [
												"🔔 الإشعار: ",
												formatArabicShortDate(taskAlert),
												" الساعة ",
												formatArabicTime12h(taskAlert),
												" (",
												getLeadTimeLabel(task.leadMinutes ?? 0),
												")"
											]
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => void handleDeleteTask(task),
									className: "text-red-600 font-semibold px-1",
									children: "حذف"
								})
							]
						}, task.id);
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-2xl border border-[#F3DCE2] bg-[#FFFFFF] p-3.5 space-y-3 shadow-xs",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
						className: "font-extrabold text-sm text-[#4A353B]",
						children: "أهداف التوفير (التحويش) 🪙"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: goalTitle,
							onChange: (e) => setGoalTitle(e.target.value),
							placeholder: "اسم الهدف",
							maxLength: 70,
							className: "rounded-xl border border-[#F3DCE2] bg-[#FFFFFF] text-[#4A353B] p-2 text-xs min-w-0 focus:outline-none focus:border-[#D47E93]"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: goalTarget,
							onChange: (e) => setGoalTarget(e.target.value),
							type: "number",
							min: "1",
							placeholder: "المبلغ بالجنيه",
							className: "rounded-xl border border-[#F3DCE2] bg-[#FFFFFF] text-[#4A353B] p-2 text-xs min-w-0 focus:outline-none focus:border-[#D47E93]"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: addGoal,
						className: "w-full min-h-[40px] rounded-xl bg-[#D47E93] hover:bg-[#C96D84] p-2 text-xs font-bold text-white transition",
						children: "إنشاء هدف توفير"
					}),
					goals.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-[#8E757C] text-center py-1",
						children: "حدد هدفًا مثل مصاريف المدرسة أو جهاز جديد."
					}) : goals.map((goal) => {
						const progress = getSavingsProgress(goal);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2 border-t border-[#F3DCE2] pt-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-between gap-2 text-xs tabular-nums text-[#4A353B]",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: goal.title }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
										Math.round(progress.saved),
										" / ",
										goal.targetAmount,
										" ج.م (",
										progress.percentage,
										"%)"
									] })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "h-2 rounded-full bg-[#FADDE4]/60 overflow-hidden",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "h-full bg-[#D47E93]",
										style: { width: progress.percentage + "%" }
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											min: "1",
											value: contributions[goal.id] || "",
											onChange: (e) => setContributions((prev) => ({
												...prev,
												[goal.id]: e.target.value
											})),
											placeholder: "إضافة مبلغ",
											className: "min-w-0 flex-1 rounded-xl border border-[#F3DCE2] bg-[#FFFFFF] text-[#4A353B] p-2 text-xs focus:outline-none focus:border-[#D47E93]"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => addContribution(goal),
											className: "min-h-[38px] rounded-xl bg-[#D47E93] hover:bg-[#C96D84] px-3 text-xs font-bold text-white transition",
											children: "ادخار"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => persistGoals(goals.filter((g) => g.id !== goal.id)),
											className: "text-xs text-red-600 font-semibold px-1",
											children: "حذف"
										})
									]
								})
							]
						}, goal.id);
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-2xl border border-[#F3DCE2] bg-[#FFFFFF] p-3.5 space-y-3 shadow-xs",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "w-8 h-8 rounded-xl bg-[#FADDE4] text-[#C96D84] flex items-center justify-center shrink-0",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "w-4 h-4" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
								className: "font-extrabold text-sm text-[#4A353B]",
								children: "التنبيهات والتذكيرات الخاصة"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] text-[#8E757C]",
								children: "إضافة تنبيه جديد بميعاده وإشعار أوتوماتيك قبله"
							})] })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-[11px] font-bold text-[#C96D84] bg-[#FADDE4] px-2 py-0.5 rounded-lg",
							children: [reminders.filter((r) => r.enabled).length, " شغّال"]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-[11px] font-bold text-[#8E757C] flex items-center gap-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "w-3.5 h-3.5 text-[#C96D84]" }), "اختيارات سريعة:"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-wrap gap-1.5",
							children: REMINDER_TITLE_SUGGESTIONS.map((suggestion) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									setRemTitle(suggestion);
									if (suggestion === "أصحي جوزي من النوم") setRemSound("alarm");
								},
								className: `px-2.5 py-1 rounded-xl text-[11px] font-bold border transition ${remTitle === suggestion ? "bg-[#D47E93] text-white border-[#D47E93]" : "bg-[#FFF8FA] text-[#4A353B] border-[#F3DCE2] hover:border-[#D47E93]"}`,
								children: suggestion
							}, suggestion))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-xl border border-[#F3DCE2] bg-[#FFF8FA] p-3 space-y-2.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs font-extrabold text-[#4A353B]",
								children: "إضافة تنبيه جديد"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								value: remTitle,
								onChange: (e) => setRemTitle(e.target.value),
								placeholder: "مثال: أصحي جوزي من النوم / عندي مشوار",
								maxLength: 90,
								className: "w-full rounded-xl border border-[#F3DCE2] bg-[#FFFFFF] text-[#4A353B] p-2.5 text-xs focus:outline-none focus:border-[#D47E93]"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-[11px] font-bold text-[#8E757C] flex items-center gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Repeat, { className: "w-3.5 h-3.5 text-[#C96D84]" }), "تكرار التنبيه"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "grid grid-cols-3 gap-1.5",
									role: "group",
									"aria-label": "تكرار التنبيه",
									children: REMINDER_REPEAT_OPTIONS.map((option) => {
										const isSelected = remRepeatType === option.value;
										return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											"aria-pressed": isSelected,
											onClick: () => setRemRepeatType(option.value),
											className: `rounded-xl border px-2 py-2 text-[11px] font-extrabold transition ${isSelected ? "bg-[#D47E93] border-[#D47E93] text-white shadow-xs" : "bg-[#FFFFFF] border-[#F3DCE2] text-[#8E757C] hover:border-[#D47E93]"}`,
											children: option.label
										}, option.value);
									})
								})]
							}),
							remRepeatType === "once" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid grid-cols-2 gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "text-[11px] font-bold text-[#8E757C]",
									children: ["التاريخ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "date",
										value: remDate,
										min: todayKey(),
										onChange: (e) => setRemDate(e.target.value),
										className: "mt-1 block w-full rounded-xl border border-[#F3DCE2] bg-[#FFFFFF] text-[#4A353B] p-2 text-xs focus:outline-none focus:border-[#D47E93]"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "text-[11px] font-bold text-[#8E757C]",
									children: ["الميعاد", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "time",
										value: remTime,
										onChange: (e) => setRemTime(e.target.value),
										className: "mt-1 block w-full rounded-xl border border-[#F3DCE2] bg-[#FFFFFF] text-[#4A353B] p-2 text-xs focus:outline-none focus:border-[#D47E93]"
									})]
								})]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "block text-[11px] font-bold text-[#8E757C]",
									children: ["الميعاد", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "time",
										value: remTime,
										onChange: (e) => setRemTime(e.target.value),
										className: "mt-1 block w-full rounded-xl border border-[#F3DCE2] bg-[#FFFFFF] text-[#4A353B] p-2 text-xs focus:outline-none focus:border-[#D47E93]"
									})]
								}), remRepeatType === "weekly" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[11px] font-bold text-[#8E757C] block",
										children: "اختاري أيام الأسبوع:"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex flex-wrap gap-1.5",
										role: "group",
										"aria-label": "أيام الأسبوع للتكرار",
										children: ARABIC_WEEKDAY_OPTIONS.map((day) => {
											const isDaySelected = remRepeatDays.includes(day.value);
											return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												"aria-pressed": isDaySelected,
												onClick: () => toggleRepeatWeekday(day.value),
												className: `rounded-xl border px-2.5 py-1.5 text-[11px] font-extrabold transition ${isDaySelected ? "bg-[#D47E93] border-[#D47E93] text-white shadow-xs" : "bg-[#FFFFFF] border-[#F3DCE2] text-[#4A353B] hover:border-[#D47E93]"}`,
												children: day.label
											}, day.value);
										})
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "block text-[11px] font-bold text-[#8E757C]",
								children: ["إمتى يوصلك الإشعار؟", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
									value: remLead,
									onChange: (e) => setRemLead(Number(e.target.value)),
									className: "mt-1 block w-full rounded-xl border border-[#F3DCE2] bg-[#FFFFFF] p-2.5 text-xs font-bold text-[#C96D84] focus:outline-none focus:border-[#D47E93]",
									children: REMINDER_LEAD_TIME_OPTIONS.map((opt) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: opt.value,
										children: opt.label
									}, opt.value))
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5 pt-0.5",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[11px] font-bold text-[#8E757C]",
											children: "نوع صوت التنبيه"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											onClick: () => void handlePreviewSound(),
											className: `inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-extrabold transition ${isPreviewingSound ? "border-[#D47E93] bg-[#D47E93] text-white" : "border-[#F3DCE2] bg-[#FFFFFF] hover:bg-[#FADDE4] text-[#C96D84]"}`,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { className: "w-3 h-3 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "جرّب الصوت 🔊" })]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "grid grid-cols-3 gap-1.5",
										role: "group",
										"aria-label": "نوع صوت التنبيه",
										children: REMINDER_SOUND_OPTIONS.map((option) => {
											const isSelected = remSound === option.value;
											return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												type: "button",
												"aria-pressed": isSelected,
												onClick: () => setRemSound(option.value),
												className: `rounded-xl border px-2 py-2 text-[11px] font-extrabold transition flex items-center justify-center gap-1 ${isSelected ? option.value === "alarm" ? "bg-[#FADDE4] border-[#C96D84] text-[#4A353B] shadow-xs" : option.value === "vibrate" ? "bg-[#FFF8FA] border-[#8E757C] text-[#4A353B] shadow-xs" : "bg-[#FADDE4] border-[#D47E93] text-[#C96D84] shadow-xs" : "bg-[#FFFFFF] border-[#F3DCE2] text-[#8E757C] hover:border-[#D47E93]"}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: option.emoji }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: option.label })]
											}, option.value);
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-[10px] text-[#8E757C]",
										children: selectedSoundOption.description
									})
								]
							}),
							previewAlertDate ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-lg bg-[#FADDE4]/50 border border-[#F3DCE2] px-2.5 py-1.5 text-[11px] text-[#4A353B] font-bold flex items-center gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CalendarClock, { className: "w-3.5 h-3.5 shrink-0 text-[#C96D84]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
									"الميعاد: ",
									formatArabicTime12h(remTime),
									" ← الإشعار القادم هيوصلك الساعة",
									" ",
									formatArabicTime12h(previewAlertDate),
									" (",
									formatArabicShortDate(previewAlertDate),
									")"
								] })]
							}) : remRepeatType === "weekly" && remRepeatDays.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "rounded-lg bg-[#FADDE4]/40 border border-[#F3DCE2] px-2.5 py-1.5 text-[11px] text-[#8E757C] font-bold",
								children: "اختاري يوماً واحداً على الأقل علشان نحسب ميعاد الإشعار القادم."
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => void handleAddReminder(),
								className: "w-full min-h-[42px] rounded-xl bg-[#D47E93] hover:bg-[#C96D84] text-white text-xs font-extrabold py-2.5 px-3 transition flex items-center justify-center gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "w-4 h-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "حفظ وتفعيل التنبيه" })]
							}),
							remStatusMsg && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] font-semibold text-[#4A353B] bg-[#FADDE4]/55 rounded-lg p-2",
								children: remStatusMsg
							})
						]
					}),
					reminders.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-[#8E757C] text-center py-2",
						children: "لسه مفيش تنبيهات خاصة. ضيفي ميعاد مهم فوق وهنفكرك قبله أوتوماتيك."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-2",
						children: reminders.map((reminder) => {
							const repeatType = resolveReminderRepeatType(reminder.repeatType);
							const nextAlertDate = getNextOccurrenceDate(reminder);
							const oneOffAlertDate = repeatType === "once" ? computeReminderAlertDate(reminder.date, reminder.time, reminder.leadMinutes) : nextAlertDate;
							const isPast = repeatType === "once" && oneOffAlertDate ? oneOffAlertDate.getTime() <= Date.now() : false;
							const soundOption = getReminderSoundOption(reminder.soundProfile);
							const soundBadgeClass = soundOption.value === "alarm" ? "bg-[#FADDE4] text-[#4A353B] border-[#E8A8B7]" : soundOption.value === "vibrate" ? "bg-[#FFF8FA] text-[#8E757C] border-[#F3DCE2]" : "bg-[#FADDE4]/70 text-[#C96D84] border-[#F3DCE2]";
							const scheduleBadge = formatReminderScheduleBadge(reminder);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: `rounded-xl border p-3 transition ${reminder.enabled ? "border-[#F3DCE2] bg-[#FFF8FA]" : "border-[#F3DCE2] bg-[#FFF8FA]/60 opacity-75"}`,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-start justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "min-w-0 flex-1 space-y-1.5",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-wrap items-center gap-1.5",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
														className: "text-xs font-extrabold text-[#4A353B]",
														children: reminder.title
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: `inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${soundBadgeClass}`,
														children: soundOption.badgeLabel
													}),
													isPast && reminder.enabled && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[10px] font-bold text-[#C96D84] bg-[#FADDE4] px-1.5 py-0.5 rounded",
														children: "عدّى ميعاده"
													})
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "inline-flex items-center gap-1 rounded-lg border border-[#F3DCE2] bg-[#FADDE4]/70 px-2 py-0.5 text-[11px] font-extrabold text-[#4A353B]",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Repeat, { className: "w-3 h-3 shrink-0 text-[#C96D84]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: scheduleBadge })]
											}) }),
											oneOffAlertDate && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-[11px] font-bold text-[#C96D84] flex items-center gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "w-3 h-3 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
													repeatType === "once" ? "الإشعار:" : "الإشعار القادم:",
													" ",
													formatArabicShortDate(oneOffAlertDate),
													" الساعة ",
													formatArabicTime12h(oneOffAlertDate),
													" (",
													getLeadTimeLabel(reminder.leadMinutes),
													")"
												] })]
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-1.5 shrink-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											role: "switch",
											"aria-checked": reminder.enabled,
											onClick: () => void handleToggleReminder(reminder),
											className: `inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-extrabold transition ${reminder.enabled ? "border-[#D47E93] bg-[#D47E93] text-white" : "border-[#F3DCE2] bg-[#FFFFFF] text-[#8E757C]"}`,
											title: reminder.enabled ? "إيقاف التنبيه مؤقتاً" : "تفعيل التنبيه",
											"aria-label": reminder.enabled ? "مفعّل — إيقاف التنبيه" : "متوقف — تفعيل التنبيه",
											children: [reminder.enabled ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "w-3 h-3" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BellOff, { className: "w-3 h-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: reminder.enabled ? "مفعّل" : "متوقف" })]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => void handleDeleteReminder(reminder),
											className: "p-2 rounded-lg text-red-600 hover:bg-red-50 transition",
											title: "حذف التنبيه",
											"aria-label": "حذف التنبيه",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "w-3.5 h-3.5" })
										})]
									})]
								})
							}, reminder.id);
						})
					})
				]
			})
		]
	});
}
export { HouseholdHub };
