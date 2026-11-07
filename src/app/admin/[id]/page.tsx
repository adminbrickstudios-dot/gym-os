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
import { AbonoGimnasio, type EstadoAbono, type PlanBrik } from "../Abono";
import { Historial, type Cambio } from "@/app/panel/configuracion/Historial";
import { Notas, type NotaBrik } from "./Notas";

type SaludFicha = { color: "rojo" | "amarillo" | "verde"; motivos: string[]; ultimo_acceso_equipo: string | null; ayudas_pendientes: number };
type Semana = { desde: string; entradas: number; ventas: number; socios_nuevos: number };
type Soporte = { id: string; quien: string; motivo: string; entro_en: string; vence_en: string; salio_en: string | null; en_curso: boolean };
const COLOR = { rojo: ["🔴 Urgente", "pildora-rojo"], amarillo: ["🟡 Atención", "pildora-amarillo"], verde: ["🟢 Todo bien", "pildora-verde"] } as const;
const diaCorto = (d: string) => new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

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
  let g: Detalle, cambios: Cambio[], abonos: Record<string, EstadoAbono>, planes: PlanBrik[];
  let saludTodos: Record<string, SaludFicha>, semanas: Semana[], soportes: Soporte[], notas: NotaBrik[];
  try {
    [g, cambios, abonos, planes, saludTodos, semanas, soportes, notas] = await Promise.all([
      rpc<Detalle>("admin_gimnasio", { p_gimnasio_id: id }),
      rpc<Cambio[]>("historial_configuracion", { p_gimnasio_id: id, p_limite: 20 }),
      rpc<Record<string, EstadoAbono>>("admin_abonos"),
      rpc<PlanBrik[]>("admin_planes_brik"),
      rpc<Record<string, SaludFicha>>("admin_salud_v2"),
      rpc<Semana[]>("admin_uso_semanal", { p_gimnasio_id: id }),
      rpc<Soporte[]>("admin_soportes", { p_gimnasio_id: id, p_limite: 20 }),
      rpc<NotaBrik[]>("admin_notas", { p_gimnasio_id: id }),
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

      {saludTodos[g.gimnasio_id] && !g.es_demo && (
        <section className="space-y-3" data-ficha-salud>
          <p className="titulo-grupo">Cómo viene</p>
          <div className="tarjeta p-5 space-y-3">
            <p><span className={`pildora ${COLOR[saludTodos[g.gimnasio_id].color][1]}`} data-color={saludTodos[g.gimnasio_id].color}>{COLOR[saludTodos[g.gimnasio_id].color][0]}</span></p>
            {saludTodos[g.gimnasio_id].motivos.length > 0
              ? <div className="space-y-1">{saludTodos[g.gimnasio_id].motivos.map((m) => <p key={m} className="texto-suave">⚑ {m}</p>)}</div>
              : <p className="texto-suave">Usa el panel, entra gente y el abono está al día.</p>}
            <p className="texto-tenue text-sm">Último ingreso del equipo: {fecha(saludTodos[g.gimnasio_id].ultimo_acceso_equipo)}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-uso-semanal>
            {semanas.map((s) => (
              <div key={s.desde} className="tarjeta p-4">
                <p className="texto-tenue text-sm">Semana del {diaCorto(s.desde)}</p>
                <p className="numero text-2xl">{s.entradas}</p><p className="texto-tenue text-sm">entradas</p>
                <p className="texto-suave text-sm mt-1">{s.ventas} cobros · {s.socios_nuevos} socios nuevos</p>
              </div>
            ))}
          </div>
        </section>
      )}

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

      {abonos[g.gimnasio_id] && !g.es_demo && <AbonoGimnasio gimnasioId={g.gimnasio_id} abono={abonos[g.gimnasio_id]} planes={planes} />}

      <section className="space-y-3" data-admin-soportes>
        <p className="titulo-grupo">Entradas de Soporte BRIK</p>
        <p className="texto-suave">Cada vez que alguien de BRIK entra a este gimnasio queda escrito quién, por qué y cuándo. El dueño lo ve en su Control.</p>
        {soportes.length === 0 ? <p className="texto-tenue">Nadie de BRIK entró todavía.</p> : (
          <div className="space-y-2">
            {soportes.map((s) => (
              <div key={s.id} className="tarjeta p-4" data-soporte={s.en_curso ? "en-curso" : "cerrado"}>
                <p className="font-semibold break-words">{s.motivo}</p>
                <p className="texto-suave text-sm break-all">{s.quien} · entró {fecha(s.entro_en)}{s.en_curso ? ` · adentro hasta ${fecha(s.vence_en)}` : ` · salió ${fecha(s.salio_en)}`}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <p className="titulo-grupo">Notas internas de BRIK</p>
        <Notas gimnasioId={g.gimnasio_id} notas={notas} />
      </section>

      <section className="space-y-3" data-admin-cambios>
        <p className="titulo-grupo">Últimos cambios de configuración</p>
        <Historial cambios={cambios} />
      </section>
    </main>
  );
}
