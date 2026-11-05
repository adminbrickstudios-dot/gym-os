# 05 · La app del socio

Es lo que el gimnasio le muestra a su gente: tiene que dar ganas de abrirla.
Hoy tiene mucho (semáforo, QR, escanear la tablet, pagar online o por
transferencia, invitar, referir, firmar, eventos, grados, encuesta, clases,
lugar en la sala, rutina, historial, novedades, cuenta, pausa/baja, mis
datos, instalar). **Todo se queda.** Lo nuevo: entrar más fácil, recordar
la sesión, y que se sienta una app de verdad.

## 1. Entrar (D23)

- **Google** (un toque): Supabase Auth con proveedor Google. 🔌 Mateo crea
  las credenciales en Google Cloud (paso a paso en el ítem). Si el mail de
  Google coincide con el de un socio, se vincula; si no, pide DNI + código al
  celular para vincular (nunca vincula solo por nombre).
- **Mail y contraseña** (ya existe), **código por mail** (ya existe; 🔌 SMTP
  propio), **código por SMS/WhatsApp** (ya existe por SMS; 🔌 proveedor).
- **La sesión se recuerda**: entra una vez y queda adentro (sesión larga,
  refresh automático de `@supabase/ssr`). "Cerrar sesión" en Cuenta.
- Instalable (PWA, ya existe): al segundo ingreso, una invitación corta a
  "Agregar a inicio".
- **Primera vez**: 3 pantallas de bienvenida (tu QR para entrar · reservá
  tus clases · pagá desde acá) que se saltean, y aceptar el reglamento si
  falta.

## 2. Inicio del socio

```
Hola Juan 💪                                  🔔
┌──────────────────────────────────────────┐
│  ✅ Al día                                │  ← el semáforo, animado al abrir
│  hasta el 30/11 · faltan 15 días          │
│  [ Mostrar mi QR ]   [ Escanear entrada ] │
└──────────────────────────────────────────┘
Esta semana: ● ● ● ○ ○   racha 🔥 6 semanas      meta del mes 9/12
Hoy: Spinning 19:00 (reservado, lugar 7)   [Ver clases]
Tu rutina de hoy: Día B · Piernas          [Empezar]
Pagar · Invitar a un amigo · Eventos · Novedades
```

- Si está vencido: el rojo con el motivo y **Pagar ahora** (MercadoPago o
  transferencia) arriba de todo.
- Al entrar (QR o DNI): "Entraste 19:04 ✓ · llevás 12 este mes 🔥" con una
  animación corta; hitos (10, 50, 100) con confetti.

## 3. Lo que se suma

- **Progreso**: visitas por mes (gráfico), racha, meta mensual de visitas
  (la pone el gimnasio), insignias simples, resumen del año.
- **Clases**: lista de espera que inscribe sola cuando se libera un lugar
  (con aviso), y el motivo claro cuando no puede reservar ("tu plan no
  incluye Funcional", "venció tu cuota").
- **Pagos**: historial con recibos, próximos vencimientos, "cuánto pago el
  mes que viene" (con el modo de cobro del gimnasio).
- **Perfil**: foto (la que ve la recepción), datos, contraseña, sesiones,
  notificaciones (qué avisos quiere), familia (cambiar de socio).
- **Avisos en la app**: los de `03-DUENO.md §3` que el gimnasio mande a la
  app (vence pronto, clase cancelada, evento, cumpleaños, hitos).
- **Reseña**: después de una buena racha, "¿nos dejás una reseña en Google?"
  (ya existe la encuesta 0-10: los promotores van al link).
- Cada sección se apaga si el gimnasio no la usa (clases, rutinas, eventos,
  pagos online, invitados, referidos, grados).

## 4. Cómo se siente

- Transiciones entre pantallas (View Transitions) y botones que responden
  al toque (escala 0,97). Esqueletos con la forma real.
- La marca del gimnasio (colores, logo) en toda la app.
- Sin señal, el QR no se puede mostrar (cambia cada 30 s y lo firma la
  base): la app dice "Sin conexión: decí tu DNI en recepción" (la recepción
  tiene la copia sin internet, SEG-5).
