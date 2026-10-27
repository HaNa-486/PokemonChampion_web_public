/**
 * Original portfolio fixture. Species stats and move mechanics come from the
 * pinned MIT-licensed @smogon/calc package, never a live service.
 * Selected abilities, move lists and builds are demonstration choices, not an
 * assertion of current Pokémon Champions availability or competitive legality.
 */
import { Generations } from '@smogon/calc';
import type { ID } from '@smogon/calc/dist/data/interface';
import type { Ability, HeldItem, Move, Pokemon, PokemonType, Stats } from '../lib/types';

export const DEMO_VERSION = 'portfolio-demo-v1';
export const DEMO_NOTICE = 'Portfolio demo: fabricated usage statistics and a small illustrative catalog. Not current game data or a legality reference.';
export const DEMO_IMAGE = './demo-token.svg';
const engine = Generations.get(0);
const engineId = (id: string) => id.replace(/[^a-z0-9]/g, '') as ID;

const abilityNotes: Array<[string, string, string, string]> = [
  ['inner-focus', '精神力', 'Resists flinching and Intimidate. Turn history is outside this demo.', '不會畏縮，並抵抗威嚇；此示範不模擬回合歷史。'],
  ['multiscale', '多重鱗片', 'Reduces direct damage when the holder starts at full HP.', '持有者處於滿 HP 時，減少受到的直接傷害。'],
  ['sand-veil', '沙隱', 'Changes evasion in sand. Hit chance is outside the damage result.', '沙暴中影響閃避；傷害結果不包含命中機率。'],
  ['rough-skin', '粗糙皮膚', 'Contact can hurt the attacker after the hit; that recoil is outside the direct damage result.', '接觸後可能使攻擊者受傷；此反傷不計入直接傷害結果。'],
  ['blaze', '猛火', 'Boosts Fire damage at low HP; set the current HP explicitly.', '低 HP 時增強火屬性傷害；請設定目前 HP。'],
  ['tough-claws', '硬爪', 'Boosts attacks that make contact.', '增強會接觸對手的攻擊。'],
  ['torrent', '激流', 'Boosts Water damage at low HP; set the current HP explicitly.', '低 HP 時增強水屬性傷害；請設定目前 HP。'],
  ['overgrow', '茂盛', 'Boosts Grass damage at low HP; set the current HP explicitly.', '低 HP 時增強草屬性傷害；請設定目前 HP。'],
  ['chlorophyll', '葉綠素', 'Raises Speed in sun; select the current weather.', '晴天下提高速度；請選擇目前天氣。'],
  ['cursed-body', '詛咒之軀', 'May disable a move after a hit. Later turns are outside this demo.', '受擊後可能使招式無法使用；此示範不模擬後續回合。'],
  ['immunity', '免疫', 'Prevents poisoning; the calculator uses the status explicitly entered.', '防止中毒；計算器使用明確輸入的狀態。'],
  ['thick-fat', '厚脂肪', 'Reduces incoming Fire and Ice damage.', '減少受到的火與冰屬性傷害。'],
];
export const demoAbilities: Ability[] = abilityNotes.map(([id, nameZh, description, descriptionZh]) => {
  const ability = engine.abilities.get(engineId(id));
  if (!ability) throw new Error(`Demo ability missing from pinned engine: ${id}`);
  return { id, name: ability.name, nameZh, description, descriptionZh };
});

