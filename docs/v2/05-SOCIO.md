> **11/11: reemplazado por `docs/base/SOCIO-FLUJO.md`** en el alta, el ingreso y lo que ve el socio (DNI obligatorio y en grande, cuenta sin mails, el socio ya cargado reclama su ficha, menores con adulto responsable, cómo se entra: DNI, QR o los dos) y por `docs/base/PULIDO.md` (bloque Socio y página) en el detalle de cada pantalla. El resto de este archivo sigue vigente.

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

## 2b. Registrarse solo (D26)

Desde la página del gimnasio o la pantalla de ingreso: "Soy nuevo, quiero
anotarme". Pide lo mínimo: nombre, apellido, DNI, celular, mail, fecha de
nacimiento, plan (tarjetas con precio), aceptar reglamento y privacidad, y
cómo entrar (Google o contraseña). Queda **socio sin pagar** con ese plan
("a cobrar" en el panel, con la marca 🌐): puede ver horarios y pagar desde
la app; entra al gimnasio cuando paga. Menores: no se anotan solos (piden
que venga un adulto). El dueño puede apagar el registro (ya existe el
interruptor del alta online; se mantiene, con un texto claro).

## 2c. Escribirle al gimnasio (D27)

Botón "💬 Escribile al gimnasio" en la app: categoría (consulta, queja,
sugerencia, objetos perdidos, otra), texto y foto opcional. Llega al panel
en **Mensajes** con puntito rojo (dueño, encargado, recepción; el dueño
elige quién los ve). Se contesta desde el panel y el socio ve la respuesta
en la app (con aviso). Estados: nuevo · respondido · cerrado. Historial en
la ficha del socio. Respuestas rápidas guardadas ("El horario de feriado
es…"). Nunca datos de salud: si alguien escribe sobre una lesión, se
contesta pero el sistema no lo clasifica ni lo guarda aparte.

## 2d. Cambiar de plan o comprar otro pase (D28)

En "Mi plan": ver el actual y los otros planes con precio. Elegir uno →
la app muestra **lo que le queda a favor** (regla D6: los días que le
quedaban se convierten en días a favor) y el precio a pagar → pagar online
(MercadoPago, cuando esté conectado) o "pagué por transferencia" con
comprobante. Si el dueño lo prende, queda **pendiente de aprobación** en
Para hacer hoy. Comprar un pase diario o un pack suelto: igual, sin cambiar
el plan. Todo lo calcula la base (nunca la app).

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
- **Rutinas con videos**: cada ejercicio con su video o foto (ya existe el
  video en ejercicios), "la de hoy" primero, marcar series hechas.
- **Recomendaciones** (sin inteligencia artificial inventada, con reglas
  claras): "hace 10 días que no venís, hoy hay Funcional 19:00", "te queda 1
  clase del pack", "tu cuota vence el viernes".
- **Novedades** del gimnasio (ya existe) con foto.
- **Agendar con QR**: en gimnasios con reserva, el QR de la entrada marca
  el presente de la clase reservada de ese horario (presente = entrada, A7).
- **Débito automático**: lugar reservado en "Mis pagos" ("Pagá
  automático todos los meses — próximamente") hasta que exista MP-3 🔌.
- Cada sección se apaga si el gimnasio no la usa (clases, rutinas, eventos,
  pagos online, invitados, referidos, grados).

## 3b. Orden y limpieza (lo que pidió Mateo: "limpio y simple")

La app tiene **4 pestañas abajo**: **Inicio** (estado, QR, lo de hoy) ·
**Clases** (horarios y reservas) · **Rutina** · **Yo** (plan y pagos,
historial, mensajes, datos, contraseña, salir). Todo lo demás (eventos,
invitar, referir, grados, novedades) aparece en Inicio solo cuando hay algo
y en "Yo" → "Más". Si el gimnasio no tiene clases, la pestaña no está.

## 4. Cómo se siente

- Transiciones entre pantallas (View Transitions) y botones que responden
  al toque (escala 0,97). Esqueletos con la forma real.
- La marca del gimnasio (colores, logo) en toda la app.
- Sin señal, el QR no se puede mostrar (cambia cada 30 s y lo firma la
  base): la app dice "Sin conexión: decí tu DNI en recepción" (la recepción
  tiene la copia sin internet, SEG-5).
