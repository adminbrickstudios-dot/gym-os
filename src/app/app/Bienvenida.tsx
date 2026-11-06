"use client";
// VD-23: la primera vez, tres pantallas cortas (tu QR · tus clases · tus pagos) que se saltean.
// Va adentro del inicio y no tapa nada: ver o saltear la bienvenida queda anotado en la base.
import { useState, useTransition } from "react";
import { marcarBienvenida } from "./acciones";

type Paso = { clave: string; emoji: string; titulo: string; texto: string };

export function Bienvenida({ socioId, nombre, qr, clases, pagos }: { socioId: string; nombre: string; qr: boolean; clases: "reserva" | "sin_reserva" | "ninguno"; pagos: boolean }) {
  const [paso, setPaso] = useState(0);
  const [ocupado, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const pasos: Paso[] = [
    { clave: "qr", emoji: "📲", titulo: `¡Bienvenido, ${nombre}!`,
      texto: qr ? "Acá abajo tenés tu QR para entrar: mostralo en la puerta o escaneá el de la entrada con la cámara." : "Acá ves si estás al día y cuándo vence tu cuota, todos los días." },
    ...(clases === "ninguno" ? [] : [{ clave: "clases", emoji: "🗓️", titulo: clases === "reserva" ? "Reservá tus clases" : "Mirá los horarios",
      texto: clases === "reserva" ? "En la pestaña Clases elegís el día y el horario. Si no hay lugar, te anotás en la espera." : "En la pestaña Clases están todos los horarios. No hace falta reservar." }]),
    ...(pagos ? [{ clave: "pagos", emoji: "💳", titulo: "Pagá desde acá", texto: "Cuando venza tu cuota, el botón para pagar aparece arriba de todo. Tus pagos quedan en Yo." }] : []),
  ];
  const ultimo = paso >= pasos.length - 1;
  const p = pasos[paso];
  const cerrar = () => empezar(async () => {
    const r = await marcarBienvenida(socioId);
    if (r.error) setError(r.error);
  });
  return (
    <section className="tarjeta p-5 space-y-3 aparecer" data-bienvenida={p.clave} aria-label="Bienvenida">
      <p className="text-4xl" aria-hidden>{p.emoji}</p>
      <h2 className="titulo text-2xl">{p.titulo}</h2>
      <p className="texto-suave">{p.texto}</p>
      <div className="flex items-center gap-1" aria-hidden>{pasos.map((x, i) => <span key={x.clave} className="h-1.5 flex-1 rounded-full" style={{ background: i <= paso ? "var(--acento)" : "var(--borde)" }} />)}</div>
      {error && <p role="alert" className="mensaje mensaje-error">{error}</p>}
      <div className="flex gap-2">
        {ultimo
          ? <button type="button" className="boton boton-principal flex-1 !min-h-12" disabled={ocupado} onClick={cerrar} data-bienvenida-listo>{ocupado ? "Un segundo…" : "Empezar"}</button>
          : <button type="button" className="boton boton-principal flex-1 !min-h-12" onClick={() => setPaso(paso + 1)} data-bienvenida-siguiente>Siguiente</button>}
        {!ultimo && <button type="button" className="boton !min-h-12" disabled={ocupado} onClick={cerrar} data-bienvenida-saltear>Saltear</button>}
      </div>
    </section>
  );
}
