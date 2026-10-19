import Image from "next/image";
import { formatLondon, formatLondonDay, formatLondonRange } from "@/lib/sila/forms";

export const when=(value:string)=>formatLondon(new Date(value));
export const range=(start:string,end:string)=>formatLondonRange(new Date(start),new Date(end));
export const day=(value:string)=>formatLondonDay(new Date(value));
export function Arrow(){return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 12h15M13 5l7 7-7 7"/></svg>;}
export function Status({children,tone="neutral"}:{children:React.ReactNode;tone?:"neutral"|"positive"|"attention"}){return <span className={`sa-status sa-status-${tone}`}><i aria-hidden="true"/>{children}</span>;}
export function Artwork({image="printer",title,portrait=false}:{image?:string;title:string;portrait?:boolean}){return <div data-art-key={image} className={`sa-artwork${portrait?" sa-artwork-portrait":""}`}><Image src={`/art/${image}.jpg`} alt={title} width={900} height={900} unoptimized /></div>;}
export function Empty({title,children}:{title:string;children?:React.ReactNode}){return <div className="sa-empty"><span aria-hidden="true">◒</span><h3>{title}</h3>{children}</div>;}
export function Field({label,name,children,hint,...props}:{label:string;name:string;children?:React.ReactNode;hint?:string}&React.InputHTMLAttributes<HTMLInputElement>){return <label className="sa-field"><span>{label}</span>{children??<input name={name} {...props}/>} {hint?<small>{hint}</small>:null}</label>;}
export function Panel({title,children,aside}:{title:string;children:React.ReactNode;aside?:React.ReactNode}){return <section className="sa-panel"><header className="sa-panel-head"><h2>{title}</h2>{aside}</header>{children}</section>;}
export function PageTitle({kicker,title,description,actions}:{kicker:string;title:string;description?:string;actions?:React.ReactNode}){return <header className="sa-page-title"><div><p className="sa-eyebrow">{kicker}</p><h1>{title}</h1>{description?<p>{description}</p>:null}</div>{actions?<div className="sa-actions">{actions}</div>:null}</header>;}
export function Metrics({items}:{items:{label:string;value:string|number;detail:string}[]}){return <dl className="sa-metrics">{items.map(item=><div key={item.label}><dt>{item.label}</dt><dd>{item.value}<span>{item.detail}</span></dd></div>)}</dl>;}
export function WorkspaceShell({role,organisation,nav,account,children}:{role:string;organisation:string;nav:{label:string;href:string;current?:boolean}[];account?:React.ReactNode;children:React.ReactNode}){
  return <div className="sa-workspace"><aside className="sa-sidebar"><div className="sa-workspace-label"><span className="sa-monogram" aria-hidden="true">s</span><div><strong>{organisation}</strong><small>{role}</small></div></div><nav aria-label={`${role} navigation`}>{nav.map(item=><a key={item.label} href={item.href} aria-current={item.current?"page":undefined}>{item.label}<span aria-hidden="true">↗</span></a>)}</nav><p className="sa-sidebar-note">Personal access arrangements go directly to the venue.<br/>No member lists or health notes.</p>{account}</aside><div className="sa-workspace-content">{children}</div></div>;
}
