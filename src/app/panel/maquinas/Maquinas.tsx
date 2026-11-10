"use client";
// VD-54: la lista de máquinas, reportar una falla (con foto), asignar quién la arregla, cerrarla y ver el historial.
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Mensaje } from "@/components/ui/Mensaje";
import { arreglarFalla, asignarResponsable, crearMaquina, darDeBajaMaquina, historialMaquina, reportarFalla, sumarFotoFalla, verFotoFalla, type FallaHistorial } from "./acciones";
import { Icono } from "@/components/ui/Icono";

export type MaquinaPanel = {
  maquina_id: string; nombre: string; sede_id: string; sede: string; activa: boolean; estado: "fuera_de_servicio" | "en_servicio";
  falla: null | { falla_id: string; motivo: string; reportada_en: string; reportada_por: string; tiene_foto: boolean; responsable_id: string | null; responsable: string | null; puede_subir_foto: boolean };
  ultima_falla_en: string | null; ultimo_arreglo_en: string | null; cantidad_fallas: number;
};
export type DatosMaquinas = {
  puede_gestionar: boolean; equipo: { equipo_id: string; nombre: string; rol: string }[]; sedes: { sede_id: string; nombre: string }[]; maquinas: MaquinaPanel[];
};

const fecha = (m: string, zona: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
const dia = (m: string, zona: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "numeric", month: "short" }).format(new Date(m));

export function AltaMaquina({ sedes }: { sedes: { sede_id: string; nombre: string }[] }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [sede, setSede] = useState(sedes[0]?.sede_id ?? "");
  const [error, setError] = useState<string | null>(null);
  if (!abierto) return <button type="button" className="boton" onClick={() => setAbierto(true)} data-nueva-maquina><Icono nombre="mas" /> Cargar una máquina</button>;
  const guardar = async () => {
    setError(null);
    const r = await crearMaquina(sede, nombre);
    if (r.error) { setError(r.error); return; }
    setNombre(""); setAbierto(false);
  };
  return (
    <form className="tarjeta p-4 space-y-3 aparecer" onSubmit={(e) => e.preventDefault()} data-form-maquina>
      <label className="block space-y-1"><span className="etiqueta">Nombre de la máquina</span>
        <input className="campo" maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Prensa 45°, Cinta 3, Remo…" data-maquina-nombre /></label>
      {sedes.length > 1 && (
        <label className="block space-y-1"><span className="etiqueta">Sede</span>
          <select className="campo" value={sede} onChange={(e) => setSede(e.target.value)}>{sedes.map((s) => <option key={s.sede_id} value={s.sede_id}>{s.nombre}</option>)}</select></label>
      )}
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <div className="flex flex-wrap gap-2">
        <BotonAccion className="boton boton-principal" disabled={!nombre.trim()} onClick={guardar} ocupadoTexto="Guardando…" data-guardar-maquina>Guardar</BotonAccion>
        <button type="button" className="boton" onClick={() => { setAbierto(false); setError(null); }}>Cancelar</button>
      </div>
    </form>
  );
}

function FotoVer({ fallaId }: { fallaId: string }) {
  const [error, setError] = useState<string | null>(null);
  const abrir = async () => {
    setError(null);
    const r = await verFotoFalla(fallaId);
    if (r.error) { setError(r.error); return; }
    window.open(r.url, "_blank", "noopener");
  };
  return (
    <span>
      <button type="button" className="text-sm underline texto-suave" onClick={abrir} data-ver-foto-falla><Icono nombre="camara" /> Ver la foto</button>
      {error && <span className="text-sm ml-2" role="alert">{error}</span>}
    </span>
  );
}

function FotoSumar({ fallaId }: { fallaId: string }) {
  const [error, setError] = useState<string | null>(null);
  const subir = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    const fd = new FormData(); fd.set("foto", f);
    const r = await sumarFotoFalla(fallaId, fd);
    if (r.error) setError(r.error);
  };
  return (
    <label className="text-sm underline texto-suave cursor-pointer"><Icono nombre="camara" /> Sumar una foto
      <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" aria-label="Foto de la falla" onChange={(e) => void subir(e.target.files?.[0])} />
      {error && <span className="block" role="alert">{error}</span>}
    </label>
  );
}

