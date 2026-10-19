"use client";

import { flushSync } from "react-dom";

// The prototype carries the largest visible copy of each artwork into the next
// screen. Unique names avoid collisions between its hero, index and feature.
function visibleArt() {
  const result=new Map<string,{el:HTMLElement;area:number}>();
  document.querySelectorAll<HTMLElement>("[data-art-key]").forEach(el=>{
    const rect=el.getBoundingClientRect();
    const area=Math.max(0,Math.min(rect.bottom,innerHeight)-Math.max(rect.top,0))*Math.max(0,Math.min(rect.right,innerWidth)-Math.max(rect.left,0));
    const key=el.dataset.artKey!;
    if(area>0&&(!result.has(key)||result.get(key)!.area<area))result.set(key,{el,area});
  });
  return result;
}

let running:ViewTransition|undefined;
let finishRunning:(()=>void)|undefined;
export function navigateWithArtwork(update:()=>void) {
  const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const apply=()=>{flushSync(update);window.dispatchEvent(new Event("sila:navigated"));};
  running?.skipTransition();
  finishRunning?.();
  if(reduced||!document.startViewTransition){apply();return;}
  const names=new Map<HTMLElement,string>();
  const old=visibleArt();
  const name=(el:HTMLElement,key:string)=>{if(!names.has(el))names.set(el,el.style.viewTransitionName);el.style.viewTransitionName=`sila-art-${key.replace(/[^a-z0-9-]/gi,"-")}`;};
  old.forEach(({el},key)=>name(el,key));
  const transition=document.startViewTransition(()=>{
    apply();
    visibleArt().forEach(({el},key)=>{
      if(!old.has(key))return;
      // As in the prototype's FLIP, the shared plate must be visible in the
      // destination snapshot; its entrance mask would otherwise hide the morph.
      el.querySelectorAll<HTMLElement>("[data-unfold]").forEach(layer=>{
        layer.setAttribute("data-uf","");layer.style.clipPath="";layer.style.maskImage="";layer.style.removeProperty("-webkit-mask-image");
      });
      name(el,key);
    });
  });
  running=transition;
  let cleaned=false;
  const cleanup=()=>{
    if(cleaned)return;cleaned=true;
    names.forEach((previous,el)=>{if(el.style.viewTransitionName.startsWith("sila-art-"))el.style.viewTransitionName=previous;});
    if(running===transition){running=undefined;finishRunning=undefined;}
  };
  finishRunning=cleanup;
  void transition.finished.catch(()=>{}).finally(cleanup);
}
