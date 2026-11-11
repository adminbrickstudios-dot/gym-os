import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Aviso } from "@/components/panel/Marco";
import { formatearNumero } from "@/lib/formato";
import { enlacesPorRol, haceCuanto, nombreAbono, whatsappDueno, type FilaGimnasio } from "@/lib/admin/lista";
import { ErrorDatos, rpc } from "@/lib/panel/servidor";
import { BotonEntrar } from "../BotonEntrar";
import { Favorito } from "./Favorito";

export const metadata: Metadata = { title: "BRIK · Lista de gimnasios" };
const SALUD = [["rojo", "Urgente"], ["amarillo", "Atención"], ["verde", "Todo bien"]] as const;
const ABONO = [["al_dia", "Al día"], ["por_vencer", "Por vencer"], ["vencido", "Vencido"], ["sin_abono", "Sin abono / prueba"]] as const;
const PILDORA = { rojo: "pildora-rojo", amarillo: "pildora-amarillo", verde: "pildora-verde" } as const;
type Parametros = { q?: string; salud?: string; abono?: string; plan?: string; desde?: string; hasta?: string; ciudad?: string; modulo?: string; bajas?: string };
const MODULOS = [["clases", "Clases"], ["caja", "Caja"], ["vender", "Vender"], ["rutinas", "Rutinas"], ["retencion", "Retención"], ["transferencias", "Transferencias"], ["pt", "Turnos de entrenador"]] as const;
const fechaValida = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