// Accuracy and PP are intentionally unavailable: this dependency supplies the
// damage contract, not the full move catalog. A PP value of 0 means not supplied.
const moveNotes: Array<[string, string, string, string]> = [
  ['dragon-claw', '龍爪', 'A direct physical Dragon attack.', '直接造成物理傷害的龍屬性攻擊。'],
  ['earthquake', '地震', 'A Ground attack that can hit adjacent combatants.', '可攻擊相鄰寶可夢的地面屬性招式。'],
  ['extreme-speed', '神速', 'A physical Normal attack with elevated priority.', '具有較高優先度的一般屬性物理攻擊。'],
  ['protect', '守住', 'A defensive status move; not a direct damage attack.', '防守用的變化招式，不直接造成傷害。'],
  ['flamethrower', '噴射火焰', 'A direct special Fire attack.', '直接造成特殊傷害的火屬性攻擊。'],
  ['air-slash', '空氣斬', 'A direct special Flying attack.', '直接造成特殊傷害的飛行屬性攻擊。'],
  ['heat-wave', '熱風', 'A special Fire attack that can target both opponents.', '可攻擊兩名對手的火屬性特殊招式。'],
  ['flare-blitz', '閃焰衝鋒', 'A contact Fire attack with recoil after damage.', '造成傷害後有反作用力的火屬性接觸攻擊。'],
  ['surf', '衝浪', 'A special Water attack that can hit adjacent combatants.', '可攻擊相鄰寶可夢的水屬性特殊招式。'],
  ['ice-beam', '冰凍光束', 'A direct special Ice attack.', '直接造成特殊傷害的冰屬性攻擊。'],
  ['hydro-pump', '水炮', 'A high-power special Water attack.', '威力較高的水屬性特殊攻擊。'],
  ['giga-drain', '終極吸取', 'A special Grass attack that can restore HP after damage.', '造成傷害後可恢復 HP 的草屬性特殊攻擊。'],
  ['sludge-bomb', '污泥炸彈', 'A direct special Poison attack.', '直接造成特殊傷害的毒屬性攻擊。'],
  ['energy-ball', '能量球', 'A direct special Grass attack.', '直接造成特殊傷害的草屬性攻擊。'],
  ['shadow-ball', '暗影球', 'A direct special Ghost attack.', '直接造成特殊傷害的幽靈屬性攻擊。'],
  ['thunderbolt', '十萬伏特', 'A direct special Electric attack.', '直接造成特殊傷害的電屬性攻擊。'],
  ['dazzling-gleam', '魔法閃耀', 'A special Fairy attack that can target both opponents.', '可攻擊兩名對手的妖精屬性特殊招式。'],
  ['body-slam', '泰山壓頂', 'A physical Normal attack that makes contact.', '會接觸對手的一般屬性物理攻擊。'],
  ['crunch', '咬碎', 'A physical Dark attack that makes contact.', '會接觸對手的惡屬性物理攻擊。'],
  ['high-horsepower', '十萬馬力', 'A direct physical Ground attack.', '直接造成物理傷害的地面屬性攻擊。'],
];
const targetLabels: Record<string, string> = { normal: '1 adjacent target', allAdjacent: 'All adjacent', allAdjacentFoes: 'All foes', self: 'Self' };
const flagLabels: Record<string, string> = { contact: 'Contact', bite: 'Bite', sound: 'Sound', punch: 'Punch', bullet: 'Ballistics', pulse: 'Pulse', slicing: 'Slicing', wind: 'Wind' };
export const demoMoves: Move[] = moveNotes.map(([id, nameZh, description, descriptionZh]) => {
  const move = engine.moves.get(engineId(id));
  if (!move) throw new Error(`Demo move missing from pinned engine: ${id}`);
  return { id, name: move.name, nameZh, type: move.type as PokemonType,
    category: move.category ?? 'Status', power: move.category === 'Status' ? null : move.basePower,
    accuracy: null, pp: 0, priority: move.priority ?? 0,
    target: id === 'protect' ? 'Self' : targetLabels[move.target ?? 'normal'] ?? 'Varies',
    flags: Object.entries(move.flags ?? {}).filter(([, enabled]) => !!enabled).map(([flag]) => flagLabels[flag] ?? flag), description, descriptionZh };
});

const itemNotes: Array<[string, string, string, string, string]> = [
  ['choice-scarf', '講究圍巾', 'Item', 'Raises Speed while restricting move selection.', '提高速度，但限制招式選擇。'],
  ['leftovers', '吃剩的東西', 'Item', 'Restores HP at turn end; not part of direct hit damage.', '回合結束時恢復 HP；不計入直接受擊傷害。'],
  ['sitrus-berry', '文柚果', 'Berry', 'Restores HP when its HP condition is met.', '滿足 HP 條件時恢復 HP。'],
  ['life-orb', '生命寶珠', 'Item', 'Boosts damage with an HP cost after an attack.', '增強傷害，但攻擊後會消耗 HP。'],
  ['focus-sash', '氣勢披帶', 'Item', 'Can preserve 1 HP from a full-HP knockout hit.', '滿 HP 時受到致命一擊，可保留 1 HP。'],
  ['charizardite-x', '噴火龍進化石 X', 'Mega Stone', 'Connects Charizard to the Mega X form in this demo.', '在此示範中連接噴火龍與超級 X 型態。'],
];
export const demoItems: HeldItem[] = itemNotes.map(([id, nameZh, category, description, descriptionZh]) => {
  const item = engine.items.get(engineId(id));
  if (!item) throw new Error(`Demo item missing from pinned engine: ${id}`);
  return { id, name: item.name, nameZh, category, description, descriptionZh, imageUrl: DEMO_IMAGE };
});

