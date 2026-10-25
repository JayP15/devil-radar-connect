import {existsSync, readFileSync, writeFileSync, renameSync, mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import type {Coordinator} from './core.js';
const file=resolve(process.env.DEVIL_RADAR_DATA_FILE||'.data/matches.json');
export function saveCoordinator(c:Coordinator){
  mkdirSync(dirname(file),{recursive:true});
  const tmp=`${file}.tmp`;
  writeFileSync(tmp,JSON.stringify(c.snapshot(),null,2),{mode:0o600});
  renameSync(tmp,file);
}
export function loadCoordinator(c:Coordinator){
  if(!existsSync(file))return;
  c.restore(JSON.parse(readFileSync(file,'utf8')));
  console.log(`Restored ${c.profiles.size} opted-in profiles and ${c.sessions.size} sessions.`);
}
