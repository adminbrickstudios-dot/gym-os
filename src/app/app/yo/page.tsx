import type { Metadata } from "next";
import Link from "next/link";
import { fechaCorta } from "@/lib/formato";
import { miSocio } from "@/lib/app/socio";
import { intentar } from "@/lib/panel/intentar";
import { rpc } from "@/lib/panel/servidor";
import { MiFoto } from "./MiFoto";
import { AjustesAyuda } from "@/app/panel/cuenta/AjustesAyuda";
import { ayudasDeUsuario } from "@/lib/ayuda-servidor";
import { AvisoClase } from "./AvisoClase";
import { Icono } from "@/components/ui/Icono";

export const metadata: Metadata = { title: "Yo" };

/** VD-36: Yo = mi plan y mis pagos, mis datos y todo lo que no es de todos los días ("Más"). */
export default async function Yo({ searchParams }: { searchParams: Promise<{ socio?: string }> }) {
  const pedido = (await searchParams).socio;
  return intentar(async () => {
    const { g, yo } = await miSocio(pedido);
    if (yo.elegir) return <p className="texto-suave">Elegí primero <Link href="/app" className="underline">qué socio sos</Link>.</p>;
    const s = yo.socio!;
    const zona = yo.zona!;
    const q = yo.socios.length > 1 ? `?socio=${s.socio_id}` : "";
    const [referido, invitados, mensajes, compra, locker, pt, fotoPermitida, fotoActual, avisoClase] = await Promise.all([
      rpc<unknown | null>("mi_link_referido", { p_socio_id: s.socio_id }).catch(() => null),
      rpc<unknown | null>("mis_invitados", { p_gimnasio_id: g.id, p_socio_id: s.socio_id }).catch(() => null),
      // VD-38 (D27): escribirle al gimnasio. Si la sección está apagada o la base no responde, la fila no se muestra.
      rpc<{ activo: boolean; sin_leer: number }>("mensajes_estado_socio", { p_socio_id: s.socio_id }).catch(() => null),
      // VD-39: "Cambiar de plan o comprar un pase" solo si el dueño lo dejó prendido y hay algo para elegir.
      rpc<{ habilitado: boolean; planes: unknown[] }>("opciones_compra_app", { p_socio_id: s.socio_id }, { lectura: true }).catch(() => null),
      // VD-55: "Mi locker" solo si el gimnasio usa lockers y el socio tiene uno. VD-58: "Mi personal trainer" solo si el gimnasio lo ofrece o ya tiene un pack.
      rpc<{ prendido: boolean; lockers: unknown[] }>("mi_locker", { p_socio_id: s.socio_id }).catch(() => null),
      rpc<{ prendido: boolean; ofrece?: boolean; packs?: unknown[]; sesiones?: unknown[] }>("pt_socio", { p_socio_id: s.socio_id }).catch(() => null),
      // FA-16 (D57): "Mi foto" solo si el gimnasio dejó que el socio la suba (apagado por defecto).
      rpc<boolean>("foto_propia_permitida", { p_socio_id: s.socio_id }).catch(() => false),
      rpc<string | null>("foto_propia", { p_socio_id: s.socio_id }).catch(() => null),
      // FA-12: "Avisarme antes de mi clase" (solo si el gimnasio usa clases).
      yo.modo_clases !== "ninguno" ? rpc<boolean>("aviso_clase_socio", { p_socio_id: s.socio_id }).catch(() => null) : Promise.resolve(null),
    ]);
    const ayudasEstado = await ayudasDeUsuario();
    const fila = (href: string, emoji: string, titulo: string, detalle?: string, marca?: string) => (
      <li key={titulo}>
        <Link href={href} className="tarjeta flex items-center gap-3 px-5 py-4 min-h-[64px]" data-yo-fila={marca ?? titulo}>
          <span className="text-2xl" aria-hidden><Icono nombre={emoji} /></span>
          <span className="flex-1 min-w-0"><span className="block font-semibold">{titulo}</span>{detalle && <span className="block texto-suave text-sm truncate">{detalle}</span>}</span>
          <span aria-hidden className="texto-tenue">›</span>
        </Link>
      </li>
    );
    return (
      <div className="space-y-6" data-yo>
        <div>
          <h1 className="titular text-5xl">{s.nombre} {s.apellido}</h1>
          <p className="texto-tenue mt-1">Socio #{s.numero}</p>
          {yo.socios.length > 1 && <Link href="/app" className="text-sm texto-tenue underline">Cambiar de socio</Link>}
        </div>

        {fotoPermitida && <MiFoto socioId={s.socio_id} iniciales={`${s.nombre.charAt(0)}${s.apellido.charAt(0)}`.toUpperCase()} tieneFoto={!!fotoActual} />}

        {avisoClase !== null && <AvisoClase socioId={s.socio_id} inicial={avisoClase} />}

        <section className="space-y-2" aria-label="Mi plan">
          <div className="tarjeta p-5" data-mi-plan>
            <p className="texto-tenue text-sm">Mi plan</p>
            <p className="titulo text-2xl">{yo.plan ? `${yo.plan.nombre}` : "Sin plan mensual"}</p>
            {yo.acceso?.vence_en && yo.acceso.puede && <p className="texto-suave mt-1">Cubierto hasta el {fechaCorta(new Date(new Date(yo.acceso.vence_en).getTime() - 1), zona)}</p>}
          </div>
          {yo.packs?.map((p) => (
            <div key={p.plan} className="tarjeta p-5">
              <p className="titulo text-2xl"><Icono nombre="ticket" /> {p.plan}</p>
              <p className="texto-suave">Te quedan {p.cantidad - p.usadas} de {p.cantidad} clases{p.vence_en ? ` · vence el ${fechaCorta(p.vence_en, zona)}` : ""}</p>
            </div>
          ))}
        </section>

        <ul className="space-y-2" aria-label="Mi cuenta">
          {compra?.habilitado && compra.planes.length > 0 && fila(`/app/plan${q}`, "repetir", "Cambiar de plan o comprar un pase", "Con lo que te queda a favor", "plan")}
          {fila(`/app/info${q}`, "info", "Info del gimnasio", "Horarios, reglamento, contacto y cómo llegar", "info")}
          {locker?.prendido && locker.lockers.length > 0 && fila(`/app/locker${q}`, "candado", "Mi locker", "Cuál es y hasta cuándo es tuyo", "locker")}
          {pt?.prendido && (pt.ofrece || (pt.packs?.length ?? 0) > 0 || (pt.sesiones?.length ?? 0) > 0) && fila(`/app/pt${q}`, "pesa", "Mi personal trainer", "Tus sesiones y los horarios para reservar", "pt")}
          {fila(`/app/historial${q}`, "recibo", "Mis pagos y cuándo vine", "Pagos, recibos y asistencia", "historial")}
          {fila(`/app/resumen${q}`, "trofeo", "Mi año e insignias", "Cuánto viniste y lo que fuiste logrando", "resumen")}
          {fila(`/app/novedades${q}`, "campana", "Novedades", "Avisos del gimnasio y de tu cuenta", "novedades")}
          {fila(`/app/cuenta${q}`, "pausa", "Mi membresía", "Pausar, dar de baja, contraseña", "cuenta")}
        </ul>

        <section aria-labelledby="mas" className="space-y-2" data-yo-mas>
          <h2 id="mas" className="titulo text-2xl">Más</h2>
          <ul className="space-y-2">
            {mensajes?.activo && fila(`/app/mensajes${q}`, "mensaje", "Escribile al gimnasio", mensajes.sin_leer > 0 ? (mensajes.sin_leer === 1 ? "1 respuesta nueva" : `${mensajes.sin_leer} respuestas nuevas`) : "Una consulta, una queja o algo que perdiste", "mensajes")}
            {fila(`/app/ayuda${q}`, "ayuda", "Ayuda", "Preguntas cortas y cómo se hace", "ayuda")}
            {referido != null && fila(`/app${q}#referir`, "usuarios", "Invitá a un amigo", "Tu link para que se anote", "referir")}
            {invitados != null && fila(`/app${q}`, "ticket", "Invitar a alguien hoy", "Con tu pase, si tu plan lo permite", "invitar")}
            {fila(`/app/pedir-datos${q}`, "candado", "Pedir mis datos", "Ver, corregir o borrar lo que guardan de vos", "pedir-datos")}
            <li><a href={`/app/mis-datos${q}`} download className="tarjeta flex items-center gap-3 px-5 py-4 min-h-[64px]" data-yo-fila="mis-datos">
              <span className="text-2xl" aria-hidden><Icono nombre="descargar" /></span><span className="flex-1 font-semibold">Descargar mis datos</span></a></li>
          </ul>
        </section>

        {/* VD-31B: apagar las ayudas (o volver a verlas) desde la app, igual que en el panel. */}
        {ayudasEstado && <AjustesAyuda apagadas={ayudasEstado.apagadas} />}

        <form action="/salir?a=socio" method="post"><button className="boton w-full !min-h-14">Cerrar sesión</button></form>
      </div>
    );
  });
}
