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
import { Mensaje } from "@/components/ui/Mensaje";

export const metadata: Metadata = { title: "BRIK · Gimnasios" };
type Gimnasio = {
  gimnasio_id: string; slug: string; nombre: string; es_demo: boolean; suspendido: boolean; hosts: string[];
  socios: number; socios_al_dia: number; ingresos_7_dias: number; duenos: string[]; duenos_sin_cuenta: number; estoy_dentro: boolean;
};

// ADM-4: cómo viene cada gimnasio.
type Salud = { ultimo_acceso_equipo: string | null; ventas_7_dias: number; cobrado_7_dias: number; entradas_7_dias: number; sin_uso: boolean };
const hace = (m: string | null) => { if (!m) return "nunca"; const d = Math.floor((Date.now() - new Date(m).getTime()) / 86400000); return d <= 0 ? "hoy" : d === 1 ? "ayer" : `hace ${d} días`; };

// El super admin de BRIK: vive en el dominio de la plataforma, no en el de un gimnasio.
export default async function Admin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if ((await headers()).get("x-gymos-contexto") !== "plataforma") redirect("/");
  const { error } = await searchParams;
  let gimnasios: Gimnasio[];
  let salud: Record<string, Salud> = {};
  let novedades: NovedadPlataforma[] = [];
  let yo: MiSesion;
  try {
    yo = await rpc<MiSesion>("mi_sesion");
    if (!yo.es_admin) throw new ErrorDatos("Solo para administradores de BRIK", "42501", 403);
    [gimnasios, salud, novedades] = await Promise.all([rpc<Gimnasio[]>("admin_gimnasios"), rpc<Record<string, Salud>>("admin_salud_gimnasios"), rpc<NovedadPlataforma[]>("admin_novedades")]);
  } catch (e) {
    if (e instanceof ErrorDatos) return <main className="min-h-dvh grid place-items-center px-4"><Aviso emoji="🔒" titulo="Sin acceso">{e.message}</Aviso></main>;
    throw e;
  }
  const reales = gimnasios.filter((g) => !g.es_demo);
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
      <EstadoPlataforma />
      <AltaGimnasio dominio={dominioBase()} />
      <NovedadesDuenos novedades={novedades} />

      <section className="space-y-3">
        <p className="titulo-grupo">Todos los gimnasios</p>
        {gimnasios.length === 0 && <p className="texto-suave">Todavía no hay gimnasios. Creá el primero acá arriba.</p>}
        <ul className="space-y-2">
          {gimnasios.map((g) => (
            <li key={g.gimnasio_id} className="tarjeta p-5 space-y-4">
              <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
                <div className="min-w-0 flex-1">
                  <p className="titulo text-2xl">
                    {g.nombre} {g.es_demo && <span className="pildora align-middle">demo</span>}{" "}
                    {g.suspendido && <span className="pildora pildora-rojo align-middle">suspendido</span>}{" "}
                    {g.estoy_dentro && <span className="pildora pildora-verde align-middle">estás adentro</span>}
                  </p>
                  <p className="texto-suave text-sm mt-1">
                    👑 {g.duenos.join(", ") || "Sin dueño"}
                    {g.duenos_sin_cuenta > 0 && <span className="pildora pildora-amarillo ml-2">{g.duenos_sin_cuenta === 1 ? "el dueño no tiene acceso" : `${g.duenos_sin_cuenta} dueños sin acceso`}</span>}
                  </p>
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
                <BotonEntrar gimnasioId={g.gimnasio_id} />
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
