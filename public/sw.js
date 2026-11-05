// Service worker de Gym OS: solo notificaciones push (PUSH-1). No cachea nada.
self.addEventListener("push", (evento) => {
  let m = { titulo: "Gym OS", cuerpo: "", url: "/" };
  try { m = { ...m, ...evento.data.json() }; } catch { if (evento.data) m.cuerpo = evento.data.text(); }
  evento.waitUntil(self.registration.showNotification(m.titulo, { body: m.cuerpo, data: { url: m.url }, icon: "/favicon.ico", badge: "/favicon.ico", lang: "es-AR" }));
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const url = new URL(evento.notification.data?.url ?? "/", self.location.origin).href;
  evento.waitUntil((async () => {
    const abiertas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const misma = abiertas.find((c) => c.url === url);
    if (misma) return misma.focus();
    const alguna = abiertas.find((c) => new URL(c.url).origin === self.location.origin);
    if (alguna) { await alguna.navigate(url); return alguna.focus(); }
    return self.clients.openWindow(url);
  })());
});
