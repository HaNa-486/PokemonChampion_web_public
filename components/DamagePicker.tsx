"use client";
import { useId, useRef, useState, useEffect } from 'react';

type Choice={id:string;label:string;search?:string};
/** Search and select in one control; choosing an option commits immediately. */
export function DamagePicker({label,value,choices,onChange}:{label:string;value:string;choices:Choice[];onChange:(id:string)=>void}) {
 const [open,setOpen]=useState(false),[search,setSearch]=useState('');const id=useId();const trigger=useRef<HTMLButtonElement>(null),input=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(open)input.current?.focus();},[open]);
 const rows=choices.filter(c=>`${c.label} ${c.search??''} ${c.id}`.toLowerCase().includes(search.toLowerCase()));
 return <div className="damage-picker" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}} onKeyDown={e=>{if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();setOpen(false);trigger.current?.focus();}}}>
  <span id={`${id}-label`} className="damage-field-label">{label}</span>
  <button ref={trigger} type="button" aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open} aria-controls={`${id}-options`} onClick={()=>{setOpen(!open);setSearch('');}}><span id={`${id}-value`}>{choices.find(c=>c.id===value)?.label??'—'}</span><span aria-hidden="true">⌄</span></button>
  {open&&<div className="damage-picker-menu" id={`${id}-options`}><input ref={input} aria-label={label} placeholder={label} value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();e.currentTarget.parentElement?.querySelector<HTMLButtonElement>('button')?.focus();}if(e.key==='Enter'&&rows.length===1){e.preventDefault();onChange(rows[0].id);setOpen(false);trigger.current?.focus();}}}/><div className="damage-picker-options">{rows.length?rows.map(c=><button type="button" key={c.id} aria-pressed={c.id===value} onClick={()=>{onChange(c.id);setOpen(false);trigger.current?.focus();}}>{c.label}</button>):<p>0 results</p>}</div></div>}
 </div>;
}
