// Vuelta final (Mateo, 22/11) · la página de venta nueva de Pase (pasegym.com), ARMADA PERO SIN PUBLICAR: la ve el público solo con la
// llave de plataforma `landing_venta_nueva` (apagada); el super admin la mira en /admin/vista-landing. Para el dueño de un gimnasio de barrio.
// Solo lo que Pase YA hace: nada de débito automático, factura ARCA, Wellhub ni importar desde otro sistema (anotado en PASE-1.0.md).
// Precios: de la tabla de planes de Pase (super admin); sin planes cargados, la sección no se muestra. El WhatsApp sale de los datos.
import Image from "next/image";
import { formatearPesos } from "@/lib/formato";
import { Icono } from "@/components/ui/Icono";
import { NOMBRE_PRODUCTO } from "@/lib/producto";
import { Barra, Cronometro, Kettlebell, LineaPista, Mancuerna } from "@/components/ilustraciones/Gimnasio";
import { FormDemo } from "./FormDemo";
import { IlustracionCobro, IlustracionEntrada, IlustracionRetencion, PREGUNTAS, type CapturaGymOS } from "./Plataforma";

export type PlanPase = { nombre: string; precio_mensual: number | string; max_socios?: number | null; max_sedes?: number | null; descripcion?: string | null; modulos?: string[] | null };

/** Lo que dice cada plan además del precio, en palabras (nunca un límite inventado: solo lo que cargó el super admin). */
export function limitesPlan(p: PlanPase): string[] {
  const l: string[] = [];
  if (p.max_socios) l.push(`Hasta ${new Intl.NumberFormat("es-AR").format(p.max_socios)} socios`);
  if (p.max_sedes) l.push(p.max_sedes === 1 ? "Una sede" : `Hasta ${p.max_sedes} sedes`);
  return l;
}

/** Un celular: la captura real si la hay; si no, el dibujo de la pantalla. */
function Celular({ children, etiqueta }: { children: React.ReactNode; etiqueta: string }) {
  return (
    <figure className="mx-auto w-full max-w-[19rem]" data-marco="celular">
      <div className="rounded-[2.25rem] border-[10px] border-[var(--texto)] bg-[var(--fondo)] p-2 pt-6 relative">
        <span aria-hidden className="absolute top-2 left-1/2 -translate-x-1/2 h-1.5 w-16 rounded-full bg-[var(--borde)]" />
        {children}
      </div>
      <figcaption className="mt-3 text-center texto-suave">{etiqueta}</figcaption>
    </figure>
  );
}

/** Una compu: la pantalla con su base. */
function Compu({ children, etiqueta }: { children: React.ReactNode; etiqueta: string }) {
  return (
    <figure className="mx-auto w-full max-w-xl" data-marco="compu">
      <div className="rounded-t-[1.25rem] border-[10px] border-b-0 border-[var(--texto)] bg-[var(--fondo)] p-3">{children}</div>
      <div aria-hidden className="h-4 rounded-b-xl bg-[var(--texto)] mx-[-1.5rem]" />
      <figcaption className="mt-3 text-center texto-suave">{etiqueta}</figcaption>
    </figure>
  );
}

function Pantalla({ captura, children }: { captura?: CapturaGymOS; children: React.ReactNode }) {
  if (!captura) return <>{children}</>;
  return <Image src={captura.archivo} alt={captura.alt} width={captura.ancho} height={captura.alto} sizes="(min-width: 768px) 560px, 90vw" loading="lazy" quality={72} className="w-full h-auto rounded-xl" />;
}

const TERMINOS = [
  "Pase es un servicio de BRIK para administrar gimnasios: socios, entradas, cobros, clases y la página del gimnasio. Se paga con un abono mensual por gimnasio, según el plan elegido.",
  "El gimnasio es dueño de sus datos y de los de sus socios. BRIK los guarda y los procesa solo para dar el servicio, y el gimnasio los puede exportar cuando quiera.",
  "El gimnasio decide quién de su equipo entra y con qué permisos, y es responsable de lo que se carga con sus cuentas.",
  "Si el abono vence, el panel queda en solo lectura hasta que se pague: la puerta y la app de los socios siguen andando.",
  "Cualquiera de las partes puede terminar el servicio avisando con 30 días. Al terminar, el gimnasio recibe la exportación de sus datos y BRIK los borra de sus copias en un plazo razonable.",
];
const PRIVACIDAD = [
  "Datos que guardamos del gimnasio y su equipo: nombre, mail, teléfono y lo que hacen en el sistema (para seguridad y para ayudar si algo falla).",
  "Datos de los socios: los que carga el gimnasio (nombre, DNI, contacto, pagos, entradas y clases). No guardamos datos de salud: solo asistencia y los pesos que el socio anota.",
  "No vendemos datos ni los compartimos, salvo con los servicios que hacen falta para operar (la base de datos, el hosting y, si el gimnasio lo usa, Mercado Pago).",
  "Cada gimnasio ve solo lo suyo: la separación la hace la base de datos.",
  "Cualquier persona puede pedir ver, corregir o borrar sus datos (Ley 25.326 de Protección de los Datos Personales), al gimnasio o a BRIK por WhatsApp. La Agencia de Acceso a la Información Pública es el órgano de control.",
];

