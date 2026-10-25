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
 getProfiles(userId:string){return [...this.profiles.values()].filter(p=>p.userId===userId).sort((a,b)=>a.start-b.start);}
 snapshot(){return {version:2,profiles:[...this.profiles.entries()].map(([id,p])=>({...p,id})),sessions:[...this.sessions.values()].map(s=>({...s,approvals:[...s.approvals]}))};}
 restore(data:unknown){
  if(!data||typeof data!=='object')throw Error('Invalid saved data.');
  const d=data as {version:number;profiles:(Profile&{id?:string})[];sessions:(Omit<Session,'approvals'>&{approvals:string[]})[]};
  if(![1,2].includes(d.version)||!Array.isArray(d.profiles)||!Array.isArray(d.sessions))throw Error('Invalid saved data version.');
  this.profiles.clear();this.sessions.clear();
  for(const p of d.profiles){if(typeof p.userId!=='string'||!Number.isFinite(p.start)||!Number.isFinite(p.end))throw Error('Invalid saved profile.');const {id,...profile}=p;this.profiles.set(id||randomUUID().slice(0,12),{...profile,kind:p.kind||'interview'});}
  for(const s of d.sessions){if(typeof s.id!=='string'||!Array.isArray(s.approvals))throw Error('Invalid saved match.');this.sessions.set(s.id,{...s,kind:s.kind||'interview',approvals:new Set(s.approvals)});}
 }
 join(profile:Profile){
  const mine=this.getProfiles(profile.userId);
  const existing=[...this.profiles.entries()].find(([,p])=>p.userId===profile.userId&&p.kind===profile.kind&&p.topic.toLowerCase()===profile.topic.toLowerCase()&&p.difficulty===profile.difficulty&&p.start===profile.start&&p.end===profile.end&&p.preferredMinutes===profile.preferredMinutes&&p.minMinutes===profile.minMinutes);
  if(existing)return existing[0];
  if(mine.length>=10)throw Error('Maximum 10 open requests. Use /connect leave to reset your pool.');
  const id=randomUUID().slice(0,12);this.profiles.set(id,profile);this.onChange();return id;
 }
 leave(userId:string){for(const [id,p] of this.profiles){if(p.userId===userId)this.profiles.delete(id);}for(const s of this.sessions.values()){if(s.status==='PENDING'&&(s.a===userId||s.b===userId))s.status='DECLINED';}this.onChange();}
 private busy(userId:string,start:number,end:number){return [...this.sessions.values()].some(s=>s.status!=='DECLINED'&&(s.a===userId||s.b===userId)&&start<s.start+s.minutes*60000&&s.start<end);}
 find(requesterId:string):Session|null{
  const mine=this.getProfiles(requesterId).filter(p=>p.end>Date.now());if(!mine.length)throw Error('Use /connect join first.');
  for(const a of mine){
   const others=[...this.profiles.values()].filter(b=>b.userId!==a.userId&&b.end>Date.now()&&b.difficulty===a.difficulty&&b.kind===a.kind&&b.topic.toLowerCase()===a.topic.toLowerCase()&&b.optedIn);
   for(const b of others){const start=Math.max(a.start,b.start,Date.now()),end=Math.min(a.end,b.end);const agentA=new PersonalAgent(a),agentB=new PersonalAgent(b);
    if(start>=end)continue;
    const proposed=a.preferredMinutes;
    const sharedMinutes=Math.floor((end-start)/60000);
    const feasibleOffer=Math.min(proposed,sharedMinutes);
    const duration=agentB.counter(start,feasibleOffer);
    if(duration===null||!agentA.canAttend(start,duration))continue;
    if(this.busy(a.userId,start,start+duration*60000)||this.busy(b.userId,start,start+duration*60000))continue;
    const messages:AgentMessage[]=[{from:a.userId,to:b.userId,type:'MATCH_REQUEST',detail:`Propose ${proposed} minutes at ${format(start)} for ${a.topic}.`}];
    if(duration!==proposed)messages.push({from:b.userId,to:a.userId,type:'COUNTER_PROPOSAL',detail:`Shared availability and preferences support ${duration} minutes at ${format(start)}.`});
    if(!agentA.canAttend(start,duration)||!agentB.canAttend(start,duration))continue;
    messages.push({from:a.userId,to:b.userId,type:'PROPOSAL_ACCEPTED',detail:`Both agents accept ${duration} minutes; requesting explicit human approvals.`});
    const s:Session={id:randomUUID().slice(0,12),a:a.userId,b:b.userId,topic:a.topic,difficulty:a.difficulty,kind:a.kind,start,minutes:duration,status:'PENDING',approvals:new Set(),messages};
    this.sessions.set(s.id,s);this.onChange();return s;
   }
  }return null;
 }
 approve(id:string,userId:string):Session{const s=this.sessions.get(id);if(!s)throw Error('Match not found.');if(s.status!=='PENDING')throw Error(`This match is ${s.status.toLowerCase()}.`);if(userId!==s.a&&userId!==s.b)throw Error('Only matched students can approve.');
  if(!this.getProfiles(s.a).length||!this.getProfiles(s.b).length)throw Error('A student opted out.');
  s.approvals.add(userId);if(s.approvals.has(s.a)&&s.approvals.has(s.b))s.status='CONFIRMED';this.onChange();return s;}
 decline(id:string,userId:string):Session{const s=this.sessions.get(id);if(!s)throw Error('Match not found.');if(userId!==s.a&&userId!==s.b)throw Error('Only matched students can decline.');if(s.status==='CONFIRMED')throw Error('Already confirmed.');s.status='DECLINED';this.onChange();return s;}
}
export function format(ms:number){return new Intl.DateTimeFormat('en-US',{timeZone:'America/Phoenix',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(ms);}
export function trace(s:Session){return s.messages.map((m,i)=>`${i+1}. ${m.type}: ${m.detail}`).join('\n');}
