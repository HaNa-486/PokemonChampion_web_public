import { z } from "zod";
import { getCatalog } from "./catalog";
import { NATURES, NEUTRAL_NATURE, ZERO_STATS } from "./domain";
import { compareSpeed, DEFAULT_SCENARIO, effectiveSpeed, type SpeedResult } from "./speed-matrix";
import { speedVariants, type SpeedVariant } from "./speed-scenarios";
import { ResearchInputError } from "./research-error";
import type { Pokemon, TeamMember } from "./types";

const id = z.string().min(1).max(100).regex(/^[a-z0-9-]+$/);
export const speedConditionSchema = z.object({stage:z.number().int().min(-6).max(6).default(0),status:z.enum(["none","paralysis","other"]).default("none"),abilityEnabled:z.boolean().default(true),itemEnabled:z.boolean().default(true),unburden:z.boolean().default(false)}).strict();
export const speedFieldSchema = z.object({trickRoom:z.boolean().default(false),weather:z.enum(["none","sun","rain","sand","snow"]).default("none"),electricTerrain:z.boolean().default(false),attackingMoves:z.boolean().default(true)}).strict();
export const speedSubjectSchema = z.object({pokemonId:id,mode:z.enum(["range","fixed"]).default("range"),nature:z.enum(["negative","neutral","positive"]).default("neutral"),speedAp:z.number().int().min(0).max(32).default(0),abilityId:id.nullable().default(null),itemId:id.nullable().default(null),tailwind:z.boolean().default(false),condition:speedConditionSchema.prefault({})}).strict();
export const speedCandidateSchema = speedSubjectSchema.extend({variantIds:z.array(z.string().min(1).max(100)).min(1).max(32).default(["normal"])}).strict();
export const speedStudySchema = z.object({action:z.literal("speedStudy"),candidates:z.array(speedCandidateSchema).min(1).max(12),target:z.union([z.object({speed:z.number().int().min(1).max(10000)}).strict(),speedSubjectSchema]),field:speedFieldSchema.prefault({}),detail:z.enum(["compact","full"]).default("compact"),dataVersion:z.string().max(100).optional()}).strict();
export type SpeedSubject = z.infer<typeof speedSubjectSchema>;
export type SpeedCandidate = z.infer<typeof speedCandidateSchema>;
export type SpeedStudy = z.infer<typeof speedStudySchema>;
const natureKinds = ["negative","neutral","positive"] as const;
const natureFor = (kind:typeof natureKinds[number]) => kind === "neutral" ? NEUTRAL_NATURE : NATURES.find(n=>kind === "positive" ? n.up === "speed" : n.down === "speed")!;
export const SPEED_LIMITATION = "Same move priority only; hypothetical conditions are not observations or probabilities. Does not model priority blocking, damage or a full battle turn.";

