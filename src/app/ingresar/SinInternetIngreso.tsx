"use client";
import { useEffect, useState } from "react";
import { Mensaje } from "@/components/ui/Mensaje";

/** VD-61 · Sin internet: la pantalla de ingreso lo dice en cuanto se corta (y se va sola al volver), en vez de quedarse esperando. */
export function SinInternetIngreso() {
  const [sin, setSin] = useState(false);
  useEffect(() => {
    const actualizar = () => setSin(!navigator.onLine);
    actualizar();
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);
    return () => { window.removeEventListener("online", actualizar); window.removeEventListener("offline", actualizar); };
  }, []);
  if (!sin) return null;
  return (
    <div className="mb-4" data-sin-internet>
      <Mensaje tipo="error"><strong>Sin internet.</strong> Para entrar necesitás conexión: revisá el wifi o los datos y probá de nuevo. Apenas vuelva, esto se arregla solo.</Mensaje>
    </div>
  );
}
