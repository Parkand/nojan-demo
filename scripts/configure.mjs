import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import input from '@inquirer/input';
import password from '@inquirer/password';
if (existsSync('.env')) { console.error('.env already exists. Edit it manually; no settings were overwritten.'); process.exit(1); }
try {
  const host=(await input({message:'MySQL host:',default:'127.0.0.1'})).trim();
  const port=(await input({message:'MySQL port:',default:'3306'})).trim();
  const database=(await input({message:'Database name:',default:'nozhan'})).trim();
  const user=(await input({message:'MySQL username:',default:'nozhan'})).trim();
  const secret=await password({message:'MySQL password:',mask:'*'});
  if(!/^[a-zA-Z0-9.-]+$/.test(host)||!/^\d+$/.test(port)||Number(port)<1||Number(port)>65535||!/^[a-zA-Z0-9_]+$/.test(database)||!user) throw new Error('Invalid database settings.');
  const enc=encodeURIComponent;
  const url=`mysql://${enc(user)}:${enc(secret)}@${host}:${port}/${database}`;
  writeFileSync('.env',`DATABASE_URL="${url}"\nSESSION_SECRET="${randomBytes(48).toString('hex')}"\n# Local HTTP only; use true behind HTTPS.\nCOOKIE_SECURE="false"\n`,{flag:'wx',mode:0o600});
  console.log('.env created. Next: npm run db:deploy');
} catch(error) {console.error(error.message);process.exitCode=1;}
