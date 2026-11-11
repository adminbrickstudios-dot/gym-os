"use client";
// Pestaña Horarios: cuándo abre cada sede y los días que cierra (feriados,
// vacaciones). El "abierto ahora" lo calcula la base (privado.agenda), igual
// que en la página y la app.
import { useEffect, useMemo, useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { Interruptor } from "@/components/ui/Interruptor";
import { DIAS, textoCierre, type Agenda, type Franja } from "@/lib/horarios";
import { anularCierre, crearCierre, guardarHorarios, previsualizarCierre, type PrevioCierre } from "./acciones";
import { Icono } from "@/components/ui/Icono";

export type CierrePanel = {
  cierre_id: string; desde: string; hasta: string; motivo: string; compensa: boolean; sede: string | null;
  pasado: boolean; clases_canceladas: number;
};
type Fila = { abre: string; cierra: string };
type Semana = Record<number, Fila[]>;

const aSemana = (franjas: Franja[]): Semana => {
  const s: Semana = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
  for (const f of [...franjas].sort((a, b) => a.abre.localeCompare(b.abre))) s[f.dia].push({ abre: f.abre, cierra: f.cierra === "24:00" ? "00:00" : f.cierra });
  return s;
};
const aFranjas = (s: Semana): Franja[] => Object.entries(s).flatMap(([dia, filas]) => filas.map((f) => ({ dia: Number(dia), ...f })));
const hoyLocal = () => new Date().toLocaleDateString("en-CA");

export function HorariosYCierres({ agendaInicial, cierresIniciales, esDueno, alCambiarSucio }: {
  agendaInicial: Agenda; cierresIniciales: CierrePanel[]; esDueno: boolean; alCambiarSucio: (sucio: boolean) => void;
}) {
  const [agenda, setAgenda] = useState(agendaInicial);
  const [cierres, setCierres] = useState(cierresIniciales);
  const sedes = agenda.sedes;
  const [sedeId, setSedeId] = useState(sedes[0]?.sede_id ?? "");
  const sede = sedes.find((x) => x.sede_id === sedeId) ?? sedes[0];
  const [semana, setSemana] = useState<Semana>(() => aSemana(sede?.franjas ?? []));
  const guardada = useMemo(() => JSON.stringify(aSemana(sede?.franjas ?? [])), [sede]);
  const sucio = esDueno && JSON.stringify(semana) !== guardada;
  useEffect(() => { alCambiarSucio(sucio); }, [sucio, alCambiarSucio]);

  const [msjH, setMsjH] = useState<{ ok?: string; error?: string; n: number }>({ n: 0 });
  const [msjC, setMsjC] = useState<{ ok?: string; error?: string; n: number }>({ n: 0 });
  const [ocupado, empezar] = useTransition();
  // Marca de "ya responde" (React tomó la pantalla): las pruebas esperan esto antes de escribir.
  const [listo, setListo] = useState(false);
  useEffect(() => setListo(true), []);

  const cambiarSede = (id: string) => {
    setSedeId(id);
    setSemana(aSemana(sedes.find((x) => x.sede_id === id)?.franjas ?? []));
    setMsjH((m) => ({ n: m.n }));
  };
  const setDia = (dia: number, filas: Fila[]) => setSemana((s) => ({ ...s, [dia]: filas }));
  const copiarLunes = () => setSemana((s) => ({ ...s, 2: [...s[1]], 3: [...s[1]], 4: [...s[1]], 5: [...s[1]] }));

  const guardar = () => {
    for (const [dia, filas] of Object.entries(semana)) for (const f of filas) {
      if (!f.abre || !f.cierra) { setMsjH((m) => ({ error: `El ${DIAS[Number(dia) - 1].toLowerCase()}: completá las dos horas.`, n: m.n + 1 })); return; }
    }
    empezar(async () => {
      const r = await guardarHorarios(sede.sede_id, aFranjas(semana));
      if (r.error || !r.agenda) { setMsjH((m) => ({ error: r.error ?? "No se pudo guardar", n: m.n + 1 })); return; }
      const nueva = r.agenda as Agenda;
      setAgenda(nueva);
      setSemana(aSemana(nueva.sedes.find((x) => x.sede_id === sede.sede_id)?.franjas ?? []));
      setMsjH((m) => ({ ok: "Guardado", n: m.n + 1 }));
    });
  };

  // ── Cierres ──
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [previo, setPrevio] = useState<PrevioCierre | null>(null);   // VD-57: el aviso antes de confirmar
  const [sedeCierre, setSedeCierre] = useState<string>("");
  const [anulando, setAnulando] = useState<{ id: string; motivo: string } | null>(null);
  // Primero el aviso (cuántos socios y cuántos días se corren, según la regla del gimnasio); recién después se carga.
  const revisar = () => {
    if (!desde) { setMsjC((m) => ({ error: "Elegí el primer día que cierra.", n: m.n + 1 })); return; }
    if (!motivo.trim()) { setMsjC((m) => ({ error: "Escribí el motivo (lo ven los socios): por ejemplo “Feriado” o “Vacaciones”.", n: m.n + 1 })); return; }
    empezar(async () => {
      const r = await previsualizarCierre({ desde, hasta: hasta || desde, sedeId: sedeCierre || null });
      if (r.error || !r.previo) { setMsjC((m) => ({ error: r.error ?? "No se pudo revisar el cierre", n: m.n + 1 })); return; }
      setMsjC((m) => ({ n: m.n }));
      setPrevio(r.previo);
    });
  };
  const cargar = () => {
    empezar(async () => {
      const r = await crearCierre({ desde, hasta: hasta || desde, motivo, sedeId: sedeCierre || null });
      if (r.error || !r.cierres) { setMsjC((m) => ({ error: r.error ?? "No se pudo cargar", n: m.n + 1 })); return; }
      const lista = r.cierres as CierrePanel[];
      setCierres(lista); if (r.agenda) setAgenda(r.agenda as Agenda);
      const nuevo = lista.find((c) => c.desde === desde);
      const clases = nuevo?.clases_canceladas ?? 0;
      setMsjC((m) => ({ ok: `Listo: cerrado ${textoCierre({ desde, hasta: hasta || desde })}.${clases ? ` Se cancelaron ${clases} ${clases === 1 ? "clase" : "clases"} y se avisó en la app.` : ""}`, n: m.n + 1 }));
      setDesde(""); setHasta(""); setMotivo(""); setSedeCierre(""); setPrevio(null);
    });
  };
  const confirmarAnular = () => {
    if (!anulando) return;
    if (!anulando.motivo.trim()) { setMsjC((m) => ({ error: "Escribí por qué se anula (queda registrado).", n: m.n + 1 })); return; }
    empezar(async () => {
      const r = await anularCierre(anulando.id, anulando.motivo);
      if (r.error || !r.cierres) { setMsjC((m) => ({ error: r.error ?? "No se pudo anular", n: m.n + 1 })); return; }
      setCierres(r.cierres as CierrePanel[]); if (r.agenda) setAgenda(r.agenda as Agenda);
      setAnulando(null);
      setMsjC((m) => ({ ok: "Cierre anulado: las clases que había cancelado vuelven a estar.", n: m.n + 1 }));
    });
  };
  const proximos = cierres.filter((c) => !c.pasado);
  const pasados = cierres.filter((c) => c.pasado);

  return (
    <div className="space-y-4">
      <section className="tarjeta p-5 sm:p-6 space-y-4" data-horarios data-listo={listo}>
        <div>
          <p className="titulo text-2xl"><Icono nombre="reloj" /> Cuándo abre</p>
          <p className="texto-suave">Sale en tu página y en la app, con “abierto ahora”. Hora del gimnasio.</p>
        </div>
        {sedes.length > 1 && (
          <label className="block space-y-1"><span className="etiqueta">Sede</span>
            <select className="campo" value={sede?.sede_id} onChange={(e) => cambiarSede(e.target.value)} disabled={sucio}>
              {sedes.map((x) => <option key={x.sede_id} value={x.sede_id}>{x.sede}</option>)}
            </select>
            {sucio && <span className="block text-sm texto-tenue">Guardá esta sede antes de pasar a otra.</span>}
          </label>
        )}
        {sede?.texto && <p className="pildora" data-ahora>{sede.abierto ? "" : ""} Ahora: {sede.texto}</p>}
        <fieldset disabled={!esDueno || ocupado} className="divide-y divide-[var(--borde)]">
          {DIAS.map((nombre, i) => {
            const dia = i + 1;
            const filas = semana[dia];
            return (
              <div key={dia} className="py-3 space-y-2" data-dia={dia}>
                <Interruptor etiqueta={nombre} ayuda={filas.length ? undefined : "Cerrado"} checked={filas.length > 0}
                  onChange={(e) => setDia(dia, e.target.checked ? [{ abre: "07:00", cierra: "22:00" }] : [])} />
                {filas.map((f, j) => (
                  <div key={j} className="flex flex-wrap items-center gap-2">
                    <input type="time" className="campo !w-auto" aria-label={`${nombre}: abre`} value={f.abre}
                      onChange={(e) => setDia(dia, filas.map((x, k) => (k === j ? { ...x, abre: e.target.value } : x)))} />
                    <span className="texto-tenue">a</span>
                    <input type="time" className="campo !w-auto" aria-label={`${nombre}: cierra`} value={f.cierra}
                      onChange={(e) => setDia(dia, filas.map((x, k) => (k === j ? { ...x, cierra: e.target.value } : x)))} />
                    {filas.length > 1 && <button type="button" className="boton-texto" onClick={() => setDia(dia, filas.filter((_, k) => k !== j))}>Quitar</button>}
                  </div>
                ))}
                {filas.length > 0 && filas.length < 3 && (
                  <button type="button" className="boton-texto" onClick={() => setDia(dia, [...filas, { abre: "16:00", cierra: "20:00" }])}><Icono nombre="mas" /> Otra franja (turno partido)</button>
                )}
              </div>
            );
          })}
        </fieldset>
        <p className="text-sm texto-tenue">Si cierra a la medianoche, poné 00:00.</p>
        {esDueno && (
          <div className="space-y-3" data-pie="horarios" data-respuestas={msjH.n}>
            {msjH.error && <Mensaje tipo="error">{msjH.error}</Mensaje>}
            {msjH.ok && !sucio && <Mensaje tipo="exito">{msjH.ok}</Mensaje>}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="boton boton-principal" disabled={ocupado || !sucio} onClick={guardar}>{ocupado ? "Guardando…" : "Guardar"}</button>
              <button type="button" className="boton" disabled={ocupado || semana[1].length === 0} onClick={copiarLunes}><Icono nombre="lista" /> Lunes a viernes igual que el lunes</button>
              {sucio && <span className="pildora" data-sin-guardar>• Cambios sin guardar</span>}
            </div>
          </div>
        )}
      </section>

      <section className="tarjeta p-5 sm:p-6 space-y-4" data-cierres data-respuestas={msjC.n} data-listo={listo}>
        <div>
          <p className="titulo text-2xl"><Icono nombre="prohibido" /> Días que cierra</p>
          <p className="texto-suave">Feriados, vacaciones, una mudanza. Se cancelan las clases de esos días, se avisa en la página y en la app, y si querés se les devuelven los días a los socios.</p>
        </div>
        <fieldset disabled={ocupado} className="grid sm:grid-cols-2 gap-3">
          <label className="block space-y-1"><span className="etiqueta">Desde</span>
            <input type="date" className="campo" min={hoyLocal()} value={desde} onChange={(e) => { setDesde(e.target.value); if (!hasta || hasta < e.target.value) setHasta(e.target.value); }} /></label>
          <label className="block space-y-1"><span className="etiqueta">Hasta (último día cerrado)</span>
            <input type="date" className="campo" min={desde || hoyLocal()} value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
          <label className="block space-y-1 sm:col-span-2"><span className="etiqueta">Motivo</span>
            <input className="campo" maxLength={80} placeholder="Feriado, Vacaciones…" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            <span className="block text-sm texto-tenue">Lo ven los socios en la app y en tu página.</span></label>
          {sedes.length > 1 && (
            <label className="block space-y-1 sm:col-span-2"><span className="etiqueta">Dónde</span>
              <select className="campo" value={sedeCierre} onChange={(e) => setSedeCierre(e.target.value)}>
                <option value="">Todo el gimnasio</option>
                {sedes.map((x) => <option key={x.sede_id} value={x.sede_id}>Solo {x.sede}</option>)}
              </select></label>
          )}
          <p className="sm:col-span-2 text-sm texto-tenue" data-regla-cierres-ayuda>
            {sedeCierre
              ? "Con una sola sede cerrada no se suman días al vencimiento (los socios pueden ir a otra)."
              : "Si los días cerrados se suman al vencimiento de los socios lo decide la regla del gimnasio (Configuración → Reglas → Días cerrados). Antes de cargar te decimos a cuántos socios les corre el vencimiento."}
          </p>
          <div className="sm:col-span-2"><button type="button" className="boton" onClick={revisar} data-revisar-cierre>{ocupado && !previo ? "Revisando…" : "Cargar cierre"}</button></div>
        </fieldset>
        {previo && (
          <div className="tarjeta p-4 space-y-3 border-2 border-[var(--acento)]" role="group" aria-label="Confirmar el cierre" data-previo-cierre={previo.suma_dias ? "suma" : "no-suma"}>
            <p className="font-semibold" data-previo-texto>
              {previo.suma_dias
                ? `Esto corre el vencimiento de ${previo.socios} ${previo.socios === 1 ? "socio" : "socios"} ${previo.dias} ${previo.dias === 1 ? "día" : "días"}.`
                : "Esto no corre ningún vencimiento: el gimnasio no suma los días cerrados."}
            </p>
            <p className="text-sm texto-suave">
              {previo.suma_dias
                ? "Se les suman los días cerrados a quienes estaban cubiertos esos días (no a los que ya habían vencido). Si lo anulás, vuelve todo como estaba."
                : "Para que los días cerrados se sumen, el dueño cambia la regla en Configuración → Reglas → Días cerrados, antes de cargar el cierre."}
              {" "}Se cancelan las clases de esos días y se avisa en la página y en la app.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="boton boton-principal" disabled={ocupado} onClick={cargar} data-confirmar-cierre>{ocupado ? "Cargando…" : "Confirmar y cargar el cierre"}</button>
              <button type="button" className="boton-texto" disabled={ocupado} onClick={() => setPrevio(null)}>Cambiar algo</button>
            </div>
          </div>)}
        {msjC.error && <Mensaje tipo="error">{msjC.error}</Mensaje>}
        {msjC.ok && <Mensaje tipo="exito">{msjC.ok}</Mensaje>}

        {proximos.length === 0 && pasados.length === 0
          ? <p className="texto-tenue">No hay cierres cargados.</p>
          : (
            <ul className="divide-y divide-[var(--borde)]" aria-label="Cierres cargados">
              {[...proximos].reverse().concat(pasados).map((c) => (
                <li key={c.cierre_id} className={`py-3 space-y-2 ${c.pasado ? "opacity-60" : ""}`} data-cierre-panel={c.desde}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p><span className="font-semibold">{textoCierre(c)}</span> · {c.motivo}{c.sede ? ` · solo ${c.sede}` : ""}</p>
                    {!c.pasado && anulando?.id !== c.cierre_id && (
                      <button type="button" className="boton-texto" disabled={ocupado} onClick={() => setAnulando({ id: c.cierre_id, motivo: "" })}>Anular</button>
                    )}
                  </div>
                  <p className="text-sm texto-tenue">
                    {c.compensa ? "Devuelve los días" : "No devuelve días"}
                    {c.clases_canceladas > 0 && ` · canceló ${c.clases_canceladas} ${c.clases_canceladas === 1 ? "clase" : "clases"}`}
                    {c.pasado && " · ya pasó"}
                  </p>
                  {anulando?.id === c.cierre_id && (
                    <div className="flex flex-wrap gap-2">
                      <input className="campo flex-1 min-w-48" autoFocus placeholder="Por qué se anula" value={anulando.motivo}
                        onChange={(e) => setAnulando({ ...anulando, motivo: e.target.value })} aria-label="Motivo de la anulación" />
                      <button type="button" className="boton boton-peligro" disabled={ocupado} onClick={confirmarAnular}>Anular cierre</button>
                      <button type="button" className="boton-texto" onClick={() => setAnulando(null)}>Cancelar</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}
