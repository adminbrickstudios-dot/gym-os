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
import { CambiarDueno, CambiarSlug, LinksPorRol, Modulos } from "./FichaExtra";
import { enlacesPorRol, whatsappDueno, type FilaGimnasio } from "@/lib/admin/lista";
import { Ciudad, CicloDeVida, QrGimnasio } from "./FichaGestion";
import { AbonoExtra, BorrarDefinitivo, Clonar, Papelera, Reprocesar, type EnPapelera } from "./FichaAvanzada";

type SaludFicha = { color: "rojo" | "amarillo" | "verde"; motivos: string[]; ultimo_acceso_equipo: string | null; ayudas_pendientes: number };
type Semana = { desde: string; entradas: number; ventas: number; socios_nuevos: number };
type FichaExtraDatos = {
  zona_horaria: string; secciones_apagadas: string[]; secciones_validas: string[]; ultimo_webhook: string | null;
  webhooks_fallidos: { id: string; tipo: string; recibido_en: string; intentos: number; error: string | null }[];
  registro: { accion: string; quien: string; detalle: Record<string, unknown>; cuando: string }[];
};
const ACCION: Record<string, string> = { entrar_como_soporte: "Entró como soporte", cambiar_dueno: "Cambió el dueño", guardar_modulos: "Cambió los módulos", cambiar_slug: "Cambió el slug", buscar_persona: "Buscó a una persona", guardar_ciudad: "Cambió la ciudad", pausar_gimnasio: "Pausó el gimnasio", reanudar_gimnasio: "Reanudó el gimnasio", dar_de_baja: "Dio de baja el gimnasio", restaurar_baja: "Restauró el gimnasio", exportar_gimnasio: "Exportó el gimnasio", exportar_socio: "Exportó los datos de un socio", borrar_socio: "Borró los datos de un socio" };
type PasoLanzamiento = { clave: string; titulo: string; falta: string; hecho: boolean };
type ErrorPantalla = { pantalla: string; cantidad: number; ultimo: string; mensaje: string };
type Soporte = { id: string; quien: string; motivo: string; rol?: string; entro_en: string; vence_en: string; salio_en: string | null; en_curso: boolean };
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
  let saludTodos: Record<string, SaludFicha>, semanas: Semana[], soportes: Soporte[], notas: NotaBrik[], extra: FichaExtraDatos, lanzamiento: PasoLanzamiento[], errores: ErrorPantalla[], papelera: EnPapelera, linkPago: string | null, otros: { gimnasio_id: string; nombre: string }[];
  try {
    [g, cambios, abonos, planes, saludTodos, semanas, soportes, notas, extra, lanzamiento, errores, papelera, linkPago, otros] = await Promise.all([
      rpc<Detalle>("admin_gimnasio", { p_gimnasio_id: id }),
      rpc<Cambio[]>("historial_configuracion", { p_gimnasio_id: id, p_limite: 20 }),
      rpc<Record<string, EstadoAbono>>("admin_abonos"),
      rpc<PlanBrik[]>("admin_planes_brik"),
      rpc<Record<string, SaludFicha>>("admin_salud_v2"),
      rpc<Semana[]>("admin_uso_semanal", { p_gimnasio_id: id }),
      rpc<Soporte[]>("admin_soportes", { p_gimnasio_id: id, p_limite: 20 }),
      rpc<NotaBrik[]>("admin_notas", { p_gimnasio_id: id }),
      rpc<FichaExtraDatos>("admin_ficha_extra", { p_gimnasio_id: id }),
      rpc<PasoLanzamiento[]>("admin_lanzamiento", { p_gimnasio_id: id }),
      rpc<ErrorPantalla[]>("admin_errores", { p_gimnasio_id: id, p_horas: 168 }),
      rpc<EnPapelera>("admin_papelera", { p_gimnasio_id: id }),
      rpc<string | null>("admin_link_pago"),
      rpc<{ gimnasio_id: string; nombre: string }[]>("admin_gimnasios"),
    ]);
  } catch (e) {
    if (e instanceof ErrorDatos) return <main className="min-h-dvh grid place-items-center px-4"><Aviso emoji="🔒" titulo="No se pudo abrir">{e.message}</Aviso></main>;
    throw e;
  }
  const fila = (await rpc<FilaGimnasio[]>("admin_lista_gimnasios", { p_q: g.slug, p_con_bajas: true }).catch(() => [] as FilaGimnasio[])).find((x) => x.gimnasio_id === g.gimnasio_id);
  const wa = fila ? whatsappDueno(fila.dueno_telefono, `Hola ${fila.dueno ?? ""}, te escribo de BRIK por ${g.nombre}.`) : null;
  const yoSoporte = g.equipo.find((p) => p.soy_yo && p.es_soporte && p.activo);
  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-8 py-10 space-y-10">
      <header className="space-y-4" id="entrar">
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
        <p className="texto-suave">Si alguien se olvidó la contraseña, generale una nueva y pasásela. Entra en {dominioPlataforma() || "la dirección de Base"}, con “Entrá a tu gimnasio”.</p>
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
        <CambiarDueno gimnasioId={g.gimnasio_id} candidatos={g.equipo.filter((p) => p.activo && !p.es_soporte && p.rol !== "dueno").map((p) => ({ equipo_id: p.equipo_id, nombre: p.nombre }))} />
      </section>

      <section className="space-y-3" data-ficha-datos>
        <p className="titulo-grupo">Datos</p>
        <p className="texto-suave">Zona horaria: {extra.zona_horaria}. El resto de los datos del gimnasio los cambia su dueño, o BRIK entrando como soporte.</p>
        <Ciudad gimnasioId={g.gimnasio_id} ciudad={fila?.ciudad ?? null} />
        <CambiarSlug gimnasioId={g.gimnasio_id} slug={g.slug} />
      </section>

      {!g.es_demo && (
        <section className="space-y-3" data-ficha-lanzamiento>
          <p className="titulo-grupo">Lista de lanzamiento</p>
          <ul className="space-y-2">
            {lanzamiento.map((p) => (
              <li key={p.clave} className="tarjeta p-3 flex flex-wrap items-center gap-3" data-paso={p.clave} data-hecho={p.hecho ? "si" : "no"}>
                <span className={`pildora ${p.hecho ? "pildora-verde" : "pildora-amarillo"}`}>{p.hecho ? "Hecho" : "Falta"}</span>
                <span className="min-w-0 flex-1"><span className="block font-semibold">{p.titulo}</span>{!p.hecho && <span className="block texto-suave text-sm">{p.falta}</span>}</span>
                {!p.hecho && wa && <a className="boton" target="_blank" rel="noopener noreferrer" href={`${wa}${encodeURIComponent(` Te falta: ${p.titulo.toLowerCase()}. ${p.falta}.`)}`}>Avisarle por WhatsApp</a>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3" data-ficha-papelera>
        <p className="titulo-grupo">Papelera (30 días)</p>
        <Papelera gimnasioId={g.gimnasio_id} papelera={papelera} />
        <p className="titulo-grupo">Copiar la configuración de otro gimnasio</p>
        <Clonar destino={g.gimnasio_id} otros={otros.filter((o) => o.gimnasio_id !== g.gimnasio_id).map((o) => ({ id: o.gimnasio_id, nombre: o.nombre }))} />
      </section>

      <section className="space-y-3" data-ficha-ciclo>
        <p className="titulo-grupo">Pausar o dar de baja</p>
        <CicloDeVida gimnasioId={g.gimnasio_id} nombre={g.nombre} pausado={!!fila?.suspendido} paraBorrar={!!fila?.para_borrar} />
        {fila?.para_borrar && <BorrarDefinitivo gimnasioId={g.gimnasio_id} nombre={g.nombre} />}
      </section>

      <section className="space-y-3" data-ficha-errores>
        <p className="titulo-grupo">Errores de los últimos 7 días</p>
        {errores.length === 0 ? <p className="texto-tenue">Ningún error registrado.</p> : (
          <ul className="space-y-2">
            {errores.map((e) => (
              <li key={e.pantalla} className="tarjeta p-3 text-sm" data-error-pantalla>
                <span className="font-semibold">{e.pantalla}</span> · {e.cantidad} {e.cantidad === 1 ? "vez" : "veces"} · última {fecha(e.ultimo)}<span className="texto-suave"> · {e.mensaje}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" data-ficha-links>
        <p className="titulo-grupo">Links por rol</p>
        <LinksPorRol links={enlacesPorRol(g.dominios[0]?.host)} />
        {g.dominios[0] && <QrGimnasio url={`https://${g.dominios[0].host}/`} nombre={g.nombre} />}
      </section>

      <section className="space-y-3" data-ficha-modulos>
        <p className="titulo-grupo">Módulos</p>
        <Modulos key={extra.secciones_apagadas.join(",")} gimnasioId={g.gimnasio_id} validas={extra.secciones_validas} apagadas={extra.secciones_apagadas} />
      </section>

      <section className="space-y-3" data-ficha-integraciones>
        <p className="titulo-grupo">Integraciones</p>
        <p className="texto-suave">MercadoPago: último aviso recibido {fecha(extra.ultimo_webhook)}. Nunca se muestran las claves.</p>
        {extra.webhooks_fallidos.length === 0 ? <p className="texto-tenue">Ningún aviso fallido.</p> : (
          <ul className="space-y-2">
            {extra.webhooks_fallidos.map((w) => (
              <li key={w.id} className="tarjeta p-3 text-sm" data-webhook-fallido>
                <span className="font-semibold">{w.tipo}</span> · {fecha(w.recibido_en)} · {w.intentos} {w.intentos === 1 ? "intento" : "intentos"}{w.error ? ` · ${w.error}` : ""}{" "}
                <Reprocesar eventoId={w.id} gimnasioId={g.gimnasio_id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <p className="titulo-grupo">Direcciones</p>
        <Direcciones gimnasioId={g.gimnasio_id} dominios={g.dominios} />
      </section>

      {abonos[g.gimnasio_id] && !g.es_demo && <AbonoGimnasio gimnasioId={g.gimnasio_id} abono={abonos[g.gimnasio_id]} planes={planes} />}
      {abonos[g.gimnasio_id]?.plan_id && !g.es_demo && <AbonoExtra gimnasioId={g.gimnasio_id} nombre={g.nombre} abono={abonos[g.gimnasio_id]} telefono={fila?.dueno_telefono ?? null} dueno={fila?.dueno ?? null} linkPago={linkPago} />}

      <section className="space-y-3" data-admin-soportes>
        <p className="titulo-grupo">Entradas de Soporte BRIK</p>
        <p className="texto-suave">Cada vez que alguien de BRIK entra a este gimnasio queda escrito quién, por qué y cuándo. El dueño lo ve en su Control.</p>
        {soportes.length === 0 ? <p className="texto-tenue">Nadie de BRIK entró todavía.</p> : (
          <div className="space-y-2">
            {soportes.map((s) => (
              <div key={s.id} className="tarjeta p-4" data-soporte={s.en_curso ? "en-curso" : "cerrado"}>
                <p className="font-semibold break-words">{s.motivo}{s.rol && <span className="pildora ml-2 align-middle">{NOMBRE_ROL[s.rol as Rol] ?? s.rol}</span>}</p>
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

      <section className="space-y-3" data-ficha-registro>
        <p className="titulo-grupo">Registro de BRIK en este gimnasio</p>
        {extra.registro.length === 0 ? <p className="texto-tenue">BRIK todavía no hizo nada acá.</p> : (
          <ul className="space-y-2">
            {extra.registro.map((r, i) => (
              <li key={i} className="tarjeta p-3 text-sm">
                <span className="font-semibold">{ACCION[r.accion] ?? r.accion}</span> · {r.quien} · {fecha(r.cuando)}
                {typeof r.detalle.motivo === "string" && <span className="texto-suave"> · {r.detalle.motivo}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" data-admin-cambios>
        <p className="titulo-grupo">Últimos cambios de configuración</p>
        <Historial cambios={cambios} />
      </section>
    </main>
  );
}
