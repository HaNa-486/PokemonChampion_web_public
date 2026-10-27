"use client";
import { useState } from "react";
import { getCatalog } from "../lib/catalog";
import { MAX_TRANSFER_BYTES, previewTeamTransfer, type TeamTransfer } from "../lib/team-transfer";
import { useTeamPlansStore } from "../lib/team-plans-store";
import type { BattleFormat } from "../lib/types";

export function downloadTeamFile(file: TeamTransfer) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = "champions-demo-team.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function TeamTransferPanel({ initial, onClose, onImported, locale = "en" }: {
  initial?: unknown;
  onClose?: () => void;
  onImported?: (id: string, format: BattleFormat) => void;
  locale?: "en" | "zh-Hant";
}) {
  const zh = locale === "zh-Hant", t = (en: string, cn: string) => zh ? cn : en;
  const [text, setText] = useState(initial ? JSON.stringify(initial, null, 2) : "");
  const [preview, setPreview] = useState<ReturnType<typeof previewTeamTransfer> | null>(() => { try { return initial ? previewTeamTransfer(initial) : null; } catch { return null; } });
  const [importId, setImportId] = useState(() => initial ? `import-${crypto.randomUUID()}` : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const inspect = () => {
    setError(""); setSaved(false);
    try {
      if (new TextEncoder().encode(text).byteLength > MAX_TRANSFER_BYTES) throw new Error(t("File exceeds 32 KiB", "檔案超過 32 KiB"));
      setPreview(previewTeamTransfer(JSON.parse(text))); setImportId(`import-${crypto.randomUUID()}`);
    } catch (e) { setPreview(null); setError(e instanceof Error ? e.message : "Invalid JSON"); }
  };
  const save = async () => {
    if (!preview || busy || saved) return;
    setBusy(true); setError("");
    try {
      const fresh = previewTeamTransfer(preview.file);
      if (JSON.stringify(fresh.validatedAgainst) !== JSON.stringify(preview.validatedAgainst)) throw new Error(t("Fixture version changed; preview again", "範例版本已變更，請重新預覽"));
      await useTeamPlansStore.getState().importNew(preview.file, importId);
      setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Import failed"); }
    finally { setBusy(false); }
  };
  const name = (map: Map<string, { name: string; nameZh: string }>, id: string | null) => {
    const entry = id ? map.get(id) : null;
    return entry ? zh ? entry.nameZh : entry.name : id ?? t("Empty", "未設定");
  };
  return <section className="team-transfer" aria-label={t("Import team JSON", "匯入隊伍 JSON")}>
    <h2>{t("1. Choose a team file", "1. 提供隊伍檔案")}</h2>
    <p>{t("Choose or paste JSON, preview it, then save a new plan. Files are processed in this browser and never uploaded.", "選擇或貼上 JSON、預覽，再另存方案。檔案只在此瀏覽器處理，不會上傳。")}</p>
    <label>{t("Choose JSON", "選擇 JSON 檔")} <input type="file" accept=".json,application/json" disabled={busy} onChange={async e => {
      const file = e.target.files?.[0]; if (!file) return;
      setPreview(null); setSaved(false); setError("");
      if (file.size > MAX_TRANSFER_BYTES) { setError(t("File exceeds 32 KiB", "檔案超過 32 KiB")); return; }
      try { setText(await file.text()); } catch { setError(t("Could not read file", "無法讀取檔案")); }
    }} /></label>
    <label>{t("Paste JSON", "貼上 JSON")} <textarea placeholder={t("Paste an exported demo team here…", "在這裡貼上已匯出的示範隊伍 JSON…")} rows={9} maxLength={MAX_TRANSFER_BYTES} value={text} disabled={busy} onChange={e => { setText(e.target.value); setPreview(null); setSaved(false); }} /></label>
    <button onClick={inspect} disabled={busy || !text.trim()}>{t("Preview & validate", "預覽與驗證")}</button>
    {error && <p role="alert">{error}</p>}
    {preview && <section className="transfer-preview" aria-label="Import preview">
      <h2>{t("2. Review and save a plan", "2. 檢查並另存方案")}</h2>
      <h3>{preview.file.name} · {preview.file.format === "doubles" ? t("Doubles", "雙打") : t("Singles", "單打")} · {preview.file.members.length}/6</h3>
      <p>{preview.versionChanged ? t("Version differs; checked against demo rules", "版本不同，已按示範規則重新檢查") : t("Same demo version", "示範版本相符")}</p>
      <p>{preview.complete ? t("Complete team under demo rules", "符合示範規則的完整隊伍") : preview.legal ? t("Valid incomplete demo draft", "符合示範規則，尚未完成") : t("Invalid configuration", "配置有錯誤")}</p>
      <ol>{preview.file.members.map((m, i) => <li key={i}><strong>{name(getCatalog().pokemonById, m.pokemonId)}</strong><p>{name(getCatalog().abilityById, m.abilityId)} · {name(getCatalog().itemById, m.itemId)} · {m.nature}</p><p>AP: {Object.entries(m.ap).map(([k, v]) => `${k} ${v}`).join(" / ")}</p><ol>{m.moveSlots.map((id, slot) => <li key={slot}>{name(getCatalog().moveById, id)}</li>)}</ol></li>)}</ol>
      {preview.issues.map((e, i) => <p role="alert" key={i}>{e.memberId}: {e.code} — {e.message}</p>)}
      {preview.incomplete.map(s => <p key={s}>{s}</p>)}
      <button disabled={!preview.legal || busy || saved} onClick={() => void save()}>{busy ? t("Saving…", "儲存中…") : saved ? t("Saved as new plan", "已另存新方案") : t("Confirm new plan", "另存為隊伍方案")}</button>
      <button disabled={busy} onClick={() => { setPreview(null); onClose?.(); }}>{saved ? t("Done", "完成") : t("Cancel", "取消")}</button>
      {saved && <section className="transfer-success"><h2>{t("3. Use your saved plan", "3. 使用已儲存的方案")}</h2><p role="status">{t("The new plan is saved on this device. Your selected team has not changed.", "新方案已儲存到此裝置，目前隊伍尚未變更。")}</p>{onImported && <button onClick={() => onImported(importId, preview.file.format)}>{t("Select imported plan", "選擇匯入方案")}</button>}</section>}
    </section>}
  </section>;
}
