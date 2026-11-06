"use client";
import { startTransition, useActionState, useEffect, useState } from "react";
import { confirmarVinculoGoogle, pedirCodigoGoogle, verificarCodigoGoogle, type EstadoVinculo } from "../acciones";
import { PasoCodigo } from "@/components/cuentas/PasoCodigo";
import { DesafioTurnstile } from "@/components/cuentas/DesafioTurnstile";
import { Mensaje } from "@/components/ui/Mensaje";

/**
 * Primera vez con Google: la persona prueba quién es con su DNI y un código al celular (o mail) que dejó en el
 * gimnasio. No hay lista de socios ni búsqueda por nombre: el DNI es la llave y el código, la prueba.
 */
export function VincularGoogle({ cuenta }: { cuenta: string | null }) {
  const [pedido, pedir, pidiendo] = useActionState<EstadoVinculo, FormData>(pedirCodigoGoogle, {});
  const [verif, verificar, verificando] = useActionState<EstadoVinculo, FormData>(verificarCodigoGoogle, {});
  const [conf, confirmar, confirmando] = useActionState<EstadoVinculo, FormData>(confirmarVinculoGoogle, {});
  const [dni, setDni] = useState("");
  const [enCodigo, setEnCodigo] = useState(false);
  const [visto, setVisto] = useState<EstadoVinculo>(pedido);
  if (pedido !== visto) {
    setVisto(pedido);
    if (pedido.enviado) setEnCodigo(true);
  }
  const destino = verif.destino ?? conf.destino;
  useEffect(() => { if (destino) window.location.assign(destino); }, [destino]);
  const pregunta = verif.confirmar ?? conf.confirmar;

  if (pregunta && !destino) {
    return (
      <form action={confirmar} className="space-y-4" data-vincular-confirmar>
        <input type="hidden" name="dni" value={dni} />
        <input type="hidden" name="verificado" value={pregunta.verificado} />
        <input type="hidden" name="prueba" value={pregunta.prueba} />
        <Mensaje tipo="aviso">
          {pregunta.otraCuenta
            ? <>{pregunta.socio} ya entraba con otra cuenta de Google. Si seguís, esa cuenta deja de entrar a su ficha.</>
            : <>Esta cuenta de Google ya entra a la ficha de <strong>{pregunta.otros.join(", ")}</strong>. ¿Querés sumar también a <strong>{pregunta.socio}</strong>?</>}
        </Mensaje>
        {conf.error && <Mensaje tipo="error">{conf.error}</Mensaje>}
        <button type="submit" disabled={confirmando} className="boton boton-principal text-lg w-full">{confirmando ? "Vinculando…" : "Sí, vincular"}</button>
        <a href="/ingresar?modo=socio" className="boton w-full text-center">No, volver</a>
      </form>
    );
  }

  if (enCodigo) {
    return (
      <PasoCodigo
        accion={verificar}
        ocultos={{ dni }}
        intro={<>Si el DNI <strong className="text-[var(--texto)]">{dni}</strong> está cargado en el gimnasio, te mandamos un código al celular (o al mail) que dejaste. Escribilo acá.</>}
        error={verif.error ?? pedido.error} intento={verif} envio={pedido}
        entrando={verificando || !!destino}
        reenviar={() => startTransition(() => { const f = new FormData(); f.set("dni", dni); pedir(f); })}
        reenviando={pidiendo}
        cambiar={() => setEnCodigo(false)}
        textoBoton="✅ Vincular y entrar"
      />
    );
  }

  return (
    <form action={pedir} className="space-y-4" data-vincular-dni>
      <label className="block space-y-2">
        <span className="etiqueta">Tu DNI</span>
        <input
          className="campo !text-xl numero" name="dni" inputMode="numeric" autoComplete="off" required maxLength={12}
          placeholder="30111222" value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 9))}
        />
      </label>
      <DesafioTurnstile />
      {pedido.error && <Mensaje tipo="error">{pedido.error}</Mensaje>}
      <button type="submit" disabled={pidiendo} className="boton boton-principal text-lg w-full">{pidiendo ? "Mandando…" : "📲 Mandame el código"}</button>
      <p className="texto-suave text-sm">
        {cuenta ? <>Entraste con Google como <strong className="break-all">{cuenta}</strong>. </> : null}
        Es la primera vez: para cuidar tu ficha, el gimnasio te manda un código al celular o al mail que tiene cargado.
      </p>
      <a href="/ingresar?modo=socio" className="underline underline-offset-4 texto-suave text-sm inline-block min-h-11 leading-[2.75rem]">Prefiero entrar con mi celular</a>
    </form>
  );
}