function fail(path:(string|number)[],code:string,message:string):never { throw new ResearchInputError("INVALID_SPEED_INPUT",message,[{path,code,message}]); }
function subjectPokemon(subject:SpeedSubject,path:(string|number)[]) {
  const catalog=getCatalog(), p=catalog.pokemonById.get(subject.pokemonId);
  if(!p) return fail([...path,"pokemonId"],"NOT_FOUND","Unknown Pokémon in this snapshot.");
  if(subject.abilityId&&!p.abilityIds.includes(subject.abilityId)) fail([...path,"abilityId"],"ABILITY_UNAVAILABLE","Selected ability does not belong to this form.");
  if(subject.itemId&&!catalog.itemById.has(subject.itemId)) fail([...path,"itemId"],"ITEM_UNAVAILABLE","Unknown held item.");
  const stone=catalog.megaStoneIdByPokemonId.get(p.id);
  const impliedMega=subject.itemId&&!p.isMega?catalog.megaPokemonForStone(subject.itemId,p.id):undefined;
  if(impliedMega)fail([...path,"pokemonId"],"MEGA_FORM_REQUIRED",`This stone requires the current form ${impliedMega.id}; select that form and its legal ability.`);
  if(p.isMega&&subject.itemId&&subject.itemId!==stone) fail([...path,"itemId"],"MEGA_STONE_REQUIRED","Mega forms must retain their dedicated stone.");
  if(subject.condition.unburden&&(subject.abilityId!=="unburden"||subject.itemId||p.isMega)) fail([...path,"condition","unburden"],"INVALID_TRIGGER","Triggered Unburden requires the ability and no held item.");
  return p;
}
function memberFor(p:Pokemon,s:SpeedSubject):TeamMember {return {id:p.id,pokemonId:p.id,moveIds:[],abilityId:s.abilityId,itemId:s.itemId??(p.isMega?getCatalog().megaStoneIdByPokemonId.get(p.id)??null:null),nature:natureFor(s.nature),ap:{...ZERO_STATS,speed:s.speedAp}};}
function configured(p:Pokemon,s:SpeedSubject,field:SpeedStudy["field"]):SpeedVariant {return {id:"configured",label:"Configured",labelZh:"指定配置",member:memberFor(p,s),condition:s.condition,field:{...DEFAULT_SCENARIO,...field,ownTailwind:s.tailwind}};}
function points(p:Pokemon,v:SpeedVariant,mode:"range"|"fixed") {
  const evaluate=(ap:number,nature:TeamMember["nature"])=>({...effectiveSpeed(p,{...v.member,ap:{...ZERO_STATS,speed:ap},nature},v.condition,v.field,"own"),speedAp:ap,nature:nature.name});
  if(mode==="fixed")return [evaluate(v.member.ap.speed,v.member.nature)];
  return natureKinds.flatMap(n=>Array.from({length:33},(_,ap)=>evaluate(ap,natureFor(n))));
}
function bounds(results:SpeedResult[]) {return {min:Math.min(...results.map(r=>r.speed)),max:Math.max(...results.map(r=>r.speed))};}
function endpoints(results:SpeedResult[]) {return [results.reduce((a,b)=>a.speed<b.speed?a:b),results.reduce((a,b)=>a.speed>b.speed?a:b)];}
function ordering(own:SpeedResult[],target:SpeedResult[],trickRoom:boolean) {
  const orders=new Set(endpoints(own).flatMap(a=>endpoints(target).map(b=>compareSpeed(a,b,trickRoom))));
  return orders.size===1?[...orders][0]:"conditional" as const;
}

