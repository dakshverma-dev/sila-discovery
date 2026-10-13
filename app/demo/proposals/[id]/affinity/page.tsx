import type { Metadata } from "next";
import Link from "next/link";
import { AffinityStage } from "@/components/sila/affinity-stage";
import { themeVars } from "@/components/sila/band";
import { ArrowLeft } from "@/components/sila/chrome";
import { Flash } from "@/components/ui";
import { requireDemoSession } from "@/lib/auth/demo-session";
import { callApi } from "@/lib/db/api";
import type { ProposalDetail } from "@/lib/demo/views";
import { credit, groupLook, img, INDIGO, JADE, lookFor, OLIVE, OX } from "@/lib/ui/sila/art";
import { STATE_LABEL, titleLines } from "@/lib/ui/sila/view";

export const metadata: Metadata = { title: "Affinity" };

const shortName = (n: string) => n.replace(/^Illustrative /i, "");

export default async function AffinityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireDemoSession();
  const r = await callApi<ProposalDetail>("get_proposal_detail", [session.actorId, id]);
  if (!r.ok) {
    return (
      <main id="main" className="page stack">
        <Flash error={r.error.code} />
        <p>
          <Link href="/demo">Back to all experiences</Link>
        </p>
      </main>
    );
  }
  const p = r.data;
  const look = lookFor(p.experience_title);
  const t = titleLines(p.experience_title);
  const [a, b] = p.group_summaries;

  return (
    <main id="main" className="af" style={themeVars(look)}>
      <div className="wrap" style={{ paddingTop: "clamp(20px,3vw,40px)" }}>
        <div className="af-top">
          <Link href={`/demo/proposals/${p.id}`}>
            <ArrowLeft />
            Affinity reading · {t.plain}
          </Link>
          <span className="op75">Illustrative signals · Qloo integration pending</span>
        </div>
        {a && b ? (
          <div className="af-head">
            <h1>
              <span className="line-mask" style={{ paddingBottom: "0.06em" }}>
                <span data-reveal="line">{a.name}</span>
              </span>
              <span className="line-mask" style={{ paddingBottom: "0.06em" }}>
                <span data-reveal="line" data-delay="90" className="indent">
                  <em>meets</em> {b.name}
                </span>
              </span>
            </h1>
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6 }}>
              Two communities that rarely meet. sila compares what their members save, visit and follow. Where those
              overlap is the reason for “{t.plain}”, and the reason it could fill a room neither could fill alone.
              {p.group_summaries.length > 2 ? ` ${p.group_summaries.length - 2} more group(s) share this proposal.` : ""}
            </p>
          </div>
        ) : (
          <div className="af-head">
            <h1>{a?.name ?? "One group"}</h1>
            <p style={{ margin: 0 }}>An affinity reading needs two groups; this proposal has {p.group_summaries.length}.</p>
          </div>
        )}
      </div>

      {a && b && (
        <AffinityStage
          A={toGroup(a.name)}
          B={toGroup(b.name)}
          accent={look.theme.accent}
          tiles={look.shared.map((s, i) => ({
            t: s[0],
            a: s[1],
            b: s[2],
            ref: s[3],
            src: s[4] ? img(s[4]) : null,
            pos: s[5] ?? "50% 50%",
            bg: [OX, JADE, INDIGO, OLIVE][i % 4]!,
          }))}
          expTitle={t.plain}
          expSrc={img(look.layers[0]!.k)}
          expMeta={`${p.venue_name} · ${STATE_LABEL[p.state]}`}
          proposalHref={`/demo/proposals/${p.id}`}
          compat={look.compat.map(([name, strength, why, k]) => ({ name, strength, why, src: img(k) }))}
        />
      )}
    </main>
  );
}

function toGroup(name: string) {
  const g = groupLook(name);
  return { name, short: shortName(name), src: img(g.img), credit: credit(g.img), members: g.members, place: g.place, only: g.only };
}
