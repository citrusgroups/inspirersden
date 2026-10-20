import { readJson } from '@/lib/json';
import { database, fileStore } from './storage';
import { cookies } from 'next/headers';
import { creators,initialPackages,defaultSettings } from './seed';
import type { Member,Entry } from './types';
export function config(key:string){return process.env[key] || '';}
export const db=database;
export const bucket=fileStore;
export const now=()=>new Date().toISOString();
export const id=()=>crypto.randomUUID();
export async function hash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');}
export function fail(message:string,status=400):never{throw Object.assign(new Error(message),{status});}
export async function auditAction(user:Member,action:string,recordId?:string){await db().prepare('INSERT INTO audit (id,actor,action,record_id,created) VALUES (?,?,?,?,?)').bind(id(),user.email,action,recordId??null,now()).run();}
export function unpack(row:Entry):Entry{return {...row,data:typeof row.data==='string'?JSON.parse(row.data):row.data};}
export async function getRecord(recordId:string){const r=await db().prepare('SELECT * FROM records WHERE id=?').bind(recordId).first<Entry>();return r?unpack(r):null;}
export async function getSettings(){const r=await db().prepare('SELECT data FROM preferences WHERE id=?').bind('agency').first<{data:string}>();return r?JSON.parse(r.data):defaultSettings;}
export async function identity():Promise<Member|null>{
 const jar=await cookies(); const token=jar.get('id_access')?.value;let identityId='',email='',name='';
 if(token&&config('SUPABASE_URL')&&config('SUPABASE_ANON_KEY')){const r=await fetch(config('SUPABASE_URL')+'/auth/v1/user',{headers:{apikey:config('SUPABASE_ANON_KEY'),Authorization:'Bearer '+token}});if(r.ok){const u=await readJson(r);if(u.email_confirmed_at){identityId='sb:'+u.id;email=u.email.toLowerCase();name=u.user_metadata?.name||email;}}}
 if(!identityId)return null;
 let member=await db().prepare('SELECT * FROM members WHERE email=?').bind(email).first<Member>();
 if(!member){
  const owner=config('AGENCY_OWNER_EMAIL').trim().toLowerCase();
  await db().prepare('INSERT OR IGNORE INTO members (id,email,name,role,active,created) VALUES (?,?,?,?,1,?)').bind(identityId,email,name,owner&&email===owner?'Agency Owner':'Influencer',now()).run();
  member=await db().prepare('SELECT * FROM members WHERE email=?').bind(email).first<Member>();
 }
 if(!member?.active)return null;
 if(member.influencer_id){const profile=await getRecord(member.influencer_id);member.influencer_niche=String(profile?.data.niche||'');}
 return member;
}
export async function requireUser(){const u=await identity();if(!u)fail('Sign in to continue.',401);return u;}
export function staff(u:Member){return ['Agency Owner','Admin','Manager'].includes(u.role);}
export function admin(u:Member){return ['Agency Owner','Admin'].includes(u.role);}
export function canRead(u:Member,r:Entry){if(admin(u))return true;if(u.role==='Manager')return r.kind==='package'||r.data.assigned===u.email;if(u.role==='Influencer')return r.kind==='influencer'&&r.id===u.influencer_id||r.kind==='campaign'&&(r.data.influencerIds as string[]||[]).includes(u.influencer_id||'')||r.kind==='package'&&((r.data.influencerIds as string[]||[]).includes(u.influencer_id||'')||!((r.data.influencerIds as string[]||[]).length)&&(!r.data.niche||r.data.niche==='All'||r.data.niche===u.influencer_niche));return false;}
export function canWrite(u:Member,r:Entry){return admin(u)||u.role==='Manager'&&r.kind!=='package'&&r.data.assigned===u.email||u.role==='Influencer'&&r.kind==='influencer'&&r.id===u.influencer_id;}
export async function seed(u:Member){if(!admin(u))return;const n=await db().prepare('SELECT data FROM preferences WHERE id=?').bind('initialized').first();if(n)return;
 const rows=[...creators.map((data,i)=>({id:'INF-'+String(i+1).padStart(4,'0'),kind:'influencer',slug:String(data.name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,''),data})),...initialPackages.map((data,i)=>({id:'PKG-'+String(i+1).padStart(4,'0'),kind:'package',slug:null,data}))];
 await db().batch([...rows.map(r=>db().prepare('INSERT OR IGNORE INTO records (id,kind,slug,data,created,updated,version) VALUES (?,?,?,?,?,?,1)').bind(r.id,r.kind,r.slug,JSON.stringify(r.data),now(),now())),db().prepare('INSERT OR IGNORE INTO preferences (id,data) VALUES (?,?)').bind('agency',JSON.stringify(defaultSettings)),db().prepare('INSERT OR IGNORE INTO preferences (id,data) VALUES (?,?)').bind('initialized','true')]);
}
