"use client";
import { rutaGimnasio } from "@/lib/urls";
import { CampoContrasena } from "@/components/cuentas/CampoContrasena";
import Link from "next/link";
import { useRef, useState, useActionState } from "react";
import { crearGimnasio, type EstadoAlta } from "./acciones";
import { BotonEntrar } from "./BotonEntrar";
import { ListaPrueba } from "./ListaPrueba";
import { AccesoPersona } from "@/components/cuentas/AccesoPersona";

// ADM-1: el tipo de gimnasio prende lo que corresponde y crea planes de ejemplo (sin precio).
const TIPOS: [string, string][] = [
  ["", "Sin plantilla (todo apagado)"], ["musculacion", "🏋️ Musculación de barrio"], ["grande", "🏢 Gimnasio grande o cadena"],
  ["box", "🔥 Box de crossfit o funcional"], ["yoga", "🧘 Yoga o pilates"], ["artes", "🥋 Artes marciales o escuela deportiva"],
  ["natacion", "🏊 Natación"], ["personal", "💪 Entrenador personal o estudio chico"], ["24h", "🌙 24 horas o sin recepción"],
];
const aSlug = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42);
const PASOS = ["Tipo", "Datos y marca", "Dueño"];

/** VD-40: el alta en 3 pasos (tipo → datos y marca con vista previa → dueño). Todos los campos viven en un solo formulario. */
export function AltaGimnasio({ dominio, planes = [] }: { dominio: string; planes?: { id: string; nombre: string }[] }) {
  const [estado, accion, creando] = useActionState<EstadoAlta, FormData>(crearGimnasio, {});
  const [paso, setPaso] = useState(1);
  const [tipo, setTipo] = useState("musculacion");
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [tocado, setTocado] = useState(false);
  const [acento, setAcento] = useState("#16a34a");
  const [fondo, setFondo] = useState("#F4F5F6");
  const [falta, setFalta] = useState("");
  const [copiado, setCopiado] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);
  const ok = estado.ok;

  const siguiente = () => {
    if (paso === 2 && (!nombre.trim() || !slug)) { setFalta("Escribí el nombre del gimnasio para seguir"); return; }
    setFalta("");
    setPaso((p) => Math.min(3, p + 1));
  };
  const tipoNombre = TIPOS.find(([v]) => v === tipo)?.[1] ?? "";
  const direccion = `${slug || "nombre"}.${dominio || "(falta el dominio)"}`;

  return (
    <section className="tarjeta p-5 sm:p-6 space-y-4" data-alta-gimnasio>
      <p className="titulo text-2xl">➕ Nuevo gimnasio</p>
      {ok ? (
        <div role="status" className="space-y-4">
          {ok.pendiente ? (
            <div className="space-y-2" data-alta-a-medias>
              <p className="text-lg" role="alert">⚠️ <strong>{ok.nombre}</strong>: {ok.aviso}</p>
              <Link href={`/admin/${ok.gimnasio_id}`} className="boton boton-principal" data-terminar-alta>Terminar alta: dar acceso al dueño</Link>
            </div>
          ) : (
            <p className="text-lg">✅ <strong>{ok.nombre}</strong> está creado. {ok.aviso}</p>
          )}
          {ok.contrasenaNoAplicada && ok.equipoId && (
            <div className="tarjeta p-4 space-y-2" role="alert" data-contrasena-no-aplicada>
              <p className="font-semibold">La contraseña que escribiste no se aplicó</p>
              <p className="texto-suave text-sm">{ok.email} ya tenía cuenta: sigue entrando con la contraseña de siempre. Si querés ponerle una nueva, usá este botón.</p>
              <div className="flex flex-wrap gap-2 items-center"><AccesoPersona equipoId={ok.equipoId} nombre="el dueño" tieneCuenta /></div>
            </div>
          )}
          {ok.accesos && (ok.contrasena || ok.yaExistia) && (
            <div className="tarjeta !bg-[var(--tarjeta-alta)] p-4 space-y-3" data-accesos>
              <p className="font-semibold">Accesos del dueño <span className="texto-suave text-sm font-normal">{ok.contrasena ? "(la contraseña se muestra una sola vez)" : "(ya tenía cuenta: no hay contraseña nueva)"}</span></p>
              <dl className="grid gap-1">
                {ok.accesos && <div className="flex flex-wrap gap-x-2"><dt className="texto-suave">Su panel</dt><dd><a href={ok.accesos.panel} target="_blank" rel="noopener noreferrer" className="underline break-all" data-acceso-panel>{ok.accesos.panel}</a></dd></div>}
                <div className="flex flex-wrap gap-x-2"><dt className="texto-suave">Mail</dt><dd><strong className="break-all">{ok.email}</strong></dd></div>
                {ok.contrasena && <div className="flex flex-wrap gap-x-2 items-center"><dt className="texto-suave">Contraseña</dt><dd><strong className="numero text-2xl select-all">{ok.contrasena}</strong></dd></div>}
                {ok.accesos && <div className="flex flex-wrap gap-x-2"><dt className="texto-suave">Su web</dt><dd><a href={ok.accesos.web} target="_blank" rel="noopener noreferrer" className="underline break-all" data-acceso-web>{ok.accesos.web}</a></dd></div>}
              </dl>
              {ok.accesos && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="boton" data-copiar-accesos onClick={async () => { try { await navigator.clipboard.writeText(ok.accesos!.texto); setCopiado(true); } catch { setCopiado(false); } }}>{copiado ? "Copiado" : "Copiar los accesos"}</button>
                  <a href={ok.accesos.wa ?? "#"} target="_blank" rel="noopener noreferrer" className="boton boton-principal" data-accesos-wa>Mandar por WhatsApp</a>
                </div>
              )}
            </div>
          )}
          {ok.prueba && (
            <div className="tarjeta p-4 space-y-2" data-prueba-alta data-ok={ok.prueba.ok ? "si" : "no"}>
              <p className="font-semibold">Probar acceso: {ok.prueba.ok ? "todo en verde" : "hay algo para arreglar"}</p>
              <ListaPrueba pasos={ok.prueba.pasos} />
              {ok.prueba.duenos.map((d) => (<div key={d.equipo_id} className="space-y-1"><p className="texto-suave text-sm">Dueño: {d.nombre}</p><ListaPrueba pasos={d.pasos} /></div>))}
            </div>
          )}
          {ok.bienvenida && (
            <div className="space-y-2" data-bienvenida>
              <p className="etiqueta">Mensaje de bienvenida para el dueño</p>
              <textarea readOnly rows={5} className="campo select-all" value={ok.bienvenida.texto} />
              {ok.bienvenida.wa
                ? <a href={ok.bienvenida.wa} target="_blank" rel="noopener noreferrer" className="boton" data-whatsapp>💬 Mandar por WhatsApp</a>
                : <p className="texto-tenue text-sm">Copiá el mensaje y mandáselo. Si cargás su celular en el paso 3, te lo deja listo para WhatsApp.</p>}
            </div>
          )}
          <div className="flex flex-wrap gap-2 items-start">
            <BotonEntrar gimnasioId={ok.gimnasio_id} texto="🚪 Entrar al panel a terminar de configurarlo" motivoInicial="Alta del gimnasio: terminar de configurarlo" />
            <Link href={`/admin/${ok.gimnasio_id}`} className="boton" data-alta-equipo>⚙️ Equipo, claves y direcciones</Link>
            <a href={rutaGimnasio(ok.slug)} target="_blank" rel="noopener noreferrer" className="boton">🌐 Ver su página</a>
            <button type="button" className="boton texto-suave" onClick={() => window.location.reload()}>➕ Crear otro</button>
          </div>
        </div>
      ) : (
        <form ref={formulario} action={accion} className="space-y-4"
          onKeyDown={(e) => { if (e.key === "Enter" && paso < 3 && (e.target as HTMLElement).tagName === "INPUT") { e.preventDefault(); siguiente(); } }}>
          <ol className="flex flex-wrap gap-2 text-sm" aria-label="Pasos del alta">
            {PASOS.map((n, i) => (
              <li key={n} aria-current={paso === i + 1 ? "step" : undefined}
                className={`pildora ${paso === i + 1 ? "pildora-verde" : paso > i + 1 ? "" : "texto-tenue"}`}>{i + 1} · {n}</li>
            ))}
          </ol>

          <div hidden={paso !== 1} data-alta-paso="1" className="space-y-2">
            <label className="space-y-1 block"><span className="etiqueta">Tipo de gimnasio</span>
              <select name="tipo" className="campo" value={tipo} onChange={(e) => setTipo(e.target.value)}>{TIPOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
            <span className="block text-sm texto-tenue">Prende las clases y lo que cobra, y deja planes de ejemplo sin precio: el dueño los ajusta.</span>
          </div>

          <div hidden={paso !== 2} data-alta-paso="2" className={paso === 2 ? "grid lg:grid-cols-2 gap-4" : "hidden"}>
            <div className="grid sm:grid-cols-2 gap-3 content-start">
              <label className="space-y-1"><span className="etiqueta">Nombre del gimnasio</span>
                <input name="nombre" className="campo" value={nombre} placeholder="Olympo Gym"
                  onChange={(e) => { setNombre(e.target.value); if (!tocado) setSlug(aSlug(e.target.value)); }} /></label>
              <label className="space-y-1"><span className="etiqueta">Dirección</span>
                <input name="slug" className="campo" value={slug} placeholder="olympo-gym"
                  onChange={(e) => { setTocado(true); setSlug(aSlug(e.target.value)); }} />
                <span className="block text-sm texto-tenue break-all">{direccion}</span></label>
              <label className="space-y-1"><span className="etiqueta">Color principal</span>
                <input name="color_acento" type="color" className="campo !p-1 h-12" value={acento} onChange={(e) => setAcento(e.target.value)} /></label>
              <label className="space-y-1"><span className="etiqueta">Color de fondo</span>
                <input name="color_fondo" type="color" className="campo !p-1 h-12" value={fondo} onChange={(e) => setFondo(e.target.value)} /></label>
              {planes.length > 0 && (
                <label className="space-y-1 sm:col-span-2"><span className="etiqueta">Plan de Base (opcional)</span>
                  <select name="plan_brik" className="campo" defaultValue="" data-plan-brik>
                    <option value="">Sin plan: lo asigno después</option>
                    {planes.map((pl) => <option key={pl.id} value={pl.id}>{pl.nombre}</option>)}
                  </select></label>
              )}
              <p className="sm:col-span-2 texto-tenue text-sm">El logo lo sube el dueño (o vos, entrando a terminar de configurarlo) desde Configuración.</p>
            </div>
            <div className="rounded-2xl p-5 space-y-3 border border-[var(--borde,#0002)]" style={{ background: fondo }} data-vista-previa aria-label="Vista previa">
              <p className="text-xs uppercase tracking-wide opacity-60" style={{ color: "#111" }}>Vista previa · {tipoNombre.replace(/^\S+\s/, "") || "sin plantilla"}</p>
              <p className="flex items-center gap-3">
                <span className="grid place-items-center size-12 rounded-xl text-xl font-bold text-white" style={{ background: acento }} aria-hidden>{(nombre.trim()[0] ?? "G").toUpperCase()}</span>
                <span className="text-2xl font-bold" style={{ color: "#111" }}>{nombre.trim() || "Tu gimnasio"}</span>
              </p>
              <p className="text-sm break-all" style={{ color: "#444" }}>{direccion}</p>
              <span className="inline-block rounded-xl px-5 py-3 font-semibold text-white" style={{ background: acento }}>Soy socio</span>
            </div>
          </div>

          <div hidden={paso !== 3} data-alta-paso="3" className={paso === 3 ? "grid sm:grid-cols-2 gap-3" : "hidden"}>
            <label className="space-y-1"><span className="etiqueta">Nombre del dueño</span><input name="dueno" className="campo" placeholder="Nombre y apellido" /></label>
            <label className="space-y-1"><span className="etiqueta">Mail del dueño</span>
              <input name="email" type="email" className="campo" placeholder="Para crearle la cuenta" />
              <CampoContrasena />
              <span className="block text-sm texto-tenue">Si lo dejás vacío, le das acceso después.</span></label>
            <label className="space-y-1"><span className="etiqueta">Celular del dueño (opcional)</span>
              <input name="celular" type="tel" inputMode="tel" className="campo" placeholder="+54 9 387 …" />
              <span className="block text-sm texto-tenue">Para dejarte listo el WhatsApp de bienvenida. No se guarda.</span></label>
          </div>

          {(falta || estado.error) && <p role="alert" className="pildora pildora-rojo !rounded-2xl !px-4 !py-3">⚠️ {falta || estado.error}</p>}
          <div className="flex flex-wrap gap-2">
            {paso > 1 && <button type="button" className="boton" onClick={() => { setFalta(""); setPaso((p) => p - 1); }}>← Atrás</button>}
            {paso < 3
              ? <button key="siguiente" type="button" className="boton boton-principal" onClick={siguiente}>Siguiente →</button>
              : <button key="crear" type="submit" disabled={creando} className="boton boton-principal">{creando ? "Creando…" : "🏋️ Crear gimnasio"}</button>}
          </div>
        </form>
      )}
    </section>
  );
}
