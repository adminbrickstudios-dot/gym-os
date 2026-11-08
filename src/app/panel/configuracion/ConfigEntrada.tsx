"use client";
// VD-1 · Configuración → Entrada: cómo se comporta la ventana de Entrada.
// Por gimnasio (queda en la base) y "en esta compu" (queda en este navegador y le gana al gimnasio).
import { useEffect, useState, useTransition } from "react";
import { Restablecer } from "./Restablecer";
import { guardarConfigEntrada, guardarConfigVisita, leerConfigVisita, type ConfigVisita } from "@/app/panel/entrada/ventana-acciones";
import { CONFIG_ENTRADA_POR_DEFECTO, guardarPisado, leerPisado, type ConfigEntrada as Config, type PisadoEnEstaCompu } from "@/app/panel/entrada/config";
import { Interruptor } from "@/components/ui/Interruptor";
import { Mensaje } from "@/components/ui/Mensaje";

const SEGUNDOS: { valor: Config["cerrar_sola_seg"]; texto: string }[] = [
  { valor: 3, texto: "3 segundos" }, { valor: 4, texto: "4 segundos" }, { valor: 6, texto: "6 segundos" }, { valor: 0, texto: "No se cierra sola" },
];
type Eleccion = "gimnasio" | "si" | "no";
const aEleccion = (x: boolean | undefined): Eleccion => (x === undefined ? "gimnasio" : x ? "si" : "no");

const VISITA_POR_DEFECTO: ConfigVisita = { visita_horas: 5, antiprestamo_minutos: 60, avisar_en_vivo: true, registrar_salida: "no" };
const SALIDAS: [ConfigVisita["registrar_salida"], string, string][] = [
  ["no", "No", "No se anota la salida. \"Adentro\" es aproximado y cada visita se cierra sola a las horas de arriba."],
  ["opcional", "Opcional", "Quien quiere marca la salida (DNI + S en la ventana, \"Me voy\" en la tablet y en la app). \"Adentro ahora\" cuenta las visitas abiertas."],
  ["obligatoria", "Obligatoria", "Igual que opcional, y si alguien intenta entrar de nuevo sin haber salido, la recepción lo ve y puede marcarle la salida. Nunca le impide entrar."],
];

