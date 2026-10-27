"use client";
import { getCatalog } from '../lib/catalog';
import { damageFormChoices, type DamageUsage } from '../lib/damage-build';
import { itemEffectCategories } from '../lib/filtering';
import { localizedTerm } from '../lib/localization';
import type { Pokemon } from '../lib/types';
import { ResourcePicker, type ResourcePickerOption } from './ResourcePicker';
import { ItemIcon } from './ItemDisplay';
import { TypeBadge } from './TypeBadge';

type Kind='move'|'item'|'ability';
const groupOrder=['Common','Mega Stone','HP Recovery','Status Cure','PP Recovery','Damage Halving','Other'];

/** Same usage evidence and searchable picker as the database workbench. */
export function damageResourceOptions(kind:Kind,p:Pokemon,usage:DamageUsage|null,zh:boolean):ResourcePickerOption[] {
  const c=getCatalog(),locale=zh?'zh-Hant':'en';
  const rows=kind==='move'?usage?.alternatives.moves:kind==='item'?usage?.alternatives.items:usage?.alternatives.abilities;
  const ranks=new Map((rows??[]).map(r=>[r.id,r]));
  const name=(e:{name:string;nameZh?:string})=>zh?e.nameZh??e.name:e.name;
  const evidence=(id:string)=>ranks.get(id)?.evidence?.percentage;
  const description=(e:{description:string;descriptionZh:string})=>zh?e.descriptionZh:e.description;
  const searchable=(e:{id:string;name:string;nameZh?:string;description:string;descriptionZh:string})=>`${e.id} ${e.name} ${e.nameZh??''} ${e.description} ${e.descriptionZh}`;
  const options:ResourcePickerOption[]=kind==='move'?p.moveIds.map(id=>c.moveById.get(id)!).filter(m=>m.category!=='Status').map(m=>({
    id:m.id,name:name(m),searchText:searchable(m),description:description(m),icon:<TypeBadge type={m.type} locale={locale}/>,
    meta:[localizedTerm(m.category,locale),`${zh?'威力':'Power'} ${m.power??'—'}`,evidence(m.id)].filter(Boolean).join(' · '),
    rank:ranks.get(m.id)?.rank,group:ranks.has(m.id)?'Common':(zh?'其他攻擊招式':'Other attacks'),
  })):kind==='item'?c.items.map(item=>({
    id:item.id,name:name(item),searchText:searchable(item),description:description(item),icon:<ItemIcon item={item}/>,
    meta:[localizedTerm(item.category,locale),evidence(item.id),c.megaStoneIdByPokemonId.get(p.id)===item.id?(zh?'此型態必需':'Required for this form'):null].filter(Boolean).join(' · '),
    rank:ranks.get(item.id)?.rank,group:ranks.has(item.id)?'Common':item.category==='Mega Stone'?'Mega Stone':itemEffectCategories(item)[0]??'Other',
  })):p.abilityIds.map(id=>c.abilityById.get(id)!).map(a=>({
    id:a.id,name:name(a),searchText:searchable(a),description:description(a),rank:ranks.get(a.id)?.rank,
    meta:[evidence(a.id),p.abilityIds.length===1?(zh?'型態固定特性':'Fixed form ability'):null].filter(Boolean).join(' · '),
  }));
  const familyStones=damageFormChoices(p.id).map(f=>c.megaStoneIdByPokemonId.get(f.id)).filter(Boolean);
  return options.sort((a,b)=>{
    const rank=(a.rank??999)-(b.rank??999);
    if(rank)return rank;
    if(kind==='item'){
      const group=groupOrder.indexOf(a.group!)-groupOrder.indexOf(b.group!);
      if(group)return group;
      if(a.group==='Mega Stone'){
        const dedicated=Number(familyStones.includes(b.id))-Number(familyStones.includes(a.id));
        if(dedicated)return dedicated;
      }
    }
    return a.name.localeCompare(b.name,locale);
  });
}

export function DamageResourcePicker({kind,p,usage,zh,value,onChange}:{kind:Kind;p:Pokemon;usage:DamageUsage|null;zh:boolean;value:string|null;onChange:(id:string|null)=>void}) {
  const label=kind==='move'?(zh?'本次招式':'Move'):kind==='item'?(zh?'持有物':'Held item'):(zh?'特性':'Ability');
  return <ResourcePicker label={label} value={value} options={damageResourceOptions(kind,p,usage,zh)} locale={zh?'zh-Hant':'en'} detailed={false} allowClear={kind!=='move'} startAtFirstOption onChange={onChange}/>;
}
