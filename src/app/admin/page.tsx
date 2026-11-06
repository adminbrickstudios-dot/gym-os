import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Aviso } from "@/components/panel/Marco";
import { dominioBase } from "@/lib/dominios";
import { formatearNumero, formatearPesos } from "@/lib/formato";
import { ErrorDatos, rpc, type MiSesion } from "@/lib/panel/servidor";
import { CambiarContrasena } from "@/app/panel/cuenta/CambiarContrasena";
import { AltaGimnasio } from "./AltaGimnasio";
import { BotonEntrar } from "./BotonEntrar";
import { EstadoPlataforma } from "./EstadoPlataforma";
import { NovedadesDuenos, type NovedadPlataforma } from "./NovedadesDuenos";
import { PildoraAbono, PlanesBrik, type EstadoAbono, type PlanBrik } from "./Abono";
import { Mensaje } from "@/components/ui/Mensaje";
import { Ayudas, type PedidoAyuda } from "./Ayudas";
import { Metricas, type MetricasPlataforma } from "./Metricas";
import { PedidosDemo, type PedidoDemo } from "./PedidosDemo";

export const metadata: Metadata = { title: "BRIK · Gimnasios" };
type Gimnasio = {
  gimnasio_id: string; slug: string; nombre: string; es_demo: boolean; suspendido: boolean; hosts: string[];
  socios: number; socios_al_dia: number; ingresos_7_dias: number; duenos: string[]; duenos_sin_cuenta: number; estoy_dentro: boolean;
};

// ADM-4: cómo viene cada gimnasio.
type Salud = { ultimo_acceso_equipo: string | null; ventas_7_dias: number; cobrado_7_dias: number; entradas_7_dias: number; sin_uso: boolean };
// VD-40: el color de cada gimnasio y por qué (se calcula en la base, nunca se guarda).
type SaludV2 = { color: "rojo" | "amarillo" | "verde"; orden: number; puntaje: number; motivos: string[]; ayudas_pendientes: number };
const COLOR: Record<SaludV2["color"], [string, string]> = { rojo: ["🔴 Urgente", "pildora-rojo"], amarillo: ["🟡 Atención", "pildora-amarillo"], verde: ["🟢 Todo bien", "pildora-verde"] };
const FILTROS: [string, string][] = [["todos", "Todos"], ["atencion", "Necesitan atención"], ["rojo", "Urgentes"], ["amarillo", "Atención"], ["verde", "Todo bien"]];
const sinTildes = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const hace = (m: string | null) => { if (!m) return "nunca"; const d = Math.floor((Date.now() - new Date(m).getTime()) / 86400000); return d <= 0 ? "hoy" : d === 1 ? "ayer" : `hace ${d} días`; };

