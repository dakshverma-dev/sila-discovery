import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShowcaseConfirm } from "@/components/sila/showcase-live";
import { img } from "@/lib/ui/sila/art";
import { DEMO_EXPS, demoById, demoLook } from "@/lib/ui/sila/showcase";

export const metadata: Metadata = { title: "Commit to a place" };

export function generateStaticParams() {
  return DEMO_EXPS.map((e) => ({ id: e.id }));
}

export default async function ShowcaseConfirmPage({ params }: { params: Promise<{ id: string }> }) {
  const e = demoById((await params).id);
  if (!e) notFound();
  return (
    <main id="main">
      <ShowcaseConfirm e={e} src={img(demoLook(e).layers[0]!.k)} />
    </main>
  );
}
