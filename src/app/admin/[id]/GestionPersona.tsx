"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { ListaPrueba } from "../ListaPrueba";
import { arreglarAcceso, cambiarRolPersona, estadoPersona, moverPersona, probarAccesoPersona, type PruebaPersona } from "../acciones";

const ROLES: [string, string][] = [["dueno", "Dueño"], ["encargado", "Encargado"], ["recepcion", "Recepción"], ["profe", "Profe"]];
const Alerta = ({ m }: { m: string }) => (m ? <p role="alert" className="pildora pildora-rojo !rounded-2xl !px-4 !py-3 basis-full">{m}</p> : null);

/**
 * P6 y P7: "Probar acceso" de una persona (con sus "Arreglar"), desactivar o activar, cambiar el rol y mover a otro gimnasio.
 * Resetear la contraseña y dar acceso siguen en AccesoPersona. Todo pasa por funciones admin_* (la base valida y deja registro).
 */
export function GestionPersona({ equipoId, gimnasioId, nombre, rol, activo, otros, puedeMover }: {
  equipoId: string; gimnasioId: string; nombre: string; rol: string; activo: boolean; otros: { id: string; nombre: string }[]; puedeMover: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [prueba, setPrueba] = useState<PruebaPersona | null>(null);
  const [rolNuevo, setRolNuevo] = useState(rol);
  const [destino, setDestino] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const hecho = async (f: () => Promise<{ error?: string }>, texto: string, volverAProbar = false) => {
    const r = await f();
    if (r.error) { setError(r.error); setAviso(""); return; }
    setError(""); setAviso(texto);
    if (volverAProbar) { const p = await probarAccesoPersona(equipoId); if (p.prueba) setPrueba(p.prueba); }
    router.refresh();
  };
  const probar = async () => { const r = await probarAccesoPersona(equipoId); if (r.error) { setError(r.error); return; } setError(""); setPrueba(r.prueba ?? null); };
  return (
    <div className="basis-full space-y-2" data-gestion-persona={equipoId}>
      <div className="flex flex-wrap gap-2">
        <BotonAccion className="boton boton-chico" ocupadoTexto="Probando…" data-probar-acceso onClick={probar}>Probar acceso</BotonAccion>
        <button type="button" className="boton boton-chico texto-suave" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>{abierto ? "Cerrar" : "Más acciones"}</button>
      </div>
      {prueba && (
        <div className="tarjeta p-3 space-y-2" data-prueba-persona data-ok={prueba.ok ? "si" : "no"}>
          <p className="font-semibold text-sm">{prueba.ok ? "Puede entrar: todo en verde" : "No puede entrar todavía"}</p>
          <ListaPrueba pasos={prueba.pasos} arreglar={(p) => p.arreglo === "dar_acceso"
            ? <span className="texto-suave text-sm">Usá “Dar acceso” en su fila.</span>
            : <BotonAccion className="boton boton-chico" ocupadoTexto="Arreglando…" data-arreglar={p.arreglo ?? ""} onClick={() => hecho(() => arreglarAcceso(equipoId, gimnasioId, p.arreglo!), "Arreglado.", true)}>Arreglar</BotonAccion>} />
        </div>
      )}
      {abierto && (
        <div className="tarjeta p-3 space-y-3" data-mas-acciones>
          <div className="flex flex-wrap gap-2 items-end">
            <BotonAccion className="boton boton-chico" data-estado-persona onClick={() => hecho(() => estadoPersona(equipoId, gimnasioId, !activo), activo ? `${nombre} quedó desactivada.` : `${nombre} quedó activa.`)}>
              {activo ? "Desactivar" : "Activar"}
            </BotonAccion>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <label className="space-y-1"><span className="etiqueta">Rol</span>
              <select className="campo !w-44" value={rolNuevo} onChange={(e) => setRolNuevo(e.target.value)} data-rol-persona>{ROLES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
            <BotonAccion className="boton boton-chico" disabled={rolNuevo === rol} data-cambiar-rol onClick={() => hecho(() => cambiarRolPersona(equipoId, gimnasioId, rolNuevo), "Rol cambiado.")}>Cambiar rol</BotonAccion>
          </div>
          {puedeMover && otros.length > 0 && (
            <div className="flex flex-wrap gap-2 items-end">
              <label className="space-y-1"><span className="etiqueta">Mover a otro gimnasio</span>
                <select className="campo !w-56" value={destino} onChange={(e) => setDestino(e.target.value)} data-mover-destino>
                  <option value="">Elegí el gimnasio</option>{otros.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </select></label>
              <BotonAccion className="boton boton-chico" disabled={!destino} data-mover onClick={() => hecho(() => moverPersona(equipoId, gimnasioId, destino, rolNuevo), "Movida: sigue con la misma cuenta y queda desactivada acá (su historial se queda en este gimnasio).")}>Mover</BotonAccion>
            </div>
          )}
        </div>
      )}
      {aviso && <p role="status" className="texto-suave text-sm">{aviso}</p>}
      <Alerta m={error} />
    </div>
  );
}
