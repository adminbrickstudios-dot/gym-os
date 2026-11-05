import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccesoPersona } from "@/components/cuentas/AccesoPersona";
import { Aviso } from "@/components/panel/Marco";
import { dominioPlataforma } from "@/lib/dominios";
import { NOMBRE_ROL, type Rol } from "@/lib/panel/secciones";
import { ErrorDatos, rpc } from "@/lib/panel/servidor";
import { BotonEntrar } from "../BotonEntrar";
import { AgregarPersona, Direcciones } from "./Formularios";
import { Historial, type Cambio } from "@/app/panel/configuracion/Historial";

export const metadata: Metadata = { title: "BRIK · Gimnasio" };

type Detalle = {
  gimnasio_id: string; slug: string; nombre: string; es_demo: boolean;
  dominios: { dominio_id: string; host: string; tipo: "subdominio" | "propio" }[];
  equipo: { equipo_id: string; nombre: string; rol: Rol; activo: boolean; es_soporte: boolean; tiene_cuenta: boolean;
            email: string | null; ultimo_ingreso: string | null; soy_yo: boolean }[];
};
const EMOJI: Record<Rol, string> = { dueno: "👑", encargado: "🧭", recepcion: "🛎️", profe: "💪" };
const fecha = (iso: string | null) => iso
  ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso))
  : "nunca";

export default async function GimnasioAdmin({ params }: { params: Promise<{ id: string }> }) {
  if ((await headers()).get("x-gymos-contexto") !== "plataforma") redirect("/");
  const { id } = await params;
  let g: Detalle, cambios: Cambio[];
  try {
    [g, cambios] = await Promise.all([
      rpc<Detalle>("admin_gimnasio", { p_gimnasio_id: id }),
      rpc<Cambio[]>("historial_configuracion", { p_gimnasio_id: id, p_limite: 20 }),
    ]);
  } catch (e) {
    if (e instanceof ErrorDatos) return <main className="min-h-dvh grid place-items-center px-4"><Aviso emoji="🔒" titulo="No se pudo abrir">{e.message}</Aviso></main>;
    throw e;
  }
  const yoSoporte = g.equipo.find((p) => p.soy_yo && p.es_soporte && p.activo);
  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-8 py-10 space-y-10">
      <header className="space-y-4">
        <Link href="/admin" className="texto-suave">← Gimnasios</Link>
        <h1 className="titular text-6xl">{g.nombre} {g.es_demo && <span className="pildora align-middle text-base">demo</span>}</h1>
        <div className="flex flex-wrap gap-2">
          <BotonEntrar gimnasioId={g.gimnasio_id} />
          <a href={`/g/${g.slug}`} target="_blank" rel="noopener noreferrer" className="boton">🌐 Ver su página</a>
          {yoSoporte && (
            <form action="/admin/salir-gimnasio" method="post">
              <input type="hidden" name="gimnasio_id" value={g.gimnasio_id} />
              <button className="boton texto-suave">🚶 Dejar de ser parte de su equipo</button>
            </form>
          )}
        </div>
      </header>

      <section className="space-y-3">
        <p className="titulo-grupo">Equipo y claves</p>
        <p className="texto-suave">Si alguien se olvidó la contraseña, generale una nueva y pasásela. Entra en {dominioPlataforma() || "la dirección de Gym OS"}, con “Entrá a tu gimnasio”.</p>
        <ul className="space-y-2">
          {g.equipo.map((p) => (
            <li key={p.equipo_id} className={`tarjeta p-4 flex flex-wrap items-center gap-4 ${p.activo ? "" : "opacity-50"}`}>
              <span className="icono" aria-hidden>{p.es_soporte ? "🧱" : EMOJI[p.rol]}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-lg">{p.nombre}{p.soy_yo && <span className="texto-tenue font-normal"> · vos</span>}</span>
                <span className="block texto-suave text-sm break-all">
                  {p.es_soporte ? "Acceso de soporte (dueño)" : NOMBRE_ROL[p.rol]}
                  {p.tiene_cuenta ? ` · ${p.email ?? "sin mail"} · último ingreso ${fecha(p.ultimo_ingreso)}` : " · sin acceso al sistema"}
                  {!p.activo && " · desactivado"}
                </span>
              </span>
              {!p.es_soporte && p.activo && <AccesoPersona equipoId={p.equipo_id} nombre={p.nombre} tieneCuenta={p.tiene_cuenta} />}
            </li>
          ))}
        </ul>
        <AgregarPersona gimnasioId={g.gimnasio_id} />
      </section>

      <section className="space-y-3">
        <p className="titulo-grupo">Direcciones</p>
        <Direcciones gimnasioId={g.gimnasio_id} dominios={g.dominios} />
      </section>

      <section className="space-y-3" data-admin-cambios>
        <p className="titulo-grupo">Últimos cambios de configuración</p>
        <Historial cambios={cambios} />
      </section>
    </main>
  );
}
