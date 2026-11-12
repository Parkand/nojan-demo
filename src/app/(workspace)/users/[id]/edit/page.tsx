import { notFound } from 'next/navigation';
import { UserEditor } from '@/components/user-editor';
export const metadata={title:'ویرایش کاربر'};
export default async function Page({params}:{params:Promise<{id:string}>}){const id=Number((await params).id);if(!Number.isSafeInteger(id)||id<1||id>2147483647)notFound();return <UserEditor id={id}/>;}
