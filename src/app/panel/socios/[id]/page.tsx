import type { Metadata } from "next";
import { LinkPanel } from "@/components/panel/LinkPanel";
import Link from "next/link";
import { colorVar, PildoraEstado, PuntoEstado } from "@/components/panel/Estado";
import { fechaCorta, formatearPesos } from "@/lib/formato";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { CambiarPlan, DarDeBaja, VolverADarDeAlta } from "./Acciones";
import { Pestanas } from "@/components/ui/Pestanas";
import { Calendario, type Asistencia } from "./Calendario";
import { Etiquetas, Notas, type NotasYEtiquetas } from "./NotasEtiquetas";
import { Foto } from "./Foto";
import { Familia, type Familiar } from "./Familia";
import { Pausas, type DatosPausas } from "./Pausas";
import type { Ficha } from "./tipos";

export const metadata: Metadata = { title: "Ficha del socio" };

const MEDIO: Record<string, string> = { efectivo: "💵 Efectivo", transferencia: "🏦 Transferencia", debito: "💳 Débito", credito: "💳 Crédito", mercadopago: "📲 MercadoPago", debito_automatico: "🔁 Débito automático" };
const RESULTADO: Record<string, string> = { entro: "Entró", entro_modo_aviso: "Entró con aviso", forzado: "Lo dejaron pasar", rechazado: "No pudo entrar" };
type Plan = { plan_id: string; tipo: string; nombre: string; activo: boolean; precio: number | null };

function Dato({ etiqueta, valor }: { etiqueta: string; valor?: React.ReactNode }) {
  if (!valor) return null;
  return <div><dt className="text-sm texto-tenue">{etiqueta}</dt><dd className="text-lg">{valor}</dd></div>;
}

const PESTANAS = [
  { clave: "resumen", texto: "Resumen", emoji: "👤" }, { clave: "pagos", texto: "Pagos", emoji: "💵" },
  { clave: "asistencia", texto: "Asistencia", emoji: "📅" }, { clave: "notas", texto: "Notas", emoji: "📝" },
] as const;
type Pestana = (typeof PESTANAS)[number]["clave"];

