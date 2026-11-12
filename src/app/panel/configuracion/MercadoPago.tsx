"use client";
import { useState, useTransition } from "react";
import { conectarMercadoPago, desconectarMercadoPago, probarMercadoPago, type EstadoMP } from "./acciones";
import { Icono } from "@/components/ui/Icono";

/**
 * PAY-1: conectar MercadoPago para que los socios paguen desde la app. El
 * token y la clave del webhook se guardan en Vault y no se vuelven a mostrar.
 */
export function MercadoPago({ estado, puedeEditar }: { estado: EstadoMP; puedeEditar: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [token, setToken] = useState("");
  const [secreto, setSecreto] = useState("");
  const [modo, setModo] = useState<"prueba" | "produccion">(estado.modo ?? "produccion");
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  const conectar = () => empezar(async () => {
    const r = await conectarMercadoPago(token, secreto, modo);
    if (r.error) setMsj({ error: r.error }); else { setMsj({ ok: "Conectado. Los socios ya ven “Pagar con MercadoPago” en la app." }); setAbierto(false); setToken(""); setSecreto(""); }
  });
  const desconectar = () => empezar(async () => {
    const r = await desconectarMercadoPago();
    setMsj(r.error ? { error: r.error } : { ok: "Desconectado: la app ya no ofrece pagar con MercadoPago." });
  });
  const probar = () => empezar(async () => {
    const r = await probarMercadoPago();
    setMsj(r.error ? { error: r.error } : { ok: `La conexión funciona: es la cuenta de ${r.cuenta}.` });
  });
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-4" data-mercadopago={estado.conectado ? "conectado" : "no"}>
      <div>
        <p className="titulo text-2xl"><Icono nombre="tarjeta" /> Pagos online con MercadoPago</p>
        <p className="texto-suave">Que los socios paguen la cuota desde la app. Queda al día apenas MercadoPago avisa; la plata va a tu cuenta de MercadoPago.</p>
        <p className="font-semibold" data-mp-plata-directa>La plata de tus socios va directo a tu cuenta de MercadoPago. Nunca pasa por Base ni por BRIK.</p>
      </div>
      {estado.conectado ? (
        <p className="pildora pildora-verde !text-base"><Icono nombre="ok" /> Conectado{estado.modo === "prueba" ? " en modo prueba" : ""}{estado.por ? ` por ${estado.por}` : ""}</p>
      ) : <p className="texto-suave">No conectado.</p>}
      {puedeEditar && !abierto && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="boton" onClick={() => setAbierto(true)}>{estado.conectado ? "Cambiar credenciales" : "Conectar MercadoPago"}</button>
          {estado.conectado && <button type="button" className="boton" disabled={ocupado} onClick={probar} data-probar-mp>{ocupado ? "Probando…" : "Probar conexión"}</button>}
          {estado.conectado && <button type="button" className="boton texto-suave" disabled={ocupado} onClick={desconectar}>Desconectar</button>}
        </div>
      )}
      {puedeEditar && abierto && (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); conectar(); }}>
          <ol className="list-decimal pl-5 texto-suave space-y-1 text-[15px]">
            <li>En MercadoPago → Tus integraciones, creá una aplicación (Checkout Pro).</li>
            <li>En Credenciales, copiá el <b>Access Token</b> (de producción, o el de prueba para probar).</li>
            <li>En Webhooks, activá el evento <b>Pagos</b> y copiá la <b>clave secreta</b>.</li>
          </ol>
          <label className="grid gap-1">Access Token
            <input className="campo font-mono" value={token} onChange={(e) => setToken(e.target.value)} placeholder="APP_USR-…" autoComplete="off" spellCheck={false} required />
          </label>
          <label className="grid gap-1">Clave secreta del webhook
            <input className="campo font-mono" value={secreto} onChange={(e) => setSecreto(e.target.value)} autoComplete="off" spellCheck={false} required />
          </label>
          <fieldset className="flex flex-wrap gap-4">
            <legend className="sr-only">Modo</legend>
            <label className="flex items-center gap-2 min-h-11"><input type="radio" name="modo" checked={modo === "produccion"} onChange={() => setModo("produccion")} /> Producción (cobra de verdad)</label>
            <label className="flex items-center gap-2 min-h-11"><input type="radio" name="modo" checked={modo === "prueba"} onChange={() => setModo("prueba")} /> Prueba</label>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="boton" disabled={ocupado}>{ocupado ? "Guardando…" : "Guardar y conectar"}</button>
            <button type="button" className="boton texto-suave" onClick={() => setAbierto(false)}>Cancelar</button>
          </div>
          <p className="text-sm texto-tenue">Se guardan cifrados y no se vuelven a mostrar.</p>
        </form>
      )}
      {msj.ok && <p role="status" className="text-sm" style={{ color: "var(--acento)" }}><Icono nombre="ok" /> {msj.ok}</p>}
      {msj.error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {msj.error}</p>}
    </section>
  );
}
