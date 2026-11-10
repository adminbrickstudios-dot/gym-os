"use client";
// VD-42: verificación en dos pasos con una app autenticadora (TOTP de Supabase MFA). Con ella activa, lo sensible
// (exportar datos, tocar el equipo, cambiar los cobros) pide el código: lo decide la base (privado.exigir_aal2).
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Mensaje } from "@/components/ui/Mensaje";
import { crearClienteNavegador } from "@/lib/supabase/navegador";
import { Icono } from "@/components/ui/Icono";

type Estado =
  | { tipo: "cargando" }
  | { tipo: "sin" }
  | { tipo: "enrolando"; factorId: string; qr: string; secreto: string }
  | { tipo: "activo"; factorId: string; confirmada: boolean };

export function DosPasos({ recomendada }: { recomendada: boolean }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [codigo, setCodigo] = useState("");
  const [msj, setMsj] = useState<{ ok?: boolean; texto?: string }>({});

  const cargar = useCallback(async () => {
    try {
      const sb = crearClienteNavegador();
      const [{ data: f, error: e1 }, { data: a, error: e2 }] = await Promise.all([sb.auth.mfa.listFactors(), sb.auth.mfa.getAuthenticatorAssuranceLevel()]);
      if (e1 || e2) throw new Error((e1 ?? e2)!.message);
      const verificado = f?.totp?.[0];
      setEstado(verificado ? { tipo: "activo", factorId: verificado.id, confirmada: a?.currentLevel === "aal2" } : { tipo: "sin" });
    } catch (e) {
      setMsj({ texto: `No pudimos revisar la verificación en dos pasos: ${(e as Error).message}` });
      setEstado({ tipo: "sin" });
    }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const activar = async () => {
    setMsj({});
    const sb = crearClienteNavegador();
    // Un intento anterior sin terminar deja un factor sin verificar: se limpia para empezar de cero.
    const { data: todos } = await sb.auth.mfa.listFactors();
    for (const f of todos?.all ?? []) if (f.status === "unverified") await sb.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `Base ${new Date().toISOString().slice(0, 10)}` });
    if (error || !data) { setMsj({ texto: `No se pudo empezar: ${error?.message ?? "sin respuesta"}` }); return; }
    setCodigo("");
    setEstado({ tipo: "enrolando", factorId: data.id, qr: data.totp.qr_code, secreto: data.totp.secret });
  };

  const verificar = async (factorId: string, alTerminar: string) => {
    setMsj({});
    const sb = crearClienteNavegador();
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code: codigo.replace(/\s/g, "") });
    if (error) { setMsj({ texto: /invalid|inv[aá]lid/i.test(error.message) ? "Ese código no es correcto. Mirá el que muestra tu app ahora." : `No se pudo verificar: ${error.message}` }); return; }
    setCodigo("");
    setMsj({ ok: true, texto: alTerminar });
    await cargar();
    router.refresh();
  };

  const desactivar = async (factorId: string) => {
    setMsj({});
    const sb = crearClienteNavegador();
    const { error } = await sb.auth.mfa.unenroll({ factorId });
    if (error) { setMsj({ texto: /aal2/i.test(error.message) ? "Para desactivarla, primero confirmá tu código de ahora." : `No se pudo desactivar: ${error.message}` }); return; }
    setMsj({ ok: true, texto: "Verificación en dos pasos desactivada." });
    await cargar();
    router.refresh();
  };

  return (
    <section id="dos-pasos" className="tarjeta p-5 sm:p-6 max-w-xl mt-6 space-y-3" aria-labelledby="dos-pasos-titulo" data-dos-pasos={estado.tipo}>
      <h2 id="dos-pasos-titulo" className="titulo text-2xl"><Icono nombre="escudo" /> Verificación en dos pasos</h2>
      {estado.tipo === "cargando" && <div className="esqueleto h-12" aria-busy="true" aria-label="Cargando" />}

      {estado.tipo === "sin" && (
        <>
          <p className="texto-suave">
            {recomendada ? "Te la recomendamos: " : ""}además de tu contraseña, pide un código de 6 números de una app (Google Authenticator, Authy…) para exportar los datos del gimnasio, tocar el equipo o cambiar los cobros.
          </p>
          <BotonAccion className="boton boton-principal" ocupadoTexto="Preparando…" data-activar-dos-pasos onClick={activar}>Activar</BotonAccion>
        </>
      )}

      {estado.tipo === "enrolando" && (
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
          <p className="texto-suave">1. Abrí tu app autenticadora y escaneá este código (o escribí la clave a mano).</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={estado.qr} alt="Código QR para tu app autenticadora" width={176} height={176} className="rounded-xl bg-white p-2" />
          <p className="texto-suave text-sm">Clave: <code className="break-all select-all" data-clave-totp>{estado.secreto}</code></p>
          <p className="texto-suave">2. Escribí el código de 6 números que muestra la app.</p>
          <input className="campo numero text-2xl tracking-widest !w-44" inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label="Código de 6 números"
            value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} />
          <div className="flex flex-wrap gap-2">
            <BotonAccion className="boton boton-principal" ocupadoTexto="Verificando…" disabled={codigo.length !== 6}
              onClick={() => verificar(estado.factorId, "Listo: la verificación en dos pasos quedó activa.")}>Confirmar y activar</BotonAccion>
            <button type="button" className="boton-texto texto-suave" onClick={() => { void cargar(); setMsj({}); }}>Cancelar</button>
          </div>
        </form>
      )}

      {estado.tipo === "activo" && (
        <>
          <p><span className="pildora pildora-verde">Activa</span></p>
          {estado.confirmada ? (
            <p className="texto-suave" data-dos-pasos-confirmada><Icono nombre="ok" /> Ya confirmaste tu código en esta sesión: podés exportar y tocar el equipo.</p>
          ) : (
            <form className="space-y-2" onSubmit={(e) => e.preventDefault()}>
              <p className="texto-suave">Para exportar datos, tocar el equipo o cambiar los cobros, confirmá tu código de ahora.</p>
              <input className="campo numero text-2xl tracking-widest !w-44" inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label="Código de 6 números"
                value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} />
              <div>
                <BotonAccion className="boton" ocupadoTexto="Verificando…" disabled={codigo.length !== 6}
                  onClick={() => verificar(estado.factorId, "Código confirmado.")}>Confirmar código</BotonAccion>
              </div>
            </form>
          )}
          {estado.confirmada && (
            <BotonAccion className="boton boton-chico texto-suave" ocupadoTexto="Desactivando…" onClick={() => desactivar(estado.factorId)}>Desactivar</BotonAccion>
          )}
        </>
      )}
      {msj.texto && <Mensaje tipo={msj.ok ? "exito" : "error"}>{msj.texto}</Mensaje>}
    </section>
  );
}
