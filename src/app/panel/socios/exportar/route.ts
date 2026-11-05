// Exportar la lista de socios a CSV (se abre con Excel). Solo dueño y
// encargado: lo decide la base (exportar_socios). Mismo filtro que la lista.
import { aCsv } from "@/lib/csv";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

type Fila = { numero: number; nombre: string; apellido: string; dni: string | null; telefono: string | null; email: string | null; nacimiento: string | null;
  plan: string | null; estado: string; cubierto_hasta: string | null; alta: string; dado_de_baja: string | null; etiquetas: string | null };

const fecha = (d: string | null) => (d ? d.split("-").reverse().join("/") : "");

export async function GET(req: Request) {
  const panel = await contextoPanel();
  const u = new URL(req.url);
  const etiqueta = /^[0-9a-f-]{36}$/.test(u.searchParams.get("etiqueta") ?? "") ? u.searchParams.get("etiqueta") : null;
  let filas: Fila[];
  try {
    filas = await rpc<Fila[]>("exportar_socios", { p_gimnasio_id: panel.gimnasio.id, p_texto: u.searchParams.get("q") ?? "", p_etiqueta: etiqueta });
  } catch (e) {
    // Sin permiso (o cualquier error): se dice, nunca un archivo vacío.
    return new Response(`No se pudo exportar: ${(e as Error).message}`, { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const csv = aCsv(
    ["Número", "Nombre", "Apellido", "DNI", "Celular", "Mail", "Nacimiento", "Plan", "Estado", "Cubierto hasta", "Alta", "Baja", "Etiquetas"],
    filas.map((f) => [f.numero, f.nombre, f.apellido, f.dni, f.telefono, f.email, fecha(f.nacimiento), f.plan, f.estado, fecha(f.cubierto_hasta), fecha(f.alta), fecha(f.dado_de_baja), f.etiquetas]),
  );
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: panel.gimnasio.zona_horaria }).format(new Date());
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="socios-${panel.gimnasio.slug}-${hoy}.csv"`,
      "cache-control": "no-store",
    },
  });
}
