import type {Session} from './core.js';

function icsDate(timestamp: number): string {
  return new Date(timestamp).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}
function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}
function fold(line: string): string {
  // iCalendar lines are limited to 75 octets. Fold at Unicode code-point boundaries.
  const chunks: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const n = Buffer.byteLength(char);
    if (bytes + n > 73 && current) { chunks.push(current); current = ' '; bytes = 1; }
    current += char; bytes += n;
  }
  chunks.push(current);
  return chunks.join('\r\n');
}
export function calendarInvite(s: Session): string {
  if (s.status !== 'CONFIRMED' || !s.approvals.has(s.a) || !s.approvals.has(s.b)) {
    throw Error('Calendar invite requires two confirmed student approvals.');
  }
  if (!Number.isFinite(s.start) || !Number.isFinite(s.minutes) || s.minutes <= 0) {
    throw Error('Invalid session time.');
  }
  const label = s.kind === 'study' ? 'Study Session' : 'Mock Interview';
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Devil Radar Connect//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${s.id}@devil-radar-connect`,
    `DTSTAMP:${icsDate(Date.now())}`,
    `DTSTART:${icsDate(s.start)}`,
    `DTEND:${icsDate(s.start + s.minutes * 60_000)}`,
    `SUMMARY:${escapeText(`${label}: ${s.topic}`)}`,
    `DESCRIPTION:${escapeText('Opt-in peer session coordinated by Devil Radar Connect. Participants agreed in Discord. Coordinate the meeting link directly; none has been created.')}`,
    'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
