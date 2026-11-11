// PLAT-04: el ÚNICO lugar donde se arma una dirección de la plataforma o de un gimnasio.
// Ninguna pantalla escribe a mano un host, "vercel.app", "/g/<slug>" ni un link de panel: pide la dirección acá.
// Se construye desde NEXT_PUBLIC_DOMINIO_BASE y NEXT_PUBLIC_DOMINIO_PLATAFORMA (lib/dominios) más el slug o el host del gimnasio,
// así el día que se conecte el dominio nuevo cambia una variable y no hay nada que buscar en el código.
import { dominioBase, dominioPlataforma, subdominiosFuncionan } from "@/lib/dominios";
import { normalizarHost } from "@/lib/host";

export type EntornoUrls = { base: string; plataforma: string };
export type RolPuerta = "dueno" | "recepcion" | "profe" | "socio";

const LOCAL = /^(localhost|127\.\d+\.\d+\.\d+)(:\d+)?$|\.localhost(:\d+)?$/;

/** http en la compu (localhost y *.localhost), https en todo lo demás. */
export const esquemaDe = (host: string) => (LOCAL.test(host) ? "http" : "https");

/** Una ruta siempre con una barra adelante y sin barras repetidas: "panel//x" → "/panel/x". */
export const ruta = (r = "/") => `/${String(r).replace(/^\/+/, "")}`.replace(/\/{2,}/g, "/");

/** El slug va en la dirección: solo letras, números y guiones (si trae otra cosa, se codifica, nunca se rompe el link). */
const slugSeguro = (slug: string) => encodeURIComponent(String(slug).trim().toLowerCase());

export function crearUrls(env: EntornoUrls) {
  const base = normalizarHost(env.base);
  const plataforma = normalizarHost(env.plataforma) || base;
  const conSubdominios = subdominiosFuncionan(base);
  const absoluta = (host: string, r: string) => `${esquemaDe(host)}://${host}${r === "/" ? "" : r}`;

  /** La dirección de la plataforma (login universal, super admin, página de venta). Sin dominio cargado, una ruta relativa. */
  function urlPlataforma(r = "/") {
    const rr = ruta(r);
    return plataforma ? absoluta(plataforma, rr) : rr;
  }
  /** Solo el host del gimnasio: "<slug>.<dominio>", o la plataforma si todavía no hay dominio con comodín. */
  function hostGimnasio(slug: string) {
    return conSubdominios ? `${slugSeguro(slug)}.${base}` : plataforma;
  }
  /** La web del gimnasio (o una ruta de ella). Con subdominios, en su host; si no, en la plataforma como /g/<slug>. */
  function urlGimnasio(slug: string, r = "/") {
    const rr = ruta(r);
    if (conSubdominios) return absoluta(hostGimnasio(slug), rr);
    const dentro = `/g/${slugSeguro(slug)}${rr === "/" ? "" : rr}`;
    return plataforma ? absoluta(plataforma, dentro) : dentro;
  }
  /** Una dirección en un host que ya se conoce (por ejemplo el dominio propio de un gimnasio, sacado de la tabla de dominios). */
  function urlDeHost(host: string, r = "/") {
    const h = normalizarHost(host);
    return h ? absoluta(h, ruta(r)) : ruta(r);
  }
  /** La ruta DENTRO de la plataforma que muestra la web de un gimnasio (para links relativos entre pantallas de la plataforma). */
  const rutaGimnasio = (slug: string, r = "/") => `/g/${slugSeguro(slug)}${ruta(r) === "/" ? "" : ruta(r)}`;
  /** La puerta de un rol (/dueno, /recepcion, /profe, /socio) de un gimnasio: lleva al login con su marca. Sin rol, el panel. */
  function urlPanel(slug: string, rol?: RolPuerta) {
    if (conSubdominios) return urlGimnasio(slug, rol ? `/${rol}` : "/panel");
    return urlPlataforma("/ingresar");
  }
  /** El ingreso: del gimnasio (con su marca) o, sin slug, el login universal de la plataforma. */
  function urlIngreso(opc: { slug?: string; modo?: "socio"; rol?: Exclude<RolPuerta, "socio"> } = {}) {
    const q = new URLSearchParams();
    if (opc.modo) q.set("modo", opc.modo);
    if (opc.rol) q.set("rol", opc.rol);
    const consulta = q.toString() ? `?${q}` : "";
    if (!opc.slug) return urlPlataforma(`/ingresar${consulta}`);
    return urlGimnasio(opc.slug, `/ingresar${consulta}`);
  }
  return { base, plataforma, conSubdominios, urlPlataforma, hostGimnasio, urlGimnasio, urlDeHost, rutaGimnasio, urlPanel, urlIngreso };
}

/** Con el entorno real (se lee en cada uso: las variables no cambian en caliente, pero así los tests pueden cambiarlas). */
const actual = () => crearUrls({ base: dominioBase(), plataforma: dominioPlataforma() });
export const urlPlataforma = (r?: string) => actual().urlPlataforma(r);
export const hostGimnasio = (slug: string) => actual().hostGimnasio(slug);
export const urlGimnasio = (slug: string, r?: string) => actual().urlGimnasio(slug, r);
export const urlDeHost = (host: string, r?: string) => actual().urlDeHost(host, r);
export const urlPanel = (slug: string, rol?: RolPuerta) => actual().urlPanel(slug, rol);
export const urlIngreso = (opc?: Parameters<ReturnType<typeof crearUrls>["urlIngreso"]>[0]) => actual().urlIngreso(opc);
export const rutaGimnasio = (slug: string, r?: string) => actual().rutaGimnasio(slug, r);
export const hayDominioConComodin = () => actual().conSubdominios;
