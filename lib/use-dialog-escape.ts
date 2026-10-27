"use client";

import { useEffect, useRef } from "react";

const dialogEscapeStack: symbol[] = [];

export function useDialogEscape(onClose: () => void) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const token = Symbol("dialog-escape");
    dialogEscapeStack.push(token);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || dialogEscapeStack.at(-1) !== token) return;
      event.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      const index = dialogEscapeStack.lastIndexOf(token);
      if (index >= 0) dialogEscapeStack.splice(index, 1);
    };
  }, []);
}
