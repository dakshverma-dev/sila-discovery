"use client";
import { useId, useRef, useState } from "react";
import type { WorkspaceCommand } from "@/lib/sila/sample-workspace";
import { useWorkspace } from "./workspace-provider";

export function WorkspaceForm({type,sessionId,planId,version,label,children,transform,onSuccess,success="Changes saved.",className="sa-form"}:{
  type:string;sessionId?:string;planId?:string;version?:number;label:string;children:React.ReactNode;success?:string;className?:string;
  transform?:(values:Record<string,string>)=>Record<string,string>;onSuccess?:(id:string|null)=>void;
}) {
  const {command}=useWorkspace();const [pending,setPending]=useState(false),[error,setError]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null);const feedback=useRef<HTMLDivElement>(null);const id=useId();
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(pending)return;const form=event.currentTarget;setError(null);setNotice(null);
    const data=new FormData(form),values=Object.fromEntries([...data].map(([k,v])=>[k,String(v)]));
    let payload=values;try{payload=transform?transform(values):values;}catch(e){setError(e instanceof Error?e.message:"Check these details.");requestAnimationFrame(()=>feedback.current?.focus());return;}
    setPending(true);
    const input:Omit<WorkspaceCommand,"actor"|"key">={type,sessionId,planId,expectedVersion:version,values:payload};
    try{const result=await command(input);if(!result.ok)setError(result.error);else{setNotice(success);onSuccess?.(result.resultId);}}
    catch{setError("Your changes could not be saved. Check the current details and try again.");}
    finally{setPending(false);requestAnimationFrame(()=>feedback.current?.focus());}
  }
  return <form onSubmit={submit} className={className} aria-label={label} aria-describedby={error||notice?id:undefined}>
    {(error||notice)?<div id={id} ref={feedback} tabIndex={-1} role={error?"alert":"status"} className={`sa-feedback ${error?"sa-feedback-error":""}`}>{error??notice}</div>:null}
    <fieldset disabled={pending}>{children}</fieldset>{pending?<p role="status">Saving…</p>:null}
  </form>;
}
