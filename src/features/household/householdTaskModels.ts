export interface HouseholdTask {
  id: string;
  title: string;
  notes: string;
  dueDate: string | null;
  dueTime?: string | null;
  leadMinutes?: number;
  notificationId?: number;
  completed: boolean;
  createdAt: string;
}

export function isHouseholdTask(value: unknown): value is HouseholdTask {
  if (!value || typeof value !== 'object') return false;
  const task = value as Partial<HouseholdTask>;
  const validDueTime =
    task.dueTime === undefined ||
    task.dueTime === null ||
    (typeof task.dueTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(task.dueTime));
  const validLead =
    task.leadMinutes === undefined ||
    (typeof task.leadMinutes === 'number' && Number.isFinite(task.leadMinutes) && task.leadMinutes >= 0);
  const validNotificationId =
    task.notificationId === undefined ||
    (typeof task.notificationId === 'number' && Number.isInteger(task.notificationId) && task.notificationId >= 1000);
  return (
    typeof task.id === 'string' &&
    typeof task.title === 'string' &&
    task.title.trim().length > 0 &&
    typeof task.notes === 'string' &&
    typeof task.completed === 'boolean' &&
    typeof task.createdAt === 'string' &&
    (task.dueDate === null || (typeof task.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate))) &&
    validDueTime &&
    validLead &&
    validNotificationId
  );
}

export function sortHouseholdTasks(tasks: HouseholdTask[]): HouseholdTask[] {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
    if (a.dueDate === null && b.dueDate !== null) return 1;
    if (a.dueDate !== null && b.dueDate === null) return -1;
    if (a.dueDate !== null && b.dueDate !== null) {
      const keyA = `${a.dueDate}T${a.dueTime || '23:59'}`;
      const keyB = `${b.dueDate}T${b.dueTime || '23:59'}`;
      const dueDateOrder = keyA.localeCompare(keyB);
      if (dueDateOrder !== 0) return dueDateOrder;
    }
    return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
  });
}
