import { SilaApplication } from "../../../components/sila/application/application";
import { SAMPLE_SCREEN_PATHS } from "../../../lib/sila/sample-paths";
export const dynamicParams=false;
export function generateStaticParams(){return SAMPLE_SCREEN_PATHS.map(path=>({path:path.split("/")}));}
export default async function Page({params}:{params:Promise<{path:string[]}>}){return <SilaApplication path={(await params).path}/>;}
