import { notFound } from "next/navigation";
import { ArenaDemo } from "./demo";

export const metadata = { title: "Arena-Bausteine" };

/** Interne Übersicht aller Arena-Bausteine, dunkel und hell; nur in der Entwicklung. */
export default function ArenaDemoPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ArenaDemo />;
}
