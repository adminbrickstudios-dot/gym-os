"use client";
// VD-19 · La ventana de Entrada reconoce al anotado a un evento de hoy (por QR, DNI o número) y le marca
// la presencia con un toque. Es un aviso: no cambia si el socio puede entrar al gimnasio.
import { useState, useTransition } from "react";
import { presenteEnEvento, type EventoHoy } from "@/app/panel/entrada/acciones";

export function EventosHoyEntrada({ socioId, eventos }: { socioId: string; eventos: EventoHoy[] }) {
  const [presentes, setPresentes] = useState<Record<string, boolean>>(() => Object.fromEntries(eventos.map((e) => [e.evento_id, e.presente])));
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  if (eventos.length === 0) return null;
  return (
    <ul className="space-y-2" data-ventana-eventos>
      {eventos.map((e) => {
        const esta = presentes[e.evento_id] ?? e.presente;
        return (
          <li key={e.evento_id} className="flex flex-wrap items-center gap-2" data-ventana-evento={e.nombre}>
            <span className="pildora pildora-azul whitespace-normal"><span aria-hidden>🎟️</span> Hoy: {e.nombre}{e.espera ? " (en lista de espera)" : ""}</span>
            {e.espera ? null : esta
              ? <span className="pildora pildora-verde" data-evento-presente>✓ Presente</span>
              : <button type="button" className="boton" disabled={ocupado} data-evento-marcar
                  onClick={() => empezar(async () => {
                    const r = await presenteEnEvento(e.evento_id, socioId);
                    if (r.error) setError(r.error); else { setError(null); setPresentes((p) => ({ ...p, [e.evento_id]: true })); }
                  })}>Marcar presente en el evento</button>}
          </li>
        );
      })}
      {error && <li role="alert" className="mensaje mensaje-error">{error}</li>}
    </ul>
  );
}
