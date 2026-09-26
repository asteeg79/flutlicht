import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { FreshnessBanner } from "@/components/freshness-banner";
import { UpdateNotice } from "@/components/update-notice";
import { auth } from "@/lib/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Die Middleware leitet schon um; das hier deckt Pfade ab, die ihr Matcher verfehlt.
  if (!(await auth())) redirect("/login");
  return (
    <>
      <main className="mx-auto min-h-dvh max-w-lg px-5 pt-8 pb-28">
        <UpdateNotice />
        <FreshnessBanner />
        {children}
      </main>
      <BottomNav />
    </>
  );
}
