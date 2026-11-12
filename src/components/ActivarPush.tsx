"use client";
import { useEffect, useState, useTransition } from "react";
import { borrarPush, estadoPush, guardarPush, probarPush } from "@/app/push-acciones";
import { Icono } from "@/components/ui/Icono";

const NOMBRE: Record<string, string> = {
  comprobantes: "Comprobantes para revisar",
  caja: "La caja: diferencias al cerrar y retiros",
  pedidos: "Pedidos de anular una venta",
  pagos: "Mis pagos: aprobado o rechazado",
  clases: "Clases que se cancelan",
};
const CLAVE = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function bytes(base64: string) {
  const b = atob((base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };

/**
 * PUSH-1: activar las notificaciones en ESTE dispositivo y elegir qué recibir.
 * Sin soporte o sin claves, lo dice (nunca un botón que no hace nada).
 */
export function ActivarPush() {
  const [soporte, setSoporte] = useState<"si" | "no" | "iphone" | null>(null);
  const [sub, setSub] = useState<Sub | null>(null);
  const [puede, setPuede] = useState<string[]>([]);
  const [tipos, setTipos] = useState<string[] | null>(null);
  const [aviso, setAviso] = useState<{ ok?: string; error?: string }>({});
  const [ocupado, empezar] = useTransition();

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const instalada = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { setSoporte(ios && !instalada ? "iphone" : "no"); return; }
    setSoporte("si");
    void (async () => {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const actual = await reg.pushManager.getSubscription();
      const s = actual ? (actual.toJSON() as Sub) : null;
      setSub(s);
      const e = await estadoPush(s?.endpoint ?? null);
      if (e.error) setAviso({ error: e.error });
      setPuede(e.puede); setTipos(e.tipos);
    })().catch((e) => setAviso({ error: (e as Error).message }));
  }, []);

  if (soporte === null) return null;
  if (soporte === "iphone") return <p className="texto-suave" data-push="iphone"><Icono nombre="celular" /> En iPhone, las notificaciones llegan a la app instalada: tocá <b>Compartir</b> → <b>Agregar a inicio</b>, abrila desde ahí y activalas.</p>;
  if (soporte === "no") return <p className="texto-suave" data-push="sin-soporte">Este navegador no recibe notificaciones. Probá desde Chrome, Edge o Safari actualizado.</p>;
  if (!CLAVE) return <p className="texto-suave" data-push="sin-claves">Las notificaciones todavía no están configuradas en este sistema.</p>;

  const activar = () => empezar(async () => {
    setAviso({});
    if ((await Notification.requestPermission()) !== "granted") { setAviso({ error: "El navegador no dio permiso. Habilitalo en la configuración del sitio y volvé a tocar." }); return; }
    const reg = await navigator.serviceWorker.ready;
    const s = (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(CLAVE) })).toJSON() as Sub;
    const r = await guardarPush(s, null);
    if (r.error) { setAviso({ error: r.error }); return; }
    const e = await estadoPush(s.endpoint);
    setSub(s); setPuede(e.puede); setTipos(e.tipos); setAviso({ ok: "Listo: este dispositivo recibe avisos." });
  });
  const cambiar = (t: string, si: boolean) => empezar(async () => {
    if (!sub || !tipos) return;
    const nuevos = si ? [...tipos, t] : tipos.filter((x) => x !== t);
    const r = await guardarPush(sub, nuevos);
    if (r.error) setAviso({ error: r.error }); else { setTipos(nuevos); setAviso({ ok: "Guardado." }); }
  });
  const apagar = () => empezar(async () => {
    if (!sub) return;
    const r = await borrarPush(sub.endpoint);
    if (r.error) { setAviso({ error: r.error }); return; }
    await (await navigator.serviceWorker.ready).pushManager.getSubscription().then((x) => x?.unsubscribe());
    setSub(null); setTipos(null); setAviso({ ok: "Apagadas en este dispositivo." });
  });
  const probar = () => empezar(async () => {
    if (!sub) return;
    const r = await probarPush(sub);
    setAviso(r.error ? { error: r.error } : { ok: "Mandada: tiene que aparecer en unos segundos." });
  });

  return (
    <div className="space-y-3" data-push={tipos ? "activo" : "apagado"}>
      {!tipos ? (
        <button type="button" className="boton !min-h-12" disabled={ocupado} onClick={activar}><Icono nombre="campana" /> Activar en este dispositivo</button>
      ) : (
        <>
          <ul className="space-y-1">
            {puede.map((t) => (
              <li key={t}>
                <label className="flex items-center gap-3 min-h-11">
                  <input type="checkbox" className="size-5" checked={tipos.includes(t)} disabled={ocupado} onChange={(e) => cambiar(t, e.target.checked)} />
                  {NOMBRE[t] ?? t}
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="boton !min-h-11" disabled={ocupado} onClick={probar}>Mandarme una de prueba</button>
            <button type="button" className="boton !min-h-11 texto-suave" disabled={ocupado} onClick={apagar}>Apagar en este dispositivo</button>
          </div>
        </>
      )}
      {aviso.ok && <p role="status" className="text-sm" style={{ color: "var(--acento)" }}><Icono nombre="ok" /> {aviso.ok}</p>}
      {aviso.error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {aviso.error}</p>}
    </div>
  );
}
