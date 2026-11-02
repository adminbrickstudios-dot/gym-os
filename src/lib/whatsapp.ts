/** Link de WhatsApp a un teléfono +54…, con el mensaje armado. null si no hay teléfono. */
export function linkWhatsappSocio(telefono: string | null | undefined, mensaje?: string | null): string | null {
  const d = (telefono ?? "").replace(/\D/g, "");
  if (d.length < 8) return null;
  return `https://wa.me/${d}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""}`;
}
