import { createLocalRepository } from '../../services/localDataRepository';
import { isCustomReminder, type CustomReminder } from './customReminderModels';

export const CUSTOM_REMINDERS_STORAGE_KEY = 'tedbeera_custom_reminders_v1';

const isReminderList = (value: unknown): value is CustomReminder[] =>
  Array.isArray(value) && value.every(isCustomReminder);

export const customRemindersRepository = createLocalRepository<CustomReminder[]>(
  CUSTOM_REMINDERS_STORAGE_KEY,
  [],
  isReminderList
);
