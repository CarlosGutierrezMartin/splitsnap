import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Red de seguridad para errores de renderizado.
 *
 * Sin esto, una excepcion en cualquier pantalla desmonta el arbol entero y
 * la persona ve una pagina en blanco, que es indistinguible de un cuelgue o
 * de que la app se haya cerrado sola. Con esto al menos sabe que ha pasado y
 * puede volver al inicio sin perder los tickets, que estan en IndexedDB.
 *
 * Tiene que ser un componente de clase: React no ofrece equivalente en hooks.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Error de renderizado:', error, info.componentStack);
  }

  override render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-bold">Algo ha fallado</h1>
        <p className="text-sm text-muted">
          Tus tickets guardados siguen a salvo en este dispositivo.
        </p>

        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="min-h-11 rounded-control bg-primary px-5 font-semibold text-white"
        >
          Volver al inicio
        </button>

        {/* El detalle tecnico va plegado: no asusta, pero permite copiarlo y
            mandarlo cuando algo falla de verdad. */}
        <details className="mt-4 w-full text-left">
          <summary className="cursor-pointer text-xs text-faint">Detalle técnico</summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-hair p-3 text-[11px] text-muted">
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ''}
          </pre>
        </details>
      </div>
    );
  }
}
