"use client";
// E4 · El paso "Alta rápida" de la ventana (VD-6): datos → plan → (cobro en la hoja) → entra. Se baja solo cuando se usa (ver cargas.ts),
// junto con las tarjetas de plan, que no se usan en ningún otro paso.
import { Icono } from "@/components/ui/Icono";
import { Mensaje } from "@/components/ui/Mensaje";
import { TarjetasPlan, PrimerPago } from "../TarjetasPlan";
import { conPuntos, type Alta } from "./comun";

export default function AltaRapida({ alta, setAlta, ocupado, puedeCobrar, onGuardar, onBuscarInteresado }: {
  alta: Alta; setAlta: (a: Alta) => void; ocupado: boolean; puedeCobrar: boolean;
  onGuardar: (cobrarYa: boolean) => void; onBuscarInteresado: (celular: string) => void;
}) {
  return (
    <form data-ventana-alta-form data-alta-paso={alta.paso} className="p-6 sm:p-8 space-y-4"
      onSubmit={(e) => { e.preventDefault(); if (ocupado) return; if (alta.paso === "datos") { if (alta.nombre.trim()) setAlta({ ...alta, paso: "plan" }); } else onGuardar(!!alta.plan && puedeCobrar); }}>
      <p className="titulo text-2xl text-center"><Icono nombre="mas" /> Alta rápida</p>
      <p className="text-center texto-suave">DNI <strong className="text-[var(--texto)] numero">{conPuntos(alta.dni)}</strong></p>
      <ol className="flex gap-2 text-sm" aria-label="Pasos del alta rápida">
        {["Datos", "Plan", "Cobro", "Entra"].map((n, i) => {
          const actual = alta.paso === "datos" ? 0 : 1;
          return <li key={n} className={`flex-1 min-w-0 rounded-full px-2 py-1 text-center truncate border ${i === actual ? "border-[var(--acento)] font-semibold" : "border-[var(--borde)] texto-tenue"}`}>{i < actual ? <><Icono nombre="ok" /> </> : `${i + 1} · `}{n}</li>;
        })}
      </ol>

      {alta.paso === "datos" ? (
        <div className="space-y-3">
          <label className="block space-y-1"><span className="etiqueta">Nombre</span>
            <input data-alta-nombre autoFocus value={alta.nombre} onChange={(e) => setAlta({ ...alta, nombre: e.target.value })} autoComplete="off" required className="campo" /></label>
          <label className="block space-y-1"><span className="etiqueta">Apellido</span>
            <input data-alta-apellido value={alta.apellido} onChange={(e) => setAlta({ ...alta, apellido: e.target.value })} autoComplete="off" className="campo" /></label>
          <label className="block space-y-1"><span className="etiqueta">Celular (WhatsApp)</span>
            <input data-alta-celular type="tel" value={alta.telefono} onChange={(e) => setAlta({ ...alta, telefono: e.target.value })} onBlur={(e) => onBuscarInteresado(e.target.value)}
              placeholder="387 555-1234" className="campo" /></label>
          {alta.ofrecido && !alta.vinculado && (
            <Mensaje tipo="info"><span data-interesado-ofrecido={alta.ofrecido.id}>¿Es {alta.ofrecido.nombre}, que preguntó el {new Date(alta.ofrecido.creado_en).toLocaleDateString("es-AR", { day: "numeric", month: "numeric" })}?</span>{" "}
              <button type="button" className="boton mt-2" onClick={() => setAlta({ ...alta, vinculado: alta.ofrecido!.id, nombre: alta.nombre || alta.ofrecido!.nombre.split(" ")[0], apellido: alta.apellido || alta.ofrecido!.nombre.split(" ").slice(1).join(" ") })}>Sí, es esa persona</button></Mensaje>
          )}
          {alta.vinculado && <Mensaje tipo="info">Es {alta.ofrecido?.nombre}: queda marcado como “se hizo socio”.</Mensaje>}
        </div>
      ) : (
        <div className="space-y-3">
          {alta.planes === null ? <div className="h-24 rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto" aria-hidden />
            : alta.planes.length === 0 ? <Mensaje tipo="info">Este gimnasio no tiene planes cargados: se da de alta sin plan y se cobra un pase o pack desde Vender.</Mensaje>
            : <TarjetasPlan planes={alta.planes} valor={alta.plan} alElegir={(plan) => setAlta({ ...alta, plan })} />}
          {alta.planes?.find((p) => p.plan_id === alta.plan) && <PrimerPago plan={alta.planes.find((p) => p.plan_id === alta.plan)!} />}
        </div>
      )}

      {alta.error && <Mensaje tipo="error">{alta.error}</Mensaje>}
      {alta.paso === "datos" ? (
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={!alta.nombre.trim()} className="boton boton-principal text-lg px-8" data-alta-siguiente>Siguiente: plan →</button>
          <button type="button" className="boton" onClick={() => onGuardar(false)} disabled={!alta.nombre.trim() || ocupado} data-alta-solo>Solo guardar</button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {alta.plan && puedeCobrar
            ? <button type="submit" disabled={ocupado} className="boton boton-principal text-lg px-8" data-alta-cobrar>{ocupado ? "Guardando…" : "Guardar y cobrar"}</button>
            : <button type="submit" disabled={ocupado} className="boton boton-principal text-lg px-8" data-alta-guardar>{ocupado ? "Guardando…" : "Guardar"}</button>}
          {alta.plan && puedeCobrar && <button type="button" className="boton" disabled={ocupado} onClick={() => onGuardar(false)} data-alta-solo>Solo guardar</button>}
          <button type="button" className="boton-texto px-3" onClick={() => setAlta({ ...alta, paso: "datos" })}>← Datos</button>
        </div>
      )}
      <p className="text-sm texto-tenue">Esc vuelve a la búsqueda · los datos que escribiste no se pierden si hay un error</p>
    </form>
  );
}
