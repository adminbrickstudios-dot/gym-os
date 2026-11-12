import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpcLectura } from "@/lib/panel/servidor";
import { Vacio } from "@/components/ui/Vacio";
import { Atenuable } from "@/components/panel/Atenuable";
import { Pestanas } from "@/components/ui/Pestanas";
import { cargarInteresados } from "../prospectos/Interesados";
import { Prospectos } from "../prospectos/Prospectos";
import { MemoriaSocios } from "./MemoriaSocios";
import { ListaSocios } from "./ListaSocios";
import { InvitadosPorSeguir, type InvitadoSinSeguir } from "../prospectos/InvitadosPorSeguir";
import { Icono } from "@/components/ui/Icono";

export const metadata: Metadata = { title: "Socios" };

type Fila = { socio_id: string; numero: number; nombre: string; telefono: string | null; dni: string | null; plan: string | null; color: string; texto: string; dado_de_baja: boolean; puede?: boolean; autoalta?: boolean };

type Etiqueta = { id: string; nombre: string; socios: number };
type Filtros = Record<"todos" | "al_dia" | "por_vencer" | "vencidos" | "en_pausa" | "sin_plan" | "nuevos" | "bajas", number> & { planes: { plan_id: string; nombre: string; socios: number }[] };

// Las píldoras de estado: el grupo sale del veredicto de la puerta (la base agrupa).
const ESTADOS = [
  ["al_dia", "Al día"], ["por_vencer", "Por vencer"], ["vencidos", "Vencidos"], ["en_pausa", "En pausa"],
  ["sin_plan", "Sin plan"], ["nuevos", "Nuevos (30 días)"], ["bajas", "Dados de baja"],
] as const;
type Estado = (typeof ESTADOS)[number][0];
const POR_PAGINA = 60, TOPE_LISTA = 600;
const uuid = (x?: string) => (/^[0-9a-f-]{36}$/.test(x ?? "") ? x! : null);

