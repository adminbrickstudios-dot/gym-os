import type { Metadata } from "next";
import Link from "next/link";
import { PuntoEstado } from "@/components/panel/Estado";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { Vacio } from "@/components/ui/Vacio";

export const metadata: Metadata = { title: "Socios" };

type Fila = { socio_id: string; numero: number; nombre: string; telefono: string | null; dni: string | null; plan: string | null; color: string; texto: string; dado_de_baja: boolean };

type Etiqueta = { id: string; nombre: string; socios: number };

export default async function Socios({ searchParams }: { searchParams: Promise<{ q?: string; etiqueta?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const etiqueta = /^[0-9a-f-]{36}$/.test(sp.etiqueta ?? "") ? sp.etiqueta! : null;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "socios");
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    const [filas, etiquetas] = await Promise.all([
      rpc<Fila[]>("buscar_socios", { p_gimnasio_id: panel.gimnasio.id, p_texto: q, p_limite: 60, p_etiqueta: etiqueta }),
      rpc<Etiqueta[]>("etiquetas_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
    ]);
    const con = (e: string | null) => { const u = new URLSearchParams(); if (q) u.set("q", q); if (e) u.set("etiqueta", e); const x = u.toString(); return `/panel/socios${x ? `?${x}` : ""}`; };
    return (
      <>
        <Encabezado emoji="👥" titulo="Socios" bajada="Buscá por nombre, DNI, teléfono o número."
          accion={<div className="flex flex-wrap gap-2">
            <Link href="/panel/socios/nuevo" className="boton boton-principal">➕ Nuevo socio</Link>
            {panel.yo.rol !== "recepcion" && <Link href="/panel/socios/importar" className="boton">📥 Importar</Link>}
            {panel.yo.rol !== "recepcion" && filas.length > 0 && (
              // Descarga: un <a> común (no navegación del cliente), con el mismo filtro de la lista.
              <a href={`/panel/socios/exportar${con(etiqueta).replace("/panel/socios", "")}`} className="boton" download>📤 Exportar</a>
            )}
          </div>} />
        <form className="mb-4" role="search">
          <input name="q" defaultValue={q} placeholder="🔍 Buscar socio" className="campo !min-h-14 !text-lg" aria-label="Buscar socio" autoComplete="off" />
          {etiqueta && <input type="hidden" name="etiqueta" value={etiqueta} />}
        </form>
        {etiquetas.length > 0 && (
          <nav className="flex flex-wrap gap-2 mb-6" aria-label="Filtrar por etiqueta" data-filtro-etiquetas>
            <Link href={con(null)} className="pestana" aria-current={!etiqueta ? "page" : undefined}>Todos</Link>
            {etiquetas.map((e) => (
              <Link key={e.id} href={con(e.id)} className="pestana" aria-current={etiqueta === e.id ? "page" : undefined}>🏷️ {e.nombre} <span className="texto-tenue">{e.socios}</span></Link>
            ))}
          </nav>
        )}
        {filas.length === 0 ? (
          q
            ? <Vacio emoji="🔍" titulo={`Nadie con “${q}”`} acciones={<Link href="/panel/socios/nuevo" className="boton">➕ Darlo de alta</Link>}>Probá con el DNI o solo el apellido.</Vacio>
            : <Vacio emoji="👥" titulo="Todavía no hay socios" acciones={<>
                <Link href="/panel/socios/nuevo" className="boton">➕ Cargar el primero</Link>
                {panel.yo.rol !== "recepcion" && <Link href="/panel/socios/importar" className="boton">📥 Importar de un Excel</Link>}
              </>}>Cuando cargues socios, acá vas a ver cada uno con su estado: al día, por vencer o vencido.</Vacio>
        ) : (
          <ul className="space-y-2">
            {filas.map((s) => (
              <li key={s.socio_id}>
                <Link href={`/panel/socios/${s.socio_id}`} className={`tarjeta flex items-center gap-4 px-4 py-3 min-h-[68px] hover:bg-[var(--tarjeta-alta)] ${s.dado_de_baja ? "opacity-60" : ""}`}>
                  <PuntoEstado color={s.color} grande />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-lg truncate">{s.nombre} <span className="texto-tenue font-normal">#{s.numero}</span></span>
                    <span className="block texto-suave truncate">{s.dado_de_baja ? "Dado de baja" : s.texto}</span>
                  </span>
                  {s.plan && <span className="hidden sm:inline pildora">{s.plan}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {filas.length === 60 && <p className="texto-tenue mt-4">Se muestran los primeros 60. Buscá para encontrar a alguien en particular.</p>}
      </>
    );
  });
}
