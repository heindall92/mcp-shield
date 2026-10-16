# Changelog

## 1.2.0 — 2026-10-16
- Nueva regla **MCPS-TP-003 · ASCII smuggling** (inspirada en NVIDIA garak, Apache-2.0): caracteres Unicode Tag con el texto oculto decodificado en el hallazgo, selectores de variación en serie, Sneaky Bits y secuencias ANSI en nombres, descripciones, esquemas y args. Incluida en SARIF/Markdown, la ayuda, la remediación y un nuevo ejemplo de demo. Sin falsos positivos con emoji normales (VS16, banderas de subdivisión, ZWJ, CJK).
- El editor del auditor muestra los caracteres invisibles como ⟨U+XXXX⟩.
- Figura isométrica «Cero telemetría» en la ayuda (kit anatomy, MIT): instrumento sellado con bandeja mcp.json, 11 cartuchos de reglas, tarjeta de hallazgos, puerto de red tapado y contador real de peticiones externas. Tema claro/oscuro, ES/EN, una sola imagen fija con movimiento reducido y pausa fuera de pantalla.
- Tipografía Inter y JetBrains Mono variables, autoalojadas con Fontsource (OFL 1.1), con respaldo del sistema.
- Créditos y NOTICE: garak, anatomy, Inter, JetBrains Mono y Fontsource.

## 1.1.0 — 2026-10-16
- Paleta de comandos (⌘K / Ctrl+K, `/`), atajos `?`, `1–4`, `T`, `L`; botón de búsqueda en la barra superior.
- Centro de ayuda con buscador: uso, FAQ, reglas, atajos, privacidad, aviso legal, créditos y licencias, acerca de y otras herramientas del autor.
- Primeros pasos descartables, avisos (toasts) accesibles, impresión / PDF del informe (oculta el editor con el texto original).
- Pie con versión, repositorio, aviso legal, créditos y atajos; enlace «Saltar al contenido».
- Regiones desplazables accesibles por teclado (axe-core: 0 violaciones WCAG 2 A/AA en las vistas probadas).
- Textos sobre interpolación de variables corregidos según la documentación de Cursor, VS Code y Claude Desktop.
- SECURITY.md, CHANGELOG.md y README reestructurado.

## 1.0.0 — 2026-10-16
- Primera versión pública: auditor, simulador (demo) y matriz de gobernanza; parser JSONC/VS Code, ocultación de secretos, SARIF validado con el esquema oficial.