export default async function Socios({ searchParams }: { searchParams: Promise<{ q?: string; etiqueta?: string; estado?: string; plan?: string; vista?: string; web?: string; n?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  // VD-30: la lista se pide de a 60 y "Ver 60 más" suma otras 60 (hasta 600); para el resto, buscar.
  const limite = Math.min(TOPE_LISTA, Math.max(POR_PAGINA, Math.round(Number(sp.n) / POR_PAGINA) * POR_PAGINA || POR_PAGINA));
  const etiqueta = uuid(sp.etiqueta), plan = uuid(sp.plan);
  const estado: Estado | null = ESTADOS.find(([k]) => k === sp.estado)?.[0] ?? null;
  const web = sp.web === "1";
  const interesados = sp.vista === "interesados";
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "socios");
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    // VD-15 (D22): Socios · Interesados. Los Interesados (ex-Prospectos) viven en la segunda pestaña.
    if (interesados) {
      const { lista, pagina } = await cargarInteresados(panel);
      const nuevos = lista.filter((p) => p.estado === "nuevo").length;
      const invitados = await rpcLectura<InvitadoSinSeguir[]>("invitados_sin_seguimiento", { p_gimnasio_id: panel.gimnasio.id }).catch(() => []);   // FA-24
      return (
        <>
          <Encabezado icono="usuarios" titulo="Socios" bajada="Los que ya son socios y los que preguntaron y todavía no." />
          <PestanasSocios activa="interesados" nuevos={nuevos} />
          <InvitadosPorSeguir invitados={invitados} />
          <Prospectos lista={lista} pagina={pagina} zona={panel.gimnasio.zona_horaria} puedeAltas />
        </>
      );
    }
    const [filas, etiquetas, filtros, autoaltas, nuevosInteresados] = await Promise.all([
      rpcLectura<Fila[]>("buscar_socios", { p_gimnasio_id: panel.gimnasio.id, p_texto: q, p_limite: limite, p_etiqueta: etiqueta, p_estado: estado, p_plan: plan, p_origen: web ? "web" : null }),
      rpcLectura<Etiqueta[]>("etiquetas_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
      rpcLectura<Filtros>("filtros_socios", { p_gimnasio_id: panel.gimnasio.id }),
      rpcLectura<number>("autoaltas_web", { p_gimnasio_id: panel.gimnasio.id }),
      rpcLectura<{ estado: string }[]>("prospectos_panel", { p_gimnasio_id: panel.gimnasio.id }).then((l) => l.filter((p) => p.estado === "nuevo").length),
    ]);
    // Un link con los filtros de ahora, cambiando uno (null lo saca).
    const con = (cambio: { etiqueta?: string | null; estado?: string | null; plan?: string | null; web?: boolean }) => {
      const v = { etiqueta, estado, plan, web, ...cambio };
      const u = new URLSearchParams(); if (q) u.set("q", q);
      for (const k of ["estado", "plan", "etiqueta"] as const) if (v[k]) u.set(k, v[k]!);
      if (v.web) u.set("web", "1");
      const x = u.toString(); return `/panel/socios${x ? `?${x}` : ""}`;
    };
    const filtrado = !!(estado || plan || etiqueta || web);
    // Lo que MemoriaSocios recuerda: la query de ahora.
    const actual = (() => { const x = con({}).replace("/panel/socios", ""); return x; })();
    return (
      <>
        <MemoriaSocios actual={actual} />
        <Encabezado icono="usuarios" titulo="Socios" bajada="Buscá por nombre, DNI, teléfono o número."
          accion={(() => {
            const extra = panel.yo.rol !== "recepcion" && <>
              <Link href="/panel/socios/importar" className="boton"><Icono nombre="descargar" /> Importar</Link>
              <Link href="/panel/socios/duplicados" className="boton"><Icono nombre="buscar" /> Duplicados</Link>
              {filas.length > 0 && (
                // Descarga: un <a> común (no navegación del cliente), con el mismo filtro de la lista.
                // Texto, etiqueta, estado, plan y origen: el archivo trae lo mismo que la lista, sin su tope de filas. Sin filtro, todos.
                <a href={`/panel/socios/exportar${con({}).replace("/panel/socios", "")}`} className="boton" download data-exportar={filtrado || q ? "filtrado" : "todos"}><Icono nombre="subir" /> {filtrado || q ? "Exportar lo filtrado" : "Exportar"}</a>
              )}
            </>;
            return (
              <div className="flex flex-wrap items-start gap-2">
                <Link href="/panel/socios/nuevo" className="boton boton-principal"><Icono nombre="mas" /> Nuevo socio</Link>
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
        <PestanasSocios activa="socios" nuevos={nuevosInteresados} />
        <Atenuable>
        <form className="mb-4" role="search" data-transicion>
          <input name="q" defaultValue={q} placeholder="Buscar socio" className="campo !min-h-14 !text-lg" aria-label="Buscar socio" autoComplete="off" />
          {etiqueta && <input type="hidden" name="etiqueta" value={etiqueta} />}
          {estado && <input type="hidden" name="estado" value={estado} />}
          {plan && <input type="hidden" name="plan" value={plan} />}
          {web && <input type="hidden" name="web" value="1" />}
        </form>
        {filtros.todos + filtros.bajas > 0 && (
          <nav className="pestanas mb-3" aria-label="Filtrar por estado" data-filtro-estados>
            {/* Filtros: links comunes (recargan la lista). Con la app compilada, la navegación de <Link> a la misma
                lista con otro filtro a veces se cortaba (ERR_ABORTED) y no cambiaba nada: así siempre anda. */}
            <a href={con({ estado: null })} data-transicion className="pestana" aria-current={!estado ? "page" : undefined}>Todos <span className="texto-tenue">{filtros.todos}</span></a>
            {ESTADOS.filter(([k]) => filtros[k] > 0 || estado === k).map(([k, t]) => (
              <a key={k} href={con({ estado: estado === k ? null : k })} data-transicion className="pestana" aria-current={estado === k ? "page" : undefined} data-estado={k}>
                {t} <span className="texto-tenue">{filtros[k]}</span>
              </a>
            ))}
            {(autoaltas > 0 || web) && (
              <a href={con({ web: !web })} data-transicion className="pestana" aria-current={web ? "page" : undefined} data-filtro-web>
                <Icono nombre="web" /> Se anotaron por la web <span className="texto-tenue">{autoaltas}</span>
              </a>
            )}
          </nav>
        )}
        {(filtros.planes.length > 1 || etiquetas.length > 0) && (
          <nav className="pestanas mb-6" aria-label="Filtrar por plan o etiqueta" data-filtro-etiquetas>
            {filtros.planes.length > 1 && filtros.planes.map((p) => (
              <a key={p.plan_id} href={con({ plan: plan === p.plan_id ? null : p.plan_id })} data-transicion className="pestana" aria-current={plan === p.plan_id ? "page" : undefined} data-plan={p.plan_id}>
                <Icono nombre="lista" /> {p.nombre} <span className="texto-tenue">{p.socios}</span>
              </a>
            ))}
            {etiquetas.map((e) => (
              <a key={e.id} href={con({ etiqueta: etiqueta === e.id ? null : e.id })} data-transicion className="pestana" aria-current={etiqueta === e.id ? "page" : undefined}><Icono nombre="etiqueta" /> {e.nombre} <span className="texto-tenue">{e.socios}</span></a>
            ))}
          </nav>
        )}
        <div data-lista>
        {filas.length === 0 ? (
          filtrado && !q
            ? <Vacio icono="buscar" titulo="Nadie con ese filtro" acciones={<Link href="/panel/socios" className="boton">Ver todos</Link>}>Probá con otro, o sacá el filtro.</Vacio>
            : q
            ? <Vacio icono="buscar" titulo={`Nadie con “${q}”`} acciones={<Link href={`/panel/socios/nuevo${/^[\d.]{6,11}$/.test(q) ? `?dni=${q.replace(/\./g, "")}` : /^[\p{L} '.-]{2,60}$/u.test(q) ? `?nombre=${encodeURIComponent(q)}` : ""}`} className="boton"><Icono nombre="mas" /> Darlo de alta</Link>}>Probá con el DNI o solo el apellido.</Vacio>
            : <Vacio icono="usuarios" titulo="Todavía no hay socios" acciones={<>
                <Link href="/panel/socios/nuevo" className="boton"><Icono nombre="mas" /> Cargar el primero</Link>
                {panel.yo.rol !== "recepcion" && <Link href="/panel/socios/importar" className="boton"><Icono nombre="descargar" /> Importar de un Excel</Link>}
              </>}>Cuando cargues socios, acá vas a ver cada uno con su estado: al día, por vencer o vencido.</Vacio>
        ) : (
          <ListaSocios filas={filas} etiquetas={etiquetas.map((e) => ({ id: e.id, nombre: e.nombre }))} puedeEtiquetar={panel.yo.rol !== "profe"} />
        )}
        </div>
        {filas.length >= limite && (
          <div className="mt-4 flex flex-wrap items-center gap-3" data-mas-socios>
            <p className="texto-tenue">Se muestran {filas.length}. Buscá para encontrar a alguien en particular.</p>
            {limite < TOPE_LISTA && <a href={`${con({})}${con({}).includes("?") ? "&" : "?"}n=${limite + POR_PAGINA}`} className="boton" data-transicion>Ver {POR_PAGINA} más</a>}
          </div>
        )}
        </Atenuable>
      </>
    );
  });
}

/** Socios · Interesados (VD-15, D22). */
function PestanasSocios({ activa, nuevos }: { activa: "socios" | "interesados"; nuevos: number }) {
  return (
    <div className="mb-4" data-pestanas-socios>
      <Pestanas etiqueta="Socios e interesados" activa={activa} pestanas={[
        { clave: "socios", texto: "Socios", emoji: "usuarios", href: "/panel/socios" },
        { clave: "interesados", texto: nuevos > 0 ? `Interesados (${nuevos} nuevos)` : "Interesados", emoji: "hoja", href: "/panel/socios?vista=interesados" },
      ]} />
    </div>
  );
}
