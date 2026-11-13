"use client";
// E4 · Lo pesado de la Entrada se baja solo cuando se usa: el alta rápida (con las tarjetas de plan), la prueba gratis,
// el formulario de "Dejar pasar" y el comprobante del cobro. La ventana y la barrita viajan con cada pantalla del panel;
// esto no. Las funciones `precargar*` bajan la pieza un instante antes de que haga falta (por ejemplo cuando aparece
// "No hay nadie con ese DNI"), así el toque no espera.
import dynamic from "next/dynamic";

const hueco = (alto: string) => function Hueco() { return <div className={`${alto} m-6 rounded-[var(--radio)] bg-[var(--tarjeta)] esqueleto`} aria-hidden />; };

export const AltaRapida = dynamic(() => import("./AltaRapida"), { loading: hueco("h-64") });
export const PruebaGratis = dynamic(() => import("./PruebaGratis"), { loading: hueco("h-48") });
export const FormDejarPasar = dynamic(() => import("../FormDejarPasar").then((m) => m.FormDejarPasar), { loading: hueco("h-24") });
export const ComprobanteCobro = dynamic(() => import("@/app/panel/vender/compartido").then((m) => m.MandarComprobante), { ssr: false });

export const precargarAlta = () => { void import("./AltaRapida"); };
export const precargarPrueba = () => { void import("./PruebaGratis"); };
export const precargarDejarPasar = () => { void import("../FormDejarPasar"); };
export { Camara } from "@/app/panel/entrada/CamaraDinamica";
