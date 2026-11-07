import type { Metadata } from "next";
import Link from "next/link";
import { fechaCorta } from "@/lib/formato";
import { miSocio } from "@/lib/app/socio";
import { intentar } from "@/lib/panel/intentar";
import { rpc } from "@/lib/panel/servidor";

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
    const [referido, invitados, mensajes, compra, locker, pt] = await Promise.all([
      rpc<unknown | null>("mi_link_referido", { p_socio_id: s.socio_id }).catch(() => null),
      rpc<unknown | null>("mis_invitados", { p_gimnasio_id: g.id, p_socio_id: s.socio_id }).catch(() => null),
      // VD-38 (D27): escribirle al gimnasio. Si la sección está apagada o la base no responde, la fila no se muestra.
      rpc<{ activo: boolean; sin_leer: number }>("mensajes_estado_socio", { p_socio_id: s.socio_id }).catch(() => null),
      // VD-39: "Cambiar de plan o comprar un pase" solo si el dueño lo dejó prendido y hay algo para elegir.
      rpc<{ habilitado: boolean; planes: unknown[] }>("opciones_compra_app", { p_socio_id: s.socio_id }, { lectura: true }).catch(() => null),
      // VD-55: "Mi locker" solo si el gimnasio usa lockers y el socio tiene uno. VD-58: "Mi personal trainer" solo si el gimnasio lo ofrece o ya tiene un pack.
      rpc<{ prendido: boolean; lockers: unknown[] }>("mi_locker", { p_socio_id: s.socio_id }).catch(() => null),
      rpc<{ prendido: boolean; ofrece?: boolean; packs?: unknown[]; sesiones?: unknown[] }>("pt_socio", { p_socio_id: s.socio_id }).catch(() => null),
    ]);
    const fila = (href: string, emoji: string, titulo: string, detalle?: string, marca?: string) => (
      <li key={titulo}>
        <Link href={href} className="tarjeta flex items-center gap-3 px-5 py-4 min-h-[64px]" data-yo-fila={marca ?? titulo}>
          <span className="text-2xl" aria-hidden>{emoji}</span>
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

        <section className="space-y-2" aria-label="Mi plan">
          <div className="tarjeta p-5" data-mi-plan>
            <p className="texto-tenue text-sm">Mi plan</p>
            <p className="titulo text-2xl">{yo.plan ? `🏷️ ${yo.plan.nombre}` : "Sin plan mensual"}</p>
            {yo.acceso?.vence_en && yo.acceso.puede && <p className="texto-suave mt-1">Cubierto hasta el {fechaCorta(new Date(new Date(yo.acceso.vence_en).getTime() - 1), zona)}</p>}
          </div>
          {yo.packs?.map((p) => (
            <div key={p.plan} className="tarjeta p-5">
              <p className="titulo text-2xl">🎟️ {p.plan}</p>
              <p className="texto-suave">Te quedan {p.cantidad - p.usadas} de {p.cantidad} clases{p.vence_en ? ` · vence el ${fechaCorta(p.vence_en, zona)}` : ""}</p>
            </div>
          ))}
        </section>

        <ul className="space-y-2" aria-label="Mi cuenta">
          {compra?.habilitado && compra.planes.length > 0 && fila(`/app/plan${q}`, "🔄", "Cambiar de plan o comprar un pase", "Con lo que te queda a favor", "plan")}
          {locker?.prendido && locker.lockers.length > 0 && fila(`/app/locker${q}`, "🔐", "Mi locker", "Cuál es y hasta cuándo es tuyo", "locker")}
          {pt?.prendido && (pt.ofrece || (pt.packs?.length ?? 0) > 0 || (pt.sesiones?.length ?? 0) > 0) && fila(`/app/pt${q}`, "🏃", "Mi personal trainer", "Tus sesiones y los horarios para reservar", "pt")}
          {fila(`/app/historial${q}`, "🧾", "Mis pagos y cuándo vine", "Pagos, recibos y asistencia", "historial")}
          {fila(`/app/novedades${q}`, "🔔", "Novedades", "Avisos del gimnasio y de tu cuenta", "novedades")}
          {fila(`/app/cuenta${q}`, "⏸️", "Mi membresía", "Pausar, dar de baja, contraseña", "cuenta")}
        </ul>

        <section aria-labelledby="mas" className="space-y-2" data-yo-mas>
          <h2 id="mas" className="titulo text-2xl">Más</h2>
          <ul className="space-y-2">
            {mensajes?.activo && fila(`/app/mensajes${q}`, "💬", "Escribile al gimnasio", mensajes.sin_leer > 0 ? (mensajes.sin_leer === 1 ? "1 respuesta nueva" : `${mensajes.sin_leer} respuestas nuevas`) : "Una consulta, una queja o algo que perdiste", "mensajes")}
            {referido != null && fila(`/app${q}#referir`, "🤝", "Invitá a un amigo", "Tu link para que se anote", "referir")}
            {invitados != null && fila(`/app${q}`, "🎫", "Invitar a alguien hoy", "Con tu pase, si tu plan lo permite", "invitar")}
            <li><a href={`/app/mis-datos${q}`} download className="tarjeta flex items-center gap-3 px-5 py-4 min-h-[64px]" data-yo-fila="mis-datos">
              <span className="text-2xl" aria-hidden>⬇️</span><span className="flex-1 font-semibold">Descargar mis datos</span></a></li>
          </ul>
        </section>

        <form action="/salir" method="post"><button className="boton w-full !min-h-14">Cerrar sesión</button></form>
      </div>
    );
  });
}
