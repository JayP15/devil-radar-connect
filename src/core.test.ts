import {test} from 'node:test';import assert from 'node:assert/strict';import {Coordinator,makeProfile} from './core.js';
const base=Date.now()+86_400_000;
function setup(endA=180,endB=240){const c=new Coordinator();c.join(makeProfile('a','Java','medium',base,base+endA*60000,60,45));c.join(makeProfile('b','java','medium',base+120*60000,base+endB*60000,45,45));return c;}
test('agents counter 60 with 45 and mutual approval is required',()=>{const c=setup();const s=c.find('a');assert.ok(s);assert.equal(s.minutes,45);assert.equal(s.messages[1].type,'COUNTER_PROPOSAL');c.approve(s.id,'a');assert.equal(s.status,'PENDING');c.approve(s.id,'b');assert.equal(s.status,'CONFIRMED');assert.equal(s.approvals.size,2);});
test('no overlap means no match',()=>assert.equal(setup(100).find('a'),null));
test('decline prevents confirmation',()=>{const c=setup();const s=c.find('a')!;c.decline(s.id,'b');assert.throws(()=>c.approve(s.id,'a'));});
test('unrelated user cannot approve',()=>{const c=setup();const s=c.find('a')!;assert.throws(()=>c.approve(s.id,'intruder'));});
test('opt out cancels pending match',()=>{const c=setup();const s=c.find('a')!;c.leave('b');assert.equal(s.status,'DECLINED');});

test('study sessions match independently from interviews',()=>{const c=new Coordinator();c.join(makeProfile('a','CSE 110','medium',base,base+180*60000,60,45,'study'));c.join(makeProfile('b','CSE 110','medium',base+120*60000,base+240*60000,45,45,'interview'));assert.equal(c.find('a'),null);c.join(makeProfile('b','CSE 110','medium',base+120*60000,base+240*60000,45,45,'study'));assert.equal(c.find('a')?.kind,'study');});
test('session state persists through snapshot and restore',()=>{const c=setup();const s=c.find('a')!;c.approve(s.id,'a');const r=new Coordinator();r.restore(JSON.parse(JSON.stringify(c.snapshot())));assert.equal(r.sessions.get(s.id)?.approvals.has('a'),true);assert.equal(r.approve(s.id,'b').status,'CONFIRMED');});
test('mutation callback triggers state save',()=>{let n=0;const c=new Coordinator(()=>{n++});c.join(makeProfile('a','Java','medium',base,base+180*60000,60,45));c.leave('a');assert.equal(n,2);});

test('tight overlap negotiates feasible 45 minutes instead of dropping match',()=>{const c=new Coordinator();c.join(makeProfile('a','Java','medium',base,base+180*60000,60,45));c.join(makeProfile('b','Java','medium',base+135*60000,base+220*60000,60,45));const s=c.find('a');assert.ok(s);assert.equal(s.minutes,45);assert.equal(s.messages[1]?.type,'COUNTER_PROPOSAL');});
