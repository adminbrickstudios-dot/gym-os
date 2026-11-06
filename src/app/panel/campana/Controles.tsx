"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { refrescarPendientes } from "@/lib/panel/pendientes";
import { guardarPreferenciaAviso, marcarTodoLeido } from "./acciones";

/** VD-37: "Marcar todo como leído". */
export function MarcarTodo({ sinLeer }: { sinLeer: number }) {
  const router = useRouter();
  const [ocupado, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (sinLeer <= 0 && !error) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <button type="button" data-marcar-todo className="boton" disabled={ocupado}
        onClick={() => empezar(async () => {
          setError(null);
          const r = await marcarTodoLeido();
          if (r.error) { setError(r.error); return; }
          refrescarPendientes();
          router.refresh();
        })}>
        {ocupado ? "Marcando…" : "✓ Marcar todo como leído"}
      </button>
      {error && <p role="alert" className="mensaje mensaje-error">{error}</p>}
    </div>
  );
}

const NOMBRE: Record<string, { titulo: string; ayuda: string }> = {
  comprobantes: { titulo: "Comprobantes para revisar", ayuda: "Un socio mandó una transferencia." },
  caja: { titulo: "La caja", ayuda: "Cajas que quedaron abiertas, diferencias y retiros." },
  pedidos: { titulo: "Pedidos", ayuda: "Anular una venta, pausas y bajas, y sus respuestas." },
  control: { titulo: "Control", ayuda: "Cobros con otra fecha, entradas prestadas y las que se dejaron pasar." },
  stock: { titulo: "Productos para reponer", ayuda: "Se terminó o queda poco." },
  resumen: { titulo: "Resúmenes", ayuda: "El del día y el de la semana." },
  clases: { titulo: "Clases que se cancelan", ayuda: "Las tuyas." },
};

/** VD-37: qué tipos de aviso aparecen en MI campana. Por defecto todos; los avisos al celular se eligen por dispositivo. */
export function PreferenciasAvisos({ inicial }: { inicial: { tipo: string; app: boolean }[] }) {
  const router = useRouter();
  const [prefs, setPrefs] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const cambiar = (tipo: string, app: boolean) => empezar(async () => {
    setError(null); setOk(null);
    const r = await guardarPreferenciaAviso(tipo, app);
    if (r.error) { setError(r.error); return; }
    setPrefs((p) => p.map((x) => (x.tipo === tipo ? { ...x, app } : x)));
    setOk("Guardado.");
    refrescarPendientes();
    router.refresh();
  });
  return (
    <ul className="space-y-2" data-preferencias>
      {prefs.map((p) => {
        const n = NOMBRE[p.tipo] ?? { titulo: p.tipo, ayuda: "" };
        return (
          <li key={p.tipo} className="tarjeta px-4 py-3 flex items-center gap-4">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{n.titulo}</span>
              <span className="block texto-suave text-[15px]">{n.ayuda}</span>
            </span>
            <label className="flex items-center gap-2 min-h-11 flex-none cursor-pointer">
              <input type="checkbox" data-pref={p.tipo} className="size-6" checked={p.app} disabled={ocupado} onChange={(e) => cambiar(p.tipo, e.target.checked)} />
              <span className="text-sm texto-suave">En la campana</span>
            </label>
          </li>
        );
      })}
      {ok && <li className="texto-suave" role="status">{ok}</li>}
      {error && <li role="alert" className="mensaje mensaje-error">{error}</li>}
    </ul>
  );
}
