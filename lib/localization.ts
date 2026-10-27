import type { PokemonType } from "./types";

export type Locale = "en" | "zh-Hant";

const zh: Record<string, string> = {
  Normal: "一般", Fire: "火", Water: "水", Electric: "電", Grass: "草", Ice: "冰", Fighting: "格鬥", Poison: "毒", Ground: "地面", Flying: "飛行", Psychic: "超能力", Bug: "蟲", Rock: "岩石", Ghost: "幽靈", Dragon: "龍", Dark: "惡", Steel: "鋼", Fairy: "妖精",
  Physical: "物理", Special: "特殊", Status: "變化",
  "1 target": "單一目標", "1 Foe": "單一對手", "All Pokemon": "場上所有寶可夢", "All Pokémon": "場上所有寶可夢", "All adjacent": "所有鄰近寶可夢", "All allies": "所有我方", "All foes": "所有對手", Ally: "我方一隻", "Ally or self": "自己或我方", "Ally side": "我方場地", "Opposing side": "對手場地", "Random foe": "隨機對手", Self: "自己", Varies: "依招式而異", "Whole field": "全場",
  Authentic: "真實系招式", Ballistics: "球彈類", Bite: "啃咬類", Charge: "蓄力", Contact: "接觸", Dance: "舞蹈類", Defrost: "可解凍", Distance: "遠距離", Gravity: "受重力影響", Heal: "回復類", Mental: "心神類", Mirror: "可被鏡面招式模仿", "Non Sky Battle": "空中對戰限制", Powder: "粉末類", Protect: "可被守住", Pulse: "波動／波導類", Punch: "拳擊類", Recharge: "需休息", Reflectable: "可被魔法反射", Slicing: "切斬類", Snatch: "可被搶奪", Sound: "聲音類", Wind: "風類", Explosion: "爆炸類",
  Weather: "天氣", Terrain: "場地", Offense: "攻擊", Defense: "防禦", Statuses: "狀態", "Stat Changes": "能力變化", Speed: "速度", Type: "屬性", Switch: "替換", "Switch / Hazard": "替換／場地障礙", "Item / Berry": "道具／樹果", "Ability / Move": "特性／招式", Other: "其他",
  "Mega Stone": "超級石", Item: "一般道具", Berry: "樹果", "HP Recovery": "HP 回復", "Status Cure": "異常狀態回復", "PP Recovery": "PP 回復", "Damage Halving": "傷害減半", "Held item": "持有物",
  Priority: "優先度", Category: "分類", Target: "目標", Properties: "招式性質", "Move families": "招式種類", "Interaction flags": "進階機制", "Entire party": "我方全隊（含後備）", "Attacker (retaliation)": "攻擊者（反擊）", "Entire field": "全場", "1 adjacent target": "單一鄰近目標", "1 target (any distance)": "單一目標（不限距離）", "User and allies": "自己與所有我方", Move: "招式", Class: "分類", Power: "威力", "Acc.": "命中", Effect: "效果", Name: "名稱", Ability: "特性", "Effect class": "效果分類", Pokemon: "寶可夢", Pokémon: "寶可夢",
  "+ Positive": "+ 正優先度", "0 Neutral": "0 一般優先度", "− Negative": "− 負優先度", "- Negative": "− 負優先度",
};

export function localizedTerm(value: string, locale: Locale) {
  return locale === "zh-Hant" ? zh[value] ?? value : value;
}

export function localizedTerms(values: string[], locale: Locale) {
  return values.map((value) => localizedTerm(value, locale)).join(" · ");
}

export function localizedType(type: PokemonType, locale: Locale) {
  return localizedTerm(type, locale);
}
