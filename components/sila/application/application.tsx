"use client";

import { useCallback, useEffect, useState } from "react";
import { ExperiencesPage, LandingPage } from "./landing";
import { SessionClubs, SessionPage, SessionRequest } from "./session-screens";
import { compositionIn, credit } from "./compositions";
import { navigateWithArtwork } from "./art-navigation";
import { SAMPLE_ACCOUNTS, type SampleAccountId } from "@/lib/sila/sample-workspace";
import { WorkspaceProvider, useWorkspace } from "./workspace-provider";
import { Empty, Panel, WorkspaceShell } from "./primitives";
import { VenueDashboard, VenueSession, SessionEditor, VenuePayments, VenueSettings } from "./venue-screens";
import { OrganiserDashboard, OrganiserPlan } from "./organiser-screens";
import { OperationsDashboard } from "./operations-screens";
import type { ApplicationNavigation } from "./navigation";
import "./application.css";

export function SilaApplication({path=[],base=""}:{path?:string[];base?:string}) {
  return <WorkspaceProvider><Application path={path} base={base}/></WorkspaceProvider>;
}
function AccountMenu({nav}:{nav:ApplicationNavigation}) {
  const {account,switchAccount,reset}=useWorkspace();const person=SAMPLE_ACCOUNTS[account];
  const [resetOpen,setResetOpen]=useState(false);
  return <details className="sa-account-menu"><summary><span className="sa-avatar">{person.name.split(" ").map(x=>x[0]).slice(0,2).join("")}</span><span><strong>{person.name}</strong><small>{person.organisation}</small></span><span aria-hidden="true">⌄</span></summary>
    <div className="sa-account-popover"><p className="sa-eyebrow">Sample accounts</p><p className="sa-caption">Choose an account to see its own workspace.</p>
      {(Object.entries(SAMPLE_ACCOUNTS) as [SampleAccountId,typeof person][]).map(([id,p])=><button key={id} type="button" aria-pressed={id===account} onClick={event=>{event.currentTarget.closest("details")?.removeAttribute("open");switchAccount(id);nav.navigate(p.role==="organiser"?"/plans":p.role==="operator"?"/ops":"/venue");}}><strong>{p.name}</strong><small>{p.organisation} · {p.role==="coordinator"?"Venue coordinator":p.role}</small></button>)}
      <a href={nav.href(person.role==="organiser"?"/plans":person.role==="operator"?"/ops":"/venue")}>Open my workspace</a><a href={nav.href("/account")}>Account & workspace</a><button type="button" className="sa-reset-link" onClick={()=>setResetOpen(!resetOpen)}>Reset sample records</button>
      {resetOpen?<div className="sa-reset-confirm"><p>Replace this browser&apos;s sample records with the starting dataset?</p><button type="button" onClick={()=>{reset();setResetOpen(false);nav.navigate("/");}}>Reset records</button><button type="button" onClick={()=>setResetOpen(false)}>Keep my changes</button></div>:null}
    </div>
  </details>;
}
function Application({path,base}:{path:string[];base:string}) {
  const {data,account,ready,persistenceError}=useWorkspace(),person=SAMPLE_ACCOUNTS[account];
  const [activePath,setActivePath]=useState(path);
  const pathFromUrl=useCallback(()=>{const name=location.pathname;return (base&&name.startsWith(base)?name.slice(base.length):name).split("/").filter(Boolean);},[base]);
  useEffect(()=>{const update=()=>setActivePath(pathFromUrl());update();window.addEventListener("popstate",update);return()=>window.removeEventListener("popstate",update);},[pathFromUrl]); // URL is an external browser source, including static-host fallback routes.
  const href=(p:string)=>p==="/"||p.startsWith("/#")?p:`${base}${p}`;
  function go(url:string){const target=new URL(url,location.origin);navigateWithArtwork(()=>{history.pushState({},"",target.href);setActivePath(pathFromUrl());window.scrollTo({top:0,behavior:"instant"});});if(target.hash)setTimeout(()=>document.getElementById(decodeURIComponent(target.hash.slice(1)))?.scrollIntoView(),50);}
  const nav:ApplicationNavigation={href,navigate:(p)=>go(href(p))};
  const route=activePath.join("/"),home=route==="",workspace=route.startsWith("venue")||route.startsWith("plans")||route.startsWith("ops");
  const staff=person.role!=="organiser",venue=route.startsWith("venue"),ops=route.startsWith("ops");
  const session=data.sessions.find(x=>x.id===activePath[2]);
  let content:React.ReactNode;
  if(!ready&&!home)content=<main id="main" className="sa-loading" aria-busy="true"><p className="sa-eyebrow">Sila</p><h1>Opening your workspace…</h1><div className="sa-skeleton"/></main>;
  else if(workspace) {
    const allowed=venue?staff:ops?person.role==="operator":person.role==="organiser";
    if(!allowed)content=<main id="main" className="sa-public"><Empty title="Choose the account for this workspace"><p>Your current account is {person.name}. Open the account menu to choose the venue, finance, organiser or operations account.</p><a className="sa-button" href={nav.href("/")}>Back to experiences</a></Empty></main>;
    else {
      const isOps=person.role==="operator",isFinance=person.role==="finance";
      const links=person.role==="organiser"?[{label:"My plans",href:"/plans"},{label:"Find a session",href:"/experiences"},{label:"My account",href:"/account"}]
        :isOps?[{label:"Overview",href:"/ops"},{label:"Manual introductions",href:"/ops/introductions"},{label:"Activity & audit",href:"/ops/activity"},{label:"Venue sessions",href:"/venue/sessions"}]
        :[{label:"Overview",href:"/venue"},{label:"Sessions",href:"/venue/sessions"},{label:"Payments & refunds",href:"/venue/payments"},...(!isFinance?[{label:"Venue settings",href:"/venue/settings"}]:[])];
      let screen:React.ReactNode;
      if(ops)screen=<OperationsDashboard key={route} section={activePath[1]} nav={nav}/>;
      else if(activePath[0]==="plans")screen=activePath[1]?<OrganiserPlan key={route} id={activePath[1]} nav={nav}/>:<OrganiserDashboard nav={nav}/>;
      else if(activePath[1]==="payments")screen=<VenuePayments nav={nav}/>;
      else if(activePath[1]==="settings")screen=<VenueSettings/>;
      else if(activePath[2]==="new"||(session?.phase==="draft"&&activePath[2]))screen=<SessionEditor key={route} session={session} nav={nav}/>;
      else if(activePath[2])screen=<VenueSession key={route} id={activePath[2]} nav={nav}/>;
      else screen=<VenueDashboard all={activePath[1]==="sessions"} nav={nav}/>;
      content=<main id="main"><WorkspaceShell role={person.role==="organiser"?"Club organiser":isOps?"Sila operations":isFinance?"Venue finance":"Venue coordinator"} organisation={person.organisation}
        nav={links.map(x=>({...x,href:nav.href(x.href),current:`/${route}`===x.href}))} account={<div className="sa-workspace-date"><span className="sa-eyebrow">Sample records</span><span>4 November 2026</span><small>10:50 · London</small></div>}>{screen}</WorkspaceShell></main>;
    }
  } else if(home)content=<main id="main"><LandingPage nav={nav}/></main>;
  else if(activePath[0]==="experiences")content=<main id="main"><ExperiencesPage nav={nav}/></main>;
  else if(activePath[0]==="s"&&activePath[2]==="clubs")content=<main id="main"><SessionClubs key={route} id={activePath[1]??""} nav={nav}/></main>;
  else if(activePath[0]==="s"&&activePath[2]==="request")content=<main id="main"><SessionRequest key={route} id={activePath[1]??""} nav={nav}/></main>;
  else if(activePath[0]==="s")content=<main id="main"><SessionPage key={route} id={activePath[1]??""} nav={nav}/></main>;
  else if(["account","help","privacy","terms"].includes(activePath[0]??""))content=<main id="main" className="sa-public"><InformationPage page={activePath[0]!}/></main>;
  else content=<main id="main" className="sa-public"><Empty title="Page not found"><a href={nav.href("/")}>Back to Sila</a></Empty></main>;
  return <div className="sila-app" onClick={event=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const anchor=(event.target as Element).closest?.("a");if(!(anchor instanceof HTMLAnchorElement)||anchor.target||anchor.hasAttribute("download")||!anchor.href.startsWith(location.origin+"/"))return;const target=new URL(anchor.href);if(base&&target.pathname!=="/"&&!target.pathname.startsWith(base+"/"))return;if(target.pathname===location.pathname&&target.hash)return;event.preventDefault();go(target.href);}}><header className="sa-header"><div><a href={nav.href("/")} className="sa-wordmark" aria-label="Sila home">sila</a><nav aria-label="Main navigation"><a href={home?"#overview":"/#overview"} aria-current={route.startsWith("s/")||route==="experiences"?"page":undefined}>Experiences</a><a href={home?"#how":"/#how"}>How it works</a><a href={home?"#organisers":"/#organisers"}>For organisers</a><a className="sa-audience-nav" href={home?"#venues":"/#venues"}>For venues</a></nav><span className="sa-sample-label">Sample data</span><AccountMenu nav={nav}/></div></header>
    {persistenceError?<p role="alert" className="sa-storage-error">{persistenceError}</p>:null}{content}
    <footer className="sa-footer"><div><span className="sa-wordmark">sila</span><p>The Sila product interface with sample venue, club and payment records. Changes are saved in this browser only. No booking, payment, email or venue decision on these pages is real.</p><nav aria-label="Footer"><a href={nav.href("/help")}>Help & contact</a><a href={nav.href("/privacy")}>Privacy</a><a href={nav.href("/terms")}>Terms</a></nav></div>
      <div className="sa-credits"><span>Picture credits</span><p>{[...new Set([...data.sessions.filter(s=>s.phase!=="draft").flatMap(s=>compositionIn(data,s).layers.map(l=>l.k)),"printer","hare","caslon","bewick"])].map(credit).join(". ")}. Images reproduced from Wikimedia Commons and The Met Open Access. Artwork is illustrative and does not imply a venue partnership.</p></div></footer>
  </div>;
}
function InformationPage({page}:{page:string}) {
  const {data,account}=useWorkspace(),person=SAMPLE_ACCOUNTS[account];
  if(page==="account")return <><p className="sa-eyebrow">Your account</p><h1>{person.name}</h1><Panel title={person.organisation}><dl className="sa-facts"><div><dt>Email</dt><dd>{person.email}</dd></div><div><dt>Access</dt><dd>{person.role}</dd></div><div><dt>Workspace</dt><dd>Sample data snapshot · 4 November 2026, 10:50 London</dd></div></dl><p>Changes to sample records stay in this browser. The account menu switches between the supplied sample users or resets the records. It does not sign in to the authenticated booking service.</p></Panel></>;
  if(page==="help")return <><p className="sa-eyebrow">Help & contact</p><h1>A clear next step.</h1><div className="sa-two-columns"><Panel title="About your booking"><p>Your venue approves places, verifies receipts, confirms bookings and returns money. Quote your plan reference when you contact it.</p><p>{data.venue.name}<br/>{data.venue.email}<br/>{data.venue.phone}</p></Panel><Panel title="About this workspace"><p>This is the Sila product interface using sample venue, club and payment records. Actions update those records in this browser. No email, booking with a real venue or transfer of money is made.</p><p>For personal access arrangements, speak directly to the venue. Sila keeps no member roster or health-note field.</p></Panel></div><Panel title="Artwork credits"><p className="sa-caption">Jost Amman, The Printer (1568); William Caslon, A Specimen (c. 1734); Albrecht Dürer, The Rhinoceros (1515, The Met, CC0) and Young Hare (1502); Thomas Bewick, A History of British Birds (1797); Ernst Haeckel, Orchidae (1904). All other listed plates are public domain. Artwork is illustrative and does not imply a venue partnership.</p></Panel></>;
  return <><p className="sa-eyebrow">{page==="privacy"?"Privacy":"Terms"}</p><h1>{page==="privacy"?"Only what the booking needs.":"Clear conditions, before commitment."}</h1><Panel title={page==="privacy"?"Sample workspace information":"Sample booking terms"}><p>{page==="privacy"?"The sample accounts, emails and venue records are fictional. Sample changes are stored in this browser and can be reset in the account menu. This workspace does not connect to a live booking database. Do not enter real personal, health, bank-account or payment-card information.":data.sessions[0]?.venueTerms}</p><p>Sila does not hold funds. Payments and refunds go directly through the venue.</p><p>The operating legal entity, real privacy contact and approved venue agreements remain required before live use. These sample records do not establish a contract with a real venue.</p></Panel></>;
}
