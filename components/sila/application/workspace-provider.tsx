"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import { applyWorkspaceCommand, createSampleWorkspace, SAMPLE_ACCOUNTS, SAMPLE_STORAGE_KEY, type SampleAccountId, type SampleWorkspace, type WorkspaceCommand, type WorkspaceResult } from "@/lib/sila/sample-workspace";

interface Snapshot { data:SampleWorkspace; account:SampleAccountId; ready:boolean; persistenceError:string|null }
interface WorkspaceContext extends Snapshot {
  switchAccount:(id:SampleAccountId)=>void;
  command:(command:Omit<WorkspaceCommand,"actor"|"key">)=>Promise<WorkspaceResult>;
  reset:()=>void;
}
const Context=createContext<WorkspaceContext|null>(null);
const serverSnapshot:Snapshot={data:createSampleWorkspace(),account:"meadows",ready:false,persistenceError:null};
let clientSnapshot:Snapshot|undefined;
const listeners=new Set<()=>void>();
function readSaved():SampleWorkspace|null {
  const raw=localStorage.getItem(SAMPLE_STORAGE_KEY);if(!raw)return null;
  const data=JSON.parse(raw) as SampleWorkspace;
  if(data.schema!==1||!Array.isArray(data.sessions)||!Array.isArray(data.plans)||!Array.isArray(data.activity))throw Error("Unsupported sample data");
  return data;
}
function getSnapshot():Snapshot {
  if(clientSnapshot)return clientSnapshot;
  try{const account=localStorage.getItem(SAMPLE_STORAGE_KEY+".account");clientSnapshot={data:readSaved()??createSampleWorkspace(),account:account&&account in SAMPLE_ACCOUNTS?account as SampleAccountId:"meadows",ready:true,persistenceError:null};}
  catch{clientSnapshot={...serverSnapshot,ready:true,persistenceError:"Saved sample records could not be read. Reset them from the account menu to start again."};}
  return clientSnapshot;
}
function publish(next:Snapshot){clientSnapshot=next;for(const fn of listeners)fn();}
function sync(event:StorageEvent){if(event.key!==SAMPLE_STORAGE_KEY)return;try{publish({...getSnapshot(),data:readSaved()??createSampleWorkspace(),persistenceError:null});}catch{publish({...getSnapshot(),persistenceError:"The saved sample workspace could not be refreshed."});}}
function subscribe(fn:()=>void){listeners.add(fn);if(listeners.size===1)window.addEventListener("storage",sync);return()=>{listeners.delete(fn);if(listeners.size===0)window.removeEventListener("storage",sync);};}
export function WorkspaceProvider({children}:{children:React.ReactNode}) {
  const snapshot=useSyncExternalStore(subscribe,getSnapshot,()=>serverSnapshot);
  const switchAccount=useCallback((account:SampleAccountId)=>{try{localStorage.setItem(SAMPLE_STORAGE_KEY+".account",account);publish({...getSnapshot(),account});}catch{publish({...getSnapshot(),account,persistenceError:"This browser is not allowing saved sample records."});}},[]);
  const command=useCallback(async(input:Omit<WorkspaceCommand,"actor"|"key">):Promise<WorkspaceResult>=>{
    const execute=async()=>{
      const current=getSnapshot();let data=current.data;
      try{data=readSaved()??data;}catch{return {ok:false as const,error:"Saved records are unavailable. Reset the sample workspace from your account menu.",code:"STORAGE_UNAVAILABLE"};}
      const result=applyWorkspaceCommand(data,{...input,actor:current.account,key:crypto.randomUUID()});
      if(result.ok){try{localStorage.setItem(SAMPLE_STORAGE_KEY,JSON.stringify(result.data));publish({...current,data:result.data,persistenceError:null});}catch{return {ok:false as const,error:"This browser could not save your changes. Allow site storage and try again.",code:"STORAGE_UNAVAILABLE"};}}
      else if(result.code==="VERSION_CONFLICT")publish({...current,data});
      return result;
    };
    // Serialise tabs, then re-read and compare the expected session version.
    // This isolated adapter never grants access to authenticated booking data.
    return navigator.locks?navigator.locks.request(SAMPLE_STORAGE_KEY,execute):execute();
  },[]);
  const reset=useCallback(()=>{try{const data=createSampleWorkspace();localStorage.setItem(SAMPLE_STORAGE_KEY,JSON.stringify(data));publish({...getSnapshot(),data,persistenceError:null});}catch{publish({...getSnapshot(),persistenceError:"Site storage is unavailable."});}},[]);
  return <Context.Provider value={{...snapshot,switchAccount,command,reset}}>{children}</Context.Provider>;
}
export function useWorkspace(){const ctx=useContext(Context);if(!ctx)throw new Error("WorkspaceProvider is required");return ctx;}
