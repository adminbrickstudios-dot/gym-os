import type { Metadata } from "next";
import Link from "next/link";
import { FilaContacto } from "@/components/panel/FilaContacto";
import { Vacio } from "@/components/ui/Vacio";
import { rutaDisponible } from "@/lib/panel/secciones";
import { Encabezado } from "@/components/panel/Marco";
import { fechaCorta, formatearPesos } from "@/lib/formato";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpcLectura } from "@/lib/panel/servidor";
import { linkWhatsappSocio } from "@/lib/whatsapp";
import { TandaAvisos } from "@/app/panel/avisos/Tanda";
import type { Aviso } from "@/app/panel/avisos/Aviso";
import { Icono } from "@/components/ui/Icono";

export const metadata: Metadata = { title: "Vencen hoy" };
type Prometio = { socio_id: string; socio: string; momento: string; motivo: string | null; por: string | null; texto: string | null; telefono: string | null; promete_el?: string | null; autorizo?: string | null };
type Fila = { socio_id: string; nombre: string; telefono: string | null; texto: string; dias: number | null; monto_mensual: number | null; debe: number | null; ultimo_ingreso: string | null; ultimo_contacto_en: string | null; ultimo_contacto_por: string | null; mensaje: string | null };
type Grupo = { cantidad: number; plata: number | null; filas: Fila[] };
// VD-14: las tres listas, los totales y el modo de cobro los calcula la base (vencen_pestanas); acá solo se muestran.
type Pestanas = { modo: { texto: string; renovacion: string; dia_fijo?: number; dia_hoy?: number }; hoy: Grupo; vencidos: Grupo; por_vencer: Grupo };
const PESTANAS = [
  { clave: "hoy", emoji: "reloj", titulo: "Vencen hoy" },
  { clave: "vencidos", emoji: "punto-rojo", titulo: "Vencidos" },
  { clave: "por_vencer", emoji: "calendario", titulo: "Por vencer" },
  { clave: "prometieron", emoji: "usuarios", titulo: "Prometieron pagar" },
  { clave: "cobrar", emoji: "plata", titulo: "Tengo que cobrar" },
] as const;

