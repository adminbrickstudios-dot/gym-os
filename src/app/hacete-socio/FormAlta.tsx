"use client";
// Alta online en un solo formulario: plan → datos → reglamento (si el gimnasio tiene) → cómo paga.
// Al terminar la cuenta queda creada y con la sesión abierta, sin pagar (D26): dice qué sigue y lleva al perfil.
// La base decide todo lo demás (DNI sin duplicar, plan válido, reglamento vigente).
import { useActionState, useState } from "react";
import { formatearDni, formatearPesos } from "@/lib/formato";
import { unidadPlan, variantesPlan } from "@/lib/landing-textos";
import { Mensaje } from "@/components/ui/Mensaje";
import { BorradorAutomatico } from "@/lib/app/BorradorAutomatico";
import { altaOnline, type ResultadoAlta } from "./acciones";
import type { DatosAlta } from "./page";
import { Icono } from "@/components/ui/Icono";
import { CampoAntiRobot } from "@/components/cuentas/CampoAntiRobot";

function Copiar({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="boton" onClick={async () => { try { await navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 2000); } catch { setOk(false); } }}>
      {ok ? <><Icono nombre="ok" /> Copiado</> : `Copiar ${etiqueta}`}
    </button>
  );
}


/** Hoy (local) corrido `anos` años, como AAAA-MM-DD. */
const hoyLocal = (anos = 0) => { const d = new Date(); return `${d.getFullYear() - anos}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
/** ¿Tiene menos de 18 hoy? (nació después de hoy hace 18 años, y no en el futuro). La base lo vuelve a decidir con la zona del gimnasio. */
const esMenorDe18 = (nac: string) => /^\d{4}-\d{2}-\d{2}$/.test(nac) && nac > hoyLocal(18) && nac <= hoyLocal();

export function FormAlta({ datos, planInicial, origen = "" }: { datos: DatosAlta; planInicial: string | null; origen?: string }) {
  const [r, accion, enviando] = useActionState<ResultadoAlta, FormData>(altaOnline, {});
  const planes = datos.planes ?? [];
  const [plan, setPlan] = useState(planes.some((p) => p.id === planInicial) ? planInicial : null);
  const [medio, setMedio] = useState<"transferencia" | "mostrador">(datos.transferencia ? "transferencia" : "mostrador");
  const [nac, setNac] = useState(r.datos?.fecha_nacimiento ?? "");
  const menor = esMenorDe18(nac);
  const v = (c: string) => r.datos?.[c] ?? "";
  const conReglamento = !!datos.reglamento;
  // D83: crear la cuenta no pide plan. Si el gimnasio tiene las altas con plan prendidas, el plan es opcional ("Lo elijo en el gimnasio") y el medio de pago solo aparece si eligió uno.
  const conPlanes = planes.length > 0;
  const PASOS: [string, string][] = [...(conPlanes ? [["plan", "Tu plan"] as [string, string]] : []), ["datos", "Tus datos"], ...(conReglamento ? [["reglamento", "Reglamento"] as [string, string]] : []), ...(plan ? [["pago", "Cómo pagás"] as [string, string]] : [])];
  const n = (id: string) => PASOS.findIndex(([x]) => x === id) + 1;
  const errorEn = (c: string) => (r.error && r.campo === c ? r.error : null);
  const invalido = (c: string) => (errorEn(c) ? { "aria-invalid": true as const, "aria-describedby": `error-${c}` } : {});
  const MensajeCampo = ({ c }: { c: string }) => (errorEn(c) ? <span id={`error-${c}`} className="block text-sm" style={{ color: "var(--rojo)" }} role="alert">{r.error}</span> : null);

  if (r.ya_socio) {
    return (
      <div className="tarjeta p-6 space-y-4" role="status" data-alta-ya-socio>
        <p className="titulo text-3xl"><Icono nombre="persona" /> {r.por === "telefono" ? `Ese celular ya es de un socio de ${datos.marca.nombre}.` : `Ese DNI ya es socio de ${datos.marca.nombre}.`}</p>
        <p className="texto-suave text-lg">¿Querés entrar? Con tu mail y tu contraseña ves tu cuota y pagás desde la app. Si tu ficha ya estaba cargada y es tu primera vez, reclamala con tu DNI y tu celular.</p>
        <div className="flex flex-wrap gap-2">
          <a href="/ingresar?modo=socio" className="boton boton-principal" data-entrar-ya-socio><Icono nombre="llave" /> Entrar</a>
          <a href="/ingresar?modo=socio&reclamar=1" className="boton" data-reclamar-ficha><Icono nombre="persona" /> Es mi primera vez: reclamar mi ficha</a>
        </div>
      </div>
    );
  }
  if (r.listo) {
    const t = r.transferencia;
    return (
      <div className="tarjeta p-6 space-y-5" role="status" data-alta-lista={r.medio ?? "sin-plan"}>
        <BorradorAutomatico clave="alta-socio" borrar />
        <p className="titulo text-3xl" data-alta-titulo><Icono nombre="ok" /> ¡Listo, {r.nombre}! Ya tenés tu cuenta en {datos.marca.nombre}.</p>
        <p className="text-lg">
          {r.plan ? <>Elegiste <strong>{r.plan}</strong>.</> : null}
          {r.precio != null && <> Son <strong>{formatearPesos(r.precio)}</strong>.</>}
          {r.menor ? " Quedó anotado con su adulto responsable." : ""}
        </p>
        {r.dni && <p className="text-xl" data-tu-dni>Tu DNI para entrar: <strong className="numero">{formatearDni(r.dni)}</strong></p>}
        <p className="texto-suave text-lg">
          {!r.plan ? "Cuando vengas al gimnasio, en recepción te damos tu clase de prueba o te damos el alta. Tu QR ya está en tu perfil y se activa solo cuando pagues."
            : r.medio === "transferencia" && t ? "Para empezar a entrar, pagá tu plan por transferencia." : "Pasá por recepción y pagá tu plan: desde ese momento ya podés entrenar."}
          {r.pagoOnline ? " También podés pagar online desde tu perfil." : ""} Hasta que se pague, la puerta te va a decir que falta pagar.
        </p>
        {r.medio === "transferencia" && t && (
          <div className="space-y-3">
            <p className="texto-suave">Transferí a esta cuenta y mandá el comprobante desde la app. Cuando lo aprueben, ya podés entrar.</p>
            <dl className="tarjeta p-4 space-y-2">
              {([["Alias", t.alias, "numero text-xl break-all"], ["CBU / CVU", t.cbu, "numero text-lg break-all"], ["Titular", t.titular], ["Banco", t.banco]] as [string, string | null | undefined, string?][])
                .map(([dt, v, c]) => v && <div key={dt} className="flex flex-wrap items-center justify-between gap-2"><dt className="texto-suave">{dt}</dt><dd className={c}>{v}</dd></div>)}
            </dl>
            <div className="flex flex-wrap gap-2">
              {t.alias && <Copiar texto={t.alias} etiqueta="alias" />}
              {t.cbu && <Copiar texto={t.cbu} etiqueta="CBU" />}
            </div>
          </div>
        )}
        <a href={r.sesion ? "/app" : "/ingresar?modo=socio"} className="boton boton-principal text-lg w-full sm:w-auto" data-ir-a-mi-perfil>
          <Icono nombre="persona" /> {r.sesion ? "Ir a mi perfil" : "Entrar a mi perfil"}
        </a>
      </div>
    );
  }

  return (
    <form action={accion} className="space-y-8" data-form-alta>
      {/* FA-17: "¿Seguimos donde dejaste?" con lo que ya escribió (solo en este dispositivo; nunca el reglamento aceptado ni la contraseña). */}
      <BorradorAutomatico clave="alta-socio" />
      {/* VD-61: pasos cortos, cada uno con su nombre; tocar uno lleva a ese paso. */}
      <nav aria-label="Pasos para crear tu cuenta" className="flex flex-wrap gap-2" data-pasos-alta>
        {PASOS.map(([id, t], i) => <a key={id} href={"#paso-" + id} className="pildora !min-h-11 inline-flex items-center">{i + 1}. {t}</a>)}
      </nav>
      {/* React 19 vacía el formulario después de cada envío con error: los radios controlados se ven elegidos pero no viajan. Por eso el valor viaja en campos ocultos. */}
      <input type="hidden" name="plan" value={plan ?? ""} />
      <input type="hidden" name="medio" value={plan ? medio : ""} />
      <input type="hidden" name="origen" value={origen} />
      {conPlanes && <fieldset id="paso-plan" className="space-y-3 scroll-mt-4">
        <legend className="titulo text-2xl mb-3">{n("plan")}. Tu plan <span className="texto-suave text-base font-normal">(opcional)</span></legend>
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Plan">
          {planes.map((p) => (
            <label key={p.id} className={`tarjeta p-5 cursor-pointer border-2 focus-within:outline focus-within:outline-2 focus-within:outline-[var(--acento)] ${plan === p.id ? "border-[var(--acento)]" : "border-transparent"}`} data-plan={p.nombre}>
              <input type="radio" value={p.id} checked={plan === p.id} onChange={() => setPlan(p.id ?? null)} className="sr-only" />
              <span className="block titulo text-xl">{p.nombre}</span>
              {datos.mostrar_precios && p.precio != null && <span className="block mt-2"><span className="numero text-3xl">{formatearPesos(p.precio)}</span> <span className="texto-suave">{unidadPlan(p)}</span></span>}
              {datos.mostrar_precios && variantesPlan(p).map((x) => <span key={x} className="block text-sm mt-1" style={{ color: "var(--acento)" }}><Icono nombre="plata" /> {x}</span>)}
              {p.descripcion && <span className="block texto-suave text-sm mt-2">{p.descripcion}</span>}
            </label>
          ))}
          <label className={`tarjeta p-5 cursor-pointer border-2 focus-within:outline focus-within:outline-2 focus-within:outline-[var(--acento)] ${plan === null ? "border-[var(--acento)]" : "border-transparent"}`} data-plan-despues>
            <input type="radio" value="" checked={plan === null} onChange={() => setPlan(null)} className="sr-only" />
            <span className="block titulo text-xl">Lo elijo en el gimnasio</span>
            <span className="block texto-suave text-sm mt-1">Creás tu cuenta ahora y el plan lo elegís cuando vengas.</span>
          </label>
        </div>
      </fieldset>}

      <fieldset id="paso-datos" className="grid gap-4 sm:grid-cols-2 scroll-mt-4">
        <legend className="titulo text-2xl mb-3">{n("datos")}. Tus datos</legend>
        <label className="block space-y-1"><span className="etiqueta">Nombre</span><input name="nombre" required maxLength={80} autoComplete="given-name" className="campo" defaultValue={v("nombre")} /></label>
        <label className="block space-y-1"><span className="etiqueta">Apellido</span><input name="apellido" required maxLength={80} autoComplete="family-name" className="campo" defaultValue={v("apellido")} /></label>
        <label className="block space-y-1 sm:col-span-2">
          <span className="etiqueta">DNI</span>
          <input name="dni" required inputMode="numeric" pattern="[0-9]{7,8}" minLength={7} maxLength={8} autoComplete="off" className="campo !text-2xl numero" placeholder="12345678" defaultValue={v("dni")} data-dni
            onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 8); }} {...invalido("dni")} />
          <span className="block text-lg font-semibold" data-aviso-dni>Anotalo bien: con este DNI vas a entrar al gimnasio todos los días.</span>
          <span className="block text-sm texto-tenue">Solo números, sin puntos.</span>
          <MensajeCampo c="dni" />
        </label>
        <label className="block space-y-1"><span className="etiqueta">Celular</span><input name="telefono" required type="tel" autoComplete="tel" placeholder="387 555 1234" className="campo" defaultValue={v("telefono")} /></label>
        <label className="block space-y-1">
          <span className="etiqueta">Fecha de nacimiento</span>
          <input name="fecha_nacimiento" type="date" required max={hoyLocal()} className="campo" value={nac} onChange={(e) => setNac(e.target.value)} {...invalido("fecha_nacimiento")} />
          <MensajeCampo c="fecha_nacimiento" />
        </label>
        {menor && (
          <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2 tarjeta p-4" data-adulto-responsable>
            <p className="sm:col-span-2 font-semibold">Tenés menos de 18: anotá a un adulto responsable. Es quien entra a la app con su mail y su contraseña.</p>
            <label className="block space-y-1"><span className="etiqueta">Nombre del adulto responsable</span><input name="responsable_nombre" required maxLength={120} autoComplete="off" className="campo" defaultValue={v("responsable_nombre")} /></label>
            <label className="block space-y-1"><span className="etiqueta">Celular del adulto responsable</span><input name="responsable_telefono" required type="tel" autoComplete="off" placeholder="387 555 1234" className="campo" defaultValue={v("responsable_telefono")} /></label>
          </div>
        )}
        <label className="block space-y-1">
          <span className="etiqueta">{menor ? "Mail del adulto responsable" : "Mail"}</span>
          <input name="email" type="email" required autoComplete="email" className="campo" defaultValue={v("email")} {...invalido("email")} />
          <MensajeCampo c="email" />
        </label>
        <label className="block space-y-1">
          <span className="etiqueta">Contraseña</span>
          <input name="contrasena" type="password" required minLength={8} autoComplete="new-password" className="campo" {...invalido("contrasena")} />
          <span className="block text-sm texto-tenue">8 letras o más. Con el mail y esta contraseña entrás a tu perfil.</span>
          <MensajeCampo c="contrasena" />
        </label>
      </fieldset>

      {conReglamento && (
        <fieldset id="paso-reglamento" className="space-y-3 scroll-mt-4">
          <legend className="titulo text-2xl mb-3">{n("reglamento")}. Reglamento</legend>
          <div className="tarjeta p-5 max-h-64 overflow-auto whitespace-pre-line texto-suave" data-reglamento>{datos.reglamento!.texto}</div>
          <input type="hidden" name="version" value={datos.reglamento!.version} />
          <label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" name="acepto" value="si" required defaultChecked={v("acepto") === "si"} className="mt-1 size-5" />
            <span>Leí y acepto el reglamento de {datos.marca.nombre}, y que use mis datos para anotarme y cobrarme (<a href="/privacidad" target="_blank" rel="noopener noreferrer" className="underline" data-politica-acepto>política de privacidad</a>).</span></label>
        </fieldset>
      )}

      {plan && <fieldset id="paso-pago" className="space-y-3 scroll-mt-4">
        <legend className="titulo text-2xl mb-3">{n("pago")}. Cómo pagás</legend>
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Cómo pagás">
          {datos.transferencia && (
            <label className={`tarjeta p-5 cursor-pointer border-2 focus-within:outline focus-within:outline-2 focus-within:outline-[var(--acento)] ${medio === "transferencia" ? "border-[var(--acento)]" : "border-transparent"}`}>
              <input type="radio" value="transferencia" checked={medio === "transferencia"} onChange={() => setMedio("transferencia")} className="sr-only" />
              <span className="block titulo text-xl"><Icono nombre="banco" /> Transferencia</span>
              <span className="block texto-suave text-sm mt-1">Te mostramos el alias y mandás el comprobante desde la app.</span>
            </label>
          )}
          <label className={`tarjeta p-5 cursor-pointer border-2 focus-within:outline focus-within:outline-2 focus-within:outline-[var(--acento)] ${medio === "mostrador" ? "border-[var(--acento)]" : "border-transparent"}`}>
            <input type="radio" value="mostrador" checked={medio === "mostrador"} onChange={() => setMedio("mostrador")} className="sr-only" />
            <span className="block titulo text-xl"><Icono nombre="campana" /> En el gimnasio</span>
            <span className="block texto-suave text-sm mt-1">Pagás en recepción cuando vengas.</span>
          </label>
        </div>
      </fieldset>}

      <CampoAntiRobot />
      <p className="texto-suave text-sm">Ley 25.326: tus datos los guarda {datos.marca.nombre}, solo para anotarte y cobrarte. Podés pedir verlos, corregirlos o borrarlos desde “Yo” en tu app, o en recepción. Leé la <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="underline" data-politica>política de privacidad</a>.</p>
      {r.error && !r.campo && <Mensaje tipo="error">{r.error}</Mensaje>}
      <button type="submit" disabled={enviando} className="boton boton-principal text-lg w-full sm:w-auto px-10" data-crear-cuenta-enviar>
        {enviando ? "Creando tu cuenta…" : <><Icono nombre="persona" /> Crear mi cuenta</>}
      </button>
    </form>
  );
}
