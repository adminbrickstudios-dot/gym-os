import type { Metadata } from "next";
import Link from "next/link";
import { PuntoEstado } from "@/components/panel/Estado";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpcLectura } from "@/lib/panel/servidor";
import { Vacio } from "@/components/ui/Vacio";

export const metadata: Metadata = { title: "Socios" };

type Fila = { socio_id: string; numero: number; nombre: string; telefono: string | null; dni: string | null; plan: string | null; color: string; texto: string; dado_de_baja: boolean };

type Etiqueta = { id: string; nombre: string; socios: number };
type Filtros = Record<"todos" | "al_dia" | "por_vencer" | "vencidos" | "en_pausa" | "sin_plan" | "nuevos" | "bajas", number> & { planes: { plan_id: string; nombre: string; socios: number }[] };

// Las píldoras de estado: el grupo sale del veredicto de la puerta (la base agrupa).
const ESTADOS = [
  ["al_dia", "🟢 Al día"], ["por_vencer", "🟡 Por vencer"], ["vencidos", "🔴 Vencidos"], ["en_pausa", "⏸️ En pausa"],
  ["sin_plan", "⚪ Sin plan"], ["nuevos", "🆕 Nuevos (30 días)"], ["bajas", "👋 Dados de baja"],
] as const;
type Estado = (typeof ESTADOS)[number][0];
const uuid = (x?: string) => (/^[0-9a-f-]{36}$/.test(x ?? "") ? x! : null);

export default async function Socios({ searchParams }: { searchParams: Promise<{ q?: string; etiqueta?: string; estado?: string; plan?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const etiqueta = uuid(sp.etiqueta), plan = uuid(sp.plan);
  const estado: Estado | null = ESTADOS.find(([k]) => k === sp.estado)?.[0] ?? null;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "socios");
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    const [filas, etiquetas, filtros] = await Promise.all([
      rpcLectura<Fila[]>("buscar_socios", { p_gimnasio_id: panel.gimnasio.id, p_texto: q, p_limite: 60, p_etiqueta: etiqueta, p_estado: estado, p_plan: plan }),
      rpcLectura<Etiqueta[]>("etiquetas_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
      rpcLectura<Filtros>("filtros_socios", { p_gimnasio_id: panel.gimnasio.id }),
    ]);
    // Un link con los filtros de ahora, cambiando uno (null lo saca).
    const con = (cambio: { etiqueta?: string | null; estado?: string | null; plan?: string | null }) => {
      const v = { etiqueta, estado, plan, ...cambio };
      const u = new URLSearchParams(); if (q) u.set("q", q);
      for (const k of ["estado", "plan", "etiqueta"] as const) if (v[k]) u.set(k, v[k]!);
      const x = u.toString(); return `/panel/socios${x ? `?${x}` : ""}`;
    };
    const filtrado = !!(estado || plan || etiqueta);
    return (
      <>
        <Encabezado emoji="👥" titulo="Socios" bajada="Buscá por nombre, DNI, teléfono o número."
          accion={(() => {
            const extra = panel.yo.rol !== "recepcion" && <>
              <Link href="/panel/socios/importar" className="boton">📥 Importar</Link>
              <Link href="/panel/socios/duplicados" className="boton">🔎 Duplicados</Link>
              {filas.length > 0 && (
                // Descarga: un <a> común (no navegación del cliente), con el mismo filtro de la lista.
                <a href={`/panel/socios/exportar${con({ estado: null, plan: null }).replace("/panel/socios", "")}`} className="boton" download>📤 Exportar</a>
              )}
            </>;
            return (
              <div className="flex flex-wrap items-start gap-2">
                <Link href="/panel/socios/nuevo" className="boton boton-principal">➕ Nuevo socio</Link>
                {extra && <div className="hidden sm:flex flex-wrap gap-2">{extra}</div>}
                {/* En el celular lo que se usa poco va en "Más", así la búsqueda queda arriba. */}
                {extra && (
                  <details className="sm:hidden" data-mas>
                    <summary className="boton list-none cursor-pointer">⋯ Más</summary>
                    <div className="flex flex-wrap gap-2 mt-2">{extra}</div>
                  </details>
                )}
              </div>
            );
          })()} />
        <form className="mb-4" role="search">
          <input name="q" defaultValue={q} placeholder="🔍 Buscar socio" className="campo !min-h-14 !text-lg" aria-label="Buscar socio" autoComplete="off" />
          {etiqueta && <input type="hidden" name="etiqueta" value={etiqueta} />}
          {estado && <input type="hidden" name="estado" value={estado} />}
          {plan && <input type="hidden" name="plan" value={plan} />}
        </form>
        {filtros.todos + filtros.bajas > 0 && (
          <nav className="pestanas mb-3" aria-label="Filtrar por estado" data-filtro-estados>
            {/* Filtros: links comunes (recargan la lista). Con la app compilada, la navegación de <Link> a la misma
                lista con otro filtro a veces se cortaba (ERR_ABORTED) y no cambiaba nada: así siempre anda. */}
            <a href={con({ estado: null })} className="pestana" aria-current={!estado ? "page" : undefined}>Todos <span className="texto-tenue">{filtros.todos}</span></a>
            {ESTADOS.filter(([k]) => filtros[k] > 0 || estado === k).map(([k, t]) => (
              <a key={k} href={con({ estado: estado === k ? null : k })} className="pestana" aria-current={estado === k ? "page" : undefined} data-estado={k}>
                {t} <span className="texto-tenue">{filtros[k]}</span>
              </a>
            ))}
          </nav>
        )}
        {(filtros.planes.length > 1 || etiquetas.length > 0) && (
          <nav className="pestanas mb-6" aria-label="Filtrar por plan o etiqueta" data-filtro-etiquetas>
            {filtros.planes.length > 1 && filtros.planes.map((p) => (
              <a key={p.plan_id} href={con({ plan: plan === p.plan_id ? null : p.plan_id })} className="pestana" aria-current={plan === p.plan_id ? "page" : undefined} data-plan={p.plan_id}>
                📋 {p.nombre} <span className="texto-tenue">{p.socios}</span>
              </a>
            ))}
            {etiquetas.map((e) => (
              <a key={e.id} href={con({ etiqueta: etiqueta === e.id ? null : e.id })} className="pestana" aria-current={etiqueta === e.id ? "page" : undefined}>🏷️ {e.nombre} <span className="texto-tenue">{e.socios}</span></a>
            ))}
          </nav>
        )}
        {filas.length === 0 ? (
          filtrado && !q
            ? <Vacio emoji="🔍" titulo="Nadie con ese filtro" acciones={<Link href="/panel/socios" className="boton">Ver todos</Link>}>Probá con otro, o sacá el filtro.</Vacio>
            : q
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
