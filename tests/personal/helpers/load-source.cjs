/* eslint-disable @typescript-eslint/no-require-imports -- Node tests and CLI scripts intentionally use CommonJS. */
'use strict';
// Testeamos el TypeScript/TSX real del proyecto, sin build y sin crear una copia de la lógica.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function loadSource(relativePath, mocks = {}) {
  const filename = path.resolve(process.cwd(), relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText, diagnostics } = ts.transpileModule(source, {
    fileName: filename,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  if (diagnostics?.some(issue => issue.category === ts.DiagnosticCategory.Error)) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: name => name, getCurrentDirectory: () => process.cwd(),
      getNewLine: () => '\n',
    }));
  }
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const nativeRequire = loaded.require.bind(loaded);
  loaded.require = name => {
    if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name];
    if (name.startsWith('@/') || name.startsWith('./') || name.startsWith('../')) {
      throw new Error('Importación no mockeada en la prueba: ' + name + ' (' + relativePath + ')');
    }
    return nativeRequire(name);
  };
  loaded._compile(outputText, filename);
  return loaded.exports;
}

module.exports = { loadSource };
