import React from 'react';

export interface ModalConfirmacaoExclusaoProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  subtitle?: string;
  itemName?: string;
  itemType?: string; // Ex: "o hóspede", "o estabelecimento", "o quarto"
  message?: React.ReactNode;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
}

/**
 * Modal padrão de confirmação de exclusão do sistema Hotel no Zap.
 * Segue a identidade visual aprovada com ícone de alerta vermelho,
 * botão fechar no topo direito em destaque e botões de ação estilizados.
 */
export const ModalConfirmacaoExclusao: React.FC<ModalConfirmacaoExclusaoProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Excluir Item',
  subtitle = 'Confirmação de exclusão permanente',
  itemName,
  itemType = 'o registro',
  message,
  description,
  confirmText = 'Confirmar Exclusão',
  cancelText = 'Cancelar',
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* CABEÇALHO */}
        <div className="bg-slate-50 p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold shrink-0">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">{title}</h3>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="bg-[#b91c1c] hover:bg-red-800 text-white font-bold p-1.5 rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center justify-center"
            title="Fechar"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* CORPO / MENSAGEM */}
        <div className="p-6 space-y-4 text-xs text-slate-700">
          {message ? (
            <div>{message}</div>
          ) : (
            <p>
              Tem certeza de que deseja remover {itemType}{' '}
              {itemName ? <strong className="text-slate-900">{itemName}</strong> : ''}?
            </p>
          )}

          {description && (
            <p className="text-slate-400 leading-relaxed">
              {description}
            </p>
          )}

          {/* BOTÕES DE AÇÃO */}
          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50 transition"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className="px-5 py-2.5 bg-[#DC2626] hover:bg-red-700 text-white rounded-xl font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-base ${isLoading ? 'animate-spin' : ''}`}>
                {isLoading ? 'progress_activity' : 'delete'}
              </span>
              <span>{isLoading ? 'Excluindo...' : confirmText}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalConfirmacaoExclusao;
