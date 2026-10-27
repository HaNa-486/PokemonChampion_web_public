/* Floating UI exposes stable callback refs; React's generic ref lint cannot infer that contract. */
/* eslint-disable react-hooks/refs */
"use client";

import { useState, type ReactNode } from "react";
import { autoUpdate, flip, FloatingPortal, offset, shift, useClick, useDismiss, useFloating, useFocus, useHover, useInteractions, useRole } from "@floating-ui/react";

export function InfoTooltip({ label, children, onActivate }: { label: ReactNode; children: ReactNode; onActivate?: () => void }) {
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({ open, onOpenChange: setOpen, placement: "top-start", whileElementsMounted: autoUpdate, middleware: [offset(10), flip(), shift({ padding: 12 })] });
  const hover = useHover(context, { delay: { open: 150, close: 80 }, move: false });
  const focus = useFocus(context);
  const click = useClick(context, { enabled: !onActivate });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, click, dismiss, role]);

  return (
    <>
      <button ref={refs.setReference} className="info-trigger" type="button" aria-haspopup={onActivate ? "dialog" : undefined} {...getReferenceProps({ onClick: onActivate })}>{label}</button>
      {open && <FloatingPortal><div ref={refs.setFloating} style={floatingStyles} className="info-tooltip" {...getFloatingProps()}>{children}</div></FloatingPortal>}
    </>
  );
}
