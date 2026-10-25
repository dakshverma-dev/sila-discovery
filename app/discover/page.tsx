import Image from "next/image";
import { DiscoveryForm } from "@/components/discovery/form";
export default function Page() {
  return (
    <>
      <section className="sd-hero">
        <div className="sd-intro">
          <p className="sd-kicker">The Edinburgh collection / November 2026</p>
          <h1>
            Good company.
            <br />A little <em>culture.</em>
            <br />
            Something shared.
          </h1>
          <p className="sd-lede">
            A jazz record, a favourite film, a book passed around. Start with
            what your club loves. Find somewhere to go together.
          </p>
          <div className="sd-collage" aria-hidden="true">
            <div className="sd-collage-circle">
              <Image
                src="/art/actiniae.jpg"
                alt=""
                fill
                sizes="360px"
                priority
              />
            </div>
            <div className="sd-collage-square">
              <Image src="/art/bewick.jpg" alt="" fill sizes="230px" priority />
            </div>
            <span className="sd-collage-note">
              A connection
              <br />
              worth making.
            </span>
          </div>
          <p className="sd-caption">Sila / صلة / connection</p>
        </div>
        <DiscoveryForm />
      </section>
      <section className="sd-method">
        <div>
          <span>01</span>
          <h2>Begin with your tastes</h2>
          <p>
            Choose real cultural interests through Qloo’s search. A musician can
            lead to a garden. A film can lead to a gallery.
          </p>
        </div>
        <div>
          <span>02</span>
          <h2>Find what fits</h2>
          <p>
            Qloo orders the venues. Sila checks the sample dates, per-person
            budget and room for your club.
          </p>
        </div>
        <div>
          <span>03</span>
          <h2>Make a conditional request</h2>
          <p>
            Save a private sample request. Nothing is booked: the venue would
            still need to approve the club and session.
          </p>
        </div>
      </section>
      <aside className="sd-notice">
        <strong>A working discovery demo, with an honest boundary.</strong>{" "}
        Venue identities and affinities come from live Qloo calls. Sessions,
        prices and capacity are fictional. No venue partnership, booking or
        payment is implied.
      </aside>
    </>
  );
}
