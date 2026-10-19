import { scottishVenueCalendar } from "./calendar";
import { checkCommit } from "./commitment";
import { confirmationBlockers } from "./confirmation";
import { groupAmounts } from "./money";
import { refundTarget } from "./refund";
import { scheduledPaymentOpening } from "./schedule";
import { checkPublication, type SessionDraft } from "./session";
import { addDays, fromLocal } from "./time";

/** An isolated sample-data adapter for the product UI. Not an authentication or production persistence layer.
 * Commands reuse the pilot's pure checks (§07, §12, §15, §17–19, §24); server commands remain authoritative in the authenticated app.
 */
export type SampleRole = "organiser" | "coordinator" | "finance" | "operator";
export type SampleAccountId = "meadows" | "leith" | "venue" | "finance" | "operations";
export const SAMPLE_ACCOUNTS: Record<SampleAccountId, { name: string; organisation: string; email: string; role: SampleRole }> = {
  meadows: { name: "Maya Okafor", organisation: "Meadows Book Circle", email: "maya@clubs.sila.example", role: "organiser" },
  leith: { name: "Elliot Reid", organisation: "Leith Arts Club", email: "elliot@clubs.sila.example", role: "organiser" },
  venue: { name: "Rowan Ellis", organisation: "Edinburgh Print Studio", email: "rowan@studio.sila.example", role: "coordinator" },
  finance: { name: "Alex Campbell", organisation: "Edinburgh Print Studio", email: "finance@studio.sila.example", role: "finance" },
  operations: { name: "Sila operations", organisation: "Edinburgh pilot", email: "operations@sila.example", role: "operator" },
};
export interface WorkspaceSession {
  id: string; version: number; termsVersion: number; title: string; description: string; category: string; image: string;
  startsAt: string; endsAt: string; phase: "draft" | "published" | "confirmed" | "closed" | "cancelled";
  priceMinor: number; minimum: number; capacity: number; depositBasisPoints: number;
  fillBy: string; decisionBy: string; balanceDueAt: string; holdExpiresAt: string;
  resource: string; meetingPoint: string; inclusions: string; venueTerms: string; termsReviewed: boolean; coverageApproved: boolean;
  paused: boolean; pauseReason: string; minimumReachedAt: string | null; scheduledFor: string | null;
  openedAt: string | null; payBy: string | null; verifyBy: string | null;
  bookingRef: string | null; closedAt: string | null; closedReason: string | null;
}
export interface WorkspacePlan {
  id: string; sessionId: string; organiser: SampleAccountId; club: string; ref: string; requested: number;
  approved: number | null; termsVersion: number; status: "requested" | "approved" | "committed" | "withdrawn" | "declined";
  source: string; reason: string; committedAt: string | null;
}
export interface WorkspaceEntry {
  id: string; planId: string; kind: "deposit" | "balance" | "refund"; amountMinor: number;
  reference: string; receivedAt: string; verifiedAt: string; evidence: string; actor: SampleAccountId;
}
export interface WorkspaceReport { id: string; planId: string; kind: "deposit" | "balance"; amountMinor: number; reference: string; at: string }
export interface WorkspaceMessage { id: string; planId: string; actor: SampleAccountId; body: string; at: string }
export interface WorkspaceIntroduction { id: string; sessionId: string; club: string; evidence: string; at: string }
export interface SampleWorkspace {
  schema: 1; revision: number; now: string; nextId: number;
  venue: { name: string; address: string; email: string; phone: string; access: string; paymentRoute: string };
  sessions: WorkspaceSession[]; plans: WorkspacePlan[]; ledger: WorkspaceEntry[]; reports: WorkspaceReport[];
  messages: WorkspaceMessage[]; introductions: WorkspaceIntroduction[];
  activity: { id: string; sessionId: string | null; actor: SampleAccountId; detail: string; at: string }[];
  processed: Record<string, { payload: string; resultId: string | null }>;
}
const instant = (day: string, hour = 12, minute = 0) => fromLocal(day, hour, minute).toISOString();
export const SAMPLE_NOW = "2026-11-04T10:50:00.000Z";
export const SAMPLE_STORAGE_KEY = "sila.workspace.sample.v1";
export function coveredSampleDates(): string[] {
  const dates: string[] = [];
  for (let d = "2026-10-01"; d < "2027-01-01"; d = addDays(d, 1)) dates.push(d);
  return dates;
}
function seedSession(id: string, title: string, day: string, extra: Partial<WorkspaceSession> = {}): WorkspaceSession {
  return { id, title, version: 1, termsVersion: 1, description: "Spend an evening in the studio making a small edition by hand. Explore the tools, the paper and the marks that give a print its character.",
    category: "Print & paper", image: "printer", startsAt: instant(day,18), endsAt: instant(day,20), phase: "published", priceMinor: 3500,
    minimum: 16, capacity: 20, depositBasisPoints: 2500, fillBy: instant("2026-11-04"), decisionBy: instant("2026-11-12"), balanceDueAt: instant("2026-11-13"),
    holdExpiresAt: instant("2026-11-12"), resource: "Print room · studio tutor", meetingPoint: "Studio front desk, 15 minutes before the session",
    inclusions: "Studio tutor, materials, tools and a small edition to take home. All compulsory charges included.",
    venueTerms: "The organiser agrees exact places at the published per-person price. Commitments are conditional until the venue confirms. Withdrawal is free before payment opens. Before confirmation, session failure returns all payments. Venue-caused cancellation after confirmation returns deposit and balance in full. Later club withdrawal needs venue review; there is no automatic deposit forfeiture. Personal access arrangements go directly to the venue.",
    termsReviewed: true, coverageApproved: true, paused: false, pauseReason: "", minimumReachedAt: null, scheduledFor: null,
    openedAt: null, payBy: null, verifyBy: null, bookingRef: null, closedAt: null, closedReason: null, ...extra };
}
export function createSampleWorkspace(): SampleWorkspace {
  const sessions = [
    seedSession("print-room", "An evening in the print room", "2026-11-19"),
    seedSession("woodcut", "The art of the woodcut", "2026-11-20", { image: "rhino", description: "Look closely at the line of a woodcut, then cut and print a small block of your own. A studio tutor guides you through the tools and the first pull.",
      minimumReachedAt: instant("2026-10-29",10), scheduledFor: instant("2026-10-29",11,45), openedAt: instant("2026-10-29",11,45), payBy: instant("2026-11-03"), verifyBy: instant("2026-11-04") }),
    seedSession("type-and-paper", "Type, paper & the printed page", "2026-11-18", { image: "caslon", phase: "confirmed", bookingRef: "SL1042", minimumReachedAt: instant("2026-10-28",10),
      openedAt: instant("2026-10-29",11,45), payBy: instant("2026-11-03"), verifyBy: instant("2026-11-04"), decisionBy: instant("2026-11-11"), holdExpiresAt: instant("2026-11-11"), balanceDueAt: instant("2026-11-12") }),
    seedSession("botanical-print", "Botanical impressions", "2026-12-10", { image: "orchidae", phase: "draft", category: "Art & nature", termsReviewed: false, coverageApproved: false,
      fillBy: instant("2026-11-18"), decisionBy: instant("2026-11-26"), holdExpiresAt: instant("2026-11-26"), balanceDueAt: instant("2026-11-27") }),
    seedSession("autumn-prints", "An autumn print gathering", "2026-11-12", { phase: "closed", image: "bewick", closedAt: instant("2026-11-03",10), closedReason: "The studio could not provide the agreed tutor. All received payments are due back in full.",
      openedAt: instant("2026-10-22",11,45), payBy: instant("2026-10-27"), verifyBy: instant("2026-10-28"), decisionBy: instant("2026-11-05"), holdExpiresAt: instant("2026-11-05"), balanceDueAt: instant("2026-11-06") }),
  ];
  const plan = (id: string, sessionId: string, organiser: SampleAccountId, places: number, status: WorkspacePlan["status"], n: number): WorkspacePlan => ({
    id, sessionId, organiser, club: SAMPLE_ACCOUNTS[organiser].organisation, ref: `PL${n}`, requested: places,
    approved: status === "requested" ? null : places, termsVersion: 1, status, source: "Venue enquiry", reason: "", committedAt: status === "committed" ? instant("2026-10-24",10) : null,
  });
  const plans = [plan("meadows-print", "print-room", "meadows",7,"committed",147), plan("leith-print","print-room","leith",9,"requested",148),
    plan("meadows-woodcut","woodcut","meadows",7,"committed",149),plan("leith-woodcut","woodcut","leith",9,"committed",150),
    plan("meadows-type","type-and-paper","meadows",7,"committed",151),plan("leith-type","type-and-paper","leith",9,"committed",152),
    plan("meadows-autumn","autumn-prints","meadows",7,"committed",153),plan("leith-autumn","autumn-prints","leith",9,"committed",154)];
  const receipt = (id: string, planId: string, amountMinor: number): WorkspaceEntry => ({ id, planId, kind: "deposit", amountMinor, reference: `EPS-${id.toUpperCase()}`,
    receivedAt: instant("2026-11-02",10), verifiedAt: instant("2026-11-03",10), actor: "finance", evidence: "Sample bank reconciliation reference" });
  return { schema: 1, revision: 1, now: SAMPLE_NOW, nextId: 200,
    venue: { name: "Edinburgh Print Studio", address: "12 Sample Close, Edinburgh EH1 1AA · sample address", email: "hello@studio.sila.example", phone: "0131 000 0100",
      access: "Level entrance and accessible toilet. Discuss individual arrangements directly with the venue before it approves places.",
      paymentRoute: "Pay the venue by bank transfer using your plan reference. In this sample workspace no transfer should be made. The venue supplies its account details directly." },
    sessions, plans, ledger: [receipt("r1","leith-woodcut",7875),receipt("r2","meadows-type",6125),receipt("r3","leith-type",7875),receipt("r4","meadows-autumn",6125)],
    reports: [{id:"report1",planId:"meadows-woodcut",kind:"deposit",amountMinor:6125,reference:"PL149-MEADOWS",at:instant("2026-11-02",11)}],
    messages: [{id:"m1",planId:"leith-print",actor:"leith",body:"We would like nine places for our arts club. Are materials included?",at:instant("2026-11-03",10)},
      {id:"m2",planId:"leith-print",actor:"venue",body:"Yes, materials and instruction are included in the £35 price. We will review your places shortly.",at:instant("2026-11-03",11)}],
    introductions: [{id:"intro1",sessionId:"print-room",club:"Leith Arts Club",evidence:"Organiser asked for a printmaking session. Existing enquiry shared with the venue for review.",at:instant("2026-11-03",9)}],
    activity: [{id:"a1",sessionId:"print-room",actor:"meadows",detail:"Meadows Book Circle committed 7 places conditionally",at:instant("2026-10-24",10)},
      {id:"a2",sessionId:"woodcut",actor:"finance",detail:"Leith Arts Club deposit verified · £78.75",at:instant("2026-11-03",10)},
      {id:"a3",sessionId:"type-and-paper",actor:"venue",detail:"Venue confirmed booking SL1042",at:instant("2026-11-03",11)}], processed: {} };
}
export const money = (minor: number) => `£${(minor/100).toFixed(2)}`;
export function sessionPlans(data: SampleWorkspace, id: string) { return data.plans.filter(p=>p.sessionId===id); }
export function livePlans(data: SampleWorkspace, id: string) {
  const s=data.sessions.find(x=>x.id===id);
  return s && !["closed","cancelled"].includes(s.phase) ? sessionPlans(data,id).filter(p=>p.status==="committed") : [];
}
export function placesHeld(data: SampleWorkspace, id: string) { return livePlans(data,id).reduce((n,p)=>n+(p.approved??0),0); }
export function amountsFor(s: WorkspaceSession,p: WorkspacePlan) { return groupAmounts(s.priceMinor,p.approved??p.requested,s.depositBasisPoints); }
export function verifiedFor(data: SampleWorkspace,planId: string,kind: WorkspaceEntry["kind"]) { return data.ledger.filter(e=>e.planId===planId&&e.kind===kind).reduce((n,e)=>n+e.amountMinor,0); }
export function refundDue(data: SampleWorkspace,planId: string) { return Math.max(0,verifiedFor(data,planId,"deposit")+verifiedFor(data,planId,"balance")-verifiedFor(data,planId,"refund")); }
export function planState(data: SampleWorkspace,p: WorkspacePlan): string {
  const s=data.sessions.find(x=>x.id===p.sessionId)!;
  if(["closed","cancelled"].includes(s.phase))return refundDue(data,p.id)>0?"Refund due":verifiedFor(data,p.id,"refund")>0?"Refund verified":"Not proceeding";
  if(p.status==="declined")return "Request declined";
  if(p.status==="withdrawn")return "Withdrawn";
  if(s.phase==="confirmed")return p.status==="committed"?"Confirmed":"Not allocated";
  if(p.status==="requested")return "Awaiting venue approval";
  if(p.status==="approved")return "Review your conditions";
  if(!s.minimumReachedAt)return "Waiting for more places";
  if(!s.openedAt)return "Payment scheduled";
  if(verifiedFor(data,p.id,"deposit")>=amountsFor(s,p).depositMinor)return "Deposit verified";
  if(data.reports.some(r=>r.planId===p.id&&r.kind==="deposit"))return "Verification pending";
  return "Deposit due";
}
export function publicationFor(s: WorkspaceSession) {
  const draft: SessionDraft = { title:s.title,startsAt:new Date(s.startsAt),endsAt:new Date(s.endsAt),priceMinor:s.priceMinor,minimum:s.minimum,capacity:s.capacity,maxClubs:2,
    depositBasisPoints:s.depositBasisPoints,paymentWindowDays:5,fillBy:new Date(s.fillBy),decisionBy:new Date(s.decisionBy),balanceDueAt:new Date(s.balanceDueAt),holdExpiresAt:new Date(s.holdExpiresAt),
    holdCheckedBy:s.coverageApproved?"Sample venue coordinator":null,coveredDates:s.coverageApproved?coveredSampleDates():[],venueTermsVersion:s.termsReviewed?"venue-v1":null,
    platformTermsVersion:s.termsReviewed?"pilot-v1":null,accessFactsReviewed:s.termsReviewed,runAtMinimumApproved:s.coverageApproved };
  return checkPublication(draft,scottishVenueCalendar());
}
export interface WorkspaceCommand { type: string; actor: SampleAccountId; key: string; sessionId?: string; planId?: string; expectedVersion?: number; values?: Record<string,string> }
export type WorkspaceResult = {ok:true; data:SampleWorkspace; resultId:string|null; replayed?:boolean}|{ok:false;error:string;code:string};
export function applyWorkspaceCommand(previous: SampleWorkspace, command: WorkspaceCommand): WorkspaceResult {
  const payload=JSON.stringify(command), old=previous.processed[command.key];
  if(old)return old.payload===payload?{ok:true,data:previous,resultId:old.resultId,replayed:true}:{ok:false,error:"That action key was already used for different details.",code:"IDEMPOTENCY_CONFLICT"};
  const data=structuredClone(previous), actor=SAMPLE_ACCOUNTS[command.actor], values=command.values??{}, p=data.plans.find(x=>x.id===command.planId);
  const s=data.sessions.find(x=>x.id===(command.sessionId??p?.sessionId));
  const fail=(error:string,code="INVALID_FIELDS"):WorkspaceResult=>({ok:false,error,code});
  const coordinator=actor.role==="coordinator", finance=coordinator||actor.role==="finance", operator=actor.role==="operator";
  if(!command.key||command.key.length<8)return fail("An action key is required.");
  if(s&&command.expectedVersion!==s.version)return fail("This session changed. Reload the current details and try again.","VERSION_CONFLICT");
  const own=!!p&&p.organiser===command.actor;
  const id=(prefix:string)=>`${prefix}-${data.nextId++}`;
  let resultId:string|null=null, detail="";
  const requirePlan=()=>!!p&&!!s;
  if(command.type==="request") {
    if(actor.role!=="organiser"||!s)return fail("Not found.","NOT_FOUND");
    if(s.phase!=="published"||s.paused||s.minimumReachedAt||data.now>s.fillBy)return fail("This session is not accepting new requests.","SESSION_NOT_OPEN");
    const n=Number(values.places),club=(values.club??actor.organisation).trim();
    if(!Number.isInteger(n)||n<1||n>s.capacity||club.length<2||club.length>120)return fail(`Enter a club name and between 1 and ${s.capacity} exact places.`);
    const existing=data.plans.find(x=>x.sessionId===s.id&&x.organiser===command.actor&&!["withdrawn","declined"].includes(x.status));
    if(existing)return fail("Your club already has a plan for this session. Open it from My plans.","ALREADY_EXISTS");
    resultId=id("plan");data.plans.push({id:resultId,sessionId:s.id,organiser:command.actor,club,ref:`PL${data.nextId}`,requested:n,approved:null,termsVersion:s.termsVersion,status:"requested",source:values.source??"Venue enquiry",reason:"",committedAt:null});
    detail=`${club} requested ${n} places`;
  } else if(command.type==="approve"||command.type==="decline") {
    if(!coordinator||!requirePlan())return fail("Not found.","NOT_FOUND");
    if(s!.phase!=="published"||s!.paused||p!.status!=="requested")return fail("This request is no longer awaiting approval.","NOT_READY");
    if(command.type==="approve") {
      const n=Number(values.places);if(!Number.isInteger(n)||n<1||n>s!.capacity)return fail("Enter exact approved places within capacity.");
      if(values.suitability!=="on")return fail("Confirm that suitability was discussed directly with the organiser.");
      p!.approved=n;p!.status="approved";p!.termsVersion=s!.termsVersion;detail=`${p!.club}: ${n} places approved; organiser must commit`;
    } else {if(!values.reason?.trim())return fail("Give the organiser a useful reason.");p!.status="declined";p!.reason=values.reason.trim();detail=`${p!.club} request declined`;}
  } else if(command.type==="commit") {
    if(!own||!s||!p)return fail("Not found.","NOT_FOUND");
    if(values.agreement!=="on")return fail("Review and accept the exact allocation and terms before committing.");
    const r=checkCommit({now:new Date(data.now),planId:p.id,session:{phase:s.phase,termsVersion:s.termsVersion,fillBy:new Date(s.fillBy),decisionBy:new Date(s.decisionBy),minimum:s.minimum,capacity:s.capacity,maxClubs:2,intakePaused:s.paused,minimumReachedAt:s.minimumReachedAt?new Date(s.minimumReachedAt):null},
      approval:p.status==="approved"&&p.approved?{quantity:p.approved,termsVersion:p.termsVersion}:null,request:{quantity:p.approved??0,termsVersion:p.termsVersion},liveAllocations:livePlans(data,s.id).map(x=>({planId:x.id,places:x.approved!}))});
    if(!r.ok)return fail(r.reason.replaceAll("_"," ").toLowerCase()+". Review the current session.",r.reason);
    p.status="committed";p.committedAt=data.now;
    if(r.reachesMinimum){s.minimumReachedAt=data.now;s.scheduledFor=scheduledPaymentOpening(new Date(data.now),scottishVenueCalendar(),new Set(coveredSampleDates()))?.toISOString()??null;}
    detail=`${p.club} committed ${p.approved} places conditionally`;
  } else if(command.type==="withdraw") {
    if(!own||!s||!p||p.status!=="committed")return fail("Not found.","NOT_FOUND");
    if(!values.reason?.trim())return fail("Give the venue a short reason.");
    if(s.openedAt){data.messages.push({id:id("message"),planId:p.id,actor:command.actor,body:`Withdrawal review requested: ${values.reason}`,at:data.now});detail=`${p.club} requested venue review of withdrawal`;}
    else {p.status="withdrawn";p.reason=values.reason;if(placesHeld(data,s.id)<s.minimum){s.minimumReachedAt=null;s.scheduledFor=null;}detail=`${p.club} withdrew before payment opened; places released without charge`;}
  } else if(command.type==="message") {
    if(!p||!s||(!own&&!finance&&!operator))return fail("Not found.","NOT_FOUND");
    const body=values.body?.trim();if(!body||body.length>2000)return fail("Write a message of up to 2,000 characters.");
    data.messages.push({id:id("message"),planId:p.id,actor:command.actor,body,at:data.now});detail=`Message added to ${p.ref}`;
  } else if(command.type==="report"||command.type==="receipt"||command.type==="refund") {
    if(!p||!s||(command.type==="report"?!own:command.type==="refund"?actor.role!=="finance":!finance))return fail("Not found.","NOT_FOUND");
    const amountMinor=Number(values.amountMinor),reference=values.reference?.trim(),kind=values.kind==="balance"?"balance":"deposit";
    if(!Number.isSafeInteger(amountMinor)||amountMinor<=0||!reference||reference.length>100)return fail("Enter a positive GBP amount and a reference (up to 100 characters).");
    if(command.type==="report") {
      if(!s.openedAt||p.status!=="committed"||["closed","cancelled"].includes(s.phase))return fail("There is no open payment request for this plan.","NOT_READY");
      if(kind==="balance"&&s.phase!=="confirmed")return fail("Balance payment is not open before confirmation.","NOT_READY");
      data.reports.push({id:id("report"),planId:p.id,kind,amountMinor,reference,at:data.now});detail=`${p.club} reported a ${kind} payment; verification pending`;
    } else {
      const refund=command.type==="refund",at=values.receivedAt??"";
      if(!at||!Number.isFinite(Date.parse(at))||at>data.now||!values.evidence?.trim())return fail("Record when the money actually moved and an evidence reference. Future receipt times are not valid.");
      if(data.ledger.some(e=>(refund?e.kind==="refund":e.kind!=="refund")&&e.reference.trim().toUpperCase()===reference.toUpperCase()))return fail("The venue has already recorded that reference.","DUPLICATE_RECEIPT");
      if(refund){if(!["closed","cancelled"].includes(s.phase)||!s.closedAt||at<s.closedAt)return fail("A closure refund obligation and an actual return after closure are required.","NOT_READY");if(amountMinor>refundDue(data,p.id))return fail("This return exceeds the refund currently due.","OVER_REFUND");}
      else if(!s.openedAt&&!["closed","cancelled"].includes(s.phase))return fail("Payment has not opened.","PAYMENT_NOT_OPEN");
      data.ledger.push({id:id("entry"),planId:p.id,kind:refund?"refund":kind,amountMinor,reference,receivedAt:at,verifiedAt:data.now,evidence:values.evidence.trim(),actor:command.actor});
      detail=refund?`${p.club} refund verified: ${money(amountMinor)}`:`${p.club} ${kind} receipt verified: ${money(amountMinor)}`;
    }
  } else if(command.type==="confirm") {
    if(!coordinator||!s)return fail("Not found.","NOT_FOUND");
    if(s.phase!=="published")return fail("This session is not awaiting confirmation.","SESSION_NOT_OPEN");
    const active=livePlans(data,s.id), blockers=confirmationBlockers({now:new Date(data.now),minimum:s.minimum,decisionBy:new Date(s.decisionBy),holdExpiresAt:new Date(s.holdExpiresAt),externalDiaryCheckedAt:values.diary==="on"?new Date(data.now):null,paymentOpenedAt:s.openedAt?new Date(s.openedAt):null,
      allocations:active.map(x=>({allocationId:x.id,places:x.approved!,depositMinor:amountsFor(s,x).depositMinor})),receipts:data.ledger.filter(e=>e.kind==="deposit"&&!!s.payBy&&e.receivedAt<=s.payBy).map(e=>({allocationId:e.planId,kind:"deposit",amountMinor:e.amountMinor,receiptId:e.reference,receivedAt:new Date(e.receivedAt),verifiedAt:new Date(e.verifiedAt)}))});
    if(blockers.length)return fail("Cannot confirm yet: "+[...new Set(blockers.map(b=>b.code.replaceAll("_"," ").toLowerCase()))].join("; ")+".","NOT_READY");
    s.phase="confirmed";s.bookingRef=`SL${data.nextId++}`;detail=`Venue confirmed booking ${s.bookingRef}`;
  } else if(command.type==="close") {
    if(!coordinator||!s)return fail("Not found.","NOT_FOUND");
    if(!["published","confirmed"].includes(s.phase)||!values.reason?.trim()||values.refunds!=="on")return fail("Give a reason and acknowledge the full return of session payments.");
    s.phase=s.phase==="confirmed"?"cancelled":"closed";s.closedAt=data.now;s.closedReason=values.reason.trim();s.scheduledFor=null;s.paused=true;detail="Venue closed the session with full refunds due";
  } else if(command.type==="pause") {
    if((!coordinator&&!operator)||!s)return fail("Not found.","NOT_FOUND");
    if(s.phase!=="published"||!values.reason?.trim())return fail("An open session and a reason are required.");
    s.paused=values.paused==="true";s.pauseReason=values.reason.trim();detail=`New intake ${s.paused?"paused":"resumed"}: ${s.pauseReason}`;
  } else if(command.type==="create"||command.type==="save"||command.type==="publish") {
    if(!coordinator&&!operator)return fail("Not found.","NOT_FOUND");
    if(command.type==="create") {
      resultId=id("session");data.sessions.push(seedSession(resultId,values.title?.trim()||"Untitled session","2026-12-10",{phase:"draft",termsReviewed:false,coverageApproved:false,fillBy:instant("2026-11-18"),decisionBy:instant("2026-11-26"),holdExpiresAt:instant("2026-11-26"),balanceDueAt:instant("2026-11-27")}));detail="New draft session created";
    } else {
      if(!s||s.phase!=="draft")return fail("Published terms cannot be edited. Request an agreed amendment instead.","SESSION_NOT_OPEN");
      if(command.type==="publish") {
        if(!coordinator)return fail("Only the venue coordinator can publish.","NOT_FOUND");
        const check=publicationFor(s);if(check.blockers.length)return fail("Review publication checks: "+check.blockers.map(x=>x.replaceAll("_"," ").toLowerCase()).join("; ")+".","NOT_READY");
        if(data.sessions.some(x=>x.id!==s.id&&["published","confirmed"].includes(x.phase)&&x.resource===s.resource&&x.startsAt<s.endsAt&&x.endsAt>s.startsAt))return fail("This room and instructor are already held for an overlapping session.","RESOURCE_CONFLICT");
        s.phase="published";detail="Venue published the dated session";
      } else {
        const n=(key:string)=>Number(values[key]);
        if(!values.title?.trim()||!Number.isSafeInteger(n("priceMinor"))||n("priceMinor")<=0||!Number.isInteger(n("minimum"))||n("minimum")<1||!Number.isInteger(n("capacity"))||n("capacity")<n("minimum")||n("capacity")>1000||!Number.isSafeInteger(n("depositBasisPoints"))||n("depositBasisPoints")<1||n("depositBasisPoints")>10000)return fail("Enter a title, positive price, minimum/capacity and a deposit from 0.01% to 100%.");
        for(const key of ["startsAt","endsAt","fillBy","decisionBy","balanceDueAt","holdExpiresAt"])if(!values[key]||!Number.isFinite(Date.parse(values[key]!)))return fail("Complete all dates in London time.");
        Object.assign(s,{title:values.title.trim(),description:values.description??s.description,priceMinor:n("priceMinor"),minimum:n("minimum"),capacity:n("capacity"),depositBasisPoints:n("depositBasisPoints"),startsAt:values.startsAt,endsAt:values.endsAt,fillBy:values.fillBy,decisionBy:values.decisionBy,balanceDueAt:values.balanceDueAt,holdExpiresAt:values.holdExpiresAt,resource:values.resource?.trim()??s.resource,meetingPoint:values.meetingPoint??s.meetingPoint,venueTerms:values.venueTerms??s.venueTerms,termsReviewed:values.termsReviewed==="on",coverageApproved:values.coverageApproved==="on"});detail="Session draft saved";
      }
    }
  } else if(command.type==="introduction") {
    if(!operator||!s)return fail("Not found.","NOT_FOUND");
    if(!values.club?.trim()||!values.evidence?.trim())return fail("Record the club and the source evidence. The venue still approves any places.");
    data.introductions.push({id:id("introduction"),sessionId:s.id,club:values.club.trim(),evidence:values.evidence.trim(),at:data.now});detail=`Manual introduction recorded for ${values.club.trim()}`;
  } else if(command.type==="venue_settings") {
    if(!coordinator)return fail("Not found.","NOT_FOUND");
    if(!values.name?.trim()||!values.address?.trim()||!values.email?.includes("@"))return fail("Provide the venue name, address and direct contact email.");
    data.venue={...data.venue,name:values.name.trim(),address:values.address.trim(),email:values.email.trim(),phone:values.phone??"",access:values.access??"",paymentRoute:values.paymentRoute??data.venue.paymentRoute};detail="Venue public facts updated";
  } else return fail("That action is not available.");
  if(s)s.version++;
  data.revision++;data.processed[command.key]={payload,resultId};
  data.activity.unshift({id:id("activity"),sessionId:s?.id??null,actor:command.actor,detail,at:data.now});
  return {ok:true,data,resultId};
}
export function practicalText(data: SampleWorkspace,p: WorkspacePlan) {
  const s=data.sessions.find(x=>x.id===p.sessionId)!;const amounts=amountsFor(s,p);
  return [`Sila · ${s.bookingRef??p.ref}`,s.phase==="confirmed"&&p.status==="committed"?"VENUE-CONFIRMED BOOKING":s.phase==="cancelled"||s.phase==="closed"?"NOT PROCEEDING":"CONDITIONAL · NOT A CONFIRMED BOOKING",s.title,
    `${s.startsAt} to ${s.endsAt} · Europe/London`,data.venue.name,data.venue.address,s.meetingPoint,`${p.club} · ${p.approved??p.requested} places · ${money(amounts.totalMinor)} total`,
    `Venue contact: ${data.venue.email} · ${data.venue.phone}`,data.venue.access,
    "Discuss personal access arrangements directly with the venue. No member roster or health notes are kept in Sila.","Sample data workspace. No real booking or money transfer exists."].join("\n");
}
export function refundTargetFor(s:WorkspaceSession){return s.closedAt?refundTarget(new Date(s.closedAt),scottishVenueCalendar()).toISOString():null;}
