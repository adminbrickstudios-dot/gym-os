"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { marcarAlertasVistas } from "@/app/panel/seguridad-acciones";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Mensaje } from "@/components/ui/Mensaje";
import { nombreDispositivo } from "@/lib/cuenta/dispositivo";

export type AlertaSeguridad = {
  id: string; tipo: "dispositivo_nuevo" | "baja_equipo"; quien: string | null; creado_en: string; vista: boolean;
  datos: { user_agent?: string; por?: string | null; motivo?: string | null };
};

const cuando = (iso: string, zona: string) =>
  new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

/** VD-42: lo que el dueño tiene que saber de la seguridad del equipo (dispositivos nuevos y bajas). */
export function AlertasSeguridad({ alertas, zona }: { alertas: AlertaSeguridad[]; zona: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const sinVer = alertas.filter((a) => !a.vista);
  if (sinVer.length === 0) return null;
  return (
    <section aria-labelledby="alertas-seguridad" className="tarjeta p-5 sm:p-6 space-y-3" data-alertas-seguridad={sinVer.length}>
      <h2 id="alertas-seguridad" className="titulo text-2xl">🔔 Seguridad del equipo</h2>
      <ul className="space-y-2">
        {sinVer.map((a) => (
          <li key={a.id} data-alerta={a.tipo} className="flex items-start gap-3">
            <span aria-hidden className="text-xl">{a.tipo === "baja_equipo" ? "🚫" : "📱"}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">
                {a.tipo === "baja_equipo"
                  ? `${a.quien ?? "Alguien"} fue dado de baja${a.datos.por ? ` por ${a.datos.por}` : ""}`
                  : `${a.quien ?? "Alguien"} entró desde un dispositivo nuevo`}
              </span>
              <span className="block texto-suave text-sm">
                {a.tipo === "dispositivo_nuevo" ? `${nombreDispositivo(a.datos.user_agent)} · ` : a.datos.motivo ? `${a.datos.motivo} · ` : ""}{cuando(a.creado_en, zona)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="texto-suave text-sm">Si no lo esperabas, sacale el acceso desde Equipo.</p>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <BotonAccion className="boton" ocupadoTexto="Guardando…" data-marcar-alertas
        onClick={async () => { const r = await marcarAlertasVistas(); if (r.error) setError(r.error); else router.refresh(); }}>Entendido</BotonAccion>
    </section>
  );
}
