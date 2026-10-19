import { describe, expect, it } from "vitest";
import { applyWorkspaceCommand, createSampleWorkspace, placesHeld, planState, publicationFor, refundDue, verifiedFor, type SampleWorkspace, type WorkspaceCommand } from "@/lib/sila/sample-workspace";
let n=0;
function cmd(data:SampleWorkspace,input:Partial<WorkspaceCommand>&{type:string}){
  const p=data.plans.find(p=>p.id===input.planId),s=data.sessions.find(s=>s.id===(input.sessionId??p?.sessionId));
  return applyWorkspaceCommand(data,{actor:"venue",key:`test-action-${++n}`,expectedVersion:s?.version,...input});
}
function ok(data:SampleWorkspace,input:Partial<WorkspaceCommand>&{type:string}){const r=cmd(data,input);if(!r.ok)throw Error(r.error);return r.data;}
function approved(){return ok(createSampleWorkspace(),{type:"approve",planId:"leith-print",values:{places:"9",suitability:"on"}});}
describe("sample workspace product actions (§07, §15, §17–19, §24)",()=>{
  it("keeps sample accounts, session stages and exact group amounts coherent",()=>{
    const d=createSampleWorkspace();expect(placesHeld(d,"print-room")).toBe(7);expect(placesHeld(d,"woodcut")).toBe(16);
    expect(planState(d,d.plans.find(p=>p.id==="meadows-type")!)).toBe("Confirmed");
    expect(planState(d,d.plans.find(p=>p.id==="meadows-woodcut")!)).toBe("Verification pending");
    expect(refundDue(d,"meadows-autumn")).toBe(6125);
    const draft=d.sessions.find(s=>s.id==="botanical-print")!;draft.termsReviewed=true;draft.coverageApproved=true;expect(publicationFor(draft).blockers).toEqual([]);
  });
  it("only the venue approves and only the approved organiser commits",()=>{
    const original=createSampleWorkspace();for(const actor of ["operations","finance","meadows","leith"] as const)expect(cmd(original,{type:"approve",actor,planId:"leith-print",values:{places:"9",suitability:"on"}})).toMatchObject({ok:false,code:"NOT_FOUND"});
    const d=approved();for(const actor of ["venue","operations","finance","meadows"] as const)expect(cmd(d,{type:"commit",actor,planId:"leith-print",values:{agreement:"on"}})).toMatchObject({ok:false,code:"NOT_FOUND"});
    const after=ok(d,{type:"commit",actor:"leith",planId:"leith-print",values:{agreement:"on"}});expect(placesHeld(after,"print-room")).toBe(16);expect(after.sessions.find(s=>s.id==="print-room")?.scheduledFor).toBe("2026-11-04T11:45:00.000Z");
    expect(after.sessions.find(s=>s.id==="print-room")?.phase).toBe("published");
  });
  it("rejects below-minimum second clubs, expired deadlines and stale versions",()=>{
    let d=ok(createSampleWorkspace(),{type:"approve",planId:"leith-print",values:{places:"8",suitability:"on"}});
    expect(cmd(d,{type:"commit",actor:"leith",planId:"leith-print",values:{agreement:"on"}})).toMatchObject({ok:false,code:"SECOND_CLUB_BELOW_MINIMUM"});
    d=approved();d.now="2026-11-04T12:00:00.000Z";expect(cmd(d,{type:"commit",actor:"leith",planId:"leith-print",values:{agreement:"on"}}).ok).toBe(true);
    d.now="2026-11-04T12:00:00.001Z";expect(cmd(d,{type:"commit",actor:"leith",planId:"leith-print",values:{agreement:"on"}})).toMatchObject({ok:false,code:"FILL_DEADLINE_PASSED"});
    expect(cmd(approved(),{type:"commit",actor:"leith",planId:"leith-print",expectedVersion:1,values:{agreement:"on"}})).toMatchObject({ok:false,code:"VERSION_CONFLICT"});
  });
  it("serialised concurrent attempts accept only the current version",()=>{
    const d=approved(),request:WorkspaceCommand={type:"commit",actor:"leith",planId:"leith-print",expectedVersion:2,key:"competing-command-a",values:{agreement:"on"}};
    const first=applyWorkspaceCommand(d,request);expect(first.ok).toBe(true);if(!first.ok)return;
    expect(applyWorkspaceCommand(first.data,{...request,key:"competing-command-b"})).toMatchObject({ok:false,code:"VERSION_CONFLICT"});
    expect(applyWorkspaceCommand(first.data,request)).toMatchObject({ok:true,replayed:true});
    expect(applyWorkspaceCommand(first.data,{...request,values:{agreement:"off"}})).toMatchObject({ok:false,code:"IDEMPOTENCY_CONFLICT"});
  });
  it("withdraws without charge before opening and cancels a broken minimum",()=>{
    const committed=ok(approved(),{type:"commit",actor:"leith",planId:"leith-print",values:{agreement:"on"}});
    const d=ok(committed,{type:"withdraw",actor:"leith",planId:"leith-print",values:{reason:"Club timetable changed"}});
    expect(placesHeld(d,"print-room")).toBe(7);expect(d.sessions.find(s=>s.id==="print-room")?.scheduledFor).toBeNull();
    const open=ok(d,{type:"withdraw",actor:"meadows",planId:"meadows-woodcut",values:{reason:"Review our withdrawal"}});expect(open.plans.find(p=>p.id==="meadows-woodcut")?.status).toBe("committed");expect(open.messages.at(-1)?.body).toContain("Withdrawal review requested");
  });
  it("retains a receipt through blocked confirmation and confirms only after a diary check",()=>{
    const d=ok(createSampleWorkspace(),{type:"receipt",actor:"finance",planId:"meadows-woodcut",values:{amountMinor:"6125",reference:"EPS-NEW-1",receivedAt:"2026-11-02T11:00:00.000Z",evidence:"Sample reconciliation"}});
    expect(verifiedFor(d,"meadows-woodcut","deposit")).toBe(6125);
    expect(cmd(d,{type:"confirm",sessionId:"woodcut",values:{}})).toMatchObject({ok:false,code:"NOT_READY"});
    const confirmed=ok(d,{type:"confirm",sessionId:"woodcut",values:{diary:"on"}});expect(confirmed.sessions.find(s=>s.id==="woodcut")?.phase).toBe("confirmed");
    expect(cmd(d,{type:"confirm",actor:"operations",sessionId:"woodcut",values:{diary:"on"}})).toMatchObject({ok:false,code:"NOT_FOUND"});
  });
  it("deduplicates receipts and preserves actual timeliness",()=>{
    const d=createSampleWorkspace();expect(cmd(d,{type:"receipt",actor:"finance",planId:"meadows-woodcut",values:{amountMinor:"6125",reference:" eps-r1 ",receivedAt:"2026-11-02T11:00:00.000Z",evidence:"Evidence"}})).toMatchObject({ok:false,code:"DUPLICATE_RECEIPT"});
    const late=ok(d,{type:"receipt",actor:"finance",planId:"meadows-woodcut",values:{amountMinor:"6125",reference:"late",receivedAt:d.now,evidence:"Late funds"}});
    expect(cmd(late,{type:"confirm",sessionId:"woodcut",values:{diary:"on"}})).toMatchObject({ok:false,code:"NOT_READY"});
    expect(verifiedFor(late,"meadows-woodcut","deposit")).toBe(6125);
  });
  it("allows only finance to record partial refunds and blocks over-returns",()=>{
    const original=createSampleWorkspace(),values={amountMinor:"1000",reference:"RETURN-1",receivedAt:original.now,evidence:"Actual sample return"};
    expect(cmd(original,{type:"refund",planId:"meadows-autumn",values})).toMatchObject({ok:false,code:"NOT_FOUND"});
    const d=ok(original,{type:"refund",actor:"finance",planId:"meadows-autumn",values});expect(refundDue(d,"meadows-autumn")).toBe(5125);
    expect(cmd(d,{type:"refund",actor:"finance",planId:"meadows-autumn",values:{...values,reference:"RETURN-2",amountMinor:"6000"}})).toMatchObject({ok:false,code:"OVER_REFUND"});
    expect(cmd(d,{type:"refund",actor:"finance",planId:"meadows-autumn",values})).toMatchObject({ok:false,code:"DUPLICATE_RECEIPT"});
  });
  it("retains booking reference and payments when the venue cannot deliver",()=>{
    const d=ok(createSampleWorkspace(),{type:"close",sessionId:"type-and-paper",values:{reason:"Venue delivery failure",refunds:"on"}});
    expect(d.sessions.find(s=>s.id==="type-and-paper")).toMatchObject({phase:"cancelled",bookingRef:"SL1042"});expect(refundDue(d,"meadows-type")).toBe(6125);expect(placesHeld(d,"type-and-paper")).toBe(0);
  });
  it("keeps operator pause authority separate from commercial decisions",()=>{
    const d=ok(createSampleWorkspace(),{type:"pause",actor:"operations",sessionId:"print-room",values:{paused:"true",reason:"Coverage issue"}});
    expect(d.sessions.find(s=>s.id==="print-room")?.paused).toBe(true);
    expect(cmd(d,{type:"close",actor:"operations",sessionId:"print-room",values:{reason:"Cannot close",refunds:"on"}})).toMatchObject({ok:false,code:"NOT_FOUND"});
    expect(cmd(d,{type:"commit",actor:"leith",planId:"leith-print",values:{agreement:"on"}})).toMatchObject({ok:false,code:"INTAKE_PAUSED"});
  });
  it("isolates organiser conversations and never confirms a noncontributing request",()=>{
    const d=createSampleWorkspace();expect(cmd(d,{type:"message",actor:"meadows",planId:"leith-print",values:{body:"Other club"}})).toMatchObject({ok:false,code:"NOT_FOUND"});
    const own=ok(d,{type:"message",actor:"leith",planId:"leith-print",values:{body:"Our practical question"}});expect(own.messages.at(-1)?.actor).toBe("leith");
    const p={...d.plans[0]!,id:"unallocated",sessionId:"type-and-paper",status:"requested" as const,approved:null};expect(planState(d,p)).toBe("Not allocated");
  });
  it("saves only drafts, enforces publication checks and prevents operator publication",()=>{
    const d=createSampleWorkspace();expect(cmd(d,{type:"publish",sessionId:"botanical-print"})).toMatchObject({ok:false,code:"NOT_READY"});
    d.sessions.find(s=>s.id==="botanical-print")!.termsReviewed=true;d.sessions.find(s=>s.id==="botanical-print")!.coverageApproved=true;
    expect(cmd(d,{type:"publish",actor:"operations",sessionId:"botanical-print"})).toMatchObject({ok:false,code:"NOT_FOUND"});expect(cmd(d,{type:"publish",sessionId:"botanical-print"}).ok).toBe(true);
    expect(cmd(d,{type:"save",sessionId:"print-room"})).toMatchObject({ok:false,code:"SESSION_NOT_OPEN"});
  });
});
