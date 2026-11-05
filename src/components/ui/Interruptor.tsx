"use client";
import type { InputHTMLAttributes, ReactNode } from "react";

/** Prender / apagar algo, con su nombre y una línea que explica qué cambia. */
export function Interruptor({ etiqueta, ayuda, ...props }: { etiqueta: ReactNode; ayuda?: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label className="flex items-start justify-between gap-4 py-2 cursor-pointer">
      <span className="min-w-0">
        <span className="font-semibold block">{etiqueta}</span>
        {ayuda && <span className="texto-suave text-sm block mt-0.5">{ayuda}</span>}
      </span>
      <input type="checkbox" role="switch" className="interruptor mt-0.5" {...props} />
    </label>
  );
}
