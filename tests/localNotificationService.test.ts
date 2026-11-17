import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BREAKFAST_REMINDER_ID,
  LUNCH_REMINDER_ID,
  DINNER_REMINDER_ID,
  DEFAULT_REMINDER_HOUR,
  DEFAULT_REMINDER_MINUTE,
  DEFAULT_LUNCH_HOUR,
  DEFAULT_DINNER_HOUR,
  ALARM_REMINDER_CHANNEL_ID,
  GENTLE_REMINDER_CHANNEL_ID,
  VIBRATE_REMINDER_CHANNEL_ID,
  ALARM_ACTION_TYPE_ID,
  ALARM_DISMISS_ACTION_ID,
  CUSTOM_REMINDER_CHANNELS,
  getChannelIdForSoundProfile,
} from '../src/services/localNotificationService.ts';
import {
  ALARM_REPEAT_INTERVAL_MS,
  buildAlarmDisplayTitle,
  buildEgyptianAlarmPhrase,
} from '../src/services/reminderSoundPreview.ts';

test('meal reminder IDs are stable and unique', () => {
  const ids = [BREAKFAST_REMINDER_ID, LUNCH_REMINDER_ID, DINNER_REMINDER_ID];
  assert.deepEqual(ids, [101, 102, 103]);
  assert.equal(new Set(ids).size, 3);
});

test('default meal reminder times are breakfast, lunch, and dinner', () => {
  assert.deepEqual(
    [
      [DEFAULT_REMINDER_HOUR, DEFAULT_REMINDER_MINUTE],
      [DEFAULT_LUNCH_HOUR, 0],
      [DEFAULT_DINNER_HOUR, 0],
    ],
    [[8, 0], [13, 0], [19, 0]],
  );
});

test('custom reminder channels define distinct Android sound profiles', () => {
  assert.equal(ALARM_REMINDER_CHANNEL_ID, 'tedbeera_alarm');
  assert.equal(GENTLE_REMINDER_CHANNEL_ID, 'tedbeera_gentle');
  assert.equal(VIBRATE_REMINDER_CHANNEL_ID, 'tedbeera_vibrate');

  const alarm = CUSTOM_REMINDER_CHANNELS.find(c => c.id === 'tedbeera_alarm');
  const gentle = CUSTOM_REMINDER_CHANNELS.find(c => c.id === 'tedbeera_gentle');
  const vibrate = CUSTOM_REMINDER_CHANNELS.find(c => c.id === 'tedbeera_vibrate');

  assert.equal(alarm?.importance, 5);
  assert.equal(alarm?.vibration, true);
  assert.equal(alarm?.sound, 'tedbeera_alarm.wav');

  assert.equal(gentle?.importance, 4);
  assert.equal(gentle?.vibration, true);
  assert.equal(gentle?.sound, undefined);

  assert.equal(vibrate?.importance, 3);
  assert.equal(vibrate?.vibration, true);
  assert.equal(vibrate?.sound, 'tedbeera_silent.wav');
});

test('getChannelIdForSoundProfile maps each profile to its Android channel', () => {
  assert.equal(getChannelIdForSoundProfile('alarm'), 'tedbeera_alarm');
  assert.equal(getChannelIdForSoundProfile('gentle'), 'tedbeera_gentle');
  assert.equal(getChannelIdForSoundProfile('vibrate'), 'tedbeera_vibrate');
  assert.equal(getChannelIdForSoundProfile(undefined), 'tedbeera_gentle');
});

test('persistent wake-up alarm defines explicit dismiss action and Egyptian wake-up phrasing', () => {
  assert.equal(ALARM_ACTION_TYPE_ID, 'TEDBEERA_ALARM_ACTIONS');
  assert.equal(ALARM_DISMISS_ACTION_ID, 'DISMISS_ALARM');
  assert.equal(ALARM_REPEAT_INTERVAL_MS, 4000);

  assert.equal(buildEgyptianAlarmPhrase(), 'يلا قومي صحي جوزك دلوقتي!');
  assert.equal(buildEgyptianAlarmPhrase('أصحي جوزي من النوم'), 'يلا قومي صحي جوزك دلوقتي!');
  assert.equal(buildEgyptianAlarmPhrase('دواء الصبح'), 'يلا قومي، ميعاد: دواء الصبح دلوقتي!');

  assert.equal(buildAlarmDisplayTitle(), 'يلا قومي صحي جوزك ⏰');
  assert.equal(buildAlarmDisplayTitle('أصحي جوزي من النوم'), 'يلا قومي صحي جوزك ⏰');
  assert.equal(buildAlarmDisplayTitle('موعد الدكتور'), 'موعد الدكتور ⏰');
});
