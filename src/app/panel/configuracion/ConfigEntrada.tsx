"use client";
// VD-1 · Configuración → Entrada: cómo se comporta la ventana de Entrada.
// Por gimnasio (queda en la base) y "en esta compu" (queda en este navegador y le gana al gimnasio).
import { useEffect, useState, useTransition } from "react";
import { guardarConfigEntrada } from "@/app/panel/entrada/ventana-acciones";
import { guardarPisado, leerPisado, type ConfigEntrada as Config, type PisadoEnEstaCompu } from "@/app/panel/entrada/config";
import { Interruptor } from "@/components/ui/Interruptor";
import { Mensaje } from "@/components/ui/Mensaje";

const SEGUNDOS: { valor: Config["cerrar_sola_seg"]; texto: string }[] = [
  { valor: 3, texto: "3 segundos" }, { valor: 4, texto: "4 segundos" }, { valor: 6, texto: "6 segundos" }, { valor: 0, texto: "No se cierra sola" },
];
type Eleccion = "gimnasio" | "si" | "no";
const aEleccion = (x: boolean | undefined): Eleccion => (x === undefined ? "gimnasio" : x ? "si" : "no");

export function ConfigEntrada({ inicial }: { inicial: Config }) {
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
        <Interruptor etiqueta="Abrir al tipear un número" ayuda="Si no estás escribiendo en un campo, tocar un número abre la Entrada con ese número. Un lector de QR o llavero la abre siempre."
          checked={c.abrir_al_tipear} onChange={(e) => setC({ ...c, abrir_al_tipear: e.target.checked })} />
        <Interruptor etiqueta="Barra fija a la derecha" ayuda="Solo en compus de pantalla ancha: el campo DNI siempre a la vista y las últimas 5 entradas. Pensada para la compu del mostrador."
          checked={c.barra_fija} onChange={(e) => setC({ ...c, barra_fija: e.target.checked })} />
        <Interruptor etiqueta="Anotar solo cuando está en verde" ayuda="Con esto prendido, Enter anota la entrada solo si el socio está en verde; en amarillo o naranja hay que tocar el botón (así se lee el aviso)."
          checked={c.anotar_solo_en_verde} onChange={(e) => setC({ ...c, anotar_solo_en_verde: e.target.checked })} />
        <div className="py-2">
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
      </section>

      <section className="tarjeta p-5 space-y-3" data-entrada-en-esta-compu>
        <h2 className="titulo text-2xl">🖥️ En esta compu</h2>
        <p className="texto-suave">Para pisar lo del gimnasio solo en esta compu o tablet (queda guardado en este navegador). Por ejemplo, prender la barra fija solo en el mostrador.</p>
        <Elegir etiqueta="Abrir al tipear un número" valor={aEleccion(pisado.abrir_al_tipear)} alCambiar={(e) => pisar("abrir_al_tipear", e)} />
        <Elegir etiqueta="Barra fija a la derecha" valor={aEleccion(pisado.barra_fija)} alCambiar={(e) => pisar("barra_fija", e)} />
        <p className="texto-tenue text-sm">El sonido de la puerta también se prende o apaga por compu, desde la pantalla de Entrada.</p>
      </section>
    </div>
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
