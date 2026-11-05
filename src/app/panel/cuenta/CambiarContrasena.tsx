"use client";
import { useState, useTransition } from "react";
import { cambiarContrasena } from "./acciones";
import { Mensaje } from "@/components/ui/Mensaje";

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
      <input type="password" autoComplete="new-password" className="campo" placeholder="Nueva (8 caracteres o más)" aria-label="Contraseña nueva" value={a} onChange={(e) => setA(e.target.value)} />
      <input type="password" autoComplete="new-password" className="campo" placeholder="Repetila" aria-label="Repetir la contraseña" value={b} onChange={(e) => setB(e.target.value)} />
      {msj.texto && <Mensaje tipo={msj.ok ? "exito" : "error"}>{msj.texto}</Mensaje>}
      <button type="submit" disabled={ocupado || a.length < 8} className="boton boton-principal">Guardar</button>
    </form>
  );
}
