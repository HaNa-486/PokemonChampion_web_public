"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getCatalog } from "../lib/catalog";
import { useTeamStore } from "../lib/team-store";
import { copyMembers, useTeamPlansStore, validPlanMembers, structurallyValidPlanMembers } from "../lib/team-plans-store";
import { useDialogEscape } from "../lib/use-dialog-escape";
import { useModalFocus } from "../lib/use-modal-focus";
import type { BattleFormat, TeamMember } from "../lib/types";
import { exportTeamTransfer, type TeamTransfer } from "../lib/team-transfer";
import { downloadTeamFile, TeamTransferPanel } from "./TeamTransfer";

function ConfirmPlanAction({ message, zh, onConfirm, onCancel }: { message: string; zh: boolean; onConfirm: () => void; onCancel: () => void }) {
  const ref = useModalFocus();
  useDialogEscape(onCancel);
  return createPortal(<div className="scrapbook-dialog-backdrop" style={{zIndex: 100}}><section className="team-plans-dialog" ref={ref} role="alertdialog" aria-modal="true" aria-label={message}><p>{message}</p><div className="team-plan-actions"><button onClick={onCancel}>{zh ? "取消" : "Cancel"}</button><button onClick={onConfirm}>{zh ? "確認" : "Confirm"}</button></div></section></div>, document.body);
}