export default async function VencenHoy({ searchParams }: { searchParams: Promise<{ pestana?: string }> }) {
  const sp = await searchParams;
  const activa = PESTANAS.find((p) => p.clave === sp.pestana)?.clave ?? "hoy";
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "vencen_hoy");
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    const [pest, bandeja, prometieron] = await Promise.all([
      rpcLectura<Pestanas>("vencen_pestanas", { p_gimnasio_id: panel.gimnasio.id }),
      rpcLectura<Aviso[]>("bandeja_avisos", { p_gimnasio_id: panel.gimnasio.id }),
      rpcLectura<Prometio[]>("prometieron_pagar", { p_gimnasio_id: panel.gimnasio.id }),
    ]);
    const filas = pest.hoy.filas;
    // VEH-1: el "avisado ✓" es el de la bandeja (misma cuenta). Si no está en la bandeja, ya se le avisó otro día por este vencimiento.
    const avisos = new Map(bandeja.filter((b) => b.clave === "por_vencer").map((b) => [b.socio_id, b]));
    const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: panel.gimnasio.zona_horaria, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
    const marcado = (id: string) => {
      const b = avisos.get(id);
      if (!b) return "Ya se le avisó por este vencimiento";
      return b.avisado_en ? `Avisado${b.avisado_por ? ` por ${b.avisado_por}` : ""} a las ${hora(b.avisado_en)}` : null;
    };
    const tanda = filas.flatMap((f) => { const b = avisos.get(f.socio_id); return b ? [{ ...b, nombre: f.nombre, mensaje: f.mensaje ?? b.mensaje }] : []; });
    const zona = panel.gimnasio.zona_horaria;
    const puedeCobrar = rutaDisponible("/panel/vender", panel.yo.rol, panel.secciones_apagadas) && panel.cobra.membresia;
    // F7.1 · "Tengo que cobrar" (el día 1): los que vencen hoy y los vencidos en una sola cola, primero los de más plata, para ir cobrando de arriba hacia abajo.
    const colaCobro = [...pest.hoy.filas, ...pest.vencidos.filas.filter((v) => !pest.hoy.filas.some((h) => h.socio_id === v.socio_id))]
      .sort((a, b) => (b.debe ?? b.monto_mensual ?? 0) - (a.debe ?? a.monto_mensual ?? 0) || a.nombre.localeCompare(b.nombre, "es"));
    const cuantos = (c: string) => c === "prometieron" ? prometieron.length : c === "cobrar" ? colaCobro.length : pest[c as "hoy" | "vencidos" | "por_vencer"].cantidad;
    // La plata de la cuota mensual es de dueño y encargado; la recepción ve cantidades y lo que debe cada vencido.
    const gestion = panel.yo.rol !== "recepcion";
    const lista = (grupo: Fila[], clave: "hoy" | "vencidos" | "por_vencer") => (
      <ul className="space-y-2" data-lista-vencen={clave}>
        {grupo.map((f) => (
          <FilaContacto key={f.socio_id} socioId={f.socio_id} nombre={f.nombre} texto={f.texto} lista={clave === "vencidos" ? "vencido" : "por_vencer"}
            detalle={f.ultimo_ingreso ? `Vino por última vez el ${fechaCorta(f.ultimo_ingreso, zona)}` : "Nunca vino"}
            whatsapp={linkWhatsappSocio(f.telefono, f.mensaje)}
            ultimo={f.ultimo_contacto_en ? `Le escribió ${f.ultimo_contacto_por ?? "alguien"} el ${fechaCorta(f.ultimo_contacto_en, zona)}` : clave === "vencidos" ? null : marcado(f.socio_id)}
            puedeAnotar cobrar={puedeCobrar}
            aviso={clave !== "vencidos" && avisos.get(f.socio_id) ? { clave: "por_vencer", referencia: avisos.get(f.socio_id)!.referencia } : null} />
        ))}
      </ul>
    );
    // REV-1a: a los que dejaron pasar sin poder entrar, se les recuerda hoy y mañana (sale solo cuando pagan).
    const bloquePrometieron = prometieron.length > 0 && (
      <section className="mb-8 space-y-3" aria-labelledby="prometieron" data-prometieron={prometieron.length}>
        <h2 id="prometieron" className="titulo text-2xl"><Icono nombre="usuarios" /> Le prometieron pagar</h2>
        <ul className="space-y-2">
          {prometieron.map((p) => (
            <FilaContacto key={p.socio_id} socioId={p.socio_id} nombre={p.socio} texto={p.texto ?? ""} lista="vencido"
              detalle={`${p.promete_el ? `Prometió pagar el ${p.promete_el.split("-").reverse().slice(0, 2).join("/")}. ` : ""}Pasó el ${fechaCorta(p.momento, zona)} a las ${hora(p.momento)}${p.por ? ` (lo dejó pasar ${p.por}${p.autorizo && p.autorizo !== p.por ? `, autorizó ${p.autorizo}` : ""})` : ""}${p.motivo ? `: “${p.motivo}”` : ""}`}
              whatsapp={linkWhatsappSocio(p.telefono, null)} ultimo={null} puedeAnotar={false} cobrar={puedeCobrar} />
          ))}
        </ul>
      </section>
    );
    const ir = (c: string) => `/panel/vencen-hoy${c === "hoy" ? "" : `?pestana=${c}`}`;
    return (
      <>
        <Encabezado icono="reloj" titulo="Vencen hoy" bajada={filas.length
          ? `${filas.length === 1 ? "A 1 socio se le termina" : `A ${filas.length} socios se les termina`} la cuota hoy. Un mensaje ahora evita que se vayan; si vienen, cobrales desde acá.`
          : "Hoy es su último día cubierto. Un mensaje ahora evita que se vayan."} />
        <p className="texto-suave -mt-2 mb-3" data-modo-cobro={pest.modo.renovacion}>{pest.modo.texto}</p>
        <p className="mb-4 text-lg" data-totales>
          {gestion && pest.hoy.plata != null
            ? <><b className="numero" data-total="hoy">{formatearPesos(pest.hoy.plata)}</b> a cobrar hoy</>
            : <><b className="numero" data-total="hoy">{pest.hoy.cantidad}</b> {pest.hoy.cantidad === 1 ? "vence" : "vencen"} hoy</>}
          {" · "}<b className="numero" data-total="vencidos">{formatearPesos(pest.vencidos.plata)}</b> vencido
          {gestion && pest.por_vencer.plata != null && <> · <b className="numero" data-total="por_vencer">{formatearPesos(pest.por_vencer.plata)}</b> por vencer</>}
        </p>
        <nav className="pestanas mb-6" aria-label="Pestañas de cobro" data-pestanas>
          {PESTANAS.filter((p) => p.clave !== "cobrar" || puedeCobrar).map((p) => (
            <Link key={p.clave} href={ir(p.clave)} data-transicion className="pestana" data-pestana={p.clave} aria-current={p.clave === activa ? "page" : undefined}>
              <Icono nombre={p.emoji} /> {p.titulo} <span className="texto-tenue" data-cuenta>{cuantos(p.clave)}</span>
            </Link>
          ))}
        </nav>
        {activa === "hoy" && (
          <>
            {bloquePrometieron}
            {filas.length === 0 ? (
              <Vacio icono="estrella" titulo="Hoy no vence nadie">
                {pest.por_vencer.cantidad > 0
                  ? <>Los que vencen en los próximos días están en <Link href={ir("por_vencer")} className="underline">Por vencer</Link>.</>
                  : rutaDisponible("/panel/retencion", panel.yo.rol, panel.secciones_apagadas)
                    ? <>Los que se están yendo están en <Link href="/panel/retencion?lista=por_vencer" className="underline">Retención</Link>.</>
                    : "Mañana se vuelve a calcular solo."}
              </Vacio>
            ) : (
              <div className="space-y-3">
                <TandaAvisos avisos={tanda} principal />
                {lista(filas, "hoy")}
              </div>
            )}
          </>
        )}
        {activa === "vencidos" && (pest.vencidos.cantidad === 0
          ? <Vacio icono="estrella" titulo="Nadie debe la cuota">Los que dejan de pagar aparecen acá con lo que deben.</Vacio>
          : lista(pest.vencidos.filas, "vencidos"))}
        {activa === "por_vencer" && (pest.por_vencer.cantidad === 0
          ? <Vacio icono="calendario" titulo="Nadie vence en los próximos días">Se vuelve a calcular cada vez que abrís.</Vacio>
          : lista(pest.por_vencer.filas, "por_vencer"))}
        {activa === "cobrar" && puedeCobrar && (colaCobro.length === 0
          ? <Vacio icono="estrella" titulo="No hay nadie para cobrar">Los que vencen hoy y los que deben la cuota aparecen acá, los de más plata primero.</Vacio>
          : (
            <div className="space-y-3" data-cola-cobro={colaCobro.length}>
              <p className="texto-suave">{colaCobro.length === 1 ? "1 socio para cobrar" : `${colaCobro.length} socios para cobrar`}, los de más plata primero. Cobrá de arriba hacia abajo: al cobrar, sale de la lista.</p>
              <ul className="space-y-2" data-lista-vencen="cobrar">
                {colaCobro.map((f, i) => (
                  <FilaContacto key={f.socio_id} socioId={f.socio_id} nombre={`${i + 1}. ${f.nombre}`} texto={f.texto} lista={pest.hoy.filas.some((h) => h.socio_id === f.socio_id) ? "por_vencer" : "vencido"}
                    detalle={f.debe != null && f.debe > 0 ? `Debe ${formatearPesos(f.debe)}` : f.monto_mensual != null && gestion ? `Cuota ${formatearPesos(f.monto_mensual)}` : "Vence hoy"}
                    whatsapp={linkWhatsappSocio(f.telefono, f.mensaje)} ultimo={null} puedeAnotar={false} cobrar />
                ))}
              </ul>
            </div>
          ))}
        {activa === "prometieron" && (prometieron.length === 0
          ? <Vacio icono="usuarios" titulo="Nadie prometió pagar">Si dejás pasar a alguien que paga después, aparece acá hasta que pague.</Vacio>
          : bloquePrometieron)}
      </>
    );
  });
}
