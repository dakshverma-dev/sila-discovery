import { SilaApplication } from "@/components/sila/application/application";
export const metadata={title:"Workspace"};
export default async function Page({params}:{params:Promise<{path?:string[]}>}){return <SilaApplication path={(await params).path??[]} base="/sample"/>;}
