"use client";
import { useState, useTransition } from "react";
import { cambiarContrasena } from "./acciones";
import { Mensaje } from "@/components/ui/Mensaje";

export function CambiarContrasena({ tieneContrasena = false }: { tieneContrasena?: boolean }) {
  const [actual, setActual] = useState("");
  const [a, setA] = useState(""); const [b, setB] = useState("");
  const [msj, setMsj] = useState<{ ok?: boolean; texto?: string }>({});
  const [ocupado, empezar] = useTransition();
  return (
    <form className="tarjeta p-5 sm:p-6 space-y-3 max-w-md" onSubmit={(e) => {
      e.preventDefault();
      if (a !== b) { setMsj({ texto: "Las dos contraseñas no coinciden" }); return; }
      empezar(async () => { const r = await cambiarContrasena(a, actual || undefined); setMsj(r.error ? { texto: r.error } : { ok: true, texto: "Contraseña cambiada ✅" }); if (!r.error) { setActual(""); setA(""); setB(""); } });
    }}>
      <p className="titulo text-2xl">🔑 Cambiar contraseña</p>
      {tieneContrasena && <input type="password" autoComplete="current-password" className="campo" placeholder="La actual" aria-label="Contraseña actual" value={actual} onChange={(e) => setActual(e.target.value)} />}
      <input type="password" autoComplete="new-password" className="campo" placeholder="Nueva (8 caracteres o más)" aria-label="Contraseña nueva" value={a} onChange={(e) => setA(e.target.value)} />
      <input type="password" autoComplete="new-password" className="campo" placeholder="Repetila" aria-label="Repetir la contraseña" value={b} onChange={(e) => setB(e.target.value)} />
      {msj.texto && <Mensaje tipo={msj.ok ? "exito" : "error"}>{msj.texto}</Mensaje>}
      <button type="submit" disabled={ocupado || a.length < 8 || (tieneContrasena && !actual)} className="boton">Guardar</button>
    </form>
  );
}
