import { randomUUID } from 'node:crypto';
export type Difficulty='easy'|'medium'|'hard';
export type SessionKind='interview'|'study';
export type Profile={userId:string;topic:string;difficulty:Difficulty;start:number;end:number;preferredMinutes:number;minMinutes:number;optedIn:true;kind:SessionKind};
export type AgentMessage={from:string;to:string;type:'MATCH_REQUEST'|'COUNTER_PROPOSAL'|'PROPOSAL_ACCEPTED';detail:string};
export type Session={id:string;a:string;b:string;topic:string;difficulty:Difficulty;start:number;minutes:number;kind:SessionKind;status:'PENDING'|'CONFIRMED'|'DECLINED';approvals:Set<string>;messages:AgentMessage[]};
const allowed=[30,45,60,90];
export function parseWindow(day:string,startHHMM:string,endHHMM:string):[number,number]{
  // Arizona is UTC-7 year-round. Restrict MVP to this explicitly; reject malformed input.
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(startHHMM)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(endHHMM))throw Error('Use YYYY-MM-DD and HH:mm (24-hour Arizona time).');
  const start=Date.parse(`${day}T${startHHMM}:00-07:00`),end=Date.parse(`${day}T${endHHMM}:00-07:00`);
  if(!Number.isFinite(start)||!Number.isFinite(end)||new Date(start-7*3600_000).toISOString().slice(0,10)!==day||end<=start) throw Error('Invalid window: end must be after start on the same day.');
  if(end<=Date.now())throw Error('Availability must be in the future.');
  return [start,end];
}
export function makeProfile(userId:string,topic:string,difficulty:Difficulty,start:number,end:number,preferredMinutes:number,minMinutes:number,kind:SessionKind='interview'):Profile{
 if(!topic.trim()||topic.length>60||!allowed.includes(preferredMinutes)||!allowed.includes(minMinutes)||minMinutes>preferredMinutes||end<=start) throw Error('Invalid profile.');
 return {userId,topic:topic.trim(),difficulty,start,end,preferredMinutes,minMinutes,optedIn:true,kind};
}
// Each agent independently evaluates proposals against its OWN student's constraints.
export class PersonalAgent{
 constructor(readonly profile:Profile){}
 canAttend(start:number,minutes:number){return start>=this.profile.start&&start+minutes*60_000<=this.profile.end&&minutes>=this.profile.minMinutes&&minutes<=this.profile.preferredMinutes;}
 counter(start:number,offeredMinutes:number){const minutes=Math.min(this.profile.preferredMinutes,offeredMinutes);return this.canAttend(start,minutes)?minutes:null;}
}
export class Coordinator{
 readonly profiles=new Map<string,Profile>();
 readonly sessions=new Map<string,Session>();
 constructor(private onChange:()=>void=()=>{}){}
 snapshot(){return {version:1,profiles:[...this.profiles.values()],sessions:[...this.sessions.values()].map(s=>({...s,approvals:[...s.approvals]}))};}
 restore(data:unknown){
  if(!data||typeof data!=='object')throw Error('Invalid saved data.');
  const d=data as ReturnType<Coordinator['snapshot']>;
  if(d.version!==1||!Array.isArray(d.profiles)||!Array.isArray(d.sessions))throw Error('Invalid saved data version.');
  this.profiles.clear();this.sessions.clear();
  for(const p of d.profiles){if(typeof p.userId!=='string'||!Number.isFinite(p.start)||!Number.isFinite(p.end))throw Error('Invalid saved profile.');this.profiles.set(p.userId,{...p,kind:p.kind||'interview'});}
  for(const s of d.sessions){if(typeof s.id!=='string'||!Array.isArray(s.approvals))throw Error('Invalid saved match.');this.sessions.set(s.id,{...s,kind:s.kind||'interview',approvals:new Set(s.approvals)});}
 }
 join(profile:Profile){this.profiles.set(profile.userId,profile);this.onChange();}
 leave(userId:string){this.profiles.delete(userId);for(const s of this.sessions.values()){if(s.status==='PENDING'&&(s.a===userId||s.b===userId))s.status='DECLINED';}this.onChange();}
 find(requesterId:string):Session|null{
  const a=this.profiles.get(requesterId);if(!a)throw Error('Use /join first.');
  if([...this.sessions.values()].some(s=>s.status==='PENDING'&&(s.a===requesterId||s.b===requesterId)))throw Error('You already have a pending match.');
  const other=[...this.profiles.values()].filter(b=>b.userId!==a.userId&&b.difficulty===a.difficulty&&b.kind===a.kind&&b.topic.toLowerCase()===a.topic.toLowerCase()&&b.optedIn&&!([...this.sessions.values()].some(s=>s.status==='PENDING'&&(s.a===b.userId||s.b===b.userId))));
  for(const b of other){const start=Math.max(a.start,b.start),end=Math.min(a.end,b.end);const agentA=new PersonalAgent(a),agentB=new PersonalAgent(b);
   if(start>=end)continue;
   const messages:AgentMessage[]=[];
   const proposed=a.preferredMinutes;
   messages.push({from:a.userId,to:b.userId,type:'MATCH_REQUEST',detail:`Propose ${proposed} minutes at ${format(start)} for ${a.topic}.`});
   // Negotiate a duration that both agents can attend within actual shared availability.
   const sharedMinutes=Math.floor((end-start)/60_000);
   const feasibleOffer=Math.min(proposed,sharedMinutes);
   let duration:number|null=agentB.counter(start,feasibleOffer);
   if(duration===null||!agentA.canAttend(start,duration))continue;
   if(duration!==proposed)messages.push({from:b.userId,to:a.userId,type:'COUNTER_PROPOSAL',detail:`Shared availability and preferences support ${duration} minutes at ${format(start)}.`});
   // Both independently validate the final offer; never fabricate a mutual agreement.
   if(!agentA.canAttend(start,duration)||!agentB.canAttend(start,duration))continue;
   messages.push({from:a.userId,to:b.userId,type:'PROPOSAL_ACCEPTED',detail:`Both agents accept ${duration} minutes; requesting explicit human approvals.`});
   const s:Session={id:randomUUID().slice(0,12),a:a.userId,b:b.userId,topic:a.topic,difficulty:a.difficulty,kind:a.kind,start,minutes:duration,status:'PENDING',approvals:new Set(),messages};
   this.sessions.set(s.id,s);this.onChange();return s;
  }return null;
 }
 approve(id:string,userId:string):Session{const s=this.sessions.get(id);if(!s)throw Error('Match not found.');if(s.status!=='PENDING')throw Error(`This match is ${s.status.toLowerCase()}.`);if(userId!==s.a&&userId!==s.b)throw Error('Only matched students can approve.');
  if(!this.profiles.has(s.a)||!this.profiles.has(s.b))throw Error('A student opted out.');
  s.approvals.add(userId);if(s.approvals.has(s.a)&&s.approvals.has(s.b))s.status='CONFIRMED';this.onChange();return s;}
 decline(id:string,userId:string):Session{const s=this.sessions.get(id);if(!s)throw Error('Match not found.');if(userId!==s.a&&userId!==s.b)throw Error('Only matched students can decline.');if(s.status==='CONFIRMED')throw Error('Already confirmed.');s.status='DECLINED';this.onChange();return s;}
}
export function format(ms:number){return new Intl.DateTimeFormat('en-US',{timeZone:'America/Phoenix',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(ms);}
export function trace(s:Session){return s.messages.map((m,i)=>`${i+1}. ${m.type}: ${m.detail}`).join('\n');}
