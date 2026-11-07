import Link from "next/link";
import { Aviso } from "@/components/panel/Marco";

export default function NoEncontrada() {
  return (
    <main className="min-h-screen p-6 flex items-center justify-center">
      <Aviso emoji="🔎" titulo="No encontramos esta página">
        <p>La dirección no existe o ya no está.</p>
        <div className="flex flex-wrap gap-2 mt-6">
          <Link href="/" className="boton boton-principal">🏠 Ir al inicio</Link>
        </div>
      </Aviso>
    </main>
  );
}