// El super admin de BRIK: vive en el dominio de la plataforma, no en el de un gimnasio.
export default async function Admin({ searchParams }: { searchParams: Promise<{ error?: string; filtro?: string; q?: string }> }) {
  if ((await headers()).get("x-gymos-contexto") !== "plataforma") redirect("/");
  const { error, filtro: filtroPedido, q: busqueda } = await searchParams;
  const filtro = FILTROS.some(([k]) => k === filtroPedido) ? filtroPedido! : "todos";
  const q = sinTildes((busqueda ?? "").slice(0, 60).trim());
  let gimnasios: Gimnasio[];
  let salud: Record<string, Salud> = {};
  let saludV2: Record<string, SaludV2>;
  let metricas: MetricasPlataforma;
  let ayudas: PedidoAyuda[];
  let pedidosDemo: PedidoDemo[] = [];
  let novedades: NovedadPlataforma[] = [];
  let abonos: Record<string, EstadoAbono> = {};
  let planesBrik: PlanBrik[] = [];
  let yo: MiSesion;
  try {
    yo = await rpc<MiSesion>("mi_sesion");
    if (!yo.es_admin) throw new ErrorDatos("Solo para administradores de BRIK", "42501", 403);
    [gimnasios, salud, novedades, abonos, planesBrik, saludV2, metricas, ayudas] = await Promise.all([rpc<Gimnasio[]>("admin_gimnasios"), rpc<Record<string, Salud>>("admin_salud_gimnasios"),
      rpc<NovedadPlataforma[]>("admin_novedades"), rpc<Record<string, EstadoAbono>>("admin_abonos"), rpc<PlanBrik[]>("admin_planes_brik"),
      rpc<Record<string, SaludV2>>("admin_salud_v2"), rpc<MetricasPlataforma>("admin_metricas"), rpc<PedidoAyuda[]>("admin_ayudas", { p_pendientes: true })]);
    pedidosDemo = await rpc<PedidoDemo[]>("admin_pedidos_demo", { p_pendientes: true });
  } catch (e) {
    if (e instanceof ErrorDatos) return <main className="min-h-dvh grid place-items-center px-4"><Aviso emoji="🔒" titulo="Sin acceso">{e.message}</Aviso></main>;
    throw e;
  }
  const reales = gimnasios.filter((g) => !g.es_demo);
  // Los que necesitan atención primero: rojo, amarillo, verde y el demo al final; dentro de cada grupo, los de más motivos.
  const sv = (g: Gimnasio): SaludV2 => saludV2[g.gimnasio_id] ?? { color: "verde", orden: 2, puntaje: 0, motivos: [], ayudas_pendientes: 0 };
  const cuentas = { atencion: reales.filter((g) => sv(g).color !== "verde").length, rojo: reales.filter((g) => sv(g).color === "rojo").length,
    amarillo: reales.filter((g) => sv(g).color === "amarillo").length, verde: reales.filter((g) => sv(g).color === "verde").length };
  const visibles = gimnasios
    .filter((g) => (filtro === "todos" ? true : g.es_demo ? false : filtro === "atencion" ? sv(g).color !== "verde" : sv(g).color === filtro))
    .filter((g) => !q || sinTildes(`${g.nombre} ${g.slug}`).includes(q))
    .sort((a, b) => sv(a).orden - sv(b).orden || sv(b).puntaje - sv(a).puntaje || a.nombre.localeCompare(b.nombre));
  const enlaceFiltro = (k: string) => `/admin?filtro=${k}${q ? `&q=${encodeURIComponent(busqueda ?? "")}` : ""}`;
  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-8 py-10 space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-4xl mb-3" aria-hidden>🧱</p>
          <h1 className="titular text-6xl">Gimnasios</h1>
          <p className="texto-suave text-lg mt-2">{reales.length} {reales.length === 1 ? "gimnasio" : "gimnasios"} · {formatearNumero(reales.reduce((s, g) => s + g.socios_al_dia, 0))} socios al día</p>
        </div>
        <div className="flex gap-2">
          <form action="/salir" method="post"><button className="boton">🚪 Salir</button></form>
        </div>
      </header>

      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <Ayudas pedidos={ayudas} />
      <PedidosDemo pedidos={pedidosDemo} />
      <Metricas m={metricas} />
      <EstadoPlataforma />
      <AltaGimnasio dominio={dominioBase()} />
      <NovedadesDuenos novedades={novedades} />
      <PlanesBrik planes={planesBrik} />

      <section className="space-y-3">
        <p className="titulo-grupo">Todos los gimnasios</p>
        <div className="flex flex-wrap items-center gap-2" data-filtros>
          {FILTROS.map(([k, t]) => (
            <Link key={k} href={enlaceFiltro(k)} aria-current={filtro === k ? "true" : undefined} data-filtro={k}
              className={`boton ${filtro === k ? "!border-[var(--acento,#16a34a)]" : "texto-suave"}`}>
              {t}{k === "atencion" || k === "rojo" || k === "amarillo" || k === "verde" ? ` (${cuentas[k]})` : ""}
            </Link>
          ))}
          <form action="/admin" className="flex gap-2 flex-1 min-w-[14rem]">
            <input type="hidden" name="filtro" value={filtro} />
            <input name="q" defaultValue={busqueda ?? ""} className="campo flex-1" placeholder="Buscar por nombre…" aria-label="Buscar gimnasio" />
            <button className="boton">🔎</button>
          </form>
        </div>
        {gimnasios.length === 0 && <p className="texto-suave">Todavía no hay gimnasios. Creá el primero acá arriba.</p>}
        {gimnasios.length > 0 && visibles.length === 0 && (
          <p className="texto-suave" data-sin-resultados>Ningún gimnasio con ese filtro. {filtro === "atencion" ? "Todo anda bien." : <Link href="/admin" className="underline">Ver todos</Link>}</p>
        )}
        <ul className="space-y-2">
          {visibles.map((g) => (
            <li key={g.gimnasio_id} className="tarjeta p-5 space-y-4" data-gimnasio-color={g.es_demo ? "demo" : sv(g).color}>
              <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
                <div className="min-w-0 flex-1">
                  <p className="titulo text-2xl">
                    {g.nombre} {g.es_demo && <span className="pildora align-middle">demo</span>}{" "}
                    {!g.es_demo && <><span className={`pildora ${COLOR[sv(g).color][1]} align-middle`} data-color={sv(g).color}>{COLOR[sv(g).color][0]}</span>{" "}</>}
                    {g.suspendido && <span className="pildora pildora-rojo align-middle">suspendido</span>}{" "}
                    {g.estoy_dentro && <span className="pildora pildora-verde align-middle">estás adentro</span>}{" "}
                    <PildoraAbono a={abonos[g.gimnasio_id]} />
                  </p>
                  <p className="texto-suave text-sm mt-1">
                    👑 {g.duenos.join(", ") || "Sin dueño"}
                    {g.duenos_sin_cuenta > 0 && <span className="pildora pildora-amarillo ml-2">{g.duenos_sin_cuenta === 1 ? "el dueño no tiene acceso" : `${g.duenos_sin_cuenta} dueños sin acceso`}</span>}
                  </p>
                  {!g.es_demo && sv(g).motivos.length > 0 && <p className="texto-suave text-sm mt-1" data-motivos>⚑ {sv(g).motivos.join(" · ")}</p>}
                  <p className="texto-tenue text-sm mt-1 break-all">🌐 {g.hosts.join(" · ")}</p>
                  {salud[g.gimnasio_id] && (
                    <p className="texto-suave text-sm mt-1" data-salud>
                      🩺 El equipo entró {hace(salud[g.gimnasio_id].ultimo_acceso_equipo)} · {salud[g.gimnasio_id].ventas_7_dias} ventas en 7 días ({formatearPesos(salud[g.gimnasio_id].cobrado_7_dias)})
                      {salud[g.gimnasio_id].sin_uso && !g.es_demo && <span className="pildora pildora-rojo ml-2">Dejó de usarse</span>}
                    </p>
                  )}
                </div>
                <dl className="flex gap-6">
                  <div><dd className="numero text-3xl">{formatearNumero(g.socios)}</dd><dt className="text-sm texto-tenue">socios</dt></div>
                  <div><dd className="numero text-3xl">{formatearNumero(g.socios_al_dia)}</dd><dt className="text-sm texto-tenue">al día</dt></div>
                  <div><dd className="numero text-3xl">{formatearNumero(g.ingresos_7_dias)}</dd><dt className="text-sm texto-tenue">entradas 7 días</dt></div>
                </dl>
              </div>
              <div className="flex flex-wrap gap-2">
                <BotonEntrar gimnasioId={g.gimnasio_id} principal={false} />
                <Link href={`/admin/${g.gimnasio_id}`} className="boton">⚙️ Equipo, claves y direcciones</Link>
                <a href={`/g/${g.slug}`} target="_blank" rel="noopener noreferrer" className="boton">🌐 Ver su página</a>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <p className="titulo-grupo">Mi cuenta</p>
        <CambiarContrasena />
      </section>
    </main>
  );
}
