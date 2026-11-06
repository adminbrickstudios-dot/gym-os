"use client";
import { startTransition, useActionState, useEffect, useState } from "react";
import { pedirCodigo, pedirCodigoMail, verificarCodigo, verificarCodigoMail } from "./acciones";
import { FormularioIngreso } from "./FormularioIngreso";
import { PasoCodigo } from "@/components/cuentas/PasoCodigo";
import { Mensaje } from "@/components/ui/Mensaje";
import { DesafioTurnstile } from "@/components/cuentas/DesafioTurnstile";

type Via = "celular" | "mail" | "clave";
type Estado = { error?: string; enviado?: boolean; telefono?: string; email?: string; destino?: string };
const VIAS: [Via, string][] = [["celular", "📱 Celular"], ["mail", "✉️ Mail"], ["clave", "🔑 Contraseña"]];

/**
 * El socio entra con un solo campo, "celular o mail" (VD-33, primero quién): lo que escribe elige el método
 * (con "@" es un mail, si no un celular) y debajo quedan los tres métodos de siempre: código por SMS, código
 * por mail y mail con contraseña (APP-9). Nada de acá revela si la cuenta existe.
 */
export function IngresoSocio() {
  const [via, setVia] = useState<Via>("celular");
  const [valor, setValor] = useState("");
  const [intento, setIntento] = useState(0);
  const vias = <Vias via={via} cambiar={setVia} />;
  if (via === "clave") {
    return (
      <div className="mt-6 space-y-6">
        <FormularioIngreso siguiente="/app" emailInicial={valor.includes("@") ? valor : undefined} />
        {vias}
      </div>
    );
  }
  return <PorCodigo key={intento} via={via} setVia={setVia} valor={valor} setValor={setValor} vias={vias} otraVez={() => setIntento((i) => i + 1)} />;
}

function Vias({ via, cambiar }: { via: Via; cambiar: (v: Via) => void }) {
  return (
    <div>
      <p className="etiqueta mb-2">Cómo querés entrar</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Cómo entrar">
        {VIAS.map(([v, t]) => (
          <button key={v} type="button" aria-pressed={via === v} onClick={() => cambiar(v)}
            className={`pildora cursor-pointer !min-h-11 ${via === v ? "pildora-azul" : ""}`}>{t}</button>
        ))}
      </div>
    </div>
  );
}

function PorCodigo({ via, setVia, valor, setValor, vias, otraVez }: {
  via: Via; setVia: (v: Via) => void; valor: string; setValor: (v: string) => void; vias: React.ReactNode; otraVez: () => void;
}) {
  const [pedidoC, pedirC, pidiendoC] = useActionState<Estado, FormData>(pedirCodigo, {});
  const [pedidoM, pedirM, pidiendoM] = useActionState<Estado, FormData>(pedirCodigoMail, {});
  const [verifC, verificarC, verificandoC] = useActionState<Estado, FormData>(verificarCodigo, {});
  const [verifM, verificarM, verificandoM] = useActionState<Estado, FormData>(verificarCodigoMail, {});
  const mail = via === "mail";
  const pedido = mail ? pedidoM : pedidoC;
  const verif = mail ? verifM : verifC;
  const pidiendo = mail ? pidiendoM : pidiendoC;
  const verificando = mail ? verificandoM : verificandoC;

  // Una vez enviado el código se pasa al paso del código y se queda ahí, aunque un reenvío falle.
  const [enCodigo, setEnCodigo] = useState(false);
  const [confirmado, setConfirmado] = useState("");
  const [visto, setVisto] = useState<Estado>(pedido);
  if (pedido !== visto) {
    setVisto(pedido);
    if (pedido.enviado) { setEnCodigo(true); setConfirmado((mail ? pedido.email : pedido.telefono) ?? ""); }
  }
  useEffect(() => { if (verif.destino) window.location.assign(verif.destino); }, [verif.destino]);

  if (enCodigo) {
    return (
      <div className="mt-6">
        <PasoCodigo
          accion={mail ? verificarM : verificarC}
          ocultos={mail ? { email: confirmado } : { telefono: confirmado }}
          intro={mail
            ? <>Te mandamos un código a <strong className="text-[var(--texto)]">{confirmado}</strong>. Mirá también en spam.</>
            : <>Te mandamos un código por SMS a <strong className="text-[var(--texto)]">{confirmado}</strong>.</>}
          error={verif.error ?? pedido.error} intento={verif} envio={pedido}
          entrando={verificando || !!verif.destino}
          reenviar={() => startTransition(() => { const f = new FormData(); f.set(mail ? "email" : "telefono", valor); (mail ? pedirM : pedirC)(f); })}
          reenviando={pidiendo} cambiar={otraVez}
        />
      </div>
    );
  }
  return (
    <form action={mail ? pedirM : pedirC} className="mt-6 space-y-4" {...(mail ? { "data-ingreso-mail": "" } : {})}>
      <label className="block space-y-2">
        <span className="etiqueta">Tu celular o tu mail</span>
        <input
          className="campo !text-xl" name={mail ? "email" : "telefono"} type={mail ? "email" : "tel"} autoComplete={mail ? "email" : "tel"}
          required placeholder="387 555-1234 o vos@ejemplo.com" value={valor}
          onChange={(e) => {
            const v = e.target.value;
            setValor(v);
            if (v.includes("@") && via === "celular") setVia("mail");
            else if (via === "mail" && v !== "" && !v.includes("@") && /^[\d\s+()-]+$/.test(v)) setVia("celular");
          }}
        />
      </label>
      {vias}
      <DesafioTurnstile />
      {pedido.error && <Mensaje tipo="error">{pedido.error}</Mensaje>}
      <button type="submit" disabled={pidiendo} className="boton boton-principal text-lg w-full">
        {pidiendo ? "Mandando…" : mail ? "✉️ Mandame el código" : "📲 Mandame el código"}
      </button>
    </form>
  );
}