function Reportar({ m, datos, cerrar }: { m: MaquinaPanel; datos: DatosMaquinas; cerrar: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [resp, setResp] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const guardar = async () => {
    setError(null);
    let fd: FormData | null = null;
    if (foto) { fd = new FormData(); fd.set("foto", foto); }
    const r = await reportarFalla(m.maquina_id, motivo, resp || null, fd);
    if (r.error) { setError(r.error); return; }
    cerrar();
  };
  return (
    <form className="space-y-3 aparecer" onSubmit={(e) => e.preventDefault()} data-form-falla>
      <label className="block space-y-1"><span className="etiqueta">¿Qué le pasa?</span>
        <textarea className="campo min-h-20" maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Se corta el cable, no arranca, hace ruido…" data-falla-motivo /></label>
      <label className="block space-y-1"><span className="etiqueta">Foto (opcional)</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="campo" aria-label="Foto de la falla" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} data-falla-foto /></label>
      {datos.puede_gestionar && (
        <label className="block space-y-1"><span className="etiqueta">¿A quién le toca arreglarla? (opcional)</span>
          <select className="campo" value={resp} onChange={(e) => setResp(e.target.value)} data-falla-responsable>
            <option value="">Todavía no se sabe</option>
            {datos.equipo.map((q) => <option key={q.equipo_id} value={q.equipo_id}>{q.nombre}</option>)}
          </select></label>
      )}
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <div className="flex flex-wrap gap-2">
        <BotonAccion className="boton boton-principal" disabled={motivo.trim().length < 3} onClick={guardar} ocupadoTexto="Guardando…" data-guardar-falla><Icono nombre="punto-amarillo" /> Marcar fuera de servicio</BotonAccion>
        <button type="button" className="boton" onClick={cerrar}>Cancelar</button>
      </div>
    </form>
  );
}

