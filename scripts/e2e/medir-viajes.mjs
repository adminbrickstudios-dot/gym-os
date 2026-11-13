#!/usr/bin/env node
// E8 · Cuántos viajes a la base hace cada pantalla del panel (con la app compilada, en Actions: Pruebas completas, solo=medir-viajes).
// La app escribe `[rpc] nombre ms` en .local/app.log por cada llamada a la base (src/lib/panel/servidor.ts). Se abre cada pantalla con sesión
// real, se espera a que termine de pedir (incluidos los pedidos del cliente: menú y campana) y se cuentan los renglones nuevos.
// Salida: tabla en consola y en .local/viajes.log (sube con los logs): pantalla, viajes, ms sumados, y las funciones que repiten.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { COMPU, GIMNASIO, entrar, navegador, pagina } from "./comun.mjs";

const G = GIMNASIO();
const LOG = ".local/app.log";
const leer = () => (existsSync(LOG) ? readFileSync(LOG, "utf8").split("\n") : []);
const RUTAS = ["/panel", "/panel/entrada", "/panel/socios", "/panel/vencen-hoy", "/panel/retencion", "/panel/vender", "/panel/caja", "/panel/tareas",
  "/panel/clases", "/panel/clases/grilla", "/panel/planes", "/panel/resultado", "/panel/control", "/panel/equipo", "/panel/mensajes", "/panel/avisos",
  "/panel/transferencias", "/panel/lockers", "/panel/eventos", "/panel/cupones", "/panel/pagina", "/panel/configuracion", "/panel/asistente",
  "/panel/gastos", "/panel/profes", "/panel/rutinas", "/panel/documentos", "/panel/campana", "/panel/cuenta"];
const USUARIOS = [["duena@ejemplo.invalid", "dueña"], ["recepcion@ejemplo.invalid", "recepción"]];

const salida = [];
const decir = (s) => { console.log(s); salida.push(s); };
const b = await navegador();
try {
  for (const [mail, nombre] of USUARIOS) {
    const p = await pagina(b, COMPU);
    p.setDefaultNavigationTimeout(120000);
    await entrar(p, mail);
    // La primera vez de cada ruta compila/calienta: se abre una vez para calentar y se mide la segunda.
    decir(`\n### ${nombre}\n| Pantalla | Viajes a la base | ms sumados | Funciones (x veces) |\n|---|---:|---:|---|`);
    for (const ruta of RUTAS) {
      try {
        await p.goto(`${G}${ruta}`, { waitUntil: "networkidle" }).catch(() => {});
        await p.waitForTimeout(500);
        const antes = leer().length;
        await p.goto(`${G}${ruta}`, { waitUntil: "networkidle" });
        await p.waitForTimeout(1500);   // el menú y la campana piden después de pintar
        const nuevos = leer().slice(antes).map((l) => /\[rpc\] (\S+) (\d+)ms/.exec(l)).filter(Boolean);
        const por = new Map();
        let ms = 0;
        for (const m of nuevos) { por.set(m[1], (por.get(m[1]) ?? 0) + 1); ms += Number(m[2]); }
        const detalle = [...por].map(([n, c]) => (c > 1 ? `${n} x${c}` : n)).join(", ");
        decir(`| ${ruta} | ${nuevos.length} | ${ms} | ${detalle} |`);
      } catch (e) {
        decir(`| ${ruta} | (no abrió: ${String(e.message).split("\n")[0]}) | | |`);
      }
    }
    await p.close();
  }
} finally {
  await b.close();
  writeFileSync(".local/viajes.log", salida.join("\n") + "\n");
}
