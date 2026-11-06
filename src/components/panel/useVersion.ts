"use client";
import { useEffect, useState } from "react";
import { versionRegistro } from "@/app/panel/version-acciones";
import type { TablaVersion } from "@/lib/panel/version";

/**
 * La versión del registro al abrir el formulario (VD-34). Con `id` null (formulario cerrado) no hay versión.
 * `setVersion` la actualiza tras un aviso de que otro la cambió.
 */
export function useVersion(tabla: TablaVersion, id: string | null) {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    if (!id) { setVersion(null); return; }
    versionRegistro(tabla, id).then((v) => { if (vivo) setVersion(v); }).catch(() => {});
    return () => { vivo = false; };
  }, [tabla, id]);
  return [version, setVersion] as const;
}
