import { redirect } from "next/navigation";

// D41: puerta fija del super admin: /admin pide sesión y, si no hay, lleva al ingreso.
export function GET() {
  redirect("/admin");
}
