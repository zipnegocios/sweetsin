# Prompt maestro — Sweet Sin, ejecución del plan por chunks

Pegar esto como primer mensaje en la sesión de Claude Code, con el archivo
`SweetSin_Plan_Chunks_DevSpec.md` accesible en el repo (recomendado: copiarlo
a `docs/superpowers/plan-desarrollo.md` antes de arrancar, así queda versionado).

---

```
Contexto del proyecto

Estás trabajando sobre el repo zipnegocios/sweetsin. Existe un documento de
planificación completo en docs/superpowers/plan-desarrollo.md que define:
- Un CHUNK 0 de decisiones de arquitectura ya congeladas (no se discuten,
  no se reinterpretan, se ejecutan tal cual)
- 11 chunks de desarrollo, cada uno con objetivo, alcance, y (donde ya está
  definido) un prompt de trabajo específico con criterios de aceptación

Antes de escribir una sola línea de código, leé completo ese documento.

Reglas de trabajo para toda la sesión

1. Trabajamos UN CHUNK A LA VEZ, en el orden que indica el documento
   ("Sugerencia de orden real de ejecución"). No adelantes trabajo de un
   chunk posterior aunque te parezca eficiente o aunque la implementación
   de un chunk te sugiera cambios en otro — anotalo como nota para cuando
   lleguemos a ese chunk, no lo ejecutes.

2. Al terminar cada chunk, DETENÉTE. No continúes automáticamente al
   siguiente. Presentame:
   - Un resumen de lo que hiciste
   - El resultado de correr cada criterio de aceptación listado en el
     documento para ese chunk (comandos ejecutados y su salida real,
     no una descripción de lo que "debería" pasar)
   - Cualquier decisión que hayas tenido que tomar por ambigüedad del
     documento, señalada explícitamente como "decisión no especificada,
     tomé X por Y razón — confirmame si está bien"
   Esperá mi confirmación explícita antes de tocar el siguiente chunk.

3. Las "Decisiones congeladas" del Chunk 0 son innegociables. Si en algún
   momento el código existente en el repo contradice una decisión congelada
   (por ejemplo, si encontrás que el checkout ya persiste en una tabla que
   no está en el schema planeado), NO lo resuelvas por tu cuenta: parate y
   preguntame cómo proceder.

4. Cuando un chunk tenga una "Nota importante para el prompt" o diga
   "se detalla al llegar" (como los Chunks 2, 3, 4, 6, 7, 8, 10), no
   improvises el alcance completo — hacé lo que el documento sí especifica
   con precisión, y para lo que falta detallar, preguntame antes de asumir.

5. Restricciones explícitas de cada chunk (lo que dice "NO tocar", "NO
   instalar", etc.) son tan importantes como lo que sí pide hacer. Un chunk
   que cumple las tareas pero viola una restricción está mal hecho.

6. Estoy en entorno local con capacidades en la nube. Si necesitás
   credenciales, servicios externos (Cloudflare R2, EasyPanel, Postgres,
   Stripe) o accesos que no tenés disponibles en este entorno, decímelo
   de forma explícita al principio del chunk correspondiente en vez de
   mockear o simular esa parte silenciosamente.

7. Priorizá legibilidad y trazabilidad por sobre atajos: cada commit debe
   corresponder a una unidad de trabajo identificable dentro del chunk
   (no un solo commit gigante por chunk), con mensajes que referencien
   el chunk y la tarea del prompt.

Arrancá ahora

Leé docs/superpowers/plan-desarrollo.md completo, confirmame que entendiste
las decisiones congeladas del Chunk 0, y arrancá con el Chunk 1 siguiendo
exactamente el prompt que ya está escrito ahí. Antes de tocar código,
decime si el archivo de plan tiene alguna decisión abierta que te impida
arrancar (por ejemplo, la elección pnpm vs npm si no quedó resuelta) para
que la cerremos primero.
```

---

## Antes de correrlo

1. Copiá `SweetSin_Plan_Chunks_DevSpec.md` a `docs/superpowers/plan-desarrollo.md` dentro del repo y hacé commit — así Claude Code lo lee como parte del contexto del proyecto y queda versionado junto al código que produce.
2. Resolvé la decisión abierta de pnpm/npm antes de arrancar, o dejá que Claude Code te la señale como bloqueante en el primer paso (el prompt ya lo contempla).
3. Si vas a correr esto en varias sesiones separadas de Claude Code (no una sola sesión larga), al reabrir simplemente decile "seguimos con el Chunk N, ya hicimos hasta el Chunk N-1" — el documento de plan y el estado del repo le dan todo el contexto que necesita para retomar sin repetirle las reglas de trabajo (aunque no está de más volver a pegarle las reglas de la sección 1-7 si notás que se desvía).
