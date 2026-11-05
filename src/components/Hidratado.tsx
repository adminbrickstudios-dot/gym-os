"use client";
import { useEffect, useState } from "react";

/** Marca la página cuando React ya tomó los botones del marco. Las pruebas esperan esto antes de tocar. */
export function Hidratado() {
  useEffect(() => { document.documentElement.dataset.hidratado = "1"; }, []);
  return null;
}

/**
 * Lo mismo para el contenido de cada pantalla, que llega después (en streaming)
 * y se hidrata aparte: hasta que no dice "1", un clic ahí se puede perder.
 */
export function PaginaHidratada() {
  const [lista, setLista] = useState(false);
  useEffect(() => setLista(true), []);
  return <span hidden data-pagina-hidratada={lista ? "1" : "0"} />;
}
