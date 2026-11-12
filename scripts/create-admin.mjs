import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import input from '@inquirer/input';
import password from '@inquirer/password';
const db=new PrismaClient();
async function main() {
  if(await db.user.count({where:{role:'ADMIN',deletedAt:null}})) {
    if(process.argv.includes('--if-missing')) { console.log('Active admin already exists; skipped.'); return; }
    throw new Error('An active admin already exists. Use the Users page to add another.');
  }
  const name=(await input({message:'Admin display name:'})).trim();
  const username=(await input({message:'Admin username (English):'})).trim().toLowerCase();
  const secret=await password({message:'Admin password (10-64 characters):',mask:'*'});
  const confirm=await password({message:'Repeat password:',mask:'*'});
  if(name.length<2||name.length>100||! /^[a-z0-9_.-]{3,64}$/.test(username)||secret.length<10||secret.length>64||Buffer.byteLength(secret)>72||secret!==confirm) throw new Error('Invalid name/username/password, or passwords do not match.');
  const passwordHash=await bcrypt.hash(secret,12);
  await db.$transaction(async tx=>{
    if(await tx.user.count({where:{role:'ADMIN',deletedAt:null}})) throw new Error('An admin was created concurrently.');
    const admin=await tx.user.create({data:{name,username,passwordHash,role:'ADMIN'}});
    await tx.user.update({where:{id:admin.id},data:{createdById:admin.id,updatedById:admin.id}});
  },{isolationLevel:'Serializable'});
  console.log('Admin created successfully.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
