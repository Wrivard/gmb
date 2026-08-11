import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Setup des tests de composants (projet « dom »).
// jsdom n'implémente pas tout ce que les primitives d'UI appellent —
// sans ces prothèses, un test échoue pour une raison sans rapport avec
// le composant testé.

afterEach(cleanup);

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// cmdk fait défiler l'élément sélectionné jusqu'à la vue.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
