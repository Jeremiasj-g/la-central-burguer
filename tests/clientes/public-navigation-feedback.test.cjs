/* eslint-disable @typescript-eslint/no-require-imports -- Node regression tests use CommonJS. */
'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = path => fs.readFileSync(path, 'utf8');

describe('Sitio público / progreso de navegación persistente', () => {
  test('el layout conserva un único indicador global y el template de entrada', () => {
    const layout = read('src/app/(public)/layout.tsx');
    const template = read('src/app/(public)/template.tsx');
    assert.match(layout, /<PublicNavigationFeedback\s*\/>/);
    assert.match(template, /lcb-public-route-enter/);
  });

  test('la barra inicia desde cero sólo cuando empieza una navegación nueva', () => {
    const js = read('src/shared/components/layout/PublicNavigationFeedback.tsx');
    const css = read('src/app/(public)/public.css');
    const base = css.split('.lcb-navigation-progress {')[1]?.split('}')[0] ?? '';
    const active = css.split('.lcb-navigation-feedback.is-loading .lcb-navigation-progress {')[1]?.split('}')[0] ?? '';
    assert.match(base, /width:\s*0\s*;/);
    assert.doesNotMatch(base, /animation\s*:/);
    assert.match(active, /animation:\s*lcb-navigation-progress-fill/);
    assert.match(css, /@keyframes lcb-navigation-progress-fill/);
    assert.match(css, /0%\s*\{\s*width:\s*0\s*;/);
    assert.match(js, /setCycle\(current => current \+ 1\)/);
    assert.match(js, /setPhase\('loading'\)/);
    assert.doesNotMatch(js, /setTimeout\(\(\) => setVisible\(true\), 140\)/);
  });

  test('brillo repetido tipo skeleton queda limitado al recorrido de la barra', () => {
    const css = read('src/app/(public)/public.css');
    assert.match(css, /\.lcb-navigation-progress\s*\{[^}]*overflow:\s*hidden/s);
    assert.match(css, /\.lcb-navigation-feedback\.is-loading \.lcb-navigation-progress::after\s*\{[^}]*animation:\s*lcb-navigation-shimmer\s+1\.15s\s+linear\s+infinite/s);
    assert.match(css, /@keyframes lcb-navigation-shimmer/);
    assert.match(css, /100%\s*\{\s*width:\s*88%/);
    assert.match(css, /\.lcb-navigation-feedback\.is-complete \.lcb-navigation-progress\s*\{[^}]*width:\s*100%/s);
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
    assert.match(css, /\.lcb-navigation-progress::after\s*\{\s*display:\s*none/s);
  });

  test('sin activación para anclas/externos y con fin seguro tras navegación', () => {
    const js = read('src/shared/components/layout/PublicNavigationFeedback.tsx');
    assert.match(js, /destination\.origin !== window\.location\.origin/);
    assert.match(js, /destination\.pathname === window\.location\.pathname/);
    assert.match(js, /setPhase\('complete'\)/);
    assert.match(js, /setTimeout\(clear, 30000\)/);
    assert.match(js, /addEventListener\('popstate', clear\)/);
    assert.match(js, /addEventListener\('pageshow', clear\)/);
  });

  test('el velo añade blur real sin modificar las opacidades ni desenfocar la barra', () => {
    const css = read('src/app/(public)/public.css');
    const veil = css.split('.lcb-navigation-veil {')[1]?.split('}')[0] ?? '';
    assert.match(veil, /background:\s*rgba\(0, 0, 0, \.24\)/);
    assert.match(veil, /-webkit-backdrop-filter:\s*blur\(5px\)/);
    assert.match(veil, /backdrop-filter:\s*blur\(5px\)/);
    assert.match(css, /data-public-theme="dark"\] \.lcb-navigation-veil\s*\{\s*background:\s*rgba\(0, 0, 0, \.34\)/);
    assert.match(css, /\.lcb-navigation-progress\s*\{[\s\S]*?z-index:\s*1/);
  });

  test('AGENTS exige revisar la barra en cambios públicos posteriores', () => {
    const agents = read('AGENTS.md');
    assert.match(agents, /Barra superior naranja con animación continua \(regla estricta\)/);
    assert.match(agents, /no comienza mientras el indicador está oculto/);
    assert.match(agents, /shimmer durante esperas prolongadas/);
    assert.match(agents, /oscuridad \+ blur real de 5 px/);
    assert.match(agents, /no cerrar la modal, limpiar el perfil ni mostrar/);
  });
});
