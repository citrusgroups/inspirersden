import { z } from 'zod';
import { definitions } from './types';
export function validateRecord(kind:string,input:unknown){if(!definitions[kind])throw new Error('Unknown record type.');const shape:Record<string,z.ZodTypeAny>={};
 for(const f of definitions[kind]){let field:z.ZodTypeAny;
  if(f.type==='multi-influencer')field=z.array(z.string().max(100)).max(100).default([]);
  else if(f.type==='number')field=z.coerce.number().finite().min(0).max(1e12).default(0);
  else if(f.options)field=z.enum(f.options as [string,...string[]]).default(f.options[0]);
  else {let s=z.string().trim().max(f.type==='textarea'?10000:500);if(f.required)s=s.min(1,`${f.label} is required`);if(f.type==='email')field=s.email().or(z.literal('')).default('');else if(f.type==='url')field=s.url().refine(v=>v.startsWith('https://'),'Use an HTTPS URL').or(z.literal('')).default('');else if(f.type==='date')field=s.regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).default('');else field=s.default('');}
  shape[f.key]=field;
 }
 return z.object(shape).parse(input);
}
export const inquirySchema=z.object({name:z.string().trim().min(2).max(100),company:z.string().trim().max(200).default(''),email:z.string().email().max(200),phone:z.string().trim().min(7).max(40),type:z.enum(['Brand collaboration','Influencer application','General inquiry']),budget:z.string().max(100),message:z.string().trim().min(10).max(5000),website:z.string().max(0).optional()});
