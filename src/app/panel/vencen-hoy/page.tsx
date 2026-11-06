import type { Metadata } from "next";
import Link from "next/link";
import { FilaContacto } from "@/components/panel/FilaContacto";
import { Vacio } from "@/components/ui/Vacio";
import { rutaDisponible } from "@/lib/panel/secciones";
import { Encabezado } from "@/components/panel/Marco";
import { fechaCorta } from "@/lib/formato";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpcLectura } from "@/lib/panel/servidor";
import { linkWhatsappSocio } from "@/lib/whatsapp";
import { TandaAvisos } from "@/app/panel/avisos/Tanda";
import type { Aviso } from "@/app/panel/avisos/Aviso";

export const metadata: Metadata = { title: "Vencen hoy" };
type Prometio = { socio_id: string; socio: string; momento: string; motivo: string | null; por: string | null; texto: string | null; telefono: string | null };
type Fila = { socio_id: string; nombre: string; telefono: string | null; texto: string; ultimo_ingreso: string | null; ultimo_contacto_en: string | null; ultimo_contacto_por: string | null; mensaje: string | null };

export default async function VencenHoy() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "vencen_hoy");
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    const [filas, bandeja, prometieron] = await Promise.all([
      rpcLectura<Fila[]>("vencen_hoy", { p_gimnasio_id: panel.gimnasio.id }),
      rpcLectura<Aviso[]>("bandeja_avisos", { p_gimnasio_id: panel.gimnasio.id }),
      rpcLectura<Prometio[]>("prometieron_pagar", { p_gimnasio_id: panel.gimnasio.id }),
    ]);
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
    return (
      <>
        <Encabezado emoji="⏰" titulo="Vencen hoy" bajada={filas.length
          ? `${filas.length === 1 ? "A 1 socio se le termina" : `A ${filas.length} socios se les termina`} la cuota hoy. Un mensaje ahora evita que se vayan; si vienen, cobrales desde acá.`
          : "Hoy es su último día cubierto. Un mensaje ahora evita que se vayan."} />
        {/* REV-1a: a los que dejaron pasar sin poder entrar, se les recuerda hoy y mañana (sale solo cuando pagan). */}
        {prometieron.length > 0 && (
          <section className="mb-8 space-y-3" aria-labelledby="prometieron" data-prometieron={prometieron.length}>
            <h2 id="prometieron" className="titulo text-2xl">🤝 Le prometieron pagar</h2>
            <ul className="space-y-2">
              {prometieron.map((p) => (
                <FilaContacto key={p.socio_id} socioId={p.socio_id} nombre={p.socio} texto={p.texto ?? ""} lista="vencido"
                  detalle={`Pasó el ${fechaCorta(p.momento, zona)} a las ${hora(p.momento)}${p.por ? ` (lo dejó pasar ${p.por})` : ""}${p.motivo ? `: “${p.motivo}”` : ""}`}
                  whatsapp={linkWhatsappSocio(p.telefono, null)} ultimo={null} puedeAnotar={false} cobrar={puedeCobrar} />
              ))}
            </ul>
          </section>
        )}
        {filas.length === 0 ? (
          <Vacio emoji="🎉" titulo="Hoy no vence nadie">
            {rutaDisponible("/panel/retencion", panel.yo.rol, panel.secciones_apagadas)
              ? <>Los que vencen en los próximos días están en <Link href="/panel/retencion?lista=por_vencer" className="underline">Retención → Vence pronto</Link>.</>
              : "Mañana se vuelve a calcular solo."}
          </Vacio>
        ) : (
          <div className="space-y-3">
          <TandaAvisos avisos={tanda} principal />
          <ul className="space-y-2">
            {filas.map((f) => (
              <FilaContacto key={f.socio_id} socioId={f.socio_id} nombre={f.nombre} texto={f.texto} lista="por_vencer"
                detalle={f.ultimo_ingreso ? `Vino por última vez el ${fechaCorta(f.ultimo_ingreso, zona)}` : "Nunca vino"}
                whatsapp={linkWhatsappSocio(f.telefono, f.mensaje)}
                ultimo={f.ultimo_contacto_en ? `Le escribió ${f.ultimo_contacto_por ?? "alguien"} el ${fechaCorta(f.ultimo_contacto_en, zona)}` : marcado(f.socio_id)}
                puedeAnotar cobrar={puedeCobrar}
                aviso={avisos.get(f.socio_id) ? { clave: "por_vencer", referencia: avisos.get(f.socio_id)!.referencia } : null} />
            ))}
          </ul>
          </div>
        )}
      </>
    );
  });
}
