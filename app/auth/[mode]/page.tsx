import {notFound} from 'next/navigation';
import Auth from '@/components/auth';
export const metadata={title:'Agency account'};
export default async function Page({params}:{params:Promise<{mode:string}>}){const {mode}=await params;if(!['login','signup','forgot','reset','verify','invite'].includes(mode))notFound();return <Auth mode={mode}/>}
