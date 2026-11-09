import Link from "next/link";
import { formatearNumero, formatearPesos } from "@/lib/formato";
import { haceCuanto } from "@/lib/admin/lista";
import { rpc } from "@/lib/panel/servidor";

type Numero = { valor: number | string; lista: string };
type Atencion = { gimnasio_id: string; nombre: string; tipo: string; motivo: string; boton: string };
type Actividad = { tipo: string; texto: string; cuando: string; gimnasio_id: string };
export type TableroPlataforma = { numeros: Record<string, Numero>; necesitan_atencion: Atencion[]; actividad: Actividad[] };

// SA-1: a cada número le corresponde su lista (/admin/gimnasios con ese filtro).
const NUMEROS: [string, string, string, boolean][] = [
  ["activos_hoy", "Gimnasios activos hoy", "/admin/gimnasios", false],
  ["entradas_hoy", "Entradas en toda la plataforma", "/admin/gimnasios", false],
  ["cobrado_hoy", "Cobrado por los gimnasios hoy", "/admin/gimnasios", true],
  ["ingreso_mensual_brik", "Ingreso del mes de BRIK", "/admin/gimnasios?abono=al_dia", true],
  ["abonos_por_vencer", "Abonos por vencer", "/admin/gimnasios?abono=por_vencer", false],
  ["abonos_vencidos", "Abonos vencidos", "/admin/gimnasios?abono=vencido", false],
  ["ayudas_sin_responder", "Ayudas sin responder", "/admin#ayudas", false],
];

/** El tablero de inicio del super admin: números de hoy, "necesitan atención" con su motivo y lo último que pasó. */
export async function Tablero() {
  const t = await rpc<TableroPlataforma>("admin_tablero");
  return (
    <section className="space-y-6" data-tablero>
      <p className="titulo-grupo">Hoy en la plataforma</p>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {NUMEROS.map(([k, titulo, destino, plata]) => {
          const n = t.numeros[k];
          if (!n) return null;
          const valor = plata ? formatearPesos(Number(n.valor)) : formatearNumero(Number(n.valor));
          return (
            <Link key={k} href={destino} className="tarjeta p-4 block" data-numero={k}>
              <dd className="numero text-3xl">{valor}</dd>
              <dt className="texto-tenue text-sm">{titulo}</dt>
            </Link>
          );
        })}
      </dl>

      <div className="space-y-3" data-necesitan-atencion>
        <p className="titulo-grupo">Necesitan atención</p>
        {t.necesitan_atencion.length === 0 && <p className="texto-suave">Ningún gimnasio necesita atención ahora.</p>}
        <ul className="space-y-2">
          {t.necesitan_atencion.map((a, i) => (
            <li key={`${a.gimnasio_id}-${i}`} className="tarjeta p-4 flex flex-wrap items-center gap-3" data-atencion={a.tipo}>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{a.nombre}</span>
                <span className="block texto-suave text-sm">{a.motivo}</span>
              </span>
              <Link href={`/admin/${a.gimnasio_id}`} className="boton">{a.boton}</Link>
            </li>
          ))}
        </ul>
      </div>

      {t.actividad.length > 0 && (
        <div className="space-y-2" data-actividad>
          <p className="titulo-grupo">Lo último</p>
          <ul className="space-y-1">
            {t.actividad.map((a, i) => (
              <li key={i} className="texto-suave text-sm">
                <Link href={`/admin/${a.gimnasio_id}`} className="underline">{a.texto}</Link>{" "}
                <span className="texto-tenue" title={new Date(a.cuando).toLocaleString("es-AR")}>{haceCuanto(a.cuando)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
