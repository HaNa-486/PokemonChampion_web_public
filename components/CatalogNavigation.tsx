"use client";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSessionState } from '../lib/use-session-state';
import type { Locale } from '../lib/localization';

export type CatalogPageSize = 50 | 100 | 200 | 'all';
export function useCatalogPageSize(kind: string) {
  const [stored, setStored] = useSessionState(`catalog-page-size-${kind}`, '100', value => ['50','100','200','all'].includes(String(value)));
  const size: CatalogPageSize = stored === 'all' ? 'all' : Number(stored) as 50 | 100 | 200;
  return [size, (value: CatalogPageSize) => setStored(String(value))] as const;
}
export function catalogPage<T>(entries: T[], page: number, pageSize: CatalogPageSize) {
  const size = pageSize === 'all' ? Math.max(1, entries.length) : pageSize;
  const pageCount = Math.max(1, Math.ceil(entries.length / size));
  const safePage = Math.max(1, Math.min(page, pageCount));
  const start = (safePage - 1) * size;
  return {pageCount, safePage, start, rows: entries.slice(start, start + size)};
}

export function CatalogPagination({kind, locale, page, pageCount, pageSize, onPage, onPageSize}: {kind: string; locale: Locale; page: number; pageCount: number; pageSize: CatalogPageSize; onPage: (page: number) => void; onPageSize: (size: CatalogPageSize) => void}) {
  const zh = locale === 'zh-Hant';
  const sizeControl = useRef<HTMLSelectElement>(null);
  const anchorTop = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (anchorTop.current === null || !sizeControl.current) return;
    const delta = sizeControl.current.getBoundingClientRect().top - anchorTop.current;
    anchorTop.current = null;
    // Keep the control under the user's eyes even when rows above it grow/shrink.
    if (delta) window.scrollBy({top:delta, left:0, behavior:'instant'});
  },[pageSize,page]);
  const move = (next: number, element: HTMLElement) => {
    onPage(next);
    element.closest('section')?.querySelector('.table-scroll')?.scrollIntoView?.({block:'start'});
  };
  return <nav className="pagination catalog-pagination" aria-label={`${kind} pages`}>
    <label>{zh ? '每頁顯示' : 'Rows per page'} <select ref={sizeControl} aria-label={zh ? '每頁顯示' : 'Rows per page'} value={pageSize} onChange={event => {anchorTop.current=event.currentTarget.getBoundingClientRect().top; onPageSize(event.target.value === 'all' ? 'all' : Number(event.target.value) as CatalogPageSize); onPage(1);}}>{[50,100,200].map(size => <option key={size} value={size}>{size}</option>)}<option value="all">{zh ? '全部' : 'All'}</option></select></label>
    <div className="catalog-page-buttons">
      <button disabled={page === 1} aria-label={zh ? '第一頁' : 'First page'} onClick={event => move(1,event.currentTarget)}>{zh ? '« 第一頁' : '« First'}</button>
      <button disabled={page === 1} aria-label={kind === 'Move' ? 'Previous move page' : 'Previous page'} onClick={event => move(page-1,event.currentTarget)}>{zh ? '‹ 上一頁' : '‹ Previous'}</button>
      <label>{zh ? '第' : 'Page'} <select aria-label={zh ? '選擇頁碼' : 'Choose page'} value={page} onChange={event => move(Number(event.target.value),event.currentTarget)}>{Array.from({length:pageCount},(_,i) => <option key={i+1} value={i+1}>{i+1}</option>)}</select> / {pageCount}{zh ? ' 頁' : ''}</label>
      <button disabled={page === pageCount} aria-label={kind === 'Move' ? 'Next move page' : 'Next page'} onClick={event => move(page+1,event.currentTarget)}>{zh ? '下一頁 ›' : 'Next ›'}</button>
      <button disabled={page === pageCount} aria-label={zh ? '最後一頁' : 'Last page'} onClick={event => move(pageCount,event.currentTarget)}>{zh ? '最後一頁 »' : 'Last »'}</button>
    </div>
  </nav>;
}

export function CatalogBackToTop({locale, active}: {locale: Locale; active: boolean}) {
  const [visible,setVisible] = useState(false);
  useEffect(() => {
    const update = () => setVisible(window.scrollY > 300);
    update();
    window.addEventListener('scroll',update,{passive:true});
    return () => window.removeEventListener('scroll',update);
  },[]);
  if (!active || !visible) return null;
  return <button className="catalog-back-top" onClick={() => { window.scrollTo({top:0,behavior:'instant'}); document.querySelector<HTMLElement>('main h1')?.focus({preventScroll:true}); }}>{locale === 'zh-Hant' ? '↑ 回頂部' : '↑ Back to top'}</button>;
}
