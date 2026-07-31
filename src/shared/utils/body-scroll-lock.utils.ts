interface ScrollStyleSnapshot {
  bodyOverflow: string;
  bodyOverscrollBehavior: string;
  bodyPaddingRight: string;
  htmlOverflow: string;
  htmlOverscrollBehavior: string;
}

interface BodyScrollLockState {
  locks: Set<symbol>;
  snapshot: ScrollStyleSnapshot | null;
}

const GLOBAL_STATE_KEY = '__lcbBodyScrollLockState__';
const OVERLAY_SELECTOR = '[data-lcb-scroll-lock-overlay="true"]';

type GlobalWithScrollLock = typeof globalThis & {
  [GLOBAL_STATE_KEY]?: BodyScrollLockState;
};

function getState(): BodyScrollLockState {
  const scope = globalThis as GlobalWithScrollLock;

  if (!scope[GLOBAL_STATE_KEY]) {
    scope[GLOBAL_STATE_KEY] = {
      locks: new Set<symbol>(),
      snapshot: null,
    };
  }

  return scope[GLOBAL_STATE_KEY];
}

function takeSnapshot(): ScrollStyleSnapshot {
  return {
    bodyOverflow: document.body.style.overflow,
    bodyOverscrollBehavior: document.body.style.overscrollBehavior,
    bodyPaddingRight: document.body.style.paddingRight,
    htmlOverflow: document.documentElement.style.overflow,
    htmlOverscrollBehavior: document.documentElement.style.overscrollBehavior,
  };
}

function applyLockedStyles(state: BodyScrollLockState) {
  state.snapshot = takeSnapshot();

  const scrollbarWidth = Math.max(window.innerWidth - document.documentElement.clientWidth, 0);
  const computedPaddingRight = Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;

  document.documentElement.style.overflow = 'hidden';
  document.documentElement.style.overscrollBehavior = 'none';
  document.body.style.overflow = 'hidden';
  document.body.style.overscrollBehavior = 'none';

  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${computedPaddingRight + scrollbarWidth}px`;
  }

  document.body.dataset.lcbScrollLocked = 'true';
}

function restoreUnlockedStyles(state: BodyScrollLockState) {
  const snapshot = state.snapshot;

  if (snapshot) {
    document.body.style.overflow = snapshot.bodyOverflow;
    document.body.style.overscrollBehavior = snapshot.bodyOverscrollBehavior;
    document.body.style.paddingRight = snapshot.bodyPaddingRight;
    document.documentElement.style.overflow = snapshot.htmlOverflow;
    document.documentElement.style.overscrollBehavior = snapshot.htmlOverscrollBehavior;
  } else {
    // Recuperación defensiva para estilos que pudieran quedar de una versión
    // anterior del componente o de una recarga en caliente durante desarrollo.
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('overscroll-behavior');
    document.body.style.removeProperty('padding-right');
    document.documentElement.style.removeProperty('overflow');
    document.documentElement.style.removeProperty('overscroll-behavior');
  }

  delete document.body.dataset.lcbScrollLocked;
  state.snapshot = null;
}

/**
 * Bloquea el scroll de la página de forma segura para modales y drawers.
 * Soporta overlays anidados: el documento recién se desbloquea cuando el
 * último overlay libera su token, sin importar el orden de cierre.
 */
export function acquireBodyScrollLock(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => undefined;
  }

  const state = getState();
  const token = Symbol('lcb-body-scroll-lock');

  if (state.locks.size === 0) {
    applyLockedStyles(state);
  }

  state.locks.add(token);
  let released = false;

  return () => {
    if (released) return;
    released = true;

    state.locks.delete(token);

    if (state.locks.size === 0) {
      restoreUnlockedStyles(state);
      return;
    }

    // Si React desmontó una rama completa de overlays, validamos en el
    // siguiente frame que no haya quedado un token huérfano.
    window.requestAnimationFrame(() => {
      recoverOrphanedBodyScrollLock();
    });
  };
}

/**
 * Recupera el scroll si por navegación, error o Fast Refresh quedaron estilos
 * bloqueados aunque ya no exista ningún modal/drawer montado en el DOM.
 */
export function recoverOrphanedBodyScrollLock() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (document.querySelector(OVERLAY_SELECTOR)) return;

  const state = getState();
  const hasStaleStyles =
    document.body.dataset.lcbScrollLocked === 'true'
    || document.body.style.overflow === 'hidden'
    || document.documentElement.style.overflow === 'hidden';

  if (state.locks.size === 0 && !hasStaleStyles) return;

  state.locks.clear();
  restoreUnlockedStyles(state);
}
