import { afterEach } from 'vitest';

// Este setup corre para toda la suite, tambien para los tests de logica pura
// que van en node. Todo lo que toque el DOM se salta cuando no hay ventana.
if (typeof window !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  // fake-indexeddb publica sus tipos, pero no los expone en el mapa de
  // "exports" de su package.json, asi que TypeScript no los encuentra.
  // @ts-expect-error -- falta la declaracion en el subpath /auto
  await import('fake-indexeddb/auto');

  // jsdom no implementa matchMedia y ThemeContext la usa al arrancar.
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    })) as typeof window.matchMedia;
  }

  // jsdom no implementa las URL de objeto, que la pantalla de encuadre usa
  // para mostrar la foto.
  if (!URL.createObjectURL) {
    URL.createObjectURL = () => 'blob:test';
    URL.revokeObjectURL = () => {};
  }

  afterEach(cleanup);
}
