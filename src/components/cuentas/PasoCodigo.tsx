"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Mensaje } from "@/components/ui/Mensaje";

const SEGUNDOS = 59;
const reloj = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * El paso del código de 6 dígitos (VD-33): se completa solo desde el SMS o el mail
 * (autocomplete="one-time-code"), acepta pegado ("123 456"), se verifica al sexto
 * dígito sin apretar nada, no se manda dos veces, y "Reenviar en 0:59" cuenta hacia atrás.
 * `intento` es el último resultado de verificar (cambia con cada respuesta); `envio`, el último pedido
 * de código (cambia con cada reenvío y reinicia la cuenta).
 */
export function PasoCodigo({ accion, ocultos, intro, error, intento, envio, entrando, reenviar, reenviando, cambiar, textoBoton = "✅ Entrar" }: {
  accion: (datos: FormData) => void;
  ocultos: Record<string, string>;
  intro: ReactNode;
  error?: string;
  intento: unknown;
  envio: unknown;
  entrando: boolean;
  reenviar: () => void;
  reenviando: boolean;
  cambiar: () => void;
  textoBoton?: string;
}) {
  const campo = useRef<HTMLInputElement>(null);
  const enCurso = useRef(false);
  const [segundos, setSegundos] = useState(SEGUNDOS);
  const [envioVisto, setEnvioVisto] = useState(envio);
  if (envio !== envioVisto) { setEnvioVisto(envio); setSegundos(SEGUNDOS); }

  useEffect(() => {
    const t = setInterval(() => setSegundos((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);
  // Con cada respuesta el formulario se puede volver a mandar; si falló, el cursor vuelve al código.
  useEffect(() => {
    enCurso.current = false;
    if (error) campo.current?.focus();
  }, [intento, error]);

  const alMandar = (e: FormEvent<HTMLFormElement>) => {
    if (enCurso.current) { e.preventDefault(); return; }
    enCurso.current = true;
  };

  return (
    <form action={accion} onSubmit={alMandar} className="space-y-4" data-paso-codigo>
      {Object.entries(ocultos).map(([n, v]) => <input key={n} type="hidden" name={n} value={v} />)}
      <p className="texto-suave">{intro}</p>
      <input
        ref={campo} className="campo ingreso-codigo !text-3xl !min-h-16 text-center numero" name="codigo"
        inputMode="numeric" autoComplete="one-time-code" maxLength={12} required autoFocus placeholder="••••••" aria-label="Código"
        onChange={(e) => {
          const d = e.currentTarget.value.replace(/\D/g, "").slice(0, 6);
          e.currentTarget.value = d;
          if (d.length === 6) e.currentTarget.form?.requestSubmit();
        }}
      />
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <button type="submit" aria-busy={entrando} className="boton boton-principal text-lg w-full">{entrando ? "Entrando…" : textoBoton}</button>
      <div className="flex items-center justify-between gap-2 text-sm">
        <button type="button" onClick={cambiar} className="underline underline-offset-4 texto-suave cursor-pointer min-h-11">Cambiar</button>
        <button type="button" onClick={() => { setSegundos(SEGUNDOS); reenviar(); }} disabled={segundos > 0 || reenviando}
          className="underline underline-offset-4 texto-suave cursor-pointer min-h-11 disabled:no-underline disabled:opacity-70" data-reenviar>
          {reenviando ? "Mandando…" : segundos > 0 ? `Reenviar en ${reloj(segundos)}` : "Reenviar el código"}
        </button>
      </div>
    </form>
  );
}
