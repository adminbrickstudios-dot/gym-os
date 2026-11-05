"use client";
// Alta online en un solo formulario: plan → datos → reglamento → cómo paga.
// Al terminar dice exactamente qué sigue (transferir y mandar el comprobante
// desde la app, o pagar en el mostrador). La base decide todo lo demás.
import { useActionState, useState } from "react";
import { formatearPesos } from "@/lib/formato";
import { unidadPlan, variantesPlan } from "@/lib/landing-textos";
import { altaOnline, type ResultadoAlta } from "./acciones";
import type { DatosAlta } from "./page";

function Copiar({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="boton" onClick={async () => { try { await navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 2000); } catch { setOk(false); } }}>
      {ok ? "✅ Copiado" : `📋 Copiar ${etiqueta}`}
    </button>
  );
}

export function FormAlta({ datos, planInicial }: { datos: DatosAlta; planInicial: string | null }) {
  const [r, accion, enviando] = useActionState<ResultadoAlta, FormData>(altaOnline, {});
  const planes = datos.planes ?? [];
  const [plan, setPlan] = useState(planes.some((p) => p.id === planInicial) ? planInicial : null);
  const [medio, setMedio] = useState<"transferencia" | "mostrador">(datos.transferencia ? "transferencia" : "mostrador");
  const v = (c: string) => r.datos?.[c] ?? "";

  if (r.ya_socio) {
    return (
      <div className="tarjeta p-6 space-y-4" role="status" data-alta-ya-socio>
        <p className="titulo text-3xl">👋 ¡Ya sos socio, {r.nombre}!</p>
        <p className="texto-suave text-lg">Tu DNI o tu celular ya están en {datos.marca.nombre}. Entrá a la app con tu celular para ver tu cuota y pagar.</p>
        <a href="/ingresar?modo=socio" className="boton boton-principal">💪 Entrar a la app</a>
      </div>
    );
  }
  if (r.listo) {
    const t = r.transferencia;
    return (
      <div className="tarjeta p-6 space-y-5" role="status" data-alta-lista={r.medio}>
        <p className="titulo text-3xl">🎉 ¡Bienvenido/a a {datos.marca.nombre}, {r.nombre}!</p>
        <p className="text-lg">Ya estás anotado/a{r.plan ? <> en <strong>{r.plan}</strong></> : null}.
          {r.precio != null && <> Son <strong>{formatearPesos(r.precio)}</strong>.</>}</p>
        {r.medio === "transferencia" && t ? (
          <div className="space-y-3">
            <p className="texto-suave">Transferí a esta cuenta y mandá el comprobante desde la app. Cuando lo aprueben, ya podés entrar.</p>
            <dl className="tarjeta p-4 space-y-2">
              {t.alias && <div className="flex flex-wrap items-center justify-between gap-2"><dt className="texto-suave">Alias</dt><dd className="numero text-xl break-all">{t.alias}</dd></div>}
              {t.cbu && <div className="flex flex-wrap items-center justify-between gap-2"><dt className="texto-suave">CBU / CVU</dt><dd className="numero text-lg break-all">{t.cbu}</dd></div>}
              {t.titular && <div className="flex flex-wrap items-center justify-between gap-2"><dt className="texto-suave">Titular</dt><dd>{t.titular}</dd></div>}
              {t.banco && <div className="flex flex-wrap items-center justify-between gap-2"><dt className="texto-suave">Banco</dt><dd>{t.banco}</dd></div>}
            </dl>
            <div className="flex flex-wrap gap-2">
              {t.alias && <Copiar texto={t.alias} etiqueta="alias" />}
              {t.cbu && <Copiar texto={t.cbu} etiqueta="CBU" />}
            </div>
          </div>
        ) : <p className="texto-suave text-lg">Pasá por recepción y pagá tu plan: desde ese momento ya podés entrenar.</p>}
        <a href="/ingresar?modo=socio" className="boton boton-principal">💪 Entrar a la app con mi celular</a>
      </div>
    );
  }

  return (
    <form action={accion} className="space-y-8" data-form-alta>
      <fieldset className="space-y-3">
        <legend className="titulo text-2xl mb-3">1. Tu plan</legend>
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Plan">
          {planes.map((p) => (
            <label key={p.id} className={`tarjeta p-5 cursor-pointer border-2 ${plan === p.id ? "border-[var(--acento)]" : "border-transparent"}`} data-plan={p.nombre}>
              <input type="radio" name="plan" value={p.id} checked={plan === p.id} onChange={() => setPlan(p.id ?? null)} className="sr-only" />
              <span className="block titulo text-xl">{p.nombre}</span>
              {datos.mostrar_precios && p.precio != null && <span className="block mt-2"><span className="numero text-3xl">{formatearPesos(p.precio)}</span> <span className="texto-suave">{unidadPlan(p)}</span></span>}
              {datos.mostrar_precios && variantesPlan(p).map((x) => <span key={x} className="block text-sm mt-1" style={{ color: "var(--acento)" }}>💸 {x}</span>)}
              {p.descripcion && <span className="block texto-suave text-sm mt-2">{p.descripcion}</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="titulo text-2xl mb-3">2. Tus datos</legend>
        <label className="block space-y-1"><span className="etiqueta">Nombre</span><input name="nombre" required maxLength={80} autoComplete="given-name" className="campo" defaultValue={v("nombre")} /></label>
        <label className="block space-y-1"><span className="etiqueta">Apellido</span><input name="apellido" required maxLength={80} autoComplete="family-name" className="campo" defaultValue={v("apellido")} /></label>
        <label className="block space-y-1"><span className="etiqueta">DNI</span><input name="dni" required inputMode="numeric" className="campo" defaultValue={v("dni")} /><span className="text-sm texto-tenue">Solo números</span></label>
        <label className="block space-y-1"><span className="etiqueta">Celular</span><input name="telefono" required type="tel" autoComplete="tel" placeholder="387 555 1234" className="campo" defaultValue={v("telefono")} /><span className="text-sm texto-tenue">Con él entrás a la app</span></label>
        <label className="block space-y-1"><span className="etiqueta">Mail <span className="texto-tenue font-normal">(opcional)</span></span><input name="email" type="email" autoComplete="email" className="campo" defaultValue={v("email")} /></label>
        <label className="block space-y-1"><span className="etiqueta">Fecha de nacimiento <span className="texto-tenue font-normal">(opcional)</span></span><input name="fecha_nacimiento" type="date" className="campo" defaultValue={v("fecha_nacimiento")} /><span className="text-sm texto-tenue">Para saludarte en tu cumpleaños</span></label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="titulo text-2xl mb-3">3. Reglamento</legend>
        <div className="tarjeta p-5 max-h-64 overflow-auto whitespace-pre-line texto-suave" data-reglamento>{datos.reglamento!.texto}</div>
        <input type="hidden" name="version" value={datos.reglamento!.version} />
        <label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" name="acepto" value="si" required defaultChecked={v("acepto") === "si"} className="mt-1 size-5" />
          <span>Leí y acepto el reglamento de {datos.marca.nombre}.</span></label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="titulo text-2xl mb-3">4. Cómo pagás</legend>
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Cómo pagás">
          {datos.transferencia && (
            <label className={`tarjeta p-5 cursor-pointer border-2 ${medio === "transferencia" ? "border-[var(--acento)]" : "border-transparent"}`}>
              <input type="radio" name="medio" value="transferencia" checked={medio === "transferencia"} onChange={() => setMedio("transferencia")} className="sr-only" />
              <span className="block titulo text-xl">🏦 Transferencia</span>
              <span className="block texto-suave text-sm mt-1">Te mostramos el alias y mandás el comprobante desde la app.</span>
            </label>
          )}
          <label className={`tarjeta p-5 cursor-pointer border-2 ${medio === "mostrador" ? "border-[var(--acento)]" : "border-transparent"}`}>
            <input type="radio" name="medio" value="mostrador" checked={medio === "mostrador"} onChange={() => setMedio("mostrador")} className="sr-only" />
            <span className="block titulo text-xl">🛎️ En el gimnasio</span>
            <span className="block texto-suave text-sm mt-1">Pagás en recepción cuando vengas.</span>
          </label>
        </div>
      </fieldset>

      <input name="sitio" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      {r.error && <p role="alert" className="mensaje mensaje-error">⚠️ {r.error}</p>}
      <button type="submit" disabled={enviando || !plan} className="boton boton-principal text-lg w-full sm:w-auto px-10">
        {enviando ? "Anotándote…" : plan ? "💪 Hacerme socio" : "Elegí un plan"}
      </button>
    </form>
  );
}
