import {Coordinator,makeProfile,format,trace} from './core.js';
const c=new Coordinator();
const startA=Date.parse('2026-11-01T14:00:00-07:00'),endA=Date.parse('2026-11-01T17:00:00-07:00');
const startB=Date.parse('2026-11-01T16:00:00-07:00'),endB=Date.parse('2026-11-01T19:00:00-07:00');
c.join(makeProfile('student-A','Java','medium',startA,endA,60,45));c.join(makeProfile('student-B','Java','medium',startB,endB,45,45));
const s=c.find('student-A');if(!s)throw Error('Match failure');
console.log(`Matched ${format(s.start)} for ${s.minutes} minutes`);console.log(trace(s));
c.approve(s.id,'student-A');console.log('After A approval:',s.status);c.approve(s.id,'student-B');console.log('After B approval:',s.status);
