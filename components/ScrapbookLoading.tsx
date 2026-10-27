"use client";

import { useScrapbookStore } from "../lib/scrapbook-store";

export function ScrapbookLoading({ locale }: { locale: "en" | "zh-Hant" }) {
  const failed = useScrapbookStore((state) => state.hydrationError);
  const hydrate = useScrapbookStore((state) => state.hydrate);
  return <section className="panel"><p role="status">{failed
    ? locale === "zh-Hant" ? "無法讀取畫本，尚未變更已儲存的資料。請重試。" : "Could not load scrapbooks. Saved data has not been changed. Please retry."
    : locale === "zh-Hant" ? "正在讀取畫本…" : "Loading scrapbooks…"}</p>{failed && <button onClick={() => { void hydrate(); }}>{locale === "zh-Hant" ? "重試" : "Retry"}</button>}</section>;
}