function Historial({ id, zona }: { id: string; zona: string }) {
  const [filas, setFilas] = useState<FallaHistorial[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const alternar = async () => {
    if (abierto) { setAbierto(false); return; }
    setAbierto(true);
    const r = await historialMaquina(id);
    if (r.error) setError(r.error); else setFilas(r.fallas ?? []);
  };
  return (
    <div>
      <button type="button" className="text-sm underline texto-suave" onClick={alternar} data-ver-historial>{abierto ? "Ocultar el historial" : "Ver el historial"}</button>
      {abierto && (
        <div className="mt-2 space-y-2" data-historial-maquina>
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          {filas && filas.length === 0 && <p className="texto-suave text-sm">Nunca falló.</p>}
          {filas?.map((f) => (
            <p key={f.falla_id} className="text-sm border-l-2 border-[var(--borde)] pl-3 break-words">
              <span className="font-semibold">{dia(f.reportada_en, zona)}</span>: {f.motivo} <span className="texto-tenue">(lo marcó {f.reportada_por}{f.responsable ? `, le tocaba a ${f.responsable}` : ""})</span>
              <br />{f.arreglada_en
                ? <><Icono nombre="ok" /> Arreglada el {dia(f.arreglada_en, zona)} por {f.arreglada_por}{f.dias_fuera ? ` (${f.dias_fuera} ${f.dias_fuera === 1 ? "día" : "días"} fuera)` : ""}{f.nota_arreglo ? `: ${f.nota_arreglo}` : ""}</>
                : <><Icono nombre="punto-amarillo" /> Sigue fuera de servicio</>}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function TarjetaMaquina({ m, datos, zona, mostrarSede }: { m: MaquinaPanel; datos: DatosMaquinas; zona: string; mostrarSede: boolean }) {
  const [reportando, setReportando] = useState(false);
  const [nota, setNota] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fuera = m.estado === "fuera_de_servicio" && m.falla;
  const gestiona = datos.puede_gestionar;

  const arreglar = async () => {
    if (!m.falla) return;
    setError(null);
    const r = await arreglarFalla(m.falla.falla_id, nota);
    if (r.error) { setError(r.error); return; }
    setCerrando(false); setNota("");
  };
  const cambiarResp = async (v: string) => {
    if (!m.falla) return;
    setError(null);
    const r = await asignarResponsable(m.falla.falla_id, v || null);
    if (r.error) setError(r.error);
  };
  return (
    <li className="tarjeta p-4 space-y-3 min-w-0" data-maquina={m.maquina_id} data-estado={m.estado}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold text-lg"><Icono nombre="pesa" /> {m.nombre}</span>
        {mostrarSede && <span className="texto-tenue text-sm">{m.sede}</span>}
        {!m.activa ? <span className="pildora">de baja</span>
          : fuera ? <span className="pildora" data-pildora-estado="fuera"><Icono nombre="punto-amarillo" /> Fuera de servicio</span>
          : <span className="pildora" data-pildora-estado="servicio"><Icono nombre="ok" /> En servicio</span>}
        {m.ultima_falla_en && !fuera && <span className="texto-tenue text-sm">última falla: {dia(m.ultima_falla_en, zona)}</span>}
      </div>

      {fuera && m.falla && (
        <div className="space-y-1 text-sm">
          <p className="break-words"><span className="font-semibold">Desde el {fecha(m.falla.reportada_en, zona)}</span> · lo marcó {m.falla.reportada_por}: {m.falla.motivo}</p>
          <p className="texto-suave"><Icono nombre="ajustes" /> Le toca a: {gestiona ? (
            <select className="campo !min-h-9 !py-1 !w-auto inline-block" value={m.falla.responsable_id ?? ""} onChange={(e) => void cambiarResp(e.target.value)} aria-label="Quién la arregla" data-responsable>
              <option value="">Todavía no se sabe</option>
              {datos.equipo.map((q) => <option key={q.equipo_id} value={q.equipo_id}>{q.nombre}</option>)}
            </select>
          ) : <span data-responsable-texto>{m.falla.responsable ?? "todavía no se sabe"}</span>}</p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            {m.falla.tiene_foto && <FotoVer fallaId={m.falla.falla_id} />}
            {!m.falla.tiene_foto && m.falla.puede_subir_foto && <FotoSumar fallaId={m.falla.falla_id} />}
          </p>
        </div>
      )}

      {error && <Mensaje tipo="error">{error}</Mensaje>}

      {m.activa && reportando && !fuera && <Reportar m={m} datos={datos} cerrar={() => setReportando(false)} />}
      {fuera && gestiona && cerrando && (
        <div className="space-y-2 aparecer">
          <label className="block space-y-1"><span className="etiqueta">¿Qué se hizo? (opcional)</span>
            <input className="campo" maxLength={500} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Se cambió el cable, vino el técnico…" data-arreglo-nota /></label>
          <div className="flex flex-wrap gap-2">
            <BotonAccion className="boton boton-principal" onClick={arreglar} ocupadoTexto="Guardando…" data-confirmar-arreglo><Icono nombre="ok" /> Confirmar: vuelve a estar en servicio</BotonAccion>
            <button type="button" className="boton" onClick={() => setCerrando(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {m.activa && !fuera && !reportando && <button type="button" className="boton" onClick={() => setReportando(true)} data-reportar-falla><Icono nombre="punto-amarillo" /> Está rota</button>}
        {fuera && gestiona && !cerrando && <button type="button" className="boton boton-principal" onClick={() => setCerrando(true)} data-arreglada><Icono nombre="ok" /> Quedó arreglada</button>}
        {gestiona && !fuera && (
          <BotonAccion className="text-sm underline texto-suave" onClick={async () => { const r = await darDeBajaMaquina(m.maquina_id, !m.activa); if (r.error) setError(r.error); }} ocupadoTexto="…">
            {m.activa ? "Dar de baja" : "Volver a dar de alta"}
          </BotonAccion>
        )}
      </div>
      {m.cantidad_fallas > 0 && <Historial id={m.maquina_id} zona={zona} />}
    </li>
  );
}
