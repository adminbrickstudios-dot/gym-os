"use client";
import { useState, useTransition } from "react";
import { cambiarContrasena } from "./acciones";

export function CambiarContrasena() {
  const [a, setA] = useState(""); const [b, setB] = useState("");
  const [msj, setMsj] = useState<{ ok?: boolean; texto?: string }>({});
  const [ocupado, empezar] = useTransition();
  return (
    <form className="tarjeta p-5 sm:p-6 space-y-3 max-w-md" onSubmit={(e) => {
      e.preventDefault();
      if (a !== b) { setMsj({ texto: "Las dos contraseñas no coinciden" }); return; }
      empezar(async () => { const r = await cambiarContrasena(a); setMsj(r.error ? { texto: r.error } : { ok: true, texto: "Contraseña cambiada ✅" }); if (!r.error) { setA(""); setB(""); } });
    }}>
      <p className="titulo text-2xl">🔑 Cambiar contraseña</p>
      <input type="password" autoComplete="new-password" className="campo" placeholder="Nueva (8 caracteres o más)" value={a} onChange={(e) => setA(e.target.value)} />
      <input type="password" autoComplete="new-password" className="campo" placeholder="Repetila" value={b} onChange={(e) => setB(e.target.value)} />
      {msj.texto && <p role="status" className={`pildora ${msj.ok ? "pildora-verde" : "pildora-rojo"}`}>{msj.texto}</p>}
      <button type="submit" disabled={ocupado || a.length < 8} className="boton boton-principal">Guardar</button>
    </form>
  );
}
