"use client";
import { useEffect, useRef } from "react";

/** Keep keyboard navigation inside an open modal and return to its trigger. */
export function useModalFocus({ isolateBackground = false }: { isolateBackground?: boolean } = {}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    if (!dialog) return;
    // Only opt-in body portals isolate their background. Keep exact attributes
    // so an existing modal or caller-owned hidden state survives this preview.
    let portal: HTMLElement = dialog;
    while (portal.parentElement && portal.parentElement !== document.body) portal = portal.parentElement;
    const background = isolateBackground && portal.parentElement === document.body
      ? Array.from(document.body.children).filter((element): element is HTMLElement => element instanceof HTMLElement && element !== portal)
        .map(element => ({ element, inert: element.getAttribute("inert"), hidden: element.getAttribute("aria-hidden") }))
      : [];
    for (const {element} of background) { element.setAttribute("inert", ""); element.setAttribute("aria-hidden", "true"); }
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')).filter(el => !el.hidden);
    controls()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = controls(), first = elements[0], last = elements.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener("keydown", trap);
    return () => {
      dialog.removeEventListener("keydown", trap);
      for (const {element, inert, hidden} of background) {
        if (inert === null) element.removeAttribute("inert"); else element.setAttribute("inert", inert);
        if (hidden === null) element.removeAttribute("aria-hidden"); else element.setAttribute("aria-hidden", hidden);
      }
      if (previous?.isConnected) previous.focus();
    };
  }, [isolateBackground]);
  return ref;
}
