import { z } from 'zod';
import { calculate, Generations, Pokemon as CalcPokemon, Move as CalcMove, Field } from '@smogon/calc';
import type { StatsTable, StatID, ID, SpeciesName, AbilityName, ItemName, NatureName, TypeName } from '@smogon/calc/dist/data/interface';
import { getCatalog } from "./catalog";
import { calculateFinalStats, NATURES } from './domain';
import { previewTeamTransfer, transferMemberSchema, type TeamTransfer } from './team-transfer';
import { getPublishedData } from "./published-data";
import { ALL_TYPES } from './type-chart';
import { abilityCoverage, isCurrentChampionsAbility } from './damage-abilities';
import { engineMoveFor, moveHitRange, powerConditions, unsupportedMoveReasons, moveDamageCoverage } from './damage-moves';
import { combineDamageHits } from './damage-distribution';
import type { Stats, Pokemon } from './types';
import { effectiveDamageAbility } from './damage-battle-state';
import { checkIntimidate } from '@smogon/calc/dist/mechanics/util';
import { getBerryResistType } from '@smogon/calc/dist/items';

const gen = Generations.get(0); // Native Champions mechanics and Stat Points, NOT Gen 9 EVs.
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '') as ID;
const statKeys = { hp: 'hp', attack: 'atk', defense: 'def', specialAttack: 'spa', specialDefense: 'spd', speed: 'spe' } as const;
const engineStats = (s: Stats): StatsTable => Object.fromEntries(Object.entries(statKeys).map(([k,v]) => [v,s[k as keyof Stats]])) as StatsTable;
const stage = z.number().int().min(-6).max(6).default(0);
export const damageConditionSchema = z.object({
  hpPercent: z.number().min(1).max(100).default(100),
  status: z.enum(['none', 'brn', 'par', 'psn', 'tox', 'slp', 'frz']).default('none'),
  boosts: z.object({attack:stage,defense:stage,specialAttack:stage,specialDefense:stage,speed:stage}).strict().prefault({}),
  abilityEnabled: z.boolean().default(true),
  copiedAbilityId: z.string().max(100).nullable().default(null),
  disguiseBusted: z.boolean().default(false),
  gender: z.enum(['M','F','N']).nullable().default(null),
  currentTypes: z.array(z.enum(ALL_TYPES as [string,...string[]])).min(1).max(2).refine(v=>new Set(v).size===v.length,'Current types must be unique.').nullable().default(null),
  movesLast: z.boolean().nullable().default(null),
  abilityOn: z.boolean().default(false), alliesFainted: z.number().int().min(0).max(5).default(0),
}).strict();
export const allyAbilities = ['none','friend-guard','steely-spirit','plus','minus','fairy-aura','queenly-majesty','armor-tail','cloud-nine','damp','lightning-rod','flower-veil'] as const;
export const damageFieldSchema = z.object({
  attackerAllyAbility: z.enum(allyAbilities).default('none'), defenderAllyAbility: z.enum(allyAbilities).default('none'),
  weather: z.enum(['none','Sun','Rain','Sand','Snow']).default('none'),
  terrain: z.enum(['none','Electric','Grassy','Psychic','Misty']).default('none'),
  reflect: z.boolean().default(false), lightScreen: z.boolean().default(false), auroraVeil: z.boolean().default(false),
  protected: z.boolean().default(false), helpingHand: z.boolean().default(false),
  gravity:z.boolean().default(false),
  attackerTailwind: z.boolean().default(false), defenderTailwind: z.boolean().default(false),
}).strict();
export const damageMoveOptionsSchema=z.object({
  hits:z.number().int().min(1).max(10).nullable().default(null),
  powerBoost:z.boolean().default(false),
  timesHit:z.number().int().min(0).max(6).default(0),
  faintEvents:z.number().int().min(0).max(100).default(0),
  stockpiles:z.number().int().min(0).max(3).default(0),
  receivedDamage:z.number().int().min(0).max(999).default(0),
  accuracyStage:stage,evasionStage:stage,
}).strict();
export const damageSchema = z.object({
  action: z.literal('damage'), format: z.enum(['singles','doubles']),
  attacker: transferMemberSchema, defender: transferMemberSchema,
  moveId: z.string().min(1).max(100),
  moveOptions:damageMoveOptionsSchema.prefault({}),
  moveExecution: z.enum(['success','failure']).default('success'),
  attackerCondition: damageConditionSchema.prefault({}), defenderCondition: damageConditionSchema.prefault({}),
  field: damageFieldSchema.prefault({}), critical: z.boolean().default(false),
  // Explicit, legal alternative spreads. Never silently optimize a whole build.
  alternatives: z.array(z.object({label:z.string().max(60), side:z.enum(['attacker','defender']), ap:transferMemberSchema.shape.ap}).strict()).max(6).default([]),
  dataVersion: z.string().max(100).optional(),
}).strict();
export type DamageQuery = z.infer<typeof damageSchema>;
export type DamageBuild = TeamTransfer['members'][number];
export type DamageCondition = z.infer<typeof damageConditionSchema>;
const specialSpecies: Record<string,string> = { 'aegislash-blade-forme':'Aegislash-Blade','aegislash-shield-forme':'Aegislash-Shield','mega-meowstic':'Meowstic-M-Mega','mega-meowstic-female':'Meowstic-F-Mega','morpeko-hangry-mode':'Morpeko-Hangry','palafin-hero-form':'Palafin-Hero' };
export function damageSpecies(p: Pokemon) {
  const id = specialSpecies[p.id] ?? (p.isMega ? p.name.replace(/^Mega (.+?)( [XYZ])?$/, (_, name, branch) => name + '-Mega' + (branch ?? '')) : p.battleDataKey ?? p.name);
  return gen.species.get(key(id));
}
function buildPokemon(member: DamageBuild, condition: DamageCondition) {
  const valid = previewTeamTransfer({schemaVersion:1,name:'Calculation',format:'singles',ruleset:getPublishedData().publishedRulesetCode,dataVersion:getPublishedData().publishedDataVersion,members:[member]});
  if (!valid.legal) throw new Error(valid.issues.map(i=>i.message).join(' '));
  const p = getCatalog().pokemonById.get(member.pokemonId)!;
  const species = damageSpecies(p);
  if (!species) throw new Error(`Unsupported Pokémon form: ${p.name}`);
  if (!member.abilityId) throw new Error('Choose an ability for both Pokémon.');
  if(!isCurrentChampionsAbility(member.abilityId))throw new Error('Ability is not included in this demo catalog.');
  const effectiveId=condition.abilityEnabled?effectiveDamageAbility(member.abilityId,condition.copiedAbilityId):member.abilityId;
  const ability = getCatalog().abilityById.get(effectiveId!)!;
  if(condition.abilityEnabled && abilityCoverage(effectiveId!).category==='pending-engine-review')throw new Error('New Champions ability needs engine review; disable it only for an explicit comparison.');
  const item = member.itemId ? getCatalog().itemById.get(member.itemId)! : null;
  if (!gen.abilities.get(key(ability.name)) || (item && !gen.items.get(key(item.name)))) throw new Error('Unsupported ability or item in the pinned Champions engine.');
  // These transitions require copied stats or a new form, not only an ability override.
  if (condition.abilityEnabled && effectiveId==='ice-face') throw new Error('ICE_FACE_UNSUPPORTED: Ice Face form/stat transitions between hits are not supported.');
  if (member.itemId === 'focus-band') throw new Error('Focus Band survival randomness is not supported.');
  if (condition.abilityEnabled && effectiveId==='imposter') throw new Error('TRANSFORM_UNSUPPORTED: Transformed stats, original HP and copied moves are not yet supported.');
  if (condition.abilityEnabled && effectiveId==='unburden' && condition.abilityOn && member.itemId) throw new Error('Unburden activation requires no held item.');
  const stats = calculateFinalStats(p.baseStats,member.ap,NATURES.find(n=>n.name===member.nature)!);
  const calc = new CalcPokemon(gen, species.name, {name:species.name as SpeciesName,level:50,
    ability:(condition.abilityEnabled?ability.name:'No Ability') as AbilityName, gender:condition.gender??undefined, item:item?.name as ItemName|undefined, nature:member.nature as NatureName,
    evs:engineStats(member.ap), boosts:engineStats({hp:0,...condition.boosts}),
    curHP:Math.max(1,Math.floor(stats.hp*condition.hpPercent/100)), status:condition.status==='none'?'':condition.status,
    abilityOn:condition.abilityOn, alliesFainted:condition.alliesFainted,
    overrides:{baseStats:engineStats(p.baseStats),types:(condition.currentTypes??p.types) as [TypeName,TypeName]},
  });
  for (const [name,id] of Object.entries(statKeys)) if(calc.rawStats[id as StatID]!==stats[name as keyof Stats]) throw new Error('Champions AP/stat adapter mismatch.');
  return {calc,stats,p,effectiveId};
}
export const moveExecutionNotes: Record<string,{zh:string;en:string}> = {
 'future-sight':{zh:'預知未來：計算招式落下時的傷害，請填該時刻的有效能力與場地；不模擬等待回合或施放者換人。',en:'Future Sight calculates the eventual hit using the supplied effective state, not the delay or switching history.'},
 'belch':{zh:'打嗝：使用者在本場對戰已吃過樹果。',en:'Belch assumes the user has eaten a Berry in this battle.'},
 'last-resort':{zh:'珍藏：使用者已用過其他所有已學會的招式，且至少有另一招。',en:'Last Resort assumes every other known move has been used and at least one other move is known.'},
 'gigaton-hammer':{zh:'巨力錘：假設上一回合沒有使出巨力錘。',en:'Gigaton Hammer assumes it was not used on the previous turn.'},
 'counter':{zh:'雙倍奉還：請填入本回合最後承受的合格物理招式傷害；非總受傷量。',en:'Counter uses the last qualifying physical hit taken this turn, not total damage.'},
 'mirror-coat':{zh:'鏡面反射：請填入本回合最後承受的合格特殊招式傷害。',en:'Mirror Coat uses the last qualifying special hit taken this turn.'},
 'metal-burst':{zh:'金屬爆炸：假設目標先行造成傷害；填入本回合最後一次合格受擊傷害。',en:'Metal Burst assumes the target has already damaged the user this turn; enter the last qualifying hit.'},
 'comeuppance':{zh:'報仇：假設目標先行造成傷害；填入本回合最後一次合格受擊傷害。',en:'Comeuppance assumes the target has already damaged the user this turn; enter the last qualifying hit.'},
 'focus-punch':{zh:'真氣拳：假設出招前沒有因受到攻擊而失去集中力。',en:'Focus Punch assumes the user has not lost focus from an earlier hit.'},
 'sucker-punch':{zh:'突襲：假設目標選了攻擊招式，而且尚未行動。',en:'Sucker Punch assumes the target selected a damaging move and has not acted.'},
 'upper-hand':{zh:'快手還擊：假設目標正準備使出先制攻擊招式，而且尚未行動。',en:'Upper Hand assumes the target is about to use a positive-priority damaging move.'},
 'fake-out':{zh:'擊掌奇襲：假設這是使用者上場後的第一回合。',en:'Fake Out assumes this is the user’s first active turn.'},
 'first-impression':{zh:'迎頭一擊：假設這是使用者上場後的第一回合。',en:'First Impression assumes this is the user’s first active turn.'},
};
function one(query: DamageQuery) {
  const allies=[query.field.attackerAllyAbility,query.field.defenderAllyAbility];
  if(allies.some(a=>a!=='none'&&!isCurrentChampionsAbility(a)))throw new Error('Ally ability is not included in this demo catalog.');
  if(query.format==='singles' && allies.some(a=>a!=='none')) throw new Error('Ally abilities require doubles.');
  if ([query.attackerCondition,query.defenderCondition].some(c=>c.alliesFainted>(query.format==='singles'?2:3))) throw new Error('Fainted allies exceed the selected ranked battle size.');
  const attacker = buildPokemon(query.attacker,query.attackerCondition);
  const defender = buildPokemon(query.defender,query.defenderCondition);
  if(query.format==='singles'&&[query.attacker,query.defender].some((m,i)=>['receiver','power-of-alchemy'].includes(m.abilityId??'')&&[query.attackerCondition,query.defenderCondition][i].abilityEnabled&&[query.attackerCondition,query.defenderCondition][i].copiedAbilityId!=='unchanged'))throw new Error('RECEIVER_SINGLES: In singles choose not activated; there is no active ally to inherit from.');
  if ((attacker.calc.hasAbility('Rivalry')||defender.calc.hasAbility('Rivalry')) && (!query.attackerCondition.gender||!query.defenderCondition.gender)) throw new Error('Rivalry requires explicit genders for both Pokémon.');
  for (const [side,actor] of [['attacker',attacker],['defender',defender]] as const) {
    const c=query[`${side}Condition`];
    const ally=query.field[`${side}AllyAbility`];
    if(actor.calc.hasAbility('Plus','Minus')) actor.calc.abilityOn=query.format==='doubles' && ['plus','minus'].includes(ally);
    if(actor.calc.hasAbility('Analytic') && side==='attacker') {
      if(c.movesLast===null) throw new Error('Analytic requires movesLast: whether all other active Pokémon have acted.');
      actor.calc.abilityOn=c.movesLast;
    }
    if(actor.calc.hasAbility('Protean','Libero') && !c.currentTypes && !(side==='attacker'&&c.abilityOn)) throw new Error('Protean/Libero requires currentTypes, or a new attacker abilityOn trigger.');
    if(actor.calc.hasAbility('Protean','Libero') && side==='defender') actor.calc.abilityOn=false;
    const terrainTypes={Electric:'Electric',Grassy:'Grass',Psychic:'Psychic',Misty:'Fairy'} as const;
    if(actor.calc.hasAbility('Mimicry') && query.field.terrain!=='none') {
      actor.calc.types=[terrainTypes[query.field.terrain]];
      actor.calc.species={...actor.calc.species,types:[terrainTypes[query.field.terrain]]};
    }
    if(actor.calc.hasAbility('Stance Change') && side==='attacker' && actor.p.id==='aegislash-shield-forme') throw new Error('Stance Change: select the Blade battle form before attacking.');
    const invalidStatus=(c.status==='brn'&&actor.calc.hasAbility('Water Bubble','Water Veil','Thermal Exchange')) || (c.status==='par'&&actor.calc.hasAbility('Limber')) || (['psn','tox'].includes(c.status)&&actor.calc.hasAbility('Immunity','Purifying Salt')) || (c.status==='slp'&&actor.calc.hasAbility('Insomnia','Vital Spirit')) || (c.status==='frz'&&actor.calc.hasAbility('Magma Armor')) || (c.status!=='none'&&actor.calc.hasAbility('Comatose','Purifying Salt'));
    if(invalidStatus) throw new Error('Status conflicts with the effective ability.');
  }
  // Forecast changes type with weather. Require the selected form to describe
  // that effective state, rather than silently changing its identity.
  for (const [member,actor] of [[query.attacker,attacker],[query.defender,defender]] as const) if(member.pokemonId.startsWith('castform') && actor.calc.hasAbility('Forecast')) {
    const suppressed=[attacker.calc,defender.calc].some(p=>p.hasAbility('Cloud Nine','Air Lock'))||allies.includes('cloud-nine');
    const expected = suppressed?'castform':query.field.weather==='Sun'?'castform-sunny-form':query.field.weather==='Rain'?'castform-rainy-form':query.field.weather==='Snow'?'castform-snowy-form':'castform';
    if(member.pokemonId!==expected) throw new Error('Castform form must match effective weather; when weather is suppressed select the normal Castform form.');
  }
  const move = getCatalog().moveById.get(query.moveId);
  if (!move || !attacker.p.moveIds.includes(query.moveId) || !query.attacker.moveSlots.includes(query.moveId)) throw new Error('Choose a learned move in the attacker’s selected move slots.');
  const engineMove = engineMoveFor(move.id);
  if (!engineMove || move.category==='Status' || unsupportedMoveReasons[move.id]) throw new Error(`MOVE_UNSUPPORTED:${move.id}:${unsupportedMoveReasons[move.id]?.en??'No direct damage or engine support.'}`);
  const hitRange=moveHitRange(move.id);
  const hits=query.moveOptions.hits??(Array.isArray(engineMove.multihit)?(attacker.calc.hasAbility('Skill Link')?hitRange[1]:3):hitRange[1]);
  if(hits<hitRange[0]||hits>hitRange[1])throw new Error(`HIT_COUNT:Choose ${hitRange[0]}–${hitRange[1]} hits for this move.`);
  const priority = attacker.calc.hasAbility('Gale Wings') && attacker.calc.curHP()===attacker.calc.maxHP() && move.type==='Flying' ? 1 : engineMove.priority;
  let configuredPower:number|undefined;
  if(powerConditions[move.id]) configuredPower=(move.power??0)*(query.moveOptions.powerBoost?2:1);
  if(move.id==='rage-fist')configuredPower=Math.min(350,50+50*query.moveOptions.timesHit);
  if(move.id==='last-respects')configuredPower=50+50*query.moveOptions.faintEvents;
  if(move.id==='spit-up')configuredPower=100*query.moveOptions.stockpiles;
  if(['stored-power','power-trip'].includes(move.id))configuredPower=20; // resolved after effective field construction
  const fixedMove=['super-fang','endeavor','counter','mirror-coat','metal-burst','comeuppance','fissure','guillotine','horn-drill','sheer-cold'].includes(move.id);
  const calcMove = new CalcMove(gen,move.name,{isCrit:query.critical,hits,ability:attacker.calc.ability,overrides:{basePower:fixedMove?1:configuredPower??move.power??engineMove.basePower,type:move.type,category:move.category,priority,...(move.id==='future-sight'?{breaksProtect:true}:{}),...(move.id==='dragon-darts'?{multihit:[1,2]}:{}),...(configuredPower!==undefined||fixedMove?{name:`Configured ${move.name}` as typeof engineMove.name}:{})}});
  // The native Champions engine models the child hit. Charge/delayed moves do
  // not trigger it; the adapter's HP-dependent fixed moves need separate work.
  const noParent=['fly','dig','dive','bounce','solar-beam','solar-blade','sky-attack','skull-bash','meteor-beam','electro-shot','razor-wind','phantom-force','shadow-force','future-sight','doom-desire','explosion','self-destruct','misty-explosion','final-gambit'];
  if(attacker.calc.hasAbility('Parental Bond')&&noParent.includes(move.id))attacker.calc.ability='No Ability' as AbilityName;
  const parentHits=attacker.calc.hasAbility('Parental Bond')&&hits===1&&!(query.format==='doubles'&&['allAdjacent','allAdjacentFoes'].includes(calcMove.target));
  if(parentHits&&fixedMove)throw new Error('PARENTAL_FIXED_UNSUPPORTED: Parental Bond with this HP-dependent fixed-damage move is not supported; choose another attack.');
  if(parentHits&&['knock-off','hard-press'].includes(move.id))throw new Error('PARENTAL_STATE_UNSUPPORTED: This Parental Bond move needs item removal or HP-dependent power recalculated between hits; this combination is not yet supported.');
  // Multi-hit damage matrices advance deterministic defensive stages between strikes.
  // Party-copy abilities need actual post-contact type/ability state, not a cached STAB modifier.
  if((hits>1||parentHits) && defender.calc.hasAbility('Mummy','Wandering Spirit','Lingering Aroma') && calcMove.flags.contact && !attacker.calc.hasAbility('Long Reach'))throw new Error('MULTIHIT_STATE:Contact ability replacement between hits needs explicit battle state.');
  if((hits>1||parentHits)&&calcMove.category==='Special'&&defender.calc.hasAbility('Weak Armor'))defender.calc.ability='No Ability' as AbilityName;
  const ignores=attacker.calc.hasAbility('Mold Breaker');
  const weatherSuppressed=allies.includes('cloud-nine');
  const field = new Field({gameType:query.format==='singles'?'Singles':'Doubles',weather:weatherSuppressed||query.field.weather==='none'?undefined:query.field.weather,terrain:query.field.terrain==='none'?undefined:query.field.terrain,
    isGravity:query.field.gravity,isFairyAura:allies.includes('fairy-aura'),
    attackerSide:{isSteelySpirit:query.field.attackerAllyAbility==='steely-spirit',isHelpingHand:query.field.helpingHand,isTailwind:query.field.attackerTailwind},
    defenderSide:{isFriendGuard:query.field.defenderAllyAbility==='friend-guard',isReflect:query.field.reflect,isLightScreen:query.field.lightScreen,isAuroraVeil:query.field.auroraVeil,isProtected:query.field.protected,isTailwind:query.field.defenderTailwind}});
  if((allies.includes('flower-veil') || [attacker.calc,defender.calc].some(p=>p.hasAbility('Flower Veil')&&p.hasType('Grass'))) && [attacker.calc,defender.calc].some(p=>p.hasAbility('Intimidate')&&p.abilityOn)) throw new Error('Flower Veil with entry Intimidate is not supported; enter resulting current stages without entry activation.');
  if(['stored-power','power-trip'].includes(move.id)){
    const state=calculate(gen,attacker.calc,defender.calc,new CalcMove(gen,move.name),field).attacker;
    const power=20+20*(Object.values(state.boosts).reduce((n,b)=>n+Math.max(0,b??0),0)+Math.max(0,query.moveOptions.accuracyStage)+Math.max(0,query.moveOptions.evasionStage));
    calcMove.overrides={...calcMove.overrides,basePower:power};calcMove.bp=power;
  }
  // Resolve entry events exactly once. Native Parental Bond recursively calls
  // the engine for the child and would otherwise apply entry Intimidate twice.
  if(parentHits){
    checkIntimidate(gen,attacker.calc,defender.calc);
    checkIntimidate(gen,defender.calc,attacker.calc);
    if(attacker.calc.hasAbility('Intimidate'))attacker.calc.abilityOn=false;
    if(defender.calc.hasAbility('Intimidate'))defender.calc.abilityOn=false;
  }
  const result=calculate(gen,attacker.calc,defender.calc,calcMove,field);
  const blockedBy: string[]=[];
  if(query.moveExecution==='failure') blockedBy.push('Move execution condition not met');
  if(['explosion','self-destruct','misty-explosion'].includes(move.id) && (attacker.calc.hasAbility('Damp') || (!ignores&&(defender.calc.hasAbility('Damp')||allies.includes('damp'))))) blockedBy.push('Damp');
  if(!ignores && result.move.priority>0 && ['queenly-majesty','armor-tail'].includes(query.field.defenderAllyAbility)) blockedBy.push('Ally priority protection');
  if(!ignores && !attacker.calc.hasAbility('Stalwart') && ['any','normal','adjacentFoe'].includes(result.move.target) && ((result.move.type==='Electric'&&allies.includes('lightning-rod')))) throw new Error('An ally redirects this move; select the actual receiving Pokémon.');
  if(query.field.gravity&&move.flags.includes('Gravity'))blockedBy.push('Move cannot execute under Gravity');
  if(move.id==='snore' && !attacker.calc.hasStatus('slp') && !attacker.calc.hasAbility('Comatose'))blockedBy.push('Snore requires sleep');
  if(move.id==='burn-up'&&!result.attacker.hasType('Fire'))blockedBy.push('Burn Up requires Fire type');
  if(move.id==='double-shock'&&!result.attacker.hasType('Electric'))blockedBy.push('Double Shock requires Electric type');
  if(move.id==='spit-up'&&query.moveOptions.stockpiles===0)blockedBy.push('No Stockpile');
  const canHit=typeof result.damage==='number'?result.damage>0:result.damage.flat().some(d=>d>0);
  if(fixedMove && canHit){
    const hp=defender.calc.curHP();
    if(move.id==='super-fang')result.damage=Math.max(1,Math.floor(hp/2));
    else if(move.id==='endeavor')result.damage=Math.max(0,hp-attacker.calc.curHP());
    else if(['counter','mirror-coat','metal-burst','comeuppance'].includes(move.id))result.damage=Math.floor(query.moveOptions.receivedDamage*(['counter','mirror-coat'].includes(move.id)?2:1.5));
    else {result.damage=hp;if(result.defender.hasAbility('Sturdy')||(move.id==='sheer-cold'&&result.defender.hasType('Ice')))blockedBy.push('OHKO immunity');}
  }
  if(blockedBy.length) result.damage=0;
  if ([result.attacker.stats.spe,result.defender.stats.spe].some(s=>s>=999)) throw new Error('Effective speed reaches an unverified Champions engine boundary (999); lower the modifiers or use the dedicated speed comparison.');
  const damage=result.damage;
  const hitRolls:number[][]=typeof damage==='number'?[[damage]]:Array.isArray(damage[0])?damage as number[][]:parentHits&&damage.length===2?(damage as number[]).map(n=>[n]):[damage as number[]];
  const hp=defender.calc.curHP(),maxHp=defender.calc.maxHP();
  const disguiseApplied=result.defender.hasAbility('Disguise')&&!query.defenderCondition.disguiseBusted&&hitRolls[0].some(n=>n>0);
  const resistBerryUsed=!!getBerryResistType(result.defender.item)&&result.rawDesc.defenderItem===result.defender.item&&canHit;
  if(disguiseApplied&&hits>1&&resistBerryUsed)throw new Error('DISGUISE_BERRY_MULTIHIT_UNSUPPORTED: Intact Disguise with a triggering resist Berry and a native multi-hit move needs Berry consumption delayed until the first damaging hit; this combination is not yet supported.');
  // The native child call starts with the original item and configured power.
  // Resolve deterministic changes before extracting its rolls; keep the original
  // first-hit rolls and all native between-hit defensive stage adjustments.
  if(parentHits&&hitRolls.length===2&&((resistBerryUsed&&!disguiseApplied)||(move.id==='assurance'&&!query.moveOptions.powerBoost))){
    const childDefender=defender.calc.clone(),childMove=calcMove.clone();
    if(resistBerryUsed&&!disguiseApplied)childDefender.item='' as ItemName;
    if(move.id==='assurance'&&!query.moveOptions.powerBoost){childMove.bp=(move.power??60)*2;childMove.overrides={...childMove.overrides,basePower:childMove.bp};}
    const recalculated=calculate(gen,attacker.calc,childDefender,childMove,field).damage;
    if(Array.isArray(recalculated)&&Array.isArray(recalculated[1]))hitRolls[1]=recalculated[1];
  }
  // Disguise consumes the first successful hit and loses floor(maxHP/8).
  // Report this HP loss explicitly; immunity/Protect/failure never breaks it.
  const disguiseHpLoss=disguiseApplied?Math.floor(maxHp/8):0;
  if(disguiseApplied)hitRolls[0]=[disguiseHpLoss];
  const survival = !disguiseApplied && hp===maxHp && (result.defender.hasItem('Focus Sash')||result.defender.hasAbility('Sturdy'));
  const berry=hitRolls.length>1&&!result.attacker.hasAbility('Unnerve')?result.defender.item:undefined;
  const healing=berry==='Sitrus Berry'?{threshold:0.5,amount:Math.floor(maxHp/4)}:berry==='Oran Berry'?{threshold:0.5,amount:10}:berry&&['Figy Berry','Wiki Berry','Mago Berry','Aguav Berry','Iapapa Berry'].includes(berry)?{threshold:result.defender.hasAbility('Gluttony')?0.5:0.25,amount:Math.floor(maxHp/3)}:undefined;
  if(healing&&result.defender.hasAbility('Ripen'))healing.amount*=2;
  const combined=combineDamageHits(hitRolls,hp,survival,healing?{...healing,maxHp}:undefined);
  // For one hit retain the familiar 16 rolls. Multi-hit totals use weighted distribution,
  // never treat the 16 same-roll sums as an exact KO probability.
  const rolls=hitRolls.length===1?hitRolls[0].map(n=>survival?Math.min(n,Math.max(0,hp-1)):n):combined.distribution.map(r=>r.damage);
  const min=Math.min(...rolls),max=Math.max(...rolls);
  return {range:[min,max],rawRange:combined.rawRange,percentRange:[min/maxHp*100,max/maxHp*100],
    rolls,distribution:combined.distribution,rollCombinations:combined.combinations,hits:hitRolls.length,
    hitDetails:hitRolls.map((r,i)=>({hit:i+1,range:[Math.min(...r),Math.max(...r)],cumulativeRange:combined.cumulative[i].range,conditionalKoChance:combined.cumulative[i].conditionalKoChance})),
    defenderHp:hp,defenderMaxHp:maxHp,remainingHpRange:combined.remainingHpRange,healingBetweenHits:combined.healingApplied,
    disguise:{applied:disguiseApplied,hpLoss:disguiseHpLoss,state:query.defenderCondition.disguiseBusted?'busted':'intact'},
    conditionalOhkoChance:combined.conditionalKoChance,
    guaranteedSurvival:combined.remainingHpRange[0]>0,survivalMechanicApplied:combined.survivalApplied,
    attackerStats:attacker.stats,defenderStats:defender.stats,
    effectiveSpeed:{attacker:result.attacker.stats.spe,defender:result.defender.stats.spe},
    move:{id:move.id,name:move.name,nameZh:move.nameZh,catalogPower:move.power,catalogType:move.type,effectivePower:result.rawDesc.moveBP??result.move.bp,type:result.move.type,category:result.move.category,priority:result.move.priority},
    effectiveTypes:{attacker:result.attacker.types,defender:result.defender.types},
    effectiveBoosts:{attacker:result.attacker.boosts,defender:result.defender.boosts},blockedBy,
    afterHit: result.defender.hasAbility('Stamina') && max>0 ? {ability:'stamina',ifSurvives:true,defenseStage:Math.min(6,result.defender.boosts.def+1),note:'Apply only after this hit if the defender survives; current damage uses the entered pre-hit stage.'}:null,
    moveCoverage:moveDamageCoverage(move.id),
    execution:moveExecutionNotes[move.id]?{condition:moveExecutionNotes[move.id],outcome:query.moveExecution}:null,
    effectiveAbilities:{attacker:attacker.effectiveId,defender:defender.effectiveId},
    abilityEffects:{attacker:abilityCoverage(attacker.effectiveId!),defender:abilityCoverage(defender.effectiveId!),allies:allies.filter(a=>a!=='none').map(abilityCoverage)},
    appliedMechanics:result.rawDesc};
}
export function calculateDamage(input: unknown) {
  const query=damageSchema.parse(input);
  if(query.dataVersion&&query.dataVersion!==getPublishedData().publishedDataVersion)throw new Error('DATA_VERSION_CHANGED: read current rules and repeat.');
  const baseline=one(query);
  const alternatives=query.alternatives.map(a=>({label:a.label,side:a.side,ap:a.ap,result:one({...query,[a.side]:{...query[a.side],ap:a.ap}})}));
  return {engine:'@smogon/calc@0.12.0',enginePatch:'champions-lab-abilities-v1',mechanics:'champions',calculationVersion:'champions-damage-v3',dataVersion:getPublishedData().publishedDataVersion,
    inputs:query,baseline,alternatives,
    assumptions:['Selected current forms and abilities; set effective weather/terrain explicitly. Entry Intimidate only when abilityOn=true; otherwise boosts are current stages.',
      'Attacker targets an opposing defender; ally-damage/Telepathy and other combatants acting are not simulated. Ally abilities are explicit current field state.',
      'One move with the specified number of landed hits. Independent per-hit damage rolls; all hits share the specified critical setting. KO probability excludes accuracy, hit-count randomness and win probability.',
      'For multi-hit moves, Sitrus/Oran/pinch-berry healing between hits is included; single-hit HP is before healing. Recoil and drain are excluded. No residual damage, switching or move-selection simulation. Doubles spread moves assume multiple targets.',
      'Community Champions engine; not verified against the proprietary game engine. Unsupported party or post-contact replacement states are rejected. Between-hit random secondary/status/contact effects are conditioned not to activate; healing from modeled berries is included. Per-hit ranges are potential damage if all selected hits land; not a full battle simulation.'],
    source:'https://github.com/smogon/damage-calc',};
}
export type DamageResult=ReturnType<typeof calculateDamage>;
