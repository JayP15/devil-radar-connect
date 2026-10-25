import 'dotenv/config';
import {Client,GatewayIntentBits,Events,ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags, type ChatInputCommandInteraction, type ButtonInteraction} from 'discord.js';
import {Coordinator,makeProfile,parseWindow,format,trace,type Session,type SessionKind} from './core.js';
import {loadCoordinator,saveCoordinator} from './storage.js';
const token=process.env.DISCORD_TOKEN;if(!token)throw Error('Missing DISCORD_TOKEN in .env');
const bot=new Client({intents:[GatewayIntentBits.Guilds]});const coordinator=new Coordinator(()=>saveCoordinator(coordinator));loadCoordinator(coordinator);
function buttons(s:Session){return new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`yes:${s.id}`).setLabel('Approve match').setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId(`no:${s.id}`).setLabel('Decline').setStyle(ButtonStyle.Danger));}
const sessionText=(s:Session)=>`**Devil Radar Connect — Match Proposal**\n${s.kind==='study'?'Study session':'Mock interview'} topic: **${s.topic}** (${s.difficulty})\n**${format(s.start)}**, **${s.minutes} minutes**\nPartner: <@${s.a}> + <@${s.b}>\n\n**Agent-to-agent negotiation:**\n${trace(s)}\n\nBoth students must approve. No external calendar events will be created.`;
async function notify(s:Session){for(const uid of [s.a,s.b]){try{const user=await bot.users.fetch(uid);await user.send({content:sessionText(s),components:[buttons(s)]});}catch(e){console.warn(`Could not DM ${uid}:`,e);}}}
async function handleCommand(i:ChatInputCommandInteraction){const sub=i.options.getSubcommand();
 try{
 if(sub==='join'){
  const kind=i.options.getString('kind') as SessionKind|null;const topic=i.options.getString('topic',true),difficulty=i.options.getString('difficulty',true) as 'easy'|'medium'|'hard',date=i.options.getString('date',true),start=i.options.getString('start',true),end=i.options.getString('end',true),pref=i.options.getInteger('minutes',true),min=i.options.getInteger('minimum',true);
  const [a,b]=parseWindow(date,start,end);coordinator.join(makeProfile(i.user.id,topic,difficulty,a,b,pref,min,kind||'interview'));
  await i.reply({content:`✅ Opted in for **${kind||'interview'}: ${topic}** (${difficulty}). Available **${format(a)}–${format(b)}**. Preferred ${pref} minutes, minimum ${min}. Only your selected preferences enter the matching pool. Run **/connect find**.`,flags:MessageFlags.Ephemeral});return;
 }
 if(sub==='leave'){coordinator.leave(i.user.id);await i.reply({content:'✅ Opted out. Pending matches were canceled.',flags:MessageFlags.Ephemeral});return;}
 if(sub==='profile'){const p=coordinator.profiles.get(i.user.id);await i.reply({content:p?`Your opt-in: **${p.kind}: ${p.topic}** · ${p.difficulty} · ${format(p.start)}–${format(p.end)} · ${p.preferredMinutes} preferred/${p.minMinutes} minimum minutes`:'No active opt-in. Use /connect join.',flags:MessageFlags.Ephemeral});return;}
 if(sub==='find'){
  await i.deferReply({flags:MessageFlags.Ephemeral});const s=coordinator.find(i.user.id);
  if(!s){await i.editReply('No compatible opted-in student with a feasible overlapping time window yet. Ask another student to join.');return;}
  await notify(s);await i.editReply(`${sessionText(s)}\n\nApproval requests were attempted by DM. If DMs are disabled, run **/connect pending** to access your buttons privately.`);return;
 }
 if(sub==='pending'){const s=[...coordinator.sessions.values()].find(s=>s.status==='PENDING'&&(s.a===i.user.id||s.b===i.user.id));if(!s){await i.reply({content:'No pending proposal.',flags:MessageFlags.Ephemeral});return;}await i.reply({content:sessionText(s),components:[buttons(s)],flags:MessageFlags.Ephemeral});return;}
 }catch(e){const message=e instanceof Error?e.message:String(e);if(i.deferred||i.replied)await i.followUp({content:`⚠️ ${message}`,flags:MessageFlags.Ephemeral});else await i.reply({content:`⚠️ ${message}`,flags:MessageFlags.Ephemeral});}
}
async function handleButton(i:ButtonInteraction){try{const [action,id]=i.customId.split(':');if(!['yes','no'].includes(action))return;const s=action==='yes'?coordinator.approve(id,i.user.id):coordinator.decline(id,i.user.id);await i.reply({content:action==='no'?'You declined the session.':s.status==='CONFIRMED'?'✅ Both students approved! Session confirmed.':'✅ Your approval recorded. Waiting for the other student.',flags:MessageFlags.Ephemeral});
 if(s.status==='CONFIRMED'||s.status==='DECLINED'){for(const uid of [s.a,s.b]){try{await (await bot.users.fetch(uid)).send(s.status==='CONFIRMED'?`✅ **SESSION CONFIRMED**: ${s.topic}, ${format(s.start)}, ${s.minutes} minutes. Partner: <@${uid===s.a?s.b:s.a}>. Arrange your call directly; no meeting link was created.`:'❌ The match was declined. No session was scheduled.');}catch{}}}
 }catch(e){await i.reply({content:`⚠️ ${e instanceof Error?e.message:e}`,flags:MessageFlags.Ephemeral});}}
bot.on(Events.InteractionCreate,async i=>{if(i.isChatInputCommand()&&i.commandName==='connect')await handleCommand(i);else if(i.isButton())await handleButton(i);});
bot.once(Events.ClientReady,c=>console.log(`Devil Radar Connect online as ${c.user.tag}. Guild slash commands ready.`));
await bot.login(token);
