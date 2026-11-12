import { notFound } from 'next/navigation';
import { ProductEditor } from '@/components/product-editor';
export const metadata={title:'ویرایش کالا'};
export default async function Page({params}:{params:Promise<{id:string}>}){const id=Number((await params).id);if(!Number.isSafeInteger(id)||id<1||id>2147483647)notFound();return <ProductEditor id={id}/>;}