/** SA-2: la lista de gimnasios con buscador, filtros, favoritos y botones directos por fila. */
export default async function ListaGimnasios({ searchParams }: { searchParams: Promise<Parametros> }) {
  if ((await headers()).get("x-gymos-contexto") !== "plataforma") redirect("/");
  const p = await searchParams;
  const args = {
    p_q: p.q?.slice(0, 80) || null,
    p_salud: SALUD.some(([k]) => k === p.salud) ? p.salud : null,
    p_abono: ABONO.some(([k]) => k === p.abono) ? p.abono : null,
    p_plan: p.plan?.slice(0, 60) || null,
    p_alta_desde: fechaValida(p.desde), p_alta_hasta: fechaValida(p.hasta),
    p_ciudad: p.ciudad?.slice(0, 80) || null,
    p_modulo: MODULOS.some(([k]) => k === p.modulo) ? p.modulo : null,
    p_con_bajas: p.bajas === "1",
  };
  let filas: FilaGimnasio[];
  try { filas = await rpc<FilaGimnasio[]>("admin_lista_gimnasios", args); }
  catch (e) {
    if (e instanceof ErrorDatos) return <main className="min-h-dvh grid place-items-center px-4"><Aviso icono="candado" titulo="Sin acceso">{e.message}</Aviso></main>;
    throw e;
  }
  // U1: los gimnasios cuyo alta quedó a medias (el dueño todavía no tiene cuenta).
  const sinAcceso = new Set((await rpc<{ gimnasio_id: string; duenos_sin_cuenta: number }[]>("admin_gimnasios").catch(() => [])).filter((x) => x.duenos_sin_cuenta > 0).map((x) => x.gimnasio_id));
  const exportar = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]).toString();
  const hayFiltro = Object.values(args).some((v) => v);
  const ciudades = [...new Set(filas.map((f) => f.ciudad).filter((c): c is string => !!c))];
  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-8 py-10 space-y-6">
      <header className="space-y-2">
        <Link href="/admin" className="texto-suave">← Tablero</Link>
        <h1 className="titular text-5xl">Gimnasios</h1>
        <p className="texto-suave">{formatearNumero(filas.length)} {filas.length === 1 ? "gimnasio" : "gimnasios"}{hayFiltro ? " con estos filtros" : ""}</p>
      </header>

      <form action="/admin/gimnasios" className="tarjeta p-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6 items-end" data-filtros-lista>
        <label className="space-y-1 sm:col-span-3 lg:col-span-2"><span className="etiqueta">Buscar (nombre, dominio, dueño, mail o celular)</span>
          <input name="q" defaultValue={p.q ?? ""} className="campo" maxLength={80} /></label>
        <label className="space-y-1"><span className="etiqueta">Salud</span>
          <select name="salud" defaultValue={args.p_salud ?? ""} className="campo"><option value="">Todas</option>{SALUD.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
        <label className="space-y-1"><span className="etiqueta">Abono</span>
          <select name="abono" defaultValue={args.p_abono ?? ""} className="campo"><option value="">Todos</option>{ABONO.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
        <label className="space-y-1"><span className="etiqueta">Plan de BRIK</span><input name="plan" defaultValue={p.plan ?? ""} className="campo" maxLength={60} /></label>
        <label className="space-y-1"><span className="etiqueta">Alta desde</span><input type="date" name="desde" defaultValue={args.p_alta_desde ?? ""} className="campo" /></label>
        <label className="space-y-1"><span className="etiqueta">Alta hasta</span><input type="date" name="hasta" defaultValue={args.p_alta_hasta ?? ""} className="campo" /></label>
        <label className="space-y-1"><span className="etiqueta">Ciudad</span>
          <input name="ciudad" list="ciudades" defaultValue={p.ciudad ?? ""} className="campo" maxLength={80} /><datalist id="ciudades">{ciudades.map((c) => <option key={c} value={c} />)}</datalist></label>
        <label className="space-y-1"><span className="etiqueta">Tiene prendido</span>
          <select name="modulo" defaultValue={args.p_modulo ?? ""} className="campo"><option value="">Cualquier módulo</option>{MODULOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
        <label className="flex items-center gap-2 sm:col-span-3 lg:col-span-2"><input type="checkbox" name="bajas" value="1" defaultChecked={p.bajas === "1"} /><span>Mostrar los dados de baja (papelera)</span></label>
        <div className="flex gap-2 sm:col-span-3 lg:col-span-6">
          <button className="boton boton-principal">Filtrar</button>
          {hayFiltro && <Link href="/admin/gimnasios" className="boton texto-suave">Quitar filtros</Link>}
          <a href={`/admin/gimnasios/exportar${exportar ? `?${exportar}` : ""}`} className="boton" data-exportar>Exportar CSV</a>
        </div>
      </form>

      {filas.length === 0 && <p className="texto-suave" data-sin-resultados>{hayFiltro ? "Ningún gimnasio con esos filtros. " : "Todavía no hay gimnasios. "}
        {hayFiltro ? <Link href="/admin/gimnasios" className="underline">Ver todos</Link> : <Link href="/admin" className="underline">Creá el primero</Link>}</p>}

      <ul className="space-y-2">
        {filas.map((g) => {
          const wa = whatsappDueno(g.dueno_telefono, `Hola ${g.dueno ?? ""}, te escribo de BRIK por ${g.nombre}.`);
          const links = enlacesPorRol(g.hosts[0]);
          return (
            <li key={g.gimnasio_id} className="tarjeta p-4 space-y-3" data-gimnasio-fila data-color={g.es_demo ? "demo" : g.color}>
              <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
                <Favorito gimnasioId={g.gimnasio_id} favorito={g.favorito} />
                <div className="min-w-0 flex-1">
                  <p className="titulo text-xl">
                    {g.nombre} {g.es_demo && <span className="pildora align-middle">demo</span>}{" "}
                    {!g.es_demo && <span className={`pildora ${PILDORA[g.color]} align-middle`}>{SALUD.find(([k]) => k === g.color)?.[1]}</span>}{" "}
                    {g.suspendido && !g.para_borrar && <span className="pildora pildora-rojo align-middle">pausado</span>}{" "}
                    {g.para_borrar && <span className="pildora pildora-rojo align-middle">para borrar</span>}{" "}
                    {sinAcceso.has(g.gimnasio_id) && <Link href={`/admin/${g.gimnasio_id}`} className="pildora pildora-amarillo align-middle" data-terminar-alta>Terminar alta: dar acceso al dueño</Link>}{" "}
                    {g.demo_vencida && <span className="pildora pildora-amarillo align-middle">demo vencida</span>}{" "}
                    <span className="pildora align-middle" data-abono={g.abono}>{nombreAbono(g.abono)}{g.plan ? ` · ${g.plan}` : ""}</span>
                  </p>
                  <p className="texto-suave text-sm mt-1">{g.ciudad ? `${g.ciudad} · ` : ""}Dueño: {g.dueno ?? "sin dueño"} · {g.hosts[0] ?? "sin dirección"}</p>
                  {!g.es_demo && g.motivos.length > 0 && <p className="texto-suave text-sm mt-1">{g.motivos.join(" · ")}</p>}
                </div>
                <dl className="flex gap-5 text-right">
                  <div><dd className="numero text-2xl">{formatearNumero(g.socios_activos)}</dd><dt className="text-xs texto-tenue">socios activos</dt></div>
                  <div><dd className="numero text-2xl">{formatearNumero(g.entradas_hoy)}</dd><dt className="text-xs texto-tenue">entradas hoy</dt></div>
                  <div><dd className="text-sm" title={g.ultimo_uso ? new Date(g.ultimo_uso).toLocaleString("es-AR") : undefined}>{haceCuanto(g.ultimo_uso)}</dd><dt className="text-xs texto-tenue">último uso</dt></div>
                </dl>
              </div>
              <div className="flex flex-wrap gap-2">
                <BotonEntrar gimnasioId={g.gimnasio_id} principal={false} texto="Entrar como soporte" />
                <Link href={`/admin/${g.gimnasio_id}`} className="boton">Ficha</Link>
                {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="boton">WhatsApp al dueño</a>}
                {links.length > 0 && (
                  <details className="boton !p-0">
                    <summary className="cursor-pointer px-4 py-2">Links por rol</summary>
                    <ul className="p-3 space-y-1 text-sm">{links.map((l) => <li key={l.rol}>{l.nombre}: <span className="break-all select-all">{l.url}</span></li>)}</ul>
                  </details>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
