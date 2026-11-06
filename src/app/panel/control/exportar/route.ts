// VD-10: el Control en CSV (se abre con Excel), con los mismos filtros de la pantalla. Solo dueño y
// encargado con permiso: lo decide la base (linea_de_control). Sin permiso se dice; nunca un archivo vacío.
// Tope de TOPE_CSV filas por pedido: si hay más, el archivo lo avisa en la última línea.
import { aCsv } from "@/lib/csv";
import { filaCsv, TIPOS_CONTROL, TITULOS_CSV, TOPE_CSV, type PaginaControl } from "@/lib/control";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = (m: string, estado: number) => new Response(m, { status: estado, headers: { "content-type": "text/plain; charset=utf-8" } });
const sumar = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

export async function GET(req: Request) {
  const panel = await contextoPanel();
  if (panel.yo.rol !== "dueno" && panel.yo.rol !== "encargado") return texto("Tu rol no tiene acceso al Control.", 403);
  if (panel.secciones_apagadas.includes("control")) return texto("El Control está apagado en este gimnasio.", 404);
  const u = new URL(req.url);
  const zona = panel.gimnasio.zona_horaria;
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date());
  const hasta = FECHA.test(u.searchParams.get("hasta") ?? "") ? u.searchParams.get("hasta")! : hoy;
  const desde = FECHA.test(u.searchParams.get("desde") ?? "") ? u.searchParams.get("desde")! : sumar(hasta, -6);
  const tipos = u.searchParams.getAll("tipos").flatMap((t) => t.split(",")).filter((t) => (TIPOS_CONTROL as readonly string[]).includes(t));
  const quien = UUID.test(u.searchParams.get("quien") ?? "") ? u.searchParams.get("quien")! : null;

  const filas: ReturnType<typeof filaCsv>[] = [];
  let cursor: string | null = null;
  let cortado = false;
  try {
    do {
      const p: PaginaControl = await rpc<PaginaControl>("linea_de_control", {
        p_gimnasio_id: panel.gimnasio.id, p_desde: desde, p_hasta: hasta, p_tipos: tipos.length ? tipos : null,
        p_quien: quien, p_limite: 200, p_cursor: cursor,
      });
      for (const i of p.items) {
        if (filas.length >= TOPE_CSV) { cortado = true; break; }
        filas.push(filaCsv(i, zona));
      }
      cursor = cortado ? null : p.siguiente;
    } while (cursor);
  } catch (e) {
    return texto(`No se pudo exportar: ${(e as Error).message}`, 403);
  }
  if (cortado) filas.push(["", "", "", "", "", `Se cortó en ${TOPE_CSV} filas: elegí menos días o un solo tipo para ver el resto.`, ""]);
  return new Response(aCsv(TITULOS_CSV, filas), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="control-${panel.gimnasio.slug}-${desde}-a-${hasta}.csv"`,
      "cache-control": "no-store",
    },
  });
}
