import { redirect } from "next/navigation";

// D41: puerta fija del socio: el ingreso del socio con la marca del gimnasio; después va a /app.
export function GET() {
  redirect("/ingresar?modo=socio&rol=socio");
}
