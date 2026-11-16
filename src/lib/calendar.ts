import { ActionSheetIOS, Alert, Linking, Platform } from 'react-native';
import type { EventOccurrence } from './events';

// "Add to calendar" opens a one-event .ics from our server (functions/calendar.js). On iPhone,
// Safari shows Apple's "Add to Calendar" prompt; no calendar permission needed.
const BASE = 'https://collab-609ac.web.app/cal/event.ics';

export function calendarUrl(e: EventOccurrence) {
  const q = new URLSearchParams({
    t: e.title,
    s: String(e.start),
    ...(e.end ? { e: String(e.end) } : {}),
    l: `${e.venue}, ${e.address}`,
    d: [e.description, e.cost ? `Cost: ${e.cost}` : '', e.signUp ? `Sign-up: ${e.signUp}` : ''].filter(Boolean).join('\n'),
    ...(e.link ? { u: e.link } : {}),
  });
  return `${BASE}?${q.toString()}`;
}

const gStamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Google Calendar's "add event" page (opens the Google Calendar app if it's installed). */
export function googleCalendarUrl(e: EventOccurrence) {
  const end = e.end ?? e.start + 3 * 3600e3;
  const details = [e.description, e.cost ? `Cost: ${e.cost}` : '', e.signUp ? `Sign-up: ${e.signUp}` : '', e.link ?? '', 'Found on Collab']
    .filter(Boolean)
    .join('\n\n');
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${gStamp(e.start)}/${gStamp(end)}`,
    location: `${e.venue}, ${e.address}`,
    details,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export function addToAppleCalendar(e: EventOccurrence) {
  return Linking.openURL(calendarUrl(e));
}

export function addToGoogleCalendar(e: EventOccurrence) {
  return Linking.openURL(googleCalendarUrl(e));
}

const failed = () => Alert.alert('Couldn’t open your calendar', 'Try again in a moment.');

/** Asks which calendar, then opens it. */
export function chooseCalendar(e: EventOccurrence, title = 'Add to calendar') {
  const apple = () => addToAppleCalendar(e).catch(failed);
  const google = () => addToGoogleCalendar(e).catch(failed);
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options: ['Apple Calendar', 'Google Calendar', 'Cancel'], cancelButtonIndex: 2 },
      (i) => (i === 0 ? apple() : i === 1 ? google() : undefined),
    );
  } else {
    Alert.alert(title, undefined, [
      { text: 'Google Calendar', onPress: google },
      { text: 'Other calendar (.ics)', onPress: apple },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }
}