export function TeamPlans({ format, locale, onClose, initialPlanId = "" }: { format: BattleFormat; locale: "en" | "zh-Hant"; onClose: () => void; initialPlanId?: string }) {
  const zh = locale === "zh-Hant";
  const store = useTeamPlansStore();
  const members = useTeamStore(state => state.teams[format]);
  const hydrated = useTeamStore(state => state.hydrated);
  const teamStatus = useTeamStore(state => state.saveStatus);
  const [selectedId, setSelectedId] = useState(initialPlanId);
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [exportFile, setExportFile] = useState<TeamTransfer | null>(null);
  const [confirmation, setConfirmation] = useState<{message: string; action: () => void} | null>(null);
  const ask = (message: string, action: () => void) => setConfirmation({message, action});
  const [previous, setPrevious] = useState<TeamMember[] | null>(null);
  const ref = useModalFocus();
  useDialogEscape(onClose);
  const hydratePlans = store.hydrate;
  useEffect(() => { void hydratePlans(); }, [hydratePlans]);
  const plans = store.plans.filter(plan => plan.format === format);
  const selected = plans.find(plan => plan.id === selectedId);
  const names = (team: TeamMember[]) => team.map(member => { const pokemon = getCatalog().pokemonById.get(member.pokemonId); return pokemon ? zh ? pokemon.nameZh : pokemon.name : member.pokemonId; }).join(" · ");
  const save = (team: TeamMember[], overwrite = false) => {
    const id = store.save(overwrite && selected ? selected.name : name, format, team, overwrite ? selected?.id : undefined);
    if (id) { setSelectedId(id); setName(""); setNotice(zh ? "方案已更新；成員變更需再次儲存至方案。" : "Plan updated. Save again after changing members."); }
  };
  return createPortal(<div className="scrapbook-dialog-backdrop">{confirmation && <ConfirmPlanAction message={confirmation.message} zh={zh} onCancel={() => setConfirmation(null)} onConfirm={() => { confirmation.action(); setConfirmation(null); }} />}<section ref={ref} role="dialog" aria-modal="true" aria-label={zh ? "隊伍方案" : "Team plans"} className="team-plans-dialog">
    <header><h2>{zh ? "隊伍方案" : "Team plans"} · {format === "singles" ? zh ? "單打" : "Singles" : zh ? "雙打" : "Doubles"}</h2><button onClick={onClose}>{zh ? "關閉" : "Close"}</button></header>
    <p>{zh ? "方案保存在此裝置。載入後可編輯隊伍，再另存新方案或更新原方案。" : "Plans stay on this device. Load a plan, edit the team, then save a new plan or update the original."}</p>
    <p><button onClick={() => setImportOpen(value => !value)} aria-expanded={importOpen}>{zh ? "匯入隊伍 JSON 檔" : "Import team JSON"}</button></p>
    {importOpen && <TeamTransferPanel locale={locale} onClose={() => setImportOpen(false)} onImported={(id, importedFormat) => { setImportOpen(false); if (importedFormat === format) { setSelectedId(id); setNotice(zh ? "已選擇匯入方案；按下「載入到目前隊伍」即可使用。" : "Imported plan selected. Choose Load into current team to use it."); } else { setNotice(zh ? "方案已儲存；請關閉此視窗並切換對戰模式後載入。" : "Plan saved. Close this dialog and switch team mode to load it."); } }} />}
    <button disabled={!members.length} onClick={() => {try{setExportFile(exportTeamTransfer(name.trim() || "Champions team",format,members));}catch{setNotice(zh?"配置無法匯出，請先檢查欄位。":"Could not export; check the team fields.");}}}>{zh ? "匯出目前隊伍" : "Export current team"}</button>
    {exportFile && <section className="team-transfer"><h3>{exportFile.name}</h3><p>{zh ? "下載檔案，或複製完整 JSON 到另一個瀏覽器的「匯入隊伍 JSON 檔」。" : "Download the file, or copy the complete JSON into Import team JSON in another browser."}</p><label>{zh ? "隊伍 JSON" : "Team JSON"}<textarea readOnly rows={7} value={JSON.stringify(exportFile,null,2)} /></label><button onClick={()=>downloadTeamFile(exportFile)}>{zh ? "下載 JSON" : "Download JSON"}</button><button onClick={()=>setExportFile(null)}>{zh ? "收起匯出" : "Hide export"}</button></section>}
    {!store.hydrated ? <p role="status">{store.hydrationError ? zh ? "無法讀取方案，原資料已保留。" : "Could not read plans. Existing data is preserved." : zh ? "載入中…" : "Loading…"}{store.hydrationError && <button onClick={() => void store.hydrate()}>{zh ? "重試" : "Retry"}</button>}</p> : <>
      <section><h3>{zh ? "目前隊伍" : "Current team"} ({members.length}/6)</h3><p>{members.length ? names(members) : zh ? "先將寶可夢加入隊伍。" : "Add Pokémon to your team first."}</p>
        <label>{zh ? "新方案名稱" : "New plan name"}<input maxLength={60} value={name} onChange={event => setName(event.target.value)} placeholder={zh ? "例如：雪天 A" : "e.g. Snow A"} /></label>
        <button disabled={!hydrated || !name.trim() || !members.length || !validPlanMembers(members)} onClick={() => save(members)}>{zh ? "另存目前隊伍" : "Save current team as"}</button>
      </section>
      <label>{zh ? "選擇方案" : "Choose plan"}<select value={selected?.id ?? ""} onChange={event => { setSelectedId(event.target.value); setNotice(""); }}><option value="">{zh ? "選擇已儲存方案…" : "Choose a saved plan…"}</option>{plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name} ({plan.members.length}/6)</option>)}</select></label>
      {!plans.length && <p>{zh ? "尚未儲存這個對戰模式的方案。" : "No saved plans for this format yet."}</p>}
      {initialPlanId && selectedId === initialPlanId && !selected && <p role="alert">{zh ? "此裝置找不到指定方案。請重新匯入，或選擇其他已儲存方案。" : "This plan was not found on this device. Import it again or choose another saved plan."}</p>}
      {selected && <section className="team-plan-preview"><h3>{selected.name}</h3><p>{names(selected.members)}</p>
        {!validPlanMembers(selected.members) && <p role="alert">{zh ? "此方案不符合目前規則，可載入後逐項修正，原資料已保留。" : "This plan no longer meets current rules. Load it to repair the retained choices."}</p>}
        <div className="team-plan-actions">
          <button onClick={() => {try{setExportFile(exportTeamTransfer(selected.name,selected.format,selected.members));}catch{setNotice(zh?"配置無法匯出，請先檢查欄位。":"Could not export; check the plan fields.");}}}>{zh ? "匯出此方案" : "Export this plan"}</button>
          <button disabled={!hydrated || !structurallyValidPlanMembers(selected.members)} onClick={() => { const load = () => { const backup = copyMembers(members); if (useTeamStore.getState().replace(format, selected.members, { retainInvalid: true })) { setPrevious(backup); setNotice(zh ? "已載入隊伍。關閉此視窗即可編輯成員。" : "Team loaded. Close this dialog to edit members."); } }; if (members.length) ask(zh ? "以此方案取代目前隊伍？可用「復原載入」還原。" : "Replace the current team? You can undo this load.", load); else load(); }}>{zh ? "載入到目前隊伍" : "Load into current team"}</button>
          <button disabled={!name.trim() || !validPlanMembers(selected.members)} onClick={() => save(selected.members)}>{zh ? "複製為新方案" : "Duplicate as new plan"}</button>
          <button disabled={!members.length || !validPlanMembers(members)} onClick={() => ask(zh ? `以目前隊伍更新「${selected.name}」？` : `Update “${selected.name}” with the current team?`, () => save(members, true))}>{zh ? "以目前隊伍更新" : "Update from current team"}</button>
          <button disabled={!name.trim()} onClick={() => { store.rename(selected.id, name); setName(""); }}>{zh ? "以新名稱重新命名" : "Rename using new name"}</button>
          <button onClick={() => ask(zh ? `刪除方案「${selected.name}」？目前隊伍不受影響。` : `Delete plan “${selected.name}”? Your current team is kept.`, () => { store.remove(selected.id); setSelectedId(""); })}>{zh ? "刪除方案" : "Delete plan"}</button>
        </div>
        <small>{zh ? "複製或重新命名使用上方「新方案名稱」。" : "Duplicate and rename use the New plan name above."}</small>
      </section>}
      {previous && <button onClick={() => ask(zh ? "復原為上次載入前的隊伍？這會取代目前隊伍。" : "Restore the team from before the last load, replacing the current team?", () => { if (useTeamStore.getState().replace(format, previous, { retainInvalid: true })) { setPrevious(null); setNotice(zh ? "已復原隊伍。" : "Team restored."); } })}>{zh ? "復原載入" : "Undo load"}</button>}
      <p role="status">{notice}</p><p role="status">{store.saveStatus === "error" ? zh ? "方案儲存失敗，請勿關閉此頁。" : "Plan save failed. Keep this page open." : store.saveStatus === "saving" ? zh ? "方案儲存中…" : "Saving plans…" : zh ? "方案已儲存到此裝置" : "Plans saved on this device"}{store.saveStatus === "error" && <button onClick={store.retrySave}>{zh ? "重試儲存方案" : "Retry saving plans"}</button>}</p>
      {teamStatus === "error" && <p role="alert">{zh ? "目前隊伍儲存失敗，請重試。" : "Current team save failed. Please retry."}<button onClick={() => useTeamStore.getState().retrySave()}>{zh ? "重試儲存隊伍" : "Retry saving team"}</button></p>}
    </>}
  </section></div>, document.body);
}
