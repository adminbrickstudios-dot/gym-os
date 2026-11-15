# Pase 1.0 → Pase 2.0 (Mateo, 15/11)

Mateo, textual: *"Hay que terminar PASE 1.0, para después hacer Pase 2.0, donde vamos a cambiar y hacer
mejoras de estructura, de diseño, de métodos, de landing, de fluidez, de cosas que estamos pasando por
alto."*

**Pase 1.0** es lo que un gimnasio necesita para usarlo todos los días sin problemas:
- entrar, cobrar, dar de alta y la caja;
- la página del gimnasio, el socio con su cuenta y su QR;
- el super admin.

Lo que es mejorar, rediseñar o pulir a fondo está marcado **➡️ Pase 2.0** en `RECTA-FINAL.md`. Para
cerrar 1.0, un ➡️ cuenta como cerrado, igual que ✅ y ⛔.

## Ya hecho y publicado en 1.0 (no se rehace)

- **La página del gimnasio en una pantalla** (L1, Lighthouse celular 94).
- **"Quiero ser socio" con la cuenta gratis y DNI obligatorio** (L2).
- **La app del socio sin pagar con el QR bloqueado**, que se activa solo cuando la recepción cobra (L3,
  PR #23).
- **El origen de cada alta con conversión** (N4).
- **La barrita del DNI y los avisos de QR** (E1, E2).
- **La velocidad, primera parte** (E8): Configuración de 30 viajes a 6, Inicio de 29 a 6, Planes de 23 a 4.

## Lo que falta para cerrar Pase 1.0 (el agente, en este orden)

1. **Publicar lo que está en la rama**, fuera de 16–22 h: N10 (migración 20261114180000) y lo que se
   cierre en esta vuelta.
2. **Pase en todo lo que ve la gente** (D69): panel, app del socio, super admin, mails, títulos, manifest,
   página de la plataforma. Antes, una búsqueda de "Base" en `src/`: lo que es nombre del producto se
   cambia; lo que es palabra común ("base de datos") no. Va con una prueba que falla si el nombre del
   producto vuelve a aparecer escrito a mano: el nombre sale de un solo lugar.
3. **Q1 y F4.1** según D70: las opciones recomendadas que no cambian plata ni quién la ve, cada una con su
   prueba de base. Las demás pasan a ➡️ 2.0 con la recomendación escrita.
4. **F1.4 vuelve a 🟡 hasta mirar las capturas.** Se miran una por una (claro y oscuro, compu y celular),
   y se vuelve a correr el barrido de modales sin la hoja de Cobrar, que nunca se corrió así.
5. **Cerrar la velocidad con lo medido.**
   - E8: Configuración e Inicio todavía hacen 6 viajes. Se baja lo que se pueda sin rehacer pantallas; lo
     que quede, ➡️ 2.0 con su número en `VELOCIDAD.md`.
   - F0.2: igual, con lo medido.
   - Desde ahora, una prueba en `npm run chequeos` que falla si una pantalla supera los viajes que tiene
     hoy: nunca más lento que hoy.
6. **Los chicos a medias:** P2 (ninguna dirección escrita a mano), D4 (la alerta de webhooks fallidos), F1.3
   y F1.7 (cerrarlos con lo que ya está en verde).
7. **F5.1 y Q3:** lo que falta pasa a la cadena e2e completa. De FALTANTES, solo lo que rompe o bloquea el
   uso diario; lo grande, ➡️ 2.0.
8. **El QR de Temple Gym.** Cuando Mateo prenda las altas online:
   - probar `/g/templegym1/hacete-socio?o=qr` de punta a punta en producción, solo mirando, sin crear
     socios en Temple Gym;
   - en un clon `[demo]`, el mismo camino creando la cuenta.
   Si las altas siguen apagadas, queda ⛔ con el paso exacto.
9. **Los documentos en orden** (sin crear documentos nuevos):
   - `00-LEEME.md` como índice real: lo vigente arriba; lo histórico marcado como tal.
   - Ninguna contradicción entre documentos: Base/Pase, D40/D56 cerradas con D62, estados de
     `RECTA-FINAL` que digan la verdad.
   - `ESTADO-GENERAL.md` al día.
10. **F8.2:** la cadena e2e en verde, en tandas de 20 como máximo, con la base nueva en cada tanda.
11. **El cierre (F8.5):**
    - "LISTO PARA TU PASADA" arriba en `PROGRESO.md`, con el resumen de lo que se cerró.
    - `PRUEBA-DUENO.md` listo.
    - La sección "Para Pase 2.0" de abajo completa y priorizada.
    - La entrada final en `docs/LOG.md`.
    - La última línea: `TERMINADO`.

## Lo que depende de Mateo (los ⛔ de 1.0)

| Qué | Destraba |
|---|---|
| Conectar `templegymsalta.com` y `pasegym.com` en Vercel con `DOMINIO.md` (fuera de 16–22 h) | D1, D2, D3 y el QR con dominio propio |
| Prender las altas online de Temple Gym y corregir su nombre a "Temple Gym" | El QR de registro |
| Secretos de GitHub: `BRIK_ADMIN_MAIL`, `BRIK_ADMIN_CLAVE`, `DEMO_CONTRASENA`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLAVE_PRUEBA_MATEO`, `SUPABASE_REF_ESPERADO` | U0.1, U0.3, U1, H4, E3, F0.1, F8.3, F8.4, P3 |
| Variable `SALUD_URL` = `https://gym-os-pied.vercel.app/api/salud` | El aviso de caídas |
| `COPIA_CLAVE` o Supabase Pro | H5, C8, F9.7 |
| Vercel Pro | El uso comercial |
| Su pasada visual y la prueba del dueño | Cerrar 1.0 |

## Para Pase 2.0 (no se empieza hasta que Mateo lo diga)

**Movido desde `RECTA-FINAL.md`:**
- **Pulido profundo:** Z3 a Z7, F3.2, F6.1.
- **Velocidad fina:** F0.4, F0.5, lo que deje E8.
- **Funciones nuevas:** entradas sin internet (N9), débito automático (N1), resumen de la noche (N3),
  factura ARCA (N7), molinete (N8).
- **Escala:** F9.4, F9.6.
- **Plataforma:** ensayo antes de producción (N0), dominios desde el super admin (P9).
- **Revisión:** la cola vieja (Q4) y la prueba de todo junto (R3).
- **Plata y permisos:** las decisiones de Q1 que cambian plata o permisos.

**Lo que nombró Mateo:** estructura, diseño, métodos, landing, fluidez, lo que se está pasando por alto, y
el plan de profesionalización (`docs/PLAN-PROFESIONALIZACION.md`, cuando diga "terminado oficialmente").

**Lo que el agente encuentre durante 1.0** y no sea de 1.0: una línea acá, con dónde está y por qué
importa. No se arregla en 1.0.