/** Bounded calculations shared by the UI and tests. No device reads. */
export function studySpeeds(input:unknown) {
  const query=speedStudySchema.parse(input);
  const targetSubject="pokemonId" in query.target?query.target:null;
  const targetPokemon=targetSubject?subjectPokemon(targetSubject,["target"]):null;
  const results=query.candidates.map((subject,index)=>{
    const p=subjectPokemon(subject,["candidates",index]);
    const available=speedVariants(p,getCatalog().itemById.has("choice-scarf"));
    const variants=subject.mode==="fixed"?[configured(p,subject,query.field)]:[...new Set(subject.variantIds)].map(variantId=>{
      const v=available.find(v=>v.id===variantId);
      if(!v)return fail(["candidates",index,"variantIds"],"UNKNOWN_SCENARIO",`Unsupported scenario ${variantId} for ${p.id}.`);
      if(subject.abilityId&&v.member.abilityId&&subject.abilityId!==v.member.abilityId) fail(["candidates",index,"abilityId"],"CONFLICTING_SCENARIO","Ability conflicts with selected scenario.");
      if(subject.itemId&&v.member.itemId&&subject.itemId!==v.member.itemId) fail(["candidates",index,"itemId"],"CONFLICTING_SCENARIO","Held item conflicts with selected scenario.");
      if(v.condition.unburden&&subject.itemId) fail(["candidates",index,"itemId"],"CONFLICTING_SCENARIO","Unburden scenario requires no held item.");
      if(subject.condition.unburden&&v.member.itemId) fail(["candidates",index,"variantIds"],"CONFLICTING_SCENARIO","Triggered Unburden cannot be combined with a held-item scenario.");
      if(query.field.weather!=="none"&&v.field.weather!=="none"&&query.field.weather!==v.field.weather) fail(["field","weather"],"CONFLICTING_WEATHER","Selected weather conflicts with scenario.");
      return {...v,member:{...memberFor(p,subject),abilityId:v.member.abilityId??subject.abilityId,itemId:v.member.itemId??memberFor(p,subject).itemId},condition:{...subject.condition,stage:Math.max(-6,Math.min(6,subject.condition.stage+v.condition.stage)),status:subject.condition.status!=="none"?subject.condition.status:v.condition.status,unburden:subject.condition.unburden||v.condition.unburden},field:{...DEFAULT_SCENARIO,...query.field,weather:v.field.weather!=="none"?v.field.weather:query.field.weather,electricTerrain:query.field.electricTerrain||v.field.electricTerrain,ownTailwind:subject.tailwind||v.field.ownTailwind}};
    });
    return {pokemonId:p.id,name:p.name,nameZh:p.nameZh,mode:subject.mode,...(query.detail==="full"?{availableScenarios:available.map(v=>({id:v.id,label:v.label,labelZh:v.labelZh}))}:{}),variants:variants.map(v=>{
      const own=points(p,v,subject.mode);
      // Weather/terrain are shared by both combatants in every hypothetical scenario.
      const target=targetSubject&&targetPokemon?points(targetPokemon,configured(targetPokemon,targetSubject,v.field),targetSubject.mode):[{base:0,staged:0,speed:(query.target as {speed:number}).speed,factors:[],randomOrder:false,stall:false}];
      const ownBounds=bounds(own), targetBounds=bounds(target),trickRoom=query.field.trickRoom;
      const thresholdTarget=trickRoom?targetBounds.min:targetBounds.max;
      const thresholds=natureKinds.map(nature=>{
        const evaluated=Array.from({length:33},(_,ap)=>({ap,result:effectiveSpeed(p,{...v.member,ap:{...ZERO_STATS,speed:ap},nature:natureFor(nature)},v.condition,v.field,"own")}));
        const passes=evaluated.filter(e=>ordering([e.result],target,trickRoom)==="first");
        const tieAps=evaluated.filter(e=>e.result.speed>=targetBounds.min&&e.result.speed<=targetBounds.max&&target.some(t=>t.speed===e.result.speed)).map(e=>e.ap);
        const boundary=passes.length?(trickRoom?passes[passes.length-1]:passes[0]):null;
        const adjacent=boundary?evaluated.find(e=>e.ap===boundary.ap+(trickRoom?1:-1)):null;
        return {nature,passingAp:passes.length?{min:passes[0].ap,max:passes[passes.length-1].ap}:null,tieAps,boundary:boundary?{ap:boundary.ap,speed:boundary.result.speed,speedDelta:boundary.result.speed-thresholdTarget,adjacent:adjacent?{ap:adjacent.ap,speed:adjacent.result.speed,order:ordering([adjacent.result],target,trickRoom)}:null}:null};
      });
      const warnings=[...(own.some(r=>r.randomOrder)||target.some(r=>r.randomOrder)?["RANDOM_ACTION_ORDER"]:[]),...(own.some(r=>r.stall)||target.some(r=>r.stall)?["STALL_ORDER"]:[]),...(v.condition.abilityEnabled&&!subject.abilityId&&v.member.abilityId===null&&p.abilityIds.some(a=>a==="stall"||(a==="quick-draw"&&v.field.attackingMoves))?["UNSPECIFIED_ORDER_ABILITY"]:[]),...(targetSubject&&targetSubject.condition.abilityEnabled&&!targetSubject.abilityId&&targetPokemon?.abilityIds.some(a=>a==="stall"||(a==="quick-draw"&&v.field.attackingMoves))?["UNSPECIFIED_TARGET_ORDER_ABILITY"]:[])];
      const order=warnings.some(w=>w.startsWith("UNSPECIFIED"))?"conditional":ordering(own,target,trickRoom);
      return {id:v.id,label:v.label,labelZh:v.labelZh,range:ownBounds,targetRange:targetBounds,order,speedDelta:{min:ownBounds.min-targetBounds.max,max:ownBounds.max-targetBounds.min},thresholds:warnings.some(w=>w.startsWith("UNSPECIFIED"))?thresholds.map(t=>({...t,passingAp:null,boundary:null})):thresholds,warnings,assumptions:{mode:subject.mode,nature:subject.mode==="fixed"?subject.nature:"all",speedAp:subject.mode==="fixed"?subject.speedAp:null,apRange:{min:subject.mode==="fixed"?subject.speedAp:0,max:subject.mode==="fixed"?subject.speedAp:32},abilityId:v.member.abilityId,itemId:v.member.itemId,condition:v.condition,field:v.field,target:query.target},...(query.detail==="full"?{samples:own,factors:[...new Set(own.flatMap(r=>r.factors))]}:{factors:[...new Set(own.flatMap(r=>r.factors))]})};
    })};
  });
  return {results,limitation:SPEED_LIMITATION};
}
