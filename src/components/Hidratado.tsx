"use client";
import { useEffect } from "react";

/** Marca la página cuando React ya tomó los botones. Las pruebas esperan esto antes de tocar (en producción el HTML llega antes). */
export function Hidratado() {
  useEffect(() => { document.documentElement.dataset.hidratado = "1"; }, []);
  return null;
}
