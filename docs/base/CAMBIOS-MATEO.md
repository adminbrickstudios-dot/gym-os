# Cambios pedidos por Mateo y por Temple Gym (H6)

El canal único de pedidos. Lo que Mateo o el gimnasio reportan se anota acá, y es lo primero que toma cada vuelta
del agente (no hace falta escribirle un prompt nuevo por cada cosa).

**Cómo se anota.** Una línea por pedido, la más nueva arriba:

```
- AAAA-MM-DD · <quién: Mateo, Temple Gym (dueño, recepción) o BRIK> · <qué pidió o qué se rompió, con la pantalla y la captura descripta> · <estado>
```

Estados: ⏳ pedido · 🔧 en curso · ✅ hecho (con la corrida o el commit) · ⛔ necesita algo de Mateo (decir qué).

**De dónde llegan.** El botón "¿Necesitás ayuda?" del panel del dueño y de la recepción arma un WhatsApp a BRIK con la
pantalla, quién escribe (nombre y rol) y el último error. El dueño y el encargado además dejan un pedido guardado que
BRIK ve en su tablero (`/admin`). Mateo pasa lo que llega acá. No lleva datos de socios. El número de BRIK lo carga el
super admin en la plataforma (Contacto): sin número, el botón de WhatsApp no aparece.

**Regla de oro.** Nada de esto se prueba en Temple Gym: se reproduce en el gimnasio `[demo]` clonado de su configuración
(`[demo] Temple clon`, ver `docs/base/RECOMENDACIONES.md` punto 7 y el workflow `botones-temple.yml`).

---

- 2026-11-11 · BRIK · Botón "¿Necesitás ayuda?" con WhatsApp a BRIK (pantalla, usuario y último error) para el dueño y la recepción · ✅ H6 (`scripts/e2e/ayuda-brik.mjs`)
- 2026-11-11 · Mateo · Canal único de pedidos y errores de Temple Gym (este archivo) · ✅ H6
