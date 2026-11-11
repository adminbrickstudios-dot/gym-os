import { formatearNumero } from "@/lib/formato";
import { rpc } from "@/lib/panel/servidor";
import { LimitesPlanes, type PlanConLimites } from "./LimitesPlanes";

type Alerta = { clave: string; nivel: "rojo" | "amarillo"; texto: string };
type Limite = { gimnasio_id: string; nombre: string; plan: string; socios: number; max_socios: number | null; sedes: number; max_sedes: number | null; estado: "ok" | "cerca" | "pasado" | "sin_limite" };
type Tabla = { tabla: string; filas: number; megas: number; partir: boolean };

/** ESC-05, 06 y 08 en el super admin: alertas, límites por plan ("se acerca al límite") y las tablas que crecen. */
export async function EscalaDatos() {
  const [alertas, limites, planes, tablas] = await Promise.all([
    rpc<{ alertas: Alerta[] }>("admin_alertas").catch(() => ({ alertas: [] as Alerta[] })),
    rpc<Limite[]>("admin_limites_gimnasios").catch(() => [] as Limite[]),
    rpc<PlanConLimites[]>("admin_planes_con_limites").catch(() => [] as PlanConLimites[]),
    rpc<Tabla[]>("admin_tamano_tablas").catch(() => [] as Tabla[]),
  ]);
  const cerca = limites.filter((l) => l.estado === "cerca" || l.estado === "pasado");
  return (
    <section className="space-y-6" data-escala>
      <div className="space-y-2" data-alertas>
        <p className="titulo-grupo">Alertas</p>
        {alertas.alertas.length === 0 ? <p className="texto-suave">Sin alertas: todo dentro de lo normal.</p> : (
          <ul className="space-y-1">
            {alertas.alertas.map((a) => <li key={a.clave} className="flex gap-2 items-center" data-alerta={a.clave} data-nivel={a.nivel}><span className={`pildora ${a.nivel === "rojo" ? "pildora-rojo" : "pildora-amarillo"}`}>{a.nivel === "rojo" ? "Actuar" : "Mirar"}</span>{a.texto}</li>)}
          </ul>
        )}
      </div>

      <div className="space-y-2" data-limites>
        <p className="titulo-grupo">Límites por plan</p>
        <p className="texto-suave">Lo que incluye cada plan de BRIK. Vacío es sin límite. Hoy se avisa, no se bloquea.</p>
        <LimitesPlanes planes={planes} />
        {cerca.length > 0 && (
          <ul className="space-y-1" data-se-acerca>
            {cerca.map((l) => (
              <li key={l.gimnasio_id} className="tarjeta p-3 text-sm flex flex-wrap gap-x-4 items-center" data-limite-estado={l.estado}>
                <span className={`pildora ${l.estado === "pasado" ? "pildora-rojo" : "pildora-amarillo"}`}>{l.estado === "pasado" ? "Pasó el límite" : "Se acerca al límite"}</span>
                <span className="font-semibold">{l.nombre}</span>
                <span>Plan {l.plan}</span>
                {l.max_socios != null && <span>{formatearNumero(l.socios)} de {formatearNumero(l.max_socios)} socios</span>}
                {l.max_sedes != null && <span>{l.sedes} de {l.max_sedes} sedes</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2" data-tablas-crecen>
        <p className="titulo-grupo">Tablas que crecen</p>
        <ul className="space-y-1">
          {tablas.map((t) => (
            <li key={t.tabla} className="text-sm flex flex-wrap gap-x-4 items-center">
              <span className="font-semibold min-w-[11rem]">{t.tabla}</span><span>{formatearNumero(t.filas)} filas</span><span>{t.megas} MB</span>
              {t.partir && <span className="pildora pildora-amarillo">Conviene partirla por mes</span>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
