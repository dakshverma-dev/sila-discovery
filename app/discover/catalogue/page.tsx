import Link from "next/link";
import { sessions } from "@/lib/discovery/catalog";
import { SessionCard } from "@/components/discovery/card";
export default function Catalogue() {
  return (
    <section className="sd-page">
      <p className="sd-kicker">The sample collection</p>
      <h1>
        Five places.
        <br />A shared beginning.
      </h1>
      <p className="sd-lede">
        Browse fictional sessions at real Edinburgh venues. This page is
        unranked and makes no Qloo recommendation call.
      </p>
      <aside className="sd-notice">
        All dates, prices and capacities are fictional. These venues have not
        offered or approved these sessions.{" "}
        <Link href="/discover">Run live discovery</Link> to create a private
        sample shortlist and request.
      </aside>
      <div className="sd-cards">
        {sessions.map((s) => (
          <SessionCard session={s} key={s.id} />
        ))}
      </div>
    </section>
  );
}