export function PlataformaNueva({ planes, linkWhatsapp = null, capturas = [], vistaPrevia = false }: {
  planes: PlanPase[]; linkWhatsapp?: string | null; capturas?: CapturaGymOS[]; vistaPrevia?: boolean;
}) {
  const cap = (clave: string) => capturas.find((c) => c.archivo.includes(clave));
  // El botón principal: WhatsApp de BRIK (de los datos). Sin número cargado, el formulario de la demo de abajo.
  const hablemos = linkWhatsapp
    ? { href: linkWhatsapp, externo: true }
    : { href: "#demo", externo: false };
  return (
    <main className="overflow-x-clip" data-plataforma data-plataforma-nueva>
      {vistaPrevia && (
        <p className="bg-[var(--amarillo)] text-[#121A22] text-center font-semibold px-4 py-2" data-vista-previa>
          Vista previa: el público todavía ve la página de siempre.
        </p>
      )}
      <header className="mx-auto max-w-5xl px-5 pt-5 flex items-center justify-between gap-3">
        <span className="titulo text-2xl"><Icono nombre="pesa" /> {NOMBRE_PRODUCTO}</span>
        <a href="/ingresar" className="boton boton-chico" data-ingresar><Icono nombre="llave" /> Ingresar</a>
      </header>

      {/* Lo primero que lee el dueño: la pregunta y la respuesta, en un segundo. */}
      <section className="relative isolate mx-auto max-w-5xl px-5 pt-12 pb-20 grid gap-12 md:grid-cols-[1.15fr_1fr] md:items-center">
        <LineaPista className="absolute inset-x-0 bottom-0 -z-10 h-48 w-full texto-tenue opacity-50" />
        <div>
          <h1 className="titular text-[clamp(2.75rem,10vw,5.75rem)] leading-[0.92] max-w-[14ch]">¿Este socio puede entrar hoy?</h1>
          <p className="text-xl sm:text-2xl mt-6 max-w-[32ch] texto-suave">
            La recepción tipea el DNI y {NOMBRE_PRODUCTO} contesta en un segundo: verde, amarillo o rojo, y por qué.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-9">
            <a href={hablemos.href} className="boton boton-principal text-xl px-9 !min-h-16" data-hablemos
              {...(hablemos.externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
              <Icono nombre="mensaje" /> Hablemos por WhatsApp
            </a>
            <a href="#como-se-ve" className="boton text-lg px-8 !min-h-16">Ver cómo se ve</a>
          </div>
        </div>
        <Celular etiqueta="La entrada, en la recepción">
          <Pantalla captura={cap("entrada")}><IlustracionEntrada /></Pantalla>
        </Celular>
      </section>

      <section id="como-se-ve" aria-labelledby="como-se-ve-t" className="mx-auto max-w-5xl px-5 py-16 space-y-20 scroll-mt-6">
        <h2 id="como-se-ve-t" className="sr-only">Cómo se ve</h2>
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <Barra className="w-44 texto-suave mb-6" />
            <h3 className="titular text-[clamp(2rem,6vw,3rem)] leading-none">La recepción, en un toque</h3>
            <p className="texto-suave text-lg mt-4 max-w-[40ch]">Entrada, cobro y caja en la misma pantalla. Cuota, producto o pase diario: elegís el medio de pago y la caja del día queda con lo que se cobró.</p>
          </div>
          <Compu etiqueta="Cobrar en el mostrador"><Pantalla captura={cap("recepcion")}><IlustracionCobro /></Pantalla></Compu>
        </div>
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div className="md:order-2">
            <Kettlebell className="w-16 texto-suave mb-6" />
            <h3 className="titular text-[clamp(2rem,6vw,3rem)] leading-none">La app del socio, sin instalar nada</h3>
            <p className="texto-suave text-lg mt-4 max-w-[40ch]">Cada socio entra con su teléfono y ve su cuota, sus clases, su QR para la puerta y la rutina que le armó el profe. Con la marca de tu gimnasio.</p>
          </div>
          <div className="md:order-1"><Celular etiqueta="La app del socio"><Pantalla captura={cap("app")}><IlustracionEntrada /></Pantalla></Celular></div>
        </div>
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <Cronometro className="w-14 texto-suave mb-6" />
            <h3 className="titular text-[clamp(2rem,6vw,3rem)] leading-none">Estos se te van</h3>
            <p className="texto-suave text-lg mt-4 max-w-[40ch]">La lista de los socios que dejaron de venir o están por vencer, para escribirles por WhatsApp antes de perderlos.</p>
          </div>
          <Compu etiqueta="Retención"><Pantalla captura={cap("retencion")}><IlustracionRetencion /></Pantalla></Compu>
        </div>
      </section>

      {planes.length > 0 && (
        <section aria-labelledby="precios" className="mx-auto max-w-5xl px-5 py-16" data-planes-brik>
          <div className="flex items-end justify-between gap-6 mb-8">
            <h2 id="precios" className="titular text-[clamp(2.25rem,8vw,3.5rem)] leading-none">Precios</h2>
            <Mancuerna className="hidden sm:block w-28 texto-tenue" />
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {planes.map((p) => (
              <li key={p.nombre} className="tarjeta p-6 flex flex-col" data-plan-brik>
                <p className="titulo text-2xl break-words">{p.nombre}</p>
                {p.descripcion && <p className="texto-suave mt-1">{p.descripcion}</p>}
                <p className="mt-5"><span className="numero text-5xl">{formatearPesos(Number(p.precio_mensual))}</span> <span className="texto-suave">por mes</span></p>
                {limitesPlan(p).length > 0 && <ul className="mt-4 flex flex-wrap gap-2">{limitesPlan(p).map((l) => <li key={l} className="pildora">{l}</li>)}</ul>}
                {(p.modulos ?? []).length > 0 && (
                  <ul className="mt-5 space-y-1.5" aria-label={`Qué incluye ${p.nombre}`}>
                    {(p.modulos ?? []).map((m) => <li key={m} className="flex gap-2"><span className="text-[var(--acento)]" aria-hidden><Icono nombre="ok" /></span>{m}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="preguntas" className="mx-auto max-w-3xl px-5 py-16">
        <h2 id="preguntas" className="titular text-[clamp(2.25rem,8vw,3.5rem)] leading-none mb-8">Preguntas</h2>
        <div className="space-y-2">
          {PREGUNTAS.map(([p, r]) => (
            <details key={p} className="tarjeta p-4">
              <summary className="cursor-pointer font-semibold min-h-[44px] flex items-center">{p}</summary>
              <p className="texto-suave mt-2">{r}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="demo" aria-labelledby="demo-t" className="mx-auto max-w-3xl px-5 py-16 space-y-5 scroll-mt-6">
        <h2 id="demo-t" className="titular text-[clamp(2.25rem,8vw,3.5rem)] leading-none">Te lo mostramos</h2>
        <p className="texto-suave text-lg">Dejanos tus datos y te mostramos {NOMBRE_PRODUCTO} funcionando con un gimnasio de ejemplo.</p>
        <FormDemo />
        {linkWhatsapp && <a href={linkWhatsapp} target="_blank" rel="noopener noreferrer" className="boton boton-principal text-lg px-8"><Icono nombre="mensaje" /> Hablemos por WhatsApp</a>}
      </section>

      <section aria-labelledby="legal" className="mx-auto max-w-3xl px-5 py-12" data-legal-borrador>
        <h2 id="legal" className="titulo text-2xl">Términos y privacidad</h2>
        <p className="texto-tenue text-sm mt-1">Borrador para revisar: todavía no es el texto final.</p>
        <details className="tarjeta p-4 mt-4" data-terminos>
          <summary className="cursor-pointer font-semibold min-h-[44px] flex items-center">Términos del servicio (borrador)</summary>
          <ul className="texto-suave mt-2 space-y-2 list-disc pl-5">{TERMINOS.map((t) => <li key={t}>{t}</li>)}</ul>
        </details>
        <details className="tarjeta p-4 mt-2" data-privacidad>
          <summary className="cursor-pointer font-semibold min-h-[44px] flex items-center">Política de privacidad (borrador, Ley 25.326)</summary>
          <ul className="texto-suave mt-2 space-y-2 list-disc pl-5">{PRIVACIDAD.map((t) => <li key={t}>{t}</li>)}</ul>
        </details>
      </section>

      <footer className="mx-auto max-w-5xl px-5 py-12 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--borde)]">
        <p className="texto-tenue">{NOMBRE_PRODUCTO}, una línea de BRIK</p>
        <a href="/ingresar" className="boton"><Icono nombre="llave" /> Ingresar</a>
      </footer>
    </main>
  );
}
