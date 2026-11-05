// SEG-2: todos los datos del gimnasio, un CSV por tabla dentro de un zip. Solo
// el dueño: lo decide la base (exportar_gimnasio). Sin permiso, se dice.
import { zipSync, strToU8 } from "fflate";
import { aCsv } from "@/lib/csv";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

const TABLAS = ["socios", "planes", "precios_plan", "suscripciones", "coberturas", "congelamientos", "packs", "ventas", "venta_items", "pagos",
  "ingresos", "turnos_caja", "movimientos_caja", "equipo", "actividades", "clases", "reservas", "asistencias", "prospectos",
  "productos", "gastos", "ejercicios", "rutinas", "registros_ejercicio"];
type Fila = Record<string, unknown>;
const valor = (v: unknown) => (v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));

export async function GET() {
  const panel = await contextoPanel();
  const archivos: Record<string, Uint8Array> = {};
  try {
    for (const t of TABLAS) {
      const filas = await rpc<Fila[]>("exportar_gimnasio", { p_gimnasio_id: panel.gimnasio.id, p_tabla: t });
      const columnas = [...new Set(filas.flatMap((f) => Object.keys(f)))];
      archivos[`${t}.csv`] = strToU8(aCsv(columnas, filas.map((f) => columnas.map((c) => valor(f[c])))));
    }
  } catch (e) {
    return new Response(`No se pudo exportar: ${(e as Error).message}`, { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: panel.gimnasio.zona_horaria }).format(new Date());
  return new Response(Buffer.from(zipSync(archivos)), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${panel.gimnasio.slug}-datos-${hoy}.zip"`,
      "cache-control": "no-store",
    },
  });
}
