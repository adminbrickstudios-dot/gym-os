# 12 · Pendientes, notificaciones y onboarding

## Puntito rojo y números (pendientes)

Regla: **el rojo es solo para lo que pide acción hoy**. Si siempre hay algo
rojo, nadie lo mira.

- **Número** en lo que se cuenta y se resuelve: Vencen y cobrar (8),
  Transferencias (3), Mensajes (2), Para hacer hoy (5), pedidos de pausa o
  baja, caja sin contar. Más de 9 → "9+".
- **Punto** (sin número) solo en lo informativo: Novedades.
- **Nunca** en Inicio ni en secciones que siempre tienen algo.
- **Se calculan de la base, no se "marcan leídos"**: el número de Vencen es
  cuántos vencen hoy sin pagar; cuando se cobra, baja solo. Una función
  `pendientes_panel(gimnasio)` devuelve todos los contadores del rol en un
  solo pedido (rápida, < 50 ms), y el menú la pide al cargar y cada 60 s con
  la pestaña visible.
- En la app del socio: punto en la pestaña "Yo" si tiene algo para pagar o
  un mensaje respondido; en Clases si una reserva cambió.

## Centro de notificaciones (🔔, ya existe la campana)

- Lista agrupada por día, cada una con link a lo que hay que hacer,
  "Marcar todo como leído".
- Tipos y para quién, configurables por usuario y canal (en la app · push ·
  mail · WhatsApp), con "solo lo urgente" por defecto para el dueño.
- Push en la PWA: pedir permiso **después de algo que lo justifique** ("¿Te
  aviso 1 h antes de tu clase?") con un botón propio; en iPhone se pide una
  sola vez y requiere la app instalada (iOS 16.4+). El service worker
  siempre muestra una notificación al recibir un push.

## Onboarding

**Gimnasio nuevo** (ya existe "Primeros pasos", ONB-1): lista de 6 pasos con
progreso **calculado** (se tacha sola cuando el dato existe): marca y logo ·
planes y precios · cómo entra la gente (forma de acceso) · equipo (invitar a
la recepción) · primer socio (o importar Excel) · probar la Entrada con un
DNI. Se cierra y se retoma; arriba en Inicio hasta completarse. Fecha
objetivo de "abrimos con Gym OS el…".

**Datos de ejemplo**: opción "Cargar 10 socios de ejemplo para probar" con
un aviso fijo "Estás viendo datos de ejemplo · Borrarlos" (teléfonos
`+54 9 000`, mails `@ejemplo.invalid`).

**Primera vez de cada rol**: **una** pista en la pantalla de su acción
principal (no tours de 8 globos):
- Dueño: "Tocá un número para ver quiénes son".
- Recepción: "Tipeá un DNI en cualquier pantalla para dejar entrar".
- Profe: "Esta es tu clase de hoy".
- Socio: "Tu QR está acá" (y la bienvenida de 3 pantallas, `05`).
Guardado por usuario en la base (no en el navegador).

**Pantallas vacías**: ícono, una frase de qué va acá y **un solo botón**
("Cargá tu primer plan"). Nada de números inventados.

**Ayuda en el lugar**: "?" al lado de términos (pausa, cobertura, gracia,
día fijo) con una línea; Ctrl+K encuentra también la ayuda; "¿Necesitás
ayuda?" → WhatsApp de BRIK o mensaje al super admin (`10`).
