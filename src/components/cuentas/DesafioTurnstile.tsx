"use client";
import { useEffect, useRef, useState } from "react";

// VD-33c · El desafío de Cloudflare Turnstile. Sin NEXT_PUBLIC_TURNSTILE_SITE_KEY no dibuja nada (todo sigue
// igual). Con la clave, deja el token en un campo oculto del formulario ("cf-turnstile-response") y el servidor
// lo verifica con Cloudflare antes de mandar el código.
type Api = {
  render: (el: HTMLElement, o: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};
declare global { interface Window { turnstile?: Api } }

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let cargando: Promise<void> | null = null;
function cargarScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  cargando ??= new Promise<void>((ok, mal) => {
    const s = document.createElement("script");
    s.src = SCRIPT; s.async = true;
    s.onload = () => ok();
    s.onerror = () => { cargando = null; mal(new Error("No cargó el desafío")); };
    document.head.appendChild(s);
  });
  return cargando;
}

export function DesafioTurnstile() {
  const clave = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const caja = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState("");
  const [falla, setFalla] = useState(false);

  useEffect(() => {
    if (!clave || !caja.current) return;
    const el = caja.current;
    let id: string | undefined;
    let vivo = true;
    const form = el.closest("form");
    // El token es de un solo uso: después de mandar el formulario se pide uno nuevo.
    const alMandar = () => setTimeout(() => { if (id) { window.turnstile?.reset(id); setToken(""); } }, 1500);
    cargarScript().then(() => {
      if (!vivo || !window.turnstile) return;
      id = window.turnstile.render(el, {
        sitekey: clave, language: "es", theme: "auto",
        callback: (t: string) => { setToken(t); setFalla(false); },
        "expired-callback": () => setToken(""),
        "error-callback": () => { setToken(""); setFalla(true); },
      });
    }).catch(() => setFalla(true));
    form?.addEventListener("submit", alMandar);
    return () => { vivo = false; form?.removeEventListener("submit", alMandar); if (id) window.turnstile?.remove(id); };
  }, [clave]);

  if (!clave) return null;
  return (
    <div data-desafio>
      <div ref={caja} className="min-h-[65px]" />
      <input type="hidden" name="cf-turnstile-response" value={token} readOnly />
      {falla && <p role="alert" className="texto-suave text-sm mt-1">No se pudo cargar el desafío de seguridad. Revisá tu conexión y recargá la página.</p>}
    </div>
  );
}
