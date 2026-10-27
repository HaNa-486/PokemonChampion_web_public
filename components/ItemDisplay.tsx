"use client";

import { useState } from "react";
import type { HeldItem } from "../lib/types";
import { InfoTooltip } from "./InfoTooltip";
import { localizedTerm } from "../lib/localization";

type Locale = "en" | "zh-Hant";

const itemName = (item: HeldItem, locale: Locale) => locale === "zh-Hant" ? item.nameZh : item.name;

export function ItemIcon({ item, size = 24, alt = "", className = "" }: { item?: HeldItem | null; size?: number; alt?: string; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!item?.imageUrl || failedUrl === item.imageUrl) {
    return <span className={`item-icon item-icon-fallback ${className}`.trim()} style={{ width: size, height: size }} aria-hidden="true">?</span>;
  }
  return <img className={`item-icon ${className}`.trim()} src={item.imageUrl} alt={alt} width={size} height={size} loading="lazy" onError={() => setFailedUrl(item.imageUrl)} />;
}

export function ItemDisplay({ item, locale, fallbackName, size = 24, className = "" }: { item?: HeldItem | null; locale: Locale; fallbackName?: string; size?: number; className?: string }) {
  const name = item ? itemName(item, locale) : fallbackName;
  if (!name) return null;
  return <span className={`item-display ${className}`.trim()}><ItemIcon item={item} size={size} /><span className="item-display-name">{name}</span></span>;
}

export function ItemTooltip({ item, locale, onActivate, size = 24 }: { item?: HeldItem | null; locale: Locale; onActivate?: () => void; size?: number }) {
  if (!item) return <span>—</span>;
  return <InfoTooltip label={<ItemDisplay item={item} locale={locale} size={size} />} onActivate={onActivate}>
    <div className="item-tooltip-title"><ItemDisplay item={item} locale={locale} size={32} /></div>
    <div className="tooltip-meta"><span>{localizedTerm(item.category, locale)}</span></div>
    <p>{locale === "zh-Hant" ? item.descriptionZh : item.description}</p>
  </InfoTooltip>;
}
