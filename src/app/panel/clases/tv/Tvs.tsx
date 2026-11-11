"use client";
import { useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { crearTv, revocarTv } from "../acciones";
import { Icono } from "@/components/ui/Icono";

export type TvPanel = { id: string; nombre: string; sede: string; creado_en: string; modo?: "clases" | "entradas" };

/** COM-14: crear la TV (da un link que se abre una vez en ella) y sacarla. */
/** `puedeSacar` (VD-60, D34): la recepción y el profe ponen y miran las TVs; sacarlas es del dueño y el encargado. */
export function Tvs({ gimnasioId, sedes, tvs, puedeSacar = true }: { gimnasioId: string; sedes: { id: string; nombre: string }[]; tvs: TvPanel[]; puedeSacar?: boolean }) {
  const [nombre, setNombre] = useState("");
  const [sede, setSede] = useState(sedes[0]?.id ?? "");
  const [modo, setModo] = useState<"clases" | "entradas">("clases");
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <div className="space-y-8">
      <form className="tarjeta p-5 space-y-3" data-nueva-tv onSubmit={(e) => {
        e.preventDefault();
        empezar(async () => {
          const r = await crearTv(gimnasioId, sede, nombre, modo);
          if (r.error || !r.token) { setError(r.error ?? "No se pudo crear"); return; }
          setError(null); setNombre(""); setCopiado(false);
          setLink(`${window.location.origin}/tv/activar?t=${r.token}`);
        });
      }}>
        <p className="titulo text-xl"><Icono nombre="mas" /> Nueva TV</p>
        <div className="flex flex-wrap gap-3">
          <input className="campo grow min-w-52" maxLength={40} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Sala de spinning" aria-label="Nombre de la TV" />
          {sedes.length > 1 && (
            <select className="campo" value={sede} onChange={(e) => setSede(e.target.value)} aria-label="Sede">
              {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          )}
          <select className="campo" value={modo} onChange={(e) => setModo(e.target.value as "clases" | "entradas")} aria-label="Qué muestra" data-tv-modo>
            <option value="clases">Muestra las clases</option><option value="entradas">Muestra las entradas</option>
          </select>
          <button type="submit" className="boton boton-principal" disabled={ocupado}>Crear</button>
        </div>
        {error && <Mensaje tipo="error">{error}</Mensaje>}
      </form>
      {link && (
        <div className="mensaje mensaje-exito flex-col items-start gap-2" data-link-tv>
          <p><strong>Abrí este link una vez en el navegador de la TV.</strong> Queda guardada; no lo vas a ver de nuevo.</p>
          <code className="break-all text-sm" data-link={link}>{link}</code>
          <button type="button" className="boton boton-chico" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopiado(true); } catch { setCopiado(false); } }}>
            {copiado ? "Copiado" : "Copiar"}
          </button>
        </div>
      )}
      <section>
        <h2 className="titulo text-2xl mb-3">Las TVs</h2>
        {tvs.length === 0 ? <p className="texto-suave">Todavía no hay ninguna.</p> : (
          <ul className="space-y-2">{tvs.map((t) => <FilaTv key={t.id} t={t} puedeSacar={puedeSacar} />)}</ul>
        )}
      </section>
    </div>
  );
}

function FilaTv({ t, puedeSacar }: { t: TvPanel; puedeSacar: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <li className="tarjeta px-4 py-3 flex flex-wrap items-center gap-3" data-tv-fila={t.nombre}>
      <span className="grow"><Icono nombre="pantalla" /> <span className="font-semibold">{t.nombre}</span> <span className="texto-suave">· {t.sede} · {t.modo === "entradas" ? "entradas" : "clases"}</span></span>
      {puedeSacar && <button type="button" className="underline text-sm" disabled={ocupado}
        onClick={() => empezar(async () => { const r = await revocarTv(t.id); setError(r.error ?? null); })}>Sacar</button>}
      {error && <Mensaje tipo="error" className="w-full">{error}</Mensaje>}
    </li>
  );
}
