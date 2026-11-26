/**
 * PrimeReact 9 desactiva el ripple de ratón cuando detecta una pantalla
 * táctil (`ontouchstart` o `maxTouchPoints`). En portátiles híbridos eso deja
 * los botones sin efecto al usar el ratón. Este respaldo activa el mismo
 * elemento `.p-ink` con coordenadas de viewport, sin cambiar la detección
 * global de PrimeReact ni afectar a otros componentes.
 */
export function habilitarRippleRaton() {
  document.addEventListener("mousedown", (evento) => {
    if (!(evento.target instanceof Element)) return;

    const tinta = buscarTinta(evento.target);
    if (!tinta) return;

    const contenedor = tinta.parentElement;
    if (!contenedor) return;

    window.setTimeout(() => {
      if (!tinta.isConnected) return;
      if (getComputedStyle(tinta).display === "none") return;

      const caja = contenedor.getBoundingClientRect();
      const tamano = Math.max(caja.width, caja.height);

      // Reinicia la animación aunque PrimeReact ya haya activado la tinta.
      tinta.classList.remove("p-ink-active");
      void tinta.offsetWidth;
      tinta.style.width = `${tamano}px`;
      tinta.style.height = `${tamano}px`;
      tinta.style.left = `${evento.clientX - caja.left - tamano / 2}px`;
      tinta.style.top = `${evento.clientY - caja.top - tamano / 2}px`;
      tinta.classList.add("p-ink-active");
    }, 0);
  });
}

function buscarTinta(nodo: Element): HTMLElement | null {
  let actual: Element | null = nodo;

  while (actual) {
    const tinta = actual.querySelector<HTMLElement>(":scope > .p-ink");
    if (tinta) return tinta;
    actual = actual.parentElement;
  }

  return null;
}
