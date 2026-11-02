import type { Metadata } from "next";
import Link from "next/link";
import { colorVar, PildoraEstado, PuntoEstado } from "@/components/panel/Estado";
import { fechaCorta, formatearPesos } from "@/lib/formato";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";
import { CambiarPlan, DarDeBaja } from "./Acciones";
import type { Ficha } from "./tipos";

export const metadata: Metadata = { title: "Ficha del socio" };

const MEDIO: Record<string, string> = { efectivo: "💵 Efectivo", transferencia: "🏦 Transferencia", debito: "💳 Débito", credito: "💳 Crédito", mercadopago: "📲 MercadoPago", debito_automatico: "🔁 Débito automático" };
const RESULTADO: Record<string, string> = { entro: "Entró", entro_modo_aviso: "Entró con aviso", forzado: "Lo dejaron pasar", rechazado: "No pudo entrar" };
type Plan = { plan_id: string; tipo: string; nombre: string; activo: boolean; precio: number | null };

function Dato({ etiqueta, valor }: { etiqueta: string; valor?: React.ReactNode }) {
  if (!valor) return null;
  return <div><dt className="text-sm texto-tenue">{etiqueta}</dt><dd className="text-lg">{valor}</dd></div>;
}

export default async function FichaSocio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    const [f, planes] = await Promise.all([
      rpc<Ficha>("ficha_socio", { p_socio_id: id }),
      rpc<Plan[]>("planes_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
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
            <span className="size-16 sm:size-20 rounded-3xl grid place-items-center titulo text-3xl flex-none"
              style={{ background: `color-mix(in oklab, ${colorVar(v.color)}, var(--fondo) 75%)` }}>
              {(s.nombre[0] ?? "") + (s.apellido[0] ?? "")}
            </span>
            <div className="min-w-0">
              <h1 className="titular text-5xl sm:text-6xl">{s.nombre} {s.apellido}</h1>
              <p className="texto-suave text-lg mt-1">Socio #{s.numero}{s.tiene_app ? " · 📱 usa la app" : ""}</p>
            </div>
          </div>
          <div className="mt-6">
            {s.dado_de_baja_en ? <span className="pildora">👋 Dado de baja el {fechaCorta(s.dado_de_baja_en, zona)}</span>
              : <PildoraEstado color={v.color}>{v.texto}</PildoraEstado>}
          </div>
          {!s.dado_de_baja_en && (
            <div className="flex flex-wrap gap-2 mt-6">
              {!v.puede || v.color === "amarillo"
                ? <Link href={`/panel/vender?socio=${s.id}`} className="boton boton-principal">💵 Cobrar{v.para_regularizar ? ` ${formatearPesos(v.para_regularizar)}` : ""}</Link>
                : <Link href={`/panel/vender?socio=${s.id}`} className="boton">🛒 Vender</Link>}
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="boton">💬 WhatsApp</a>}
              <Link href={`/panel/socios/${s.id}/editar`} className="boton">✏️ Editar</Link>
              <CambiarPlan socioId={s.id} actual={f.membresia?.plan_id ?? null} planes={membresias} />
              <DarDeBaja socioId={s.id} />
            </div>
          )}
        </header>

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
              <Dato etiqueta="Notas" valor={s.notas} />
            </dl>
            {!s.telefono && !s.email && !s.dni && <p className="texto-suave">Sin datos de contacto.</p>}
          </div>
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

        {f.pagos && (
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
      </div>
    );
  });
}
