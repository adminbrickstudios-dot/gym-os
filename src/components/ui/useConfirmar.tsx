"use client";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { Hoja } from "@/components/ui/Hoja";
import { Icono } from "@/components/ui/Icono";

type Pedido = { texto: string; boton: string; peligro: boolean };

/**
 * Confirmar algo que no tiene vuelta, con la hoja del sistema (X, Esc, click afuera, foco atrapado) y no con el `window.confirm` del navegador.
 *   const [confirmar, dialogo] = useConfirmar();
 *   ... if (!(await confirmar("Dar de baja a X: queda 30 días para borrar.", { boton: "Dar de baja", peligro: true }))) return;
 *   ... y en el JSX: {dialogo}
 * El texto dice qué va a pasar (con nombre y monto cuando los hay). Cancelar, Esc o tocar afuera devuelven false.
 */
export function useConfirmar(): readonly [(texto: string, opciones?: { boton?: string; peligro?: boolean }) => Promise<boolean>, ReactNode] {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirmar = useCallback((texto: string, opciones?: { boton?: string; peligro?: boolean }) =>
    new Promise<boolean>((res) => {
      resolver.current?.(false);
      resolver.current = res;
      setPedido({ texto, boton: opciones?.boton ?? "Confirmar", peligro: opciones?.peligro ?? false });
    }), []);

  const cerrar = (v: boolean) => { resolver.current?.(v); resolver.current = null; setPedido(null); };

  const dialogo = (
    <Hoja abierta={!!pedido} alCerrar={() => cerrar(false)} etiqueta="Confirmar">
      <div className="p-5 sm:p-6 pr-14" data-confirmar-hoja>
        <p className="titulo text-2xl flex items-center gap-2">{pedido?.peligro && <span className="text-[var(--no)]" aria-hidden><Icono nombre="alerta" /></span>}{pedido?.peligro ? "Esto no se deshace con un toque" : "¿Confirmás?"}</p>
        <p className="mt-2 text-[15px]">{pedido?.texto}</p>
        <div className="mt-5 flex flex-wrap gap-2 justify-end">
          <button type="button" className="boton" onClick={() => cerrar(false)} data-confirmar-cancelar>Cancelar</button>
          <button type="button" className={`boton ${pedido?.peligro ? "boton-peligro" : "boton-principal"}`} onClick={() => cerrar(true)} data-confirmar-ok>{pedido?.boton}</button>
        </div>
      </div>
    </Hoja>
  );
  return [confirmar, dialogo] as const;
}
