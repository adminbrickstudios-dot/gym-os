"use client";
// E4 · El paso "Prueba gratis" de la ventana (VD-51). Se baja solo cuando se usa (ver cargas.ts).
import { Icono } from "@/components/ui/Icono";
import { Mensaje } from "@/components/ui/Mensaje";
import { conPuntos, type FormPrueba } from "./comun";

export default function PruebaGratis({ prueba, setPrueba, ocupado, onGuardar, onVolver }: {
  prueba: FormPrueba; setPrueba: (p: FormPrueba) => void; ocupado: boolean; onGuardar: () => void; onVolver: () => void;
}) {
  return (
    <form data-ventana-prueba-form className="p-6 sm:p-8 space-y-4" onSubmit={(e) => { e.preventDefault(); if (!ocupado && !(prueba.info?.existe && prueba.info.usada)) onGuardar(); }}>
      <p className="titulo text-2xl text-center"><Icono nombre="regalo" /> Prueba gratis · {conPuntos(prueba.dni)}</p>
      {prueba.info?.existe && !prueba.info.usada && (
        <p className="pildora pildora-azul !rounded-[var(--radio)] !px-4 !py-3 w-full" data-prueba-reservada>
          <Icono nombre="persona" /> Reservó desde la página{prueba.info.clase ? `: ${prueba.info.clase}` : ""}. Confirmá y lo dejás entrar.
        </p>
      )}
      <label className="block space-y-1"><span className="etiqueta">Nombre</span>
        <input data-prueba-nombre autoFocus className="campo" value={prueba.nombre} autoComplete="off" onChange={(e) => setPrueba({ ...prueba, nombre: e.target.value, error: null })} /></label>
      {!prueba.info?.existe && (
        <>
          <label className="block space-y-1"><span className="etiqueta">Apellido <span className="texto-tenue font-normal">(opcional)</span></span>
            <input className="campo" value={prueba.apellido} autoComplete="off" onChange={(e) => setPrueba({ ...prueba, apellido: e.target.value })} /></label>
          <label className="block space-y-1"><span className="etiqueta">Celular <span className="texto-tenue font-normal">(opcional)</span></span>
            <input className="campo" type="tel" inputMode="tel" value={prueba.telefono} placeholder="387 555 1234" autoComplete="off" onChange={(e) => setPrueba({ ...prueba, telefono: e.target.value })} /></label>
        </>
      )}
      {prueba.error && <Mensaje tipo="error">{prueba.error}</Mensaje>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="boton boton-principal" disabled={ocupado || !!(prueba.info?.existe && prueba.info.usada) || !prueba.nombre.trim()} data-prueba-dar><Icono nombre="regalo" /> Dejarlo entrar con la prueba</button>
        <button type="button" className="boton-texto px-3" onClick={onVolver}>Volver</button>
      </div>
      <p className="text-sm texto-tenue">Es una vez por DNI. No es socio ni gasta ningún plan; queda registrado quién la dio.</p>
    </form>
  );
}
