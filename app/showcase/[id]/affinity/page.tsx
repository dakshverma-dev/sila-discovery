import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AffinityStage } from "@/components/sila/affinity-stage";
import { themeVars } from "@/components/sila/band";
import { ArrowLeft } from "@/components/sila/chrome";
import { credit, img, INDIGO, JADE, OLIVE, OX } from "@/lib/ui/sila/art";
import { DEMO_EXPS, DEMO_STATUS, demoById, demoLook, type DemoGroup } from "@/lib/ui/sila/showcase";

export const metadata: Metadata = { title: "Affinity" };

export function generateStaticParams() {
  return DEMO_EXPS.map((e) => ({ id: e.id }));
}

const toGroup = (g: DemoGroup) => ({
  name: g.name,
  short: g.short,
  src: img(g.img),
  credit: credit(g.img),
  members: g.members,
  place: g.place,
  only: g.only,
});

export default async function ShowcaseAffinity({ params }: { params: Promise<{ id: string }> }) {
  const e = demoById((await params).id);
  if (!e) notFound();
  const look = demoLook(e);
  return (
    <main id="main" className="af" style={themeVars(look)}>
      <div className="wrap" style={{ paddingTop: "clamp(20px,3vw,40px)" }}>
        <div className="af-top">
          <Link href={`/showcase/${e.id}`}>
            <ArrowLeft />
            Affinity reading · {e.title}
          </Link>
          <span className="op75">Illustrative signals · Qloo integration pending</span>
        </div>
        <div className="af-head">
          <h1>
            <span className="line-mask" style={{ paddingBottom: "0.06em" }}>
              <span data-reveal="line">{e.A.name}</span>
            </span>
            <span className="line-mask" style={{ paddingBottom: "0.06em" }}>
              <span data-reveal="line" data-delay="90" className="indent">
                <em>meets</em> {e.B.name}
              </span>
            </span>
          </h1>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6 }}>
            Two communities that rarely meet. sila compares what their members save, visit and follow. Where those overlap
            is the reason for “{e.title}”, and the reason it could fill a room neither could fill alone.
          </p>
        </div>
      </div>
      <AffinityStage
        A={toGroup(e.A)}
        B={toGroup(e.B)}
        accent={look.theme.accent}
        tiles={e.shared.map((s, i) => ({
          t: s[0],
          a: s[1],
          b: s[2],
          ref: s[3],
          src: s[4] ? img(s[4]) : null,
          pos: s[5] ?? "50% 50%",
          bg: [OX, JADE, INDIGO, OLIVE][i % 4]!,
        }))}
        expTitle={e.title}
        expSrc={img(look.layers[0]!.k)}
        expMeta={`${e.venue} · ${DEMO_STATUS[e.status].short}`}
        proposalHref={`/showcase/${e.id}`}
        compat={e.compat.map(([name, strength, why, k]) => ({ name, strength, why, src: img(k) }))}
      />
    </main>
  );
}
