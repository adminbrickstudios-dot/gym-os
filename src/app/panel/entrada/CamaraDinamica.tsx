"use client";
import dynamic from "next/dynamic";

/** El lector de QR (jsQR + cámara) se baja recién cuando se abre (VD-47), no con la pantalla. */
export const Camara = dynamic(() => import("./Camara").then((m) => m.Camara), { ssr: false });