export function ConfigEntrada({ inicial, puedeEditar = true }: { inicial: Config; puedeEditar?: boolean }) {
  const [c, setC] = useState(inicial);
  const [guardado, setGuardado] = useState(inicial);
  const [msj, setMsj] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const [ocupado, empezar] = useTransition();
  const [pisado, setPisado] = useState<PisadoEnEstaCompu>({});
  useEffect(() => { setPisado(leerPisado()); }, []);

  const sucio = JSON.stringify(c) !== JSON.stringify(guardado);
  const guardar = () => empezar(async () => {
    const r = await guardarConfigEntrada(c);
    if (r.error || !r.config) { setMsj({ tipo: "error", texto: r.error ?? "No se pudo guardar." }); return; }
    setC(r.config); setGuardado(r.config);
    setMsj({ tipo: "exito", texto: "Guardado. Vale para todas las compus del gimnasio (salvo las que lo pisan abajo)." });
  });
  const pisar = (k: keyof PisadoEnEstaCompu, e: Eleccion) => {
    const nuevo = { ...pisado };
    if (e === "gimnasio") delete nuevo[k]; else nuevo[k] = e === "si";
    setPisado(nuevo); guardarPisado(nuevo);
  };

  return (
    <div className="space-y-5" data-config-entrada>
      <section className="tarjeta p-5 space-y-2">
        <h2 className="titulo text-2xl">🚪 La Entrada en todo el panel</h2>
        <p className="texto-suave">La ventana de Entrada se abre desde cualquier pantalla: con el botón verde, con F2 o Ctrl+E, tipeando un DNI o pasando el lector.</p>
        <div className="py-2" data-opcion="entrada-resultado">
          <p className="font-semibold">Mostrar el resultado de la entrada</p>
          <p className="texto-suave text-sm">Con el aviso, Enter anota y el resultado sale abajo a la derecha (con la franja de color); tocarlo abre la ficha rápida. Con la ventana grande, el veredicto ocupa la pantalla como siempre.</p>
          <div className="flex flex-wrap gap-2 mt-2" role="group" aria-label="Mostrar el resultado de la entrada">
            {([["aviso", "Aviso en la esquina"], ["ventana", "Ventana grande"]] as const).map(([valor, texto]) => (
              <button key={valor} type="button" aria-pressed={c.resultado_entrada === valor} data-resultado={valor}
                className={`pestana ${c.resultado_entrada === valor ? "!bg-[var(--texto)] !text-[var(--fondo)]" : ""}`}
                onClick={() => setC({ ...c, resultado_entrada: valor })}>{texto}</button>
            ))}
          </div>
        </div>
        <Interruptor etiqueta="Abrir al tipear un número" data-opcion="entrada-abrir-al-tipear" ayuda="Si no estás escribiendo en un campo, tocar un número abre la Entrada con ese número. Un lector de QR o llavero la abre siempre."
          checked={c.abrir_al_tipear} onChange={(e) => setC({ ...c, abrir_al_tipear: e.target.checked })} />
        <Interruptor etiqueta="Barra fija a la derecha" data-opcion="entrada-barra-fija" ayuda="Solo en compus de pantalla ancha: el campo DNI siempre a la vista y las últimas 5 entradas. Pensada para la compu del mostrador."
          checked={c.barra_fija} onChange={(e) => setC({ ...c, barra_fija: e.target.checked })} />
        <Interruptor etiqueta="Anotar solo cuando está en verde" data-opcion="entrada-solo-verde" ayuda="Con esto prendido, Enter anota la entrada solo si el socio está en verde; en amarillo o naranja hay que tocar el botón (así se lee el aviso)."
          checked={c.anotar_solo_en_verde} onChange={(e) => setC({ ...c, anotar_solo_en_verde: e.target.checked })} />
        <div className="py-2" data-opcion="entrada-cerrar-sola">
          <p className="font-semibold">Cerrar sola después de anotar</p>
          <div className="flex flex-wrap gap-2 mt-2" role="group" aria-label="Cerrar sola después de anotar">
            {SEGUNDOS.map((s) => (
              <button key={s.valor} type="button" aria-pressed={c.cerrar_sola_seg === s.valor}
                className={`pestana ${c.cerrar_sola_seg === s.valor ? "!bg-[var(--texto)] !text-[var(--fondo)]" : ""}`}
                onClick={() => setC({ ...c, cerrar_sola_seg: s.valor })}>{s.texto}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button type="button" className="boton boton-principal" disabled={!sucio || ocupado} onClick={guardar}>{ocupado ? "Guardando…" : "💾 Guardar"}</button>
          {sucio && <span className="texto-tenue text-sm">Hay cambios sin guardar</span>}
        </div>
        {msj && <Mensaje tipo={msj.tipo}>{msj.texto}</Mensaje>}
        {puedeEditar && (
          <Restablecer id="entrada" recomendado="abrir al tipear prendido, barra fija apagada, anotar con Enter siempre, y cerrar sola a los 4 segundos."
            alConfirmar={async () => {
              const r = await guardarConfigEntrada(CONFIG_ENTRADA_POR_DEFECTO);
              if (r.error || !r.config) return r.error ?? "No se pudo restablecer.";
              setC(r.config); setGuardado(r.config); return null;
            }} />
        )}
      </section>

      <ConfigVisitaSeccion puedeEditar={puedeEditar} />

      <section className="tarjeta p-5 space-y-3" data-entrada-en-esta-compu data-opcion="entrada-esta-compu">
        <h2 className="titulo text-2xl">🖥️ En esta compu</h2>
        <p className="texto-suave">Para pisar lo del gimnasio solo en esta compu o tablet (queda guardado en este navegador). Por ejemplo, prender la barra fija solo en el mostrador.</p>
        <Elegir etiqueta="Abrir al tipear un número" valor={aEleccion(pisado.abrir_al_tipear)} alCambiar={(e) => pisar("abrir_al_tipear", e)} />
        <Elegir etiqueta="Barra fija a la derecha" valor={aEleccion(pisado.barra_fija)} alCambiar={(e) => pisar("barra_fija", e)} />
        <p className="texto-tenue text-sm">El sonido de la puerta también se prende o apaga por compu, desde la pantalla de Entrada.</p>
      </section>
    </div>
  );
}

/** VD-3 · Una visita dura N horas (dentro, volver a pasar no cuenta otra entrada) y el aviso de préstamo. */
function ConfigVisitaSeccion({ puedeEditar }: { puedeEditar: boolean }) {
  const [c, setC] = useState<ConfigVisita | null>(null);
  const [guardado, setGuardado] = useState<ConfigVisita | null>(null);
  const [msj, setMsj] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const [ocupado, empezar] = useTransition();
  useEffect(() => {
    let vivo = true;
    void leerConfigVisita().then((r) => {
      if (!vivo) return;
      if (r.config) { setC(r.config); setGuardado(r.config); } else setMsj({ tipo: "error", texto: r.error ?? "No se pudo leer." });
    });
    return () => { vivo = false; };
  }, []);
  const sucio = !!c && JSON.stringify(c) !== JSON.stringify(guardado);
  const guardar = () => empezar(async () => {
    if (!c) return;
    const r = await guardarConfigVisita(c);
    if (r.error || !r.config) { setMsj({ tipo: "error", texto: r.error ?? "No se pudo guardar." }); return; }
    setC(r.config); setGuardado(r.config);
    setMsj({ tipo: "exito", texto: "Guardado." });
  });
  const entero = (t: string) => (t === "" ? 0 : Math.max(0, Math.trunc(Number(t)) || 0));
  return (
    <section className="tarjeta p-5 space-y-3" data-config-visita data-opcion="visita-horas antiprestamo registrar-salida avisar-en-vivo">
      <h2 className="titulo text-2xl">🔁 Volver a entrar y avisos de la puerta</h2>
      <p className="texto-suave">Una visita dura unas horas: si el mismo socio pasa de nuevo por cualquier vía (DNI, QR, tablet) dentro de ese tiempo, se le dice a qué hora entró y no se cuenta otra entrada ni se gasta otra clase.</p>
      {!c ? <div className="esqueleto h-24" aria-hidden /> : (
        <>
          <label className="block">
            <span className="font-semibold">Una visita dura (horas)</span>
            <input className="campo mt-1 max-w-40" type="number" inputMode="numeric" min={0} max={24} value={c.visita_horas} data-visita-horas
              onChange={(e) => setC({ ...c, visita_horas: entero(e.target.value) })} />
            <span className="block texto-tenue text-sm mt-1">0 = no hay visita larga: solo se ignora el doble toque de un minuto.</span>
          </label>
          <label className="block">
            <span className="font-semibold">Avisar si vuelve a entrar por otra vía antes de (minutos)</span>
            <input className="campo mt-1 max-w-40" type="number" inputMode="numeric" min={0} max={720} value={c.antiprestamo_minutos} data-antiprestamo-minutos
              onChange={(e) => setC({ ...c, antiprestamo_minutos: entero(e.target.value) })} />
            <span className="block texto-tenue text-sm mt-1">Si entra por el QR y a los pocos minutos por la tablet (o al revés), la recepción ve un aviso amarillo y te queda anotado en Control de la puerta. 0 = apagado.</span>
          </label>
          <div data-registrar-salida={c.registrar_salida}>
            <p className="font-semibold">Registrar la salida</p>
            <div className="flex flex-wrap gap-2 mt-2" role="group" aria-label="Registrar la salida">
              {SALIDAS.map(([k, t]) => (
                <button key={k} type="button" aria-pressed={c.registrar_salida === k} data-salida={k}
                  className={`pestana ${c.registrar_salida === k ? "!bg-[var(--texto)] !text-[var(--fondo)]" : ""}`}
                  onClick={() => setC({ ...c, registrar_salida: k })}>{t}</button>
              ))}
            </div>
            <span className="block texto-tenue text-sm mt-1">{SALIDAS.find(([k]) => k === c.registrar_salida)?.[2]}</span>
          </div>
          <Interruptor etiqueta="Avisar las entradas por QR o tablet en todas las pantallas" ayuda="Un aviso chiquito arriba a la derecha cuando alguien entra por el QR o la tablet, o intenta entrar y no puede (ese queda hasta que lo cierres, con el botón Cobrar)."
            checked={c.avisar_en_vivo} onChange={(e) => setC({ ...c, avisar_en_vivo: e.target.checked })} />
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button type="button" className="boton boton-principal" disabled={!sucio || ocupado} onClick={guardar}>{ocupado ? "Guardando…" : "💾 Guardar"}</button>
            {sucio && <span className="texto-tenue text-sm">Hay cambios sin guardar</span>}
          </div>
          {puedeEditar && (
            <Restablecer id="visita" recomendado="una visita dura 5 horas, avisar el préstamo a los 60 minutos y avisos en vivo prendidos."
              alConfirmar={async () => {
                const r = await guardarConfigVisita(VISITA_POR_DEFECTO);
                if (r.error || !r.config) return r.error ?? "No se pudo restablecer.";
                setC(r.config); setGuardado(r.config); return null;
              }} />
          )}
        </>
      )}
      {msj && <Mensaje tipo={msj.tipo}>{msj.texto}</Mensaje>}
    </section>
  );
}

function Elegir({ etiqueta, valor, alCambiar }: { etiqueta: string; valor: Eleccion; alCambiar: (e: Eleccion) => void }) {
  const opciones: [Eleccion, string][] = [["gimnasio", "Lo del gimnasio"], ["si", "Sí"], ["no", "No"]];
  return (
    <div>
      <p className="font-semibold">{etiqueta}</p>
      <div className="flex flex-wrap gap-2 mt-2" role="group" aria-label={`${etiqueta} en esta compu`}>
        {opciones.map(([k, t]) => (
          <button key={k} type="button" aria-pressed={valor === k} data-en-esta-compu={`${etiqueta}:${k}`}
            className={`pestana ${valor === k ? "!bg-[var(--texto)] !text-[var(--fondo)]" : ""}`} onClick={() => alCambiar(k)}>{t}</button>
        ))}
      </div>
    </div>
  );
}
