"use client";
import { useState, useTransition } from "react";
import { crearContrasena, pedirBajaSocio, pedirPausaSocio } from "../acciones";

const CATEGORIAS: [string, string][] = [["viaje", "✈️ Viaje"], ["trabajo", "💼 Trabajo"], ["estudio", "📚 Estudio"], ["otro", "Otro"]];
const MOTIVOS: [string, string][] = [
  ["precio", "💸 El precio"], ["horario", "⏰ Los horarios"], ["mudanza", "📦 Me mudo"], ["otro_gimnasio", "🏋️ Otro gimnasio"],
  ["sin_tiempo", "⌛ No tengo tiempo"], ["insatisfecho", "😕 No me gustó"], ["otro", "Otra cosa"],
];

/** Pedir una pausa: queda pendiente hasta que el gimnasio la aprueba. */
export function PedirPausa({ socioId, hoy }: { socioId: string; hoy: string }) {
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState("");
  const [cat, setCat] = useState("viaje");
  const [nota, setNota] = useState("");
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    empezar(async () => {
      const r = await pedirPausaSocio(socioId, desde, hasta, cat, nota);
      setMsj(r.error ? { error: r.error } : { ok: "Listo: el gimnasio lo va a ver y te confirma." });
    });
  };
  return (
    <form onSubmit={enviar} className="tarjeta p-5 space-y-4" data-pedir-pausa>
      <div>
        <h2 className="titulo text-2xl">⏸️ Pausar mi membresía</h2>
        <p className="texto-suave">No pagás esos días y no perdés tu plan. El gimnasio lo aprueba.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1"><span className="text-sm texto-suave">Desde</span>
          <input type="date" required min={hoy} value={desde} onChange={(e) => setDesde(e.target.value)} className="campo w-full" /></label>
        <label className="space-y-1"><span className="text-sm texto-suave">Vuelvo el</span>
          <input type="date" required min={desde} value={hasta} onChange={(e) => setHasta(e.target.value)} className="campo w-full" /></label>
      </div>
      <fieldset className="flex flex-wrap gap-2"><legend className="text-sm texto-suave mb-1">¿Por qué?</legend>
        {CATEGORIAS.map(([v, t]) => (
          <label key={v} className={`pildora cursor-pointer ${cat === v ? "pildora-azul" : ""}`}>
            <input type="radio" name="cat" value={v} checked={cat === v} onChange={() => setCat(v)} className="sr-only" />{t}
          </label>
        ))}
      </fieldset>
      <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} placeholder="Algo más (opcional)" className="campo w-full" />
      <button type="submit" disabled={ocupado || !hasta} className="boton boton-principal w-full">{ocupado ? "Enviando…" : "Pedir la pausa"}</button>
      {msj.ok && <p role="status" className="mensaje mensaje-exito">✅ {msj.ok}</p>}
      {msj.error && <p role="alert" className="pildora pildora-rojo">⚠️ {msj.error}</p>}
    </form>
  );
}

/** Pedir la baja: no da de baja, avisa al gimnasio con el motivo. */
export function PedirBaja({ socioId, ofrecePausa }: { socioId: string; ofrecePausa: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  if (msj.ok) return <p role="status" className="mensaje mensaje-exito" data-pedido-baja-ok>✅ {msj.ok}</p>;
  if (!abierto) return <button type="button" className="boton-texto texto-suave w-full" onClick={() => setAbierto(true)}>👋 Quiero darme de baja</button>;
  return (
    <div className="tarjeta p-5 space-y-4" data-pedir-baja>
      <div>
        <h2 className="titulo text-2xl">👋 Darme de baja</h2>
        <p className="texto-suave">Le avisamos al gimnasio y te contacta para cerrarlo.{ofrecePausa ? " Si es por un tiempo, una pausa te guarda el plan." : ""}</p>
      </div>
      <fieldset className="grid grid-cols-2 gap-2"><legend className="text-sm texto-suave mb-1">¿Por qué te vas?</legend>
        {MOTIVOS.map(([v, t]) => (
          <label key={v} className={`boton !justify-start cursor-pointer ${motivo === v ? "!border-[var(--acento)] font-bold" : "opacity-80"}`}>
            <input type="radio" name="motivo" value={v} checked={motivo === v} onChange={() => setMotivo(v)} className="sr-only" />{t}
          </label>
        ))}
      </fieldset>
      <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} placeholder="Contanos algo más (opcional)" className="campo w-full" />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={ocupado || !motivo} className="boton boton-peligro"
          onClick={() => empezar(async () => { const r = await pedirBajaSocio(socioId, motivo!, nota); setMsj(r.error ? { error: r.error } : { ok: "Listo: el gimnasio te va a contactar." }); })}>
          {ocupado ? "Enviando…" : "Pedir la baja"}
        </button>
        <button type="button" className="boton" onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
      {msj.error && <p role="alert" className="pildora pildora-rojo">⚠️ {msj.error}</p>}
    </div>
  );
}

/** APP-9: crear o cambiar la contraseña (para entrar con mail y contraseña). */
export function CrearContrasena({ email }: { email: string | null }) {
  const [clave, setClave] = useState("");
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  if (!email) return <p className="texto-suave text-sm" data-sin-mail>🔑 Para entrar con contraseña, entrá una vez con tu mail (“✉️ Mail” al ingresar).</p>;
  return (
    <form className="tarjeta p-5 space-y-3" data-crear-contrasena
      onSubmit={(e) => { e.preventDefault(); empezar(async () => { const r = await crearContrasena(clave); setMsj(r.error ? { error: r.error } : { ok: "Listo: ya podés entrar con tu mail y esta contraseña." }); if (!r.error) setClave(""); }); }}>
      <h2 className="titulo text-2xl">🔑 Mi contraseña</h2>
      <p className="texto-suave">Para entrar con <strong>{email}</strong> sin esperar un código.</p>
      <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} minLength={8} required autoComplete="new-password" placeholder="8 letras o más" className="campo w-full" aria-label="Contraseña nueva" />
      <button type="submit" disabled={ocupado || clave.length < 8} className="boton w-full">{ocupado ? "Guardando…" : "Guardar contraseña"}</button>
      {msj.ok && <p role="status" className="mensaje mensaje-exito">✅ {msj.ok}</p>}
      {msj.error && <p role="alert" className="pildora pildora-rojo">⚠️ {msj.error}</p>}
    </form>
  );
}
