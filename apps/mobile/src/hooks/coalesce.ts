/**
 * Garantiza que `job` nunca corra dos veces a la vez. Un pedido que llega durante una corrida
 * agenda exactamente una repetición (cubre lo ocurrido después de que la corrida arrancó).
 * `call()` resuelve cuando termina todo el ciclo; un error del job no deja trabado el runner.
 */
export function makeCoalescer(job: () => Promise<void>) {
  let loop: Promise<void> | null = null;
  let again = false;

  function call(): Promise<void> {
    if (loop) {
      again = true;
      return loop;
    }
    const p = (async () => {
      try {
        do {
          again = false;
          try {
            await job();
          } catch {
            // el job reporta sus propios errores; acá solo no se traba el ciclo
          }
        } while (again);
      } finally {
        loop = null;
      }
    })();
    loop = p;
    return p;
  }

  return { call, idle: (): Promise<void> => loop ?? Promise.resolve() };
}