export default async function FichaSocio({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pestana?: string; mes?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const pestana: Pestana = PESTANAS.find((p) => p.clave === sp.pestana)?.clave ?? "resumen";
  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? `${sp.mes}-01` : null;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    exigirSeccion(panel, "socios");
    const [f, planes, asistencia, ne, foto, familia, pausas] = await Promise.all([
      rpc<Ficha>("ficha_socio", { p_socio_id: id }),
      rpc<Plan[]>("planes_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
      pestana === "asistencia" ? rpc<Asistencia>("asistencia_socio", { p_socio_id: id, p_mes: mes }) : Promise.resolve(null),
      rpc<NotasYEtiquetas>("notas_y_etiquetas", { p_socio_id: id }),
      rpc<string | null>("foto_socio", { p_socio_id: id }),
      rpc<Familiar[]>("familia_socio", { p_socio_id: id }),
      rpc<DatosPausas>("pausas_socio", { p_socio_id: id }),
    ]);
    const zona = panel.gimnasio.zona_horaria;
    const { socio: s, acceso: v } = f;
    const momento = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
    const wa = s.telefono ? `https://wa.me/${s.telefono.replace(/\D/g, "")}` : null;
    const membresias = planes.filter((p) => p.tipo === "membresia" && p.activo);

    return (
      <div className="space-y-10">
        <header>
          <Link href="/panel/socios" className="texto-suave hover:text-[var(--texto)]">← Socios</Link>
          <div className="flex items-start gap-4 mt-4">
            <Foto socioId={s.id} iniciales={(s.nombre[0] ?? "") + (s.apellido[0] ?? "")} color={colorVar(v.color)}
              version={foto ? foto.slice(-36, -4) : null} />
            <div className="min-w-0">
              <h1 className="titular text-5xl sm:text-6xl">{s.nombre} {s.apellido}</h1>
              <p className="texto-suave text-lg mt-1">Socio #{s.numero}{s.tiene_app ? " · 📱 usa la app" : ""}</p>
            </div>
          </div>
          <div className="mt-6">
            {s.dado_de_baja_en ? <span className="pildora">👋 Dado de baja el {fechaCorta(s.dado_de_baja_en, zona)}</span>
              : <PildoraEstado color={v.color}>{v.texto}</PildoraEstado>}
          </div>
          <div className="mt-4"><Etiquetas socioId={s.id} etiquetas={ne.etiquetas} todas={ne.todas} /></div>
          {s.dado_de_baja_en && (
            <div className="mt-6 space-y-2" data-dado-de-baja>
              <p className="texto-suave">¿Volvió? Dalo de alta de nuevo y después asignale un plan y cobrale. La baja queda en su historial.</p>
              <VolverADarDeAlta socioId={s.id} />
            </div>
          )}
          {!s.dado_de_baja_en && (
            <div className="flex flex-wrap gap-2 mt-6">
              {!v.puede || v.color === "amarillo"
                ? <LinkPanel href={`/panel/vender?socio=${s.id}`} className="boton boton-principal">💵 Cobrar{v.para_regularizar ? ` ${formatearPesos(v.para_regularizar)}` : ""}</LinkPanel>
                : <LinkPanel href={`/panel/vender?socio=${s.id}`} className="boton">🛒 Vender</LinkPanel>}
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="boton">💬 WhatsApp</a>}
              <Link href={`/panel/socios/${s.id}/editar`} className="boton">✏️ Editar</Link>
              <CambiarPlan socioId={s.id} actual={f.membresia?.plan_id ?? null} planes={membresias} />
              <DarDeBaja socioId={s.id} />
            </div>
          )}
        </header>

        <Pestanas etiqueta="Partes de la ficha" activa={pestana}
          pestanas={PESTANAS.filter((p) => p.clave !== "pagos" || f.pagos).map((p) => ({ ...p, href: `/panel/socios/${s.id}?pestana=${p.clave}` }))} />

        {pestana === "resumen" && <>
        <section className="grid sm:grid-cols-2 gap-3">
          <div className="tarjeta p-6">
            <p className="titulo text-2xl mb-4">🏷️ Plan</p>
            {f.membresia ? (
              <dl className="space-y-3">
                <Dato etiqueta="Plan" valor={f.membresia.plan} />
                <Dato etiqueta="Desde" valor={fechaCorta(f.membresia.inicio, zona)} />
                <Dato etiqueta="Precio de lista" valor={f.membresia.precio != null ? formatearPesos(f.membresia.precio) : "Sin precio cargado"} />
                {v.vence_en && <Dato etiqueta="Cubierto hasta" valor={fechaCorta(new Date(new Date(v.vence_en).getTime() - 1), zona)} />}
              </dl>
            ) : <p className="texto-suave">Sin membresía. Puede entrar con pase o pack.</p>}
            {f.packs.map((p) => (
              <p key={p.id} className="mt-4 pildora pildora-azul">🎟️ {p.plan}: le quedan {p.cantidad - p.usadas} de {p.cantidad}</p>
            ))}
          </div>
          <div className="tarjeta p-6">
            <p className="titulo text-2xl mb-4">📱 Contacto</p>
            <dl className="space-y-3">
              <Dato etiqueta="WhatsApp" valor={s.telefono} />
              <Dato etiqueta="Mail" valor={s.email} />
              <Dato etiqueta="DNI" valor={s.dni} />
              <Dato etiqueta="Emergencia" valor={s.contacto_emergencia_nombre ? `${s.contacto_emergencia_nombre} · ${s.contacto_emergencia_telefono ?? ""}` : null} />
            </dl>
            {!s.telefono && !s.email && !s.dni && <p className="texto-suave">Sin datos de contacto.</p>}
          </div>
          {!s.dado_de_baja_en && <Pausas socioId={s.id} datos={pausas} />}
          <Familia socioId={s.id} familia={familia} />
        </section>

        <section>
          <h2 className="titulo text-3xl mb-4">🚪 Últimas entradas</h2>
          {f.ingresos.length === 0 ? <p className="texto-suave">Todavía no vino.</p> : (
            <ul className="space-y-1">
              {f.ingresos.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-2">
                  <PuntoEstado color={i.resultado === "rechazado" ? "rojo" : i.color} />
                  <span className="numero text-lg w-28 texto-suave">{momento(i.momento)}</span>
                  <span className="truncate">{RESULTADO[i.resultado] ?? i.resultado}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        </>}

        {pestana === "pagos" && f.pagos && (
          <section>
            <h2 className="titulo text-3xl mb-4">💵 Pagos</h2>
            {f.pagos.length === 0 ? <p className="texto-suave">Sin pagos registrados.</p> : (
              <ul className="space-y-2">
                {f.pagos.map((p) => (
                  <li key={p.id} className="tarjeta flex items-center gap-4 px-4 py-3">
                    <span className="numero text-2xl">{formatearPesos(p.monto)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{p.detalle ?? "Venta"}</span>
                      <span className="block text-sm texto-tenue">{fechaCorta(p.fecha, zona)} · {MEDIO[p.medio] ?? p.medio}</span>
                    </span>
                    {p.estado !== "aprobado" && <span className={`pildora ${p.estado === "pendiente" ? "pildora-azul" : "pildora-rojo"}`}>{p.estado}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
                )}
        {pestana === "pagos" && !f.pagos && <p className="texto-suave">Los pagos los ven el dueño y el encargado.</p>}

        {pestana === "asistencia" && asistencia && <Calendario a={asistencia} socioId={s.id} />}

        {pestana === "notas" && <Notas socioId={s.id} notas={ne.notas} zona={zona} notaVieja={s.notas} />}
      </div>
    );
  });
}
