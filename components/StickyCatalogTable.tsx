"use client";
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Position = {top: number; left: number; width: number; tableWidth: number; scroll: number; columns: number[]};
/** Mirrors the real header only while it leaves the viewport; preserves horizontal alignment and sorting. */
export function StickyCatalogTable({header, children}: {header: ReactNode; children: ReactNode}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const [position,setPosition] = useState<Position | null>(null);
  useEffect(() => {
    const element = wrapper.current;
    if (!element) return;
    let frame = 0;
    const measure = () => {
      const table = element.querySelector('table'), head = table?.querySelector('thead');
      if (!table || !head) return;
      const top = Math.max(0,document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0);
      const heading = head.getBoundingClientRect(), bounds = table.getBoundingClientRect(), clip = element.getBoundingClientRect();
      const next = heading.height > 0 && heading.top < top && bounds.bottom > top + heading.height
        ? {top, left:clip.left, width:clip.width, tableWidth:bounds.width, scroll:element.scrollLeft, columns:Array.from(head.querySelectorAll('th'),cell => cell.getBoundingClientRect().width)} : null;
      setPosition(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    };
    const update = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(element);
    const topbar = document.querySelector('.topbar'); if (topbar) observer?.observe(topbar);
    window.addEventListener('scroll',update,{passive:true}); window.addEventListener('resize',update);
    element.addEventListener('scroll',update,{passive:true}); update();
    return () => {cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('scroll',update);window.removeEventListener('resize',update);element.removeEventListener('scroll',update);};
  },[header,children]);
  return <><div className="table-scroll pokemon-table-scroll" ref={wrapper}><table><thead>{header}</thead>{children}</table></div>{position && createPortal(<div className="catalog-sticky-heading" style={{top:position.top,left:position.left,width:position.width}}><table aria-label="Pokémon column headings" style={{width:position.tableWidth,transform:`translateX(${-position.scroll}px)`}}><colgroup>{position.columns.map((width,index) => <col key={index} style={{width}} />)}</colgroup><thead>{header}</thead></table></div>,document.body)}</>;
}
