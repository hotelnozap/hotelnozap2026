import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onBack?: () => void;
  backLabel?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class SafeModuleBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[SafeModuleBoundary] Erro interceptado:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 md:p-10 flex items-center justify-center min-h-[50vh]">
          <div className="max-w-lg w-full bg-white border border-rose-200 rounded-2xl p-6 sm:p-8 shadow-xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl">error_outline</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {this.props.fallbackTitle || 'Instabilidade ao abrir este módulo'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Ocorreu uma inconsistência temporária nos dados deste registro. Você pode tentar recarregar ou voltar à tela anterior.
              </p>
            </div>
            {this.state.error?.message && (
              <div className="text-left bg-slate-900 text-rose-300 font-mono text-[11px] p-3 rounded-xl overflow-x-auto border border-slate-800">
                {this.state.error.message}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: undefined })}
                className="flex-1 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors shadow-sm"
              >
                Tentar Novamente
              </button>
              {this.props.onBack && (
                <button
                  type="button"
                  onClick={this.props.onBack}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-colors border border-slate-200"
                >
                  {this.props.backLabel || 'Voltar ao Mapa'}
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
