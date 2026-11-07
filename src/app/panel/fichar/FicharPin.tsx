"use client";
// VD-53 · En la compu del mostrador: cada uno pone SU PIN y ficha, sin cambiar quién atiende.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BotonFichar, textoResultado } from "@/components/panel/BotonFichar";
import { Mensaje } from "@/components/ui/Mensaje";
import { ficharConPin, type ResFichaje } from "./acciones";

export function FicharPin({ zona, mio }: { zona: string; mio: { nombre: string; enTurno: boolean; entradaEn: string | null; sinSalidaDesde: string | null } }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [res, setRes] = useState<ResFichaje | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <div className="space-y-6 max-w-xl">
      <BotonFichar nombre={mio.nombre} enTurno={mio.enTurno} entradaEn={mio.entradaEn} sinSalidaDesde={mio.sinSalidaDesde} zona={zona} />
      <form className="tarjeta p-5 space-y-3" data-fichar-pin
        onSubmit={(e) => { e.preventDefault(); empezar(async () => { const r = await ficharConPin(pin); setRes(r); if (!r.error) { setPin(""); router.refresh(); } }); }}>
        <h2 className="titulo text-xl">🔢 Fichar con mi PIN</h2>
        <p className="texto-suave text-sm">Si otra persona está atendiendo en esta compu, poné tu PIN de 4 números: ficha tu entrada o tu salida, a tu nombre.</p>
        <label className="block">
          <span className="font-semibold block mb-1">Mi PIN</span>
          <input name="pin" type="password" inputMode="numeric" autoComplete="off" maxLength={4} pattern="[0-9]{4}" value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className="campo w-32 text-center text-2xl tracking-widest" aria-label="Mi PIN" />
        </label>
        <button className="boton boton-principal" disabled={ocupado || pin.length !== 4} data-fichar-con-pin>{ocupado ? "Fichando…" : "Fichar"}</button>
        {res && (res.error
          ? <Mensaje tipo="error">{res.error}</Mensaje>
          : <Mensaje tipo={res.accion === "entrada" || res.accion === "salida" ? "exito" : "aviso"}>{textoResultado(res, zona)}</Mensaje>)}
      </form>
    </div>
  );
}
