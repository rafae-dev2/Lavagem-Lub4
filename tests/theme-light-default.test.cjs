'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const contextPath = path.join(root, 'src/contexts/ThemeContext.tsx');
const contextSource = fs.readFileSync(contextPath, 'utf8');

const runtime = { effects: [], states: [] };
globalThis.__themeLightDefaultReact = {
  createContext(defaultValue) {
    const context = {
      current: defaultValue,
      Provider({ value, children }) {
        context.current = value;
        return children;
      },
    };
    return context;
  },
  useContext(context) {
    return context.current;
  },
  useEffect(effect) {
    runtime.effects.push(effect);
  },
  useState(initialValue) {
    let value = typeof initialValue === 'function' ? initialValue() : initialValue;
    const state = {
      get value() {
        return value;
      },
      setState(nextValue) {
        value = typeof nextValue === 'function' ? nextValue(value) : nextValue;
      },
    };
    runtime.states.push(state);
    return [value, state.setState];
  },
  createElement(type, props, ...children) {
    const nextProps = { ...(props || {}) };
    if (children.length === 1) nextProps.children = children[0];
    if (children.length > 1) nextProps.children = children;
    return type(nextProps);
  },
};

async function main() {
const bundle = (await esbuild.build({
  entryPoints: [contextPath],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  jsx: 'transform',
  tsconfigRaw: { compilerOptions: { jsx: 'transform' } },
  write: false,
  plugins: [{
    name: 'theme-react-hook-stub',
    setup(build) {
      build.onResolve({ filter: /^react$/ }, () => ({
        path: 'theme-react-hook-stub',
        namespace: 'theme-react-hook-stub',
      }));
      build.onLoad({ filter: /.*/, namespace: 'theme-react-hook-stub' }, () => ({
        loader: 'js',
        contents: `
          const react = globalThis.__themeLightDefaultReact;
          export default react;
          export const createContext = (...args) => react.createContext(...args);
          export const useContext = (...args) => react.useContext(...args);
          export const useEffect = (...args) => react.useEffect(...args);
          export const useState = (...args) => react.useState(...args);
        `,
      }));
    },
  }],
})).outputFiles[0].text;

const contextModule = { exports: {} };
const runBundle = vm.runInThisContext(
  `(function (require, module, exports, __filename, __dirname) {\n${bundle}\n})`,
  { filename: contextPath },
);
runBundle(require, contextModule, contextModule.exports, contextPath, path.dirname(contextPath));
const themeApi = contextModule.exports;

defaultEnvironment();

function makeStorage(initial = {}, { getThrows = false, setThrows = false } = {}) {
  const values = new Map(Object.entries(initial));
  const writes = [];
  return {
    writes,
    getItem(key) {
      if (getThrows) throw new Error('localStorage getItem indisponível');
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      writes.push([key, value]);
      if (setThrows) throw new Error('localStorage setItem indisponível');
      values.set(key, String(value));
    },
    value(key) {
      return values.has(key) ? values.get(key) : null;
    },
  };
}

function makeDocument(classNames = []) {
  const names = new Set(classNames);
  const calls = { remove: [], add: [] };
  const classList = {
    remove(...classes) {
      calls.remove.push(classes);
      classes.forEach((name) => names.delete(name));
    },
    add(...classes) {
      calls.add.push(classes);
      classes.forEach((name) => names.add(name));
    },
    contains(name) {
      return names.has(name);
    },
  };
  return {
    names,
    calls,
    documentElement: { classList },
  };
}

function defaultEnvironment() {
  delete globalThis.window;
  delete globalThis.document;
  runtime.effects.length = 0;
  runtime.states.length = 0;
}

function mount({ storage, classes = ['app-shell'], documentEnabled = true } = {}) {
  if (storage) globalThis.window = { localStorage: storage };
  else delete globalThis.window;

  const documentStub = makeDocument(classes);
  if (documentEnabled) globalThis.document = documentStub;
  else delete globalThis.document;

  runtime.effects.length = 0;
  runtime.states.length = 0;
  assert.doesNotThrow(() => themeApi.ThemeProvider({ children: null }));
  return {
    value: themeApi.useTheme(),
    effect: runtime.effects[0],
    document: documentStub,
  };
}

function flushEffect(mounted) {
  assert.equal(typeof mounted.effect, 'function', 'o provider deve registrar o efeito de tema');
  mounted.effect();
}

assert.match(contextSource, /const DEFAULT_THEME: Theme = 'verdan';/);
assert.match(contextSource, /const THEME_DEFAULT_VERSION = 'verdan-v10\.29';/);
assert.match(contextSource, /const THEME_DEFAULT_VERSION_KEY = 'bp-theme-default-version';/);

{
  const mounted = mount({ documentEnabled: false });
  assert.equal(mounted.value.theme, 'verdan', 'SSR sem window deve iniciar em verdan');
  assert.equal(mounted.value.isDark, true, 'SSR sem window deve expor isDark=true');
  assert.equal(mounted.value.themeInfo, themeApi.THEMES[0]);
  assert.doesNotThrow(() => flushEffect(mounted), 'SSR não deve quebrar se o stub executar o efeito');
}

defaultEnvironment();

{
  const storage = makeStorage();
  const mounted = mount({ storage });
  assert.equal(mounted.value.theme, 'verdan', 'instalação sem preferência deve iniciar em verdan');
  assert.deepEqual(storage.writes, [], 'initializer deve apenas ler, sem gravar o marcador');
  flushEffect(mounted);
  assert.equal(storage.value('bp-theme'), 'verdan');
  assert.equal(storage.value('bp-theme-default-version'), 'verdan-v10.29');
}

defaultEnvironment();

{
  const storage = makeStorage({ 'bp-theme': 'light', 'bp-theme-default-version': 'light-v10.6' });
  const mounted = mount({ storage });
  assert.equal(mounted.value.theme, 'verdan', 'preferência antiga deve migrar uma única vez para verdan');
  flushEffect(mounted);
  assert.equal(storage.value('bp-theme'), 'verdan');
  assert.equal(storage.value('bp-theme-default-version'), 'verdan-v10.29');
}

defaultEnvironment();

{
  const storage = makeStorage({
    'bp-theme': 'light',
    'bp-theme-default-version': 'verdan-v10.29',
  });
  const mounted = mount({ storage });
  assert.equal(mounted.value.theme, 'light', 'tema manual deve sobreviver após o marcador atualizado');
  assert.equal(mounted.value.isDark, false);
  flushEffect(mounted);
  assert.equal(storage.value('bp-theme'), 'light');
  assert.equal(mounted.document.names.has('dark'), false);
}

defaultEnvironment();

{
  const storage = makeStorage({
    'bp-theme': 'tema-inexistente',
    'bp-theme-default-version': 'verdan-v10.29',
  });
  const mounted = mount({ storage });
  assert.equal(mounted.value.theme, 'verdan', 'valor persistido inválido deve cair no padrão verdan');
  flushEffect(mounted);
  assert.equal(storage.value('bp-theme'), 'verdan');
  assert.equal(storage.value('bp-theme-default-version'), 'verdan-v10.29');
}

defaultEnvironment();

{
  const storage = makeStorage();
  const mounted = mount({ storage });
  mounted.value.setTheme('light');
  assert.deepEqual(
    storage.writes,
    [['bp-theme', 'light'], ['bp-theme-default-version', 'verdan-v10.29']],
    'escolha antes do primeiro efeito deve persistir tema e marcador juntos',
  );
  flushEffect(mounted);
  assert.equal(storage.value('bp-theme'), 'light', 'efeito inicial não pode desfazer escolha manual precoce');
  assert.equal(mounted.document.names.has('dark'), false);
}

defaultEnvironment();

{
  const storage = makeStorage({}, { getThrows: true });
  const mounted = mount({ storage, classes: ['app-shell', 'dark', 'theme-ocean'] });
  assert.equal(mounted.value.theme, 'verdan');
  assert.doesNotThrow(() => flushEffect(mounted), 'falha de leitura do storage não deve quebrar o provider');
  assert.equal(mounted.document.names.has('theme-ocean'), false);
  assert.equal(mounted.document.names.has('theme-verdan'), true);
}

defaultEnvironment();

{
  const storage = makeStorage({}, { setThrows: true });
  const mounted = mount({ storage, classes: ['app-shell', 'dark', 'theme-ocean'] });
  assert.equal(mounted.value.theme, 'verdan');
  assert.doesNotThrow(() => flushEffect(mounted), 'falha de gravação do storage não deve quebrar o provider');
  assert.equal(mounted.document.names.has('theme-ocean'), false);
  assert.equal(mounted.document.names.has('theme-verdan'), true);
}

defaultEnvironment();

{
  const storage = makeStorage({
    'bp-theme': 'light',
    'bp-theme-default-version': 'verdan-v10.29',
  });
  const mounted = mount({
    storage,
    classes: ['app-shell', 'dark', 'theme-ocean', 'theme-verdan', 'classe-estrutural'],
  });
  flushEffect(mounted);
  assert.equal(mounted.document.names.has('dark'), false);
  assert.equal(mounted.document.names.has('theme-ocean'), false);
  assert.equal(mounted.document.names.has('theme-verdan'), false);
  assert.equal(mounted.document.names.has('classe-estrutural'), true, 'classes genéricas devem ser preservadas');
  assert.equal(mounted.document.names.has('app-shell'), true);
}

defaultEnvironment();

{
  const mounted = mount({ storage: makeStorage() });
  assert.deepEqual(
    Object.keys(mounted.value).sort(),
    ['isDark', 'setTheme', 'theme', 'themeInfo', 'toggleTheme'],
    'a forma pública do contexto deve permanecer inalterada',
  );
  assert.deepEqual(
    themeApi.THEMES.map((theme) => theme.key),
    ['verdan', 'liquid-glass-v18', 'black-cyan', 'ios-liquid-glass', 'light', 'dark', 'ocean', 'sunset', 'forest', 'midnight', 'rose', 'arctic', 'copper', 'lavender', 'glass', 'glassy-v18'],
    'a lista de temas existente deve ser preservada com verdan no topo',
  );
}

defaultEnvironment();
console.log('OK: padrão verdan-v10.29, migração única, SSR, persistência sem corrida, classes e API do contexto validados.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
