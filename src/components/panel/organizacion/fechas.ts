// Pase 2.0 · organización: "Hoy", "Ayer", "hace 3 días", "hace 2 meses" para la última vez que vino (en el día local del gimnasio). Sin dato, "—".
export function fechaHumanaCorta(iso: string | null | undefined, zona = "America/Argentina/Buenos_Aires", ahora = new Date()): string {
  if (!iso) return "—";
  const dia = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(d);
  const dias = Math.round((Date.parse(dia(ahora)) - Date.parse(dia(new Date(iso)))) / 86_400_000);
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "hace 1 mes" : `hace ${meses} meses`;
}
