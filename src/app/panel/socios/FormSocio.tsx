"use client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { guardarSocio, prospectoPorDni, prospectoPorTelefono, type EstadoForm, type PlanParaAlta, type ProspectoOfrecido } from "./acciones";
import { Mensaje } from "@/components/ui/Mensaje";
import { AvisoSalud } from "@/components/ui/AvisoSalud";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Tilde } from "@/components/ui/Tilde";
import { useVersion } from "@/components/panel/useVersion";
import { TarjetasPlan, PrimerPago } from "@/components/panel/TarjetasPlan";
import { abrirCobrar, hayHojaCobrar, EVENTO_COBRO_HECHO, type CobroHecho } from "@/components/panel/cobrar/evento";
import { MandarComprobante } from "@/app/panel/vender/compartido";
import { formatearPesos } from "@/lib/formato";
import { Icono } from "@/components/ui/Icono";
import { TEXTO_CAMBIOS_SIN_GUARDAR, useCambiosSinGuardar } from "@/components/ui/useCambiosSinGuardar";

export type PlanAlta = PlanParaAlta;

type Socio = Partial<Record<"nombre" | "apellido" | "dni" | "telefono" | "email" | "fecha_nacimiento" | "contacto_emergencia_nombre" | "contacto_emergencia_telefono" | "notas" | "responsable_nombre" | "responsable_telefono", string | null>>;

function Campo({ nombre, etiqueta, valor, tipo = "text", ayuda, ...resto }: { nombre: string; etiqueta: string; valor?: string | null; tipo?: string; ayuda?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block space-y-2">
      <span className="etiqueta">{etiqueta}</span>
      <input name={nombre} type={tipo} defaultValue={valor ?? ""} className="campo" {...resto} />
      {ayuda && <span className="block text-sm texto-tenue">{ayuda}</span>}
    </label>
  );
}

function esMenor(nacimiento: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nacimiento)) return false;
  const hoy = new Date(), [a, m, d] = nacimiento.split("-").map(Number);
  const cumple18 = new Date(a + 18, m - 1, d);
  return cumple18 > hoy;
}

type PagoPasado = { fecha: string; monto: string; medio: string };
const MEDIOS_PASADO = [["efectivo", "Efectivo"], ["transferencia", "Transferencia"], ["debito", "Débito"], ["credito", "Crédito"]] as const;
const diaAnterior = (iso: string) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

