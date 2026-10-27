import { Generations } from '@smogon/calc';
import type { ID } from '@smogon/calc/dist/data/interface';
import { getCatalog } from "./catalog";

const gen=Generations.get(0);
export const engineMoveFor=(id:string)=>{const m=getCatalog().moveById.get(id);return m?gen.moves.get(m.name.toLowerCase().replace(/[^a-z0-9]/g,'') as ID):undefined;};
export const powerConditions:Record<string,{zh:string;en:string}>={
 'assurance':{zh:'目標在本回合已受到傷害：威力 ×2',en:'Target already took damage this turn: power ×2'},
 'avalanche':{zh:'本回合已被此目標的攻擊打中：威力 ×2',en:'This target damaged the user this turn: power ×2'},
 'payback':{zh:'在目標之後出招（不是剛換入的目標）：威力 ×2',en:'Moving after the target (not a switch-in): power ×2'},
 'lash-out':{zh:'本回合能力階級曾被降低：威力 ×2',en:'A stat was lowered this turn: power ×2'},
 'temper-flare':{zh:'上一回合招式失敗：威力 ×2',en:'Previous turn’s move failed: power ×2'},
 'stomping-tantrum':{zh:'上一回合招式失敗：威力 ×2',en:'Previous turn’s move failed: power ×2'},
 'round':{zh:'緊接另一隻的輪唱出招：威力 ×2',en:'Following another Pokémon’s Round: power ×2'},
 'fickle-beam':{zh:'本次全頭發動：威力 ×2（不自動混合發動機率）',en:'All heads activate: power ×2 (activation chance not mixed in)'},
};
export const unsupportedMoveReasons:Record<string,{zh:string;en:string}>={
 'beat-up':{zh:'圍攻需要每位可參戰隊友的種類、狀態與順序；目前尚未提供隊伍逐擊輸入。',en:'Beat Up needs the species, status and order of every eligible party member; party-hit input is not yet supported.'},
 'fling':{zh:'投擲需要確認持有物能否被投擲及道具失效狀態；目前尚未驗證全部道具的投擲威力。',en:'Fling requires item throwability and suppression state; not all item powers have been verified.'},
};
export function moveHitRange(id:string):[number,number]{
 if(id==='dragon-darts')return [1,2];
 const m=engineMoveFor(id);if(!m?.multihit)return [1,1];
 return Array.isArray(m.multihit)?[m.multihit[0],m.multihit[1]]:[m.multiaccuracy?1:m.multihit as number,m.multihit as number];
}
export const borrowedStatNotes:Record<string,{zh:string;en:string}>={
 'body-press':{zh:'基礎威力 80；使用攻擊方的防禦與防禦階級，取代攻擊能力。',en:'Base power 80; uses the attacker’s Defense and Defense stage instead of Attack.'},
 'foul-play':{zh:'基礎威力 95；借用防守方的攻擊與攻擊階級。使用者的特性、道具及灼傷仍另行判定。',en:'Base power 95; borrows the defender’s Attack and Attack stage. User ability, item and burn are evaluated separately.'},
};
export function moveDamageCoverage(id:string){
 const m=getCatalog().moveById.get(id);if(!m)throw new Error(`Unknown Champions move: ${id}`);
 const engine=engineMoveFor(id),hits=moveHitRange(id),reason=unsupportedMoveReasons[id];
 const category=m.category==='Status'?'status-no-direct-damage':!engine?'engine-review-pending':reason?'requires-unmodeled-state':hits[1]>1?'multi-hit':'conditional-damage';
 return {id,category,basePower:m.power,hitRange:hits,offensiveStat: id==='body-press'?'attacker.defense':id==='foul-play'?'defender.attack':m.category==='Special'?'attacker.specialAttack':'attacker.attack',note:borrowedStatNotes[id]??reason??null,powerCondition:powerConditions[id]??null,review:'Catalog availability and engine contract; not exhaustive game validation'};
}
export const getDamageMoveCoverage=()=>getCatalog().moves.map(m=>moveDamageCoverage(m.id));

export const damageMoveCoverage=getDamageMoveCoverage();