type SpeciesFixture = { id: string; engineKey: string; nameZh: string; dex: number; generation: number; abilityIds: string[]; moveIds: string[]; name?: string; baseId?: string };
export const demoSpecies: SpeciesFixture[] = [
  { id: 'dragonite', engineKey: 'dragonite', nameZh: '快龍', dex: 149, generation: 1, abilityIds: ['inner-focus', 'multiscale'], moveIds: ['dragon-claw', 'earthquake', 'extreme-speed', 'protect'] },
  { id: 'garchomp', engineKey: 'garchomp', nameZh: '烈咬陸鯊', dex: 445, generation: 4, abilityIds: ['sand-veil', 'rough-skin'], moveIds: ['earthquake', 'dragon-claw', 'crunch', 'protect'] },
  { id: 'charizard', engineKey: 'charizard', nameZh: '噴火龍', dex: 6, generation: 1, abilityIds: ['blaze'], moveIds: ['flamethrower', 'air-slash', 'heat-wave', 'protect', 'dragon-claw', 'flare-blitz'] },
  { id: 'mega-charizard-x', engineKey: 'charizardmegax', name: 'Mega Charizard X', nameZh: '超級噴火龍 X', dex: 6, generation: 6, baseId: 'charizard', abilityIds: ['tough-claws'], moveIds: ['flare-blitz', 'dragon-claw', 'earthquake', 'protect', 'flamethrower'] },
  { id: 'blastoise', engineKey: 'blastoise', nameZh: '水箭龜', dex: 9, generation: 1, abilityIds: ['torrent'], moveIds: ['surf', 'ice-beam', 'hydro-pump', 'protect'] },
  { id: 'venusaur', engineKey: 'venusaur', nameZh: '妙蛙花', dex: 3, generation: 1, abilityIds: ['overgrow', 'chlorophyll'], moveIds: ['giga-drain', 'sludge-bomb', 'energy-ball', 'protect'] },
  { id: 'gengar', engineKey: 'gengar', nameZh: '耿鬼', dex: 94, generation: 1, abilityIds: ['cursed-body'], moveIds: ['shadow-ball', 'sludge-bomb', 'thunderbolt', 'dazzling-gleam', 'protect'] },
  { id: 'snorlax', engineKey: 'snorlax', nameZh: '卡比獸', dex: 143, generation: 1, abilityIds: ['immunity', 'thick-fat'], moveIds: ['body-slam', 'crunch', 'high-horsepower', 'protect'] },
];
export const demoPokemon: Pokemon[] = demoSpecies.map(fixture => {
  const species = engine.species.get(engineId(fixture.engineKey));
  if (!species) throw new Error(`Demo species missing from pinned engine: ${fixture.id}`);
  const s = species.baseStats;
  const baseStats: Stats = { hp: s.hp, attack: s.atk, defense: s.def, specialAttack: s.spa, specialDefense: s.spd, speed: s.spe };
  return { id: fixture.id, speciesKey: fixture.baseId ?? fixture.engineKey, battleDataKey: fixture.engineKey,
    name: fixture.name ?? species.name, nameZh: fixture.nameZh, types: [...species.types] as PokemonType[],
    baseStats, imageUrl: DEMO_IMAGE, abilityIds: [...fixture.abilityIds], moveIds: [...fixture.moveIds],
    isMega: !!fixture.baseId, legal: true };
});
export const demoFormRelations = [{ baseFormId: 'charizard', megaFormId: 'mega-charizard-x', requiredItemId: 'charizardite-x', source: 'Portfolio demonstration form mapping' }];
export const demoDexByPokemonId = Object.fromEntries(demoSpecies.map(p => [p.id, p.dex]));
export const demoGenerationByPokemonId = Object.fromEntries(demoSpecies.map(p => [p.id, p.generation]));