/** C10 · Cargar en el pasado: fecha de alta y pagos de antes. Solo dueño y encargado (la base lo exige). Los pagos no entran en la caja de hoy. */
function CargaPasada({ hoy, plan, abierto, alAbrir }: { hoy: string; plan: string; abierto: boolean; alAbrir: (v: boolean) => void }) {
  const [fechaAlta, setFechaAlta] = useState("");
  const [pagos, setPagos] = useState<PagoPasado[]>([{ fecha: "", monto: "", medio: "efectivo" }]);
  const ayer = diaAnterior(hoy);
  const cambiar = (i: number, campo: keyof PagoPasado, valor: string) => setPagos((p) => p.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));
  // Solo se mandan los pagos con algo escrito: la base dice en palabras qué le falta a uno incompleto.
  const enviados = pagos.filter((p) => p.fecha || p.monto);
  return (
    <fieldset className="space-y-3" data-carga-pasada>
      <legend className="titulo text-2xl mb-2"><Icono nombre="calendario" /> Alta en el pasado</legend>
      {!abierto ? (
        <>
          <p className="texto-suave text-sm">¿Se anotó y pagó hace días o meses? Cargá su fecha de alta y sus pagos de antes: la cobertura y la deuda salen como si los hubieras cobrado ese día.</p>
          <button type="button" className="boton" data-pasado-abrir onClick={() => alAbrir(true)}><Icono nombre="mas" /> Cargar fecha de alta y pagos de antes</button>
        </>
      ) : (
        <div className="space-y-4">
          <input type="hidden" name="pasado" value="1" />
          <input type="hidden" name="fecha_alta" value={fechaAlta} />
          <input type="hidden" name="pagos_pasados" value={JSON.stringify(enviados)} />
          {!plan && <Mensaje tipo="aviso">Elegí el plan arriba: los pagos son de su membresía.</Mensaje>}
          <label className="block space-y-2 sm:max-w-xs">
            <span className="etiqueta">Fecha de alta</span>
            <input type="date" className="campo" max={hoy} value={fechaAlta} onChange={(e) => setFechaAlta(e.target.value)} data-pasado-alta />
            <span className="block text-sm texto-tenue">Vacía: queda la fecha de su primer pago.</span>
          </label>
          <p className="etiqueta">Pagos de antes</p>
          <ul className="space-y-3">
            {pagos.map((p, i) => (
              <li key={i} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] items-end" data-pasado-pago={i}>
                <label className="block space-y-1"><span className="etiqueta">Fecha</span>
                  <input type="date" className="campo" max={ayer} value={p.fecha} onChange={(e) => cambiar(i, "fecha", e.target.value)} data-pasado-fecha /></label>
                <label className="block space-y-1"><span className="etiqueta">Monto</span>
                  <input className="campo" inputMode="decimal" placeholder="25000" value={p.monto} onChange={(e) => cambiar(i, "monto", e.target.value)} data-pasado-monto /></label>
                <label className="block space-y-1"><span className="etiqueta">Medio</span>
                  <select className="campo" value={p.medio} onChange={(e) => cambiar(i, "medio", e.target.value)} data-pasado-medio>
                    {MEDIOS_PASADO.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select></label>
                {pagos.length > 1 && <button type="button" className="boton" aria-label="Sacar este pago" onClick={() => setPagos((x) => x.filter((_, j) => j !== i))}><Icono nombre="cerrar" /></button>}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {pagos.length < 24 && <button type="button" className="boton" data-pasado-otro onClick={() => setPagos((x) => [...x, { fecha: "", monto: "", medio: "efectivo" }])}><Icono nombre="mas" /> Otro pago</button>}
            <button type="button" className="boton" onClick={() => alAbrir(false)}>Sacar la carga en el pasado</button>
          </div>
          <p className="text-sm texto-tenue">Las fechas tienen que ser de días que ya pasaron (un pago de hoy se cobra desde Cobrar). Estos pagos no entran en la caja de hoy: cuentan en el mes de su fecha y quedan marcados en Control como cargados por vos, con la fecha de hoy.</p>
        </div>
      )}
    </fieldset>
  );
}

type Props = {
  socioId: string | null; socio?: Socio; prospectoId?: string; planes?: PlanAlta[]; puedeCobrar?: boolean;
  /** C10: dueño o encargado pueden cargar un alta en el pasado; `hoy` es el día de hoy del gimnasio (AAAA-MM-DD). */
  puedePasado?: boolean; hoy?: string;
  /** VD-6: el alta ya está hecha (vuelve de un Interesado): arranca en el cobro. */
  creado?: { socioId: string; nombre: string; cobrar: boolean };
};

/** VD-6 · Los 4 pasos del alta: datos, plan, cobro, listo. */
function Pasos({ actual }: { actual: number }) {
  const nombres = ["Datos", "Plan", "Cobro", "Listo"];
  return (
    <ol className="flex gap-2 text-sm" data-pasos-alta={actual} aria-label="Pasos del alta">
      {nombres.map((n, i) => (
        <li key={n} aria-current={i + 1 === actual ? "step" : undefined}
          className={`flex-1 min-w-0 rounded-full px-3 py-1.5 text-center truncate border ${i + 1 === actual ? "border-[var(--acento)] font-semibold" : i + 1 < actual ? "texto-suave border-[var(--borde)]" : "texto-tenue border-[var(--borde)]"}`}>
          {i + 1 < actual ? <><Icono nombre="ok" /> </> : `${i + 1} · `}{n}
        </li>
      ))}
    </ol>
  );
}

export function FormSocio(props: Props) {
  // "Dar de alta a otro": cambia la clave y el formulario vuelve a empezar limpio.
  const [vuelta, setVuelta] = useState(0);
  return <FormInterno key={vuelta} {...props} otro={() => setVuelta((n) => n + 1)} />;
}

function FormInterno({ socioId, socio, prospectoId, planes = [], puedeCobrar = false, puedePasado = false, hoy = "", creado: creadoInicial, otro }: Props & { otro: () => void }) {
  const [plan, setPlan] = useState("");
  const [pasadoAbierto, setPasadoAbierto] = useState(false);
  const router = useRouter();
  const [estado, accion, guardando] = useActionState<EstadoForm, FormData>(guardarSocio.bind(null, socioId), {});
  const [versionAbierta] = useVersion("socios", socioId);
  // VD-6: el socio ya está creado (pasos 3 y 4), lo cobrado, y el Interesado con ese celular si lo hay.
  const [creado, setCreado] = useState<{ socioId: string; nombre: string } | null>(creadoInicial ?? null);
  const [cobro, setCobro] = useState<CobroHecho | null>(null);
  const [linkSocio, setLinkSocio] = useState<{ link: string; texto: string; wa: string | null; conContrasena?: boolean } | null>(null);
  const [avisoLink, setAvisoLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [despues, setDespues] = useState(false);
  const [ofrecido, setOfrecido] = useState<ProspectoOfrecido | null>(null);
  const [vinculado, setVinculado] = useState<string | null>(null);
  // FLUIDEZ regla 7: lo escrito no se pierde sin avisar (cerrar, recargar, tocar el menú o Cancelar).
  const [tocado, setTocado] = useState(false);
  useCambiosSinGuardar(tocado && !guardando && !estado.destino && !creado);
  const planElegido = planes.find((p) => p.plan_id === plan) ?? null;
  useEffect(() => {
    if (!estado.destino) return;
    // F1.2: con link de contraseña (o un aviso de que no se pudo armar) se queda en el "listo" para mostrarlo.
    if (!socioId && estado.socioId && (estado.linkContrasena || estado.avisoLink)) {
      setCreado({ socioId: estado.socioId, nombre: estado.nombre ?? "" });
      setLinkSocio(estado.linkContrasena ?? null); setAvisoLink(estado.avisoLink ?? null);
      if (estado.cobrar && hayHojaCobrar()) abrirCobrar({ socioId: estado.socioId, origen: "otro" });
      else setDespues(true);
      return;
    }
    // VD-5b: con cobro, la hoja Cobrar se abre acá mismo; si no está montada, se va a Vender como antes.
    if (!socioId && estado.cobrar && estado.socioId && hayHojaCobrar()) {
      setCreado({ socioId: estado.socioId, nombre: estado.nombre ?? "" });
      abrirCobrar({ socioId: estado.socioId, origen: "otro" });
      return;
    }
    router.push(estado.destino);
  }, [estado.destino, estado.cobrar, estado.socioId, estado.nombre, estado.linkContrasena, estado.avisoLink, socioId, router]);
  // Viene de un Interesado con el alta hecha: la hoja de cobro se abre sola.
  useEffect(() => {
    if (creadoInicial?.cobrar && hayHojaCobrar()) abrirCobrar({ socioId: creadoInicial.socioId, origen: "otro" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const creadoId = creado?.socioId;
  useEffect(() => {
    if (!creadoId) return;
    const hecho = (e: Event) => { const c = (e as CustomEvent<CobroHecho>).detail; if (c.socioId === creadoId) setCobro(c); };
    window.addEventListener(EVENTO_COBRO_HECHO, hecho);
    return () => window.removeEventListener(EVENTO_COBRO_HECHO, hecho);
  }, [creadoId]);
  const paso = creado ? (cobro || despues ? 4 : 3) : plan ? 2 : 1;
  const buscarInteresado = async (celular: string) => {
    if (socioId || prospectoId) return;
    const r = await prospectoPorTelefono(celular);
    setOfrecido(r.prospecto ?? null);
    if (!r.prospecto) setVinculado(null);
  };
  // VD-6b: el Interesado también se ofrece por DNI.
  const buscarInteresadoDni = async (dni: string) => {
    if (socioId || prospectoId) return;
    const r = await prospectoPorDni(dni);
    if (r.prospecto) setOfrecido(r.prospecto);
  };
  // Menor de 18 (D10): aparece el adulto responsable. La base lo exige igual.
  const [nacimiento, setNacimiento] = useState(socio?.fecha_nacimiento ?? "");
  const [textoNotas, setTextoNotas] = useState(socio?.notas ?? "");   // VD-46H
  const menor = esMenor(nacimiento);
  // Con error, React vacía el form al volver la acción: se vuelve a dibujar con lo que se había escrito.
  const v: Socio = { ...socio, ...estado.valores };

  // Pasos 3 y 4 del alta: el cobro (la hoja Cobrar) y el "listo" con la bienvenida.
  if (creado) {
    const nombreSocio = creado.nombre || "el socio";
    return (
      <div className="max-w-2xl space-y-6" data-alta-creado={creado.socioId}>
        <Pasos actual={paso} />
        {paso === 3 ? (
          <div className="tarjeta p-6 space-y-4" data-alta-paso="cobro">
            <p className="titulo text-2xl"><Icono nombre="plata" /> Cobrá el primer pago</p>
            <p className="texto-suave">{nombreSocio} ya está dado de alta. Falta cobrar su primera cuota para que pueda entrar.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="boton boton-principal text-lg px-8" data-alta-cobrar onClick={() => abrirCobrar({ socioId: creado.socioId, origen: "otro" })}><Icono nombre="plata" /> Cobrar</button>
              <button type="button" className="boton" data-alta-despues onClick={() => setDespues(true)}>Cobrar después</button>
            </div>
          </div>
        ) : (
          <div className="tarjeta p-6 space-y-4 aparecer" data-alta-paso="listo">
            <div className="flex items-center gap-3"><Tilde tamano={48} /><p className="titulo text-2xl">¡Listo! {nombreSocio} ya es socio</p></div>
            {cobro
              ? <Mensaje tipo="exito"><span data-alta-cobrado={cobro.total}>Cobrado {formatearPesos(cobro.total)}.</span> <MandarComprobante ventaId={cobro.ventaId} className="mt-2" /></Mensaje>
              : <Mensaje tipo="info">Todavía no se cobró nada: se cobra desde su ficha o cuando venga.</Mensaje>}
            <p className="texto-suave">Dale la bienvenida: ya puede entrar con su DNI.</p>
            {avisoLink && <Mensaje tipo="aviso">{avisoLink}</Mensaje>}
            {linkSocio?.conContrasena && <Mensaje tipo="exito"><span data-socio-con-contrasena>Ya puede entrar a su app con su mail y la contraseña que escribiste. No se le mandó ningún mail.</span></Mensaje>}
            {linkSocio && !linkSocio.conContrasena && (
              <div className="space-y-2" data-link-contrasena>
                <p className="font-semibold">Que cree su contraseña</p>
                <p className="texto-suave text-sm">Mandale este link: elige su contraseña y entra a su app con mail y contraseña.</p>
                <input className="campo font-mono text-sm" readOnly value={linkSocio.link} onFocus={(e) => e.currentTarget.select()} aria-label="Link para crear la contraseña" />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="boton" data-copiar-link onClick={async () => { try { await navigator.clipboard.writeText(linkSocio.texto); setCopiado(true); } catch { setCopiado(false); } }}>{copiado ? "Copiado" : "Copiar mensaje"}</button>
                  {linkSocio.wa && <a className="boton" href={linkSocio.wa} target="_blank" rel="noopener noreferrer" data-wa-link>Mandar por WhatsApp</a>}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Link href={`/panel/socios/${creado.socioId}`} className="boton boton-principal" data-alta-ficha><Icono nombre="persona" /> Ver su ficha</Link>
              <button type="button" className="boton" data-alta-otro onClick={otro}><Icono nombre="mas" /> Dar de alta a otro</button>
              <Link href="/panel/socios" className="boton">Socios</Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <form action={accion} onInput={() => setTocado(true)} className="max-w-2xl space-y-8">
      {!socioId && <Pasos actual={paso} />}
      {socioId && <input type="hidden" name="version" value={estado.version ?? versionAbierta ?? ""} />}
      {(prospectoId || vinculado) && <input type="hidden" name="prospecto" value={prospectoId ?? vinculado ?? ""} />}
      {prospectoId && <Mensaje tipo="info">Viene de Prospectos: al darlo de alta queda marcado como “se hizo socio”.</Mensaje>}
      <fieldset className="grid sm:grid-cols-2 gap-4">
        <legend className="titulo text-2xl mb-4"><Icono nombre="persona" /> Datos</legend>
        <Campo nombre="nombre" etiqueta="Nombre" valor={v.nombre} required autoFocus autoComplete="off" />
        <Campo nombre="apellido" etiqueta="Apellido" valor={v.apellido} autoComplete="off" />
        <Campo nombre="dni" etiqueta="DNI" valor={v.dni} inputMode="numeric" ayuda="Solo números, sin puntos" onBlur={(e) => void buscarInteresadoDni(e.target.value)} />
        <Campo nombre="fecha_nacimiento" etiqueta="Fecha de nacimiento" valor={v.fecha_nacimiento} tipo="date" onChange={(e) => setNacimiento(e.target.value)} />
      </fieldset>
      {(menor || socio?.responsable_nombre) && (
        <fieldset className="grid sm:grid-cols-2 gap-4" data-responsable>
          <legend className="titulo text-2xl mb-1"><Icono nombre="usuarios" /> Adulto responsable</legend>
          <p className="sm:col-span-2 texto-suave -mt-1 mb-2">{menor ? "Es menor de 18: se carga con un adulto responsable. Es quien entra a la app y a quien se le avisa." : "Ya es mayor de edad: podés dejarlo o borrarlo."}</p>
          <Campo nombre="responsable_nombre" etiqueta="Nombre del responsable" valor={v.responsable_nombre} required={menor} autoComplete="off" />
          <Campo nombre="responsable_telefono" etiqueta="Celular del responsable" valor={v.responsable_telefono} tipo="tel" required={menor} placeholder="387 555-1234" />
        </fieldset>
      )}
      <fieldset className="grid sm:grid-cols-2 gap-4">
        <legend className="titulo text-2xl mb-4"><Icono nombre="celular" /> Contacto</legend>
        <Campo nombre="telefono" etiqueta="WhatsApp" valor={v.telefono} tipo="tel" placeholder="387 555-1234" ayuda="Para avisarle cuándo vence" onBlur={(e) => void buscarInteresado(e.target.value)} />
        {ofrecido && !vinculado && (
          <div className="sm:col-span-2" data-interesado-ofrecido={ofrecido.id}>
            <Mensaje tipo="info">
              ¿Es {ofrecido.nombre}, que preguntó el {new Date(ofrecido.creado_en).toLocaleDateString("es-AR", { day: "numeric", month: "numeric" })}?{" "}
              <button type="button" className="boton mt-2" onClick={() => setVinculado(ofrecido.id)}>Sí, es esa persona</button>
            </Mensaje>
          </div>
        )}
        {vinculado && <div className="sm:col-span-2"><Mensaje tipo="info">Es {ofrecido?.nombre}: al darlo de alta queda marcado como “se hizo socio”.</Mensaje></div>}
        <Campo nombre="email" etiqueta="Mail" valor={v.email} tipo="email" />
        {!socioId && <Campo nombre="contrasena_elegida" etiqueta="Contraseña para su app (opcional)" autoComplete="new-password" data-contrasena-socio
          ayuda="Si la escribís (8 letras o más), entra a su app con su mail y esa contraseña, al toque: no se le manda ningún mail. Vacía: le pasás un link para que cree la suya." />}
        <Campo nombre="contacto_emergencia_nombre" etiqueta="Contacto de emergencia" valor={v.contacto_emergencia_nombre} placeholder="Nombre" />
        <Campo nombre="contacto_emergencia_telefono" etiqueta="Teléfono de emergencia" valor={v.contacto_emergencia_telefono} tipo="tel" />
      </fieldset>
      <label className="block space-y-2">
        <span className="etiqueta">Notas</span>
        <textarea name="notas" defaultValue={v.notas ?? ""} onChange={(e) => setTextoNotas(e.target.value)} className="campo" placeholder="Horario que prefiere, objetivo…" />
        <AvisoSalud texto={textoNotas} />
        <span className="block text-sm texto-tenue"><Icono nombre="corazon" /> No anotes datos de salud (lesiones, enfermedades): el sistema no los guarda.</span>
      </label>
      {!socioId && planes.length > 0 && (
        <fieldset className="space-y-2" data-plan-alta>
          <legend className="titulo text-2xl mb-2"><Icono nombre="etiqueta" /> Plan</legend>
          <input type="hidden" name="plan_id" value={plan} />
          <TarjetasPlan planes={planes} valor={plan} alElegir={setPlan} />
          {planElegido ? <PrimerPago plan={planElegido} /> : <p className="texto-tenue text-sm">Sin plan por ahora (viene con pase o pack). Tocá un plan para elegirlo; tocalo de nuevo para sacarlo.</p>}
        </fieldset>
      )}
      {!socioId && puedePasado && hoy && planes.length > 0 && <CargaPasada hoy={hoy} plan={plan} abierto={pasadoAbierto} alAbrir={setPasadoAbierto} />}
      {estado.error && <Mensaje tipo="error">{estado.error}</Mensaje>}
      <div className="flex flex-wrap gap-2">
        {!socioId && plan && puedeCobrar && !pasadoAbierto
          ? <>
              <BotonAccion name="despues" value="cobrar" disabled={guardando || !!estado.destino} className="boton boton-principal text-lg px-8">{guardando ? "Guardando…" : "Dar de alta y cobrar"}</BotonAccion>
              <BotonAccion disabled={guardando || !!estado.destino} className="boton">Solo dar de alta</BotonAccion>
            </>
          : <BotonAccion disabled={guardando || !!estado.destino} className="boton boton-principal text-lg px-8">{guardando ? "Guardando…" : socioId ? "Guardar cambios" : "Dar de alta"}</BotonAccion>}
        <button type="button" onClick={() => { if (!tocado || creado || window.confirm(TEXTO_CAMBIOS_SIN_GUARDAR)) router.back(); }} className="boton">Cancelar</button>
      </div>
    </form>
  );
}
