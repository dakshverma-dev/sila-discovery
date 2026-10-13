import { DEMO_EXPS, DEMO_STATUS, demoDemand, demoLines, demoLook, type DemoExp } from "@/lib/ui/sila/showcase";
import { Band } from "./band";

export function demoInCat(cat: string): DemoExp[] {
  return DEMO_EXPS.filter((e) => cat === "All" || e.cat === cat);
}

/** The v2 demonstration experiences as discovery bands, each labelled "Demo data". */
export function DemoBands({ list, startAt = 1 }: { list: DemoExp[]; startAt?: number }) {
  return (
    <>
      {list.map((e) => {
        const look = demoLook(e);
        const d = demoDemand(e);
        return (
          <Band
            key={e.id}
            demo
            no={startAt + DEMO_EXPS.indexOf(e)}
            look={look}
            title={e.title}
            lines={demoLines(e)}
            href={`/showcase/${e.id}`}
            place={e.city}
            description={e.dek}
            format={e.format}
            glyph={DEMO_STATUS[e.status].glyph}
            statusLabel={DEMO_STATUS[e.status].label}
            capacity={e.capacity}
            required={e.needed}
            reserved={e.committed}
            mine={false}
            demandText={d.demandText}
            possible={d.possible}
            pair={`${e.A.name} + ${e.B.name}`}
            interestId={e.status !== "confirmed" ? `demo:${e.id}` : undefined}
          />
        );
      })}
    </>
  );
}

