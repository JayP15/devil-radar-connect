import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Coordinator, makeProfile} from './core.js';
import {calendarInvite} from './calendar.js';
const base = Date.now() + 2 * 86_400_000;
function build() {
  const c = new Coordinator();
  c.join(makeProfile('a','Java, TypeScript','medium',base,base+180*60_000,60,45));
  c.join(makeProfile('b','Java, TypeScript','medium',base+120*60_000,base+240*60_000,45,45));
  return {c,s:c.find('a')!};
}
test('calendar invite requires both student approvals',()=>{
  const {c,s}=build();
  assert.throws(()=>calendarInvite(s),/two confirmed/);
  c.approve(s.id,'a');
  assert.throws(()=>calendarInvite(s),/two confirmed/);
  c.approve(s.id,'b');
  const ics=calendarInvite(s);
  assert.match(ics,/BEGIN:VCALENDAR\r\n/);
  assert.match(ics,/METHOD:PUBLISH/);
  assert.match(ics,/DTSTART:\d{8}T\d{6}Z/);
  assert.match(ics,/DTEND:\d{8}T\d{6}Z/);
  assert.match(ics,/SUMMARY:Mock Interview: Java\\, TypeScript/);
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
});
test('declined match never generates invite',()=>{
  const {c,s}=build(); c.decline(s.id,'b');
  assert.throws(()=>calendarInvite(s));
});
