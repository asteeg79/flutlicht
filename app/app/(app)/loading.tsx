/**
 * Ladezustand aller App-Seiten: Kopf und Flächen als Platzhalter. Nach einem Kaltstart
 * braucht der Server bis zu 2 s; ohne diese Datei bliebe der alte Tab so lange stehen,
 * und Next.js könnte die Tabs der Navigation nicht vorab laden.
 */
export default function Loading() {
  return (
    <div role="status" className="arena-anim animate-pulse">
      <span className="sr-only">Lädt …</span>
      <div className="hero-bg px-[18px] pt-[calc(env(safe-area-inset-top)+20px)] pb-3.5 lg:px-9 lg:pt-7 lg:pb-[22px]">
        <div className="mx-auto max-w-[560px] lg:max-w-none">
          <div className="mb-2 h-6 w-32 bg-hero-text/15 lg:mb-2.5" />
          <div className="h-[34px] w-56 bg-hero-text/15 lg:h-[43px] lg:w-72" />
          <div className="mt-2.5 flex gap-[22px] lg:hidden">
            <div className="h-10 w-14 bg-hero-text/15" />
            <div className="h-10 w-14 bg-hero-text/15" />
            <div className="h-10 w-20 bg-hero-text/15" />
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-[560px] flex-col gap-3 px-[18px] pt-[18px] lg:max-w-none lg:px-9 lg:pt-6">
        <div className="h-48 bg-surface" />
        <div className="h-16 bg-surface" />
        <div className="h-16 bg-surface" />
      </div>
    </div>
  );
}
