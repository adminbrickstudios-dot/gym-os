#!/usr/bin/env node
// E4 · Para correrlo en Actions con la app ya compilada (Pruebas completas, solo=medir-js, app_modo=produccion):
// imprime el JS por ruta del panel y lo guarda en .local/js-rutas.md (sube con las capturas y logs).
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync(".local", { recursive: true });
const salida = execSync("node scripts/medir/js-rutas.mjs --json .local/js-rutas.json", { encoding: "utf8" });
writeFileSync(".local/js-rutas.md", salida);
console.log(salida);
