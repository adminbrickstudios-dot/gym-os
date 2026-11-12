# Molinete o cerradura por API (N8) · diseño corto

Estado: ⛔ **no construido** (hay que elegir hardware) y 🔌 (necesita el dispositivo y su red). Toca la puerta del gimnasio: nunca se arma solo (ver `PREGUNTAS.md`, P-N5).

## Idea

Un punto de la API que el molinete o la cerradura llama con el socio que presentó (QR, llavero, huella del lector) y que **abre si la entrada da verde**, con la misma
función de siempre: `privado.calcular_acceso`. La vía `molinete` ya existe en `ingresos.via_acceso`. Cero cálculo propio: el dispositivo no decide, solo pregunta y obedece.

## Forma (propuesta)

- `POST /api/molinete/entrar` con una clave del **dispositivo** (el mismo modelo de tablets autorizadas de la Entrada: token por dispositivo, hash en la base, revocable por sede).
- Cuerpo: qué presentó (`qr`, `llavero` o `dni`). Respuesta: `{ abrir: true|false, color, motivo, texto }`; el dispositivo abre solo con `abrir: true`.
- Un `abrir: true` registra el ingreso (idempotente por una clave de operación del dispositivo, para que un reintento por red no cuente dos entradas).
- Rojo siempre dice el motivo y no abre. Si el dispositivo no llega a la base: **política de emergencia escrita** (hoy el modo emergencia de la puerta; el molinete debe tener la suya: abierto, cerrado o solo con llavero cacheado) y queda anotado.
- Interruptor de N5 (`molinete`, apagado por gimnasio y sede).

## Lo que hace falta antes de escribir código

1. ⛔ Hardware: ¿molinete con controladora que acepte HTTP/webhook, o cerradura con relé y un microcontrolador propio? Marca y modelo.
2. 🔌 Red del gimnasio y alimentación del dispositivo; qué pasa con un corte de internet (modo emergencia).
3. ⛔ Seguridad: dispositivo autenticado, límite de pedidos, nada de abrir con un dato que el visitante controla (un DNI tipeado no abre solo).
4. ⛔ Prueba en un dispositivo de banco, nunca en la puerta de Temple Gym.

## Qué se reutiliza

`calcular_acceso`, `registrar_ingreso`, el esquema de dispositivos de la Entrada, el modo emergencia de la puerta y el interruptor por gimnasio (N5).
