import React, { useState, useRef, useMemo } from 'react';
import { maskCpfCnpj, isValidCpf, isValidCnpj, getCpfCnpjValidationStatus } from '../utils/masks';

export interface CadastroContaPagarProps {
  onBack: () => void;
  onSaveSuccess?: () => void;
}

export const CadastroContaPagar: React.FC<CadastroContaPagarProps> = ({ onBack, onSaveSuccess }) => {
  // Form states
  const [statusPendente, setStatusPendente] = useState(true);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [supplier, setSupplier] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');

  const docValidation = useMemo(() => getCpfCnpjValidationStatus(cpfCnpj), [cpfCnpj]);
  const [documentNumber, setDocumentNumber] = useState('');
  
  const [amount, setAmount] = useState('');
  const [emissionDate, setEmissionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [condition, setCondition] = useState('unica');
  
  // List of condition options state
  const [conditionOptions, setConditionOptions] = useState([
    { value: 'unica', label: 'À Vista / Parcela Única' },
    { value: '2', label: '2x' },
    { value: '3', label: '3x' },
    { value: 'recorrente', label: 'Despesa Fixa Recorrente (Mensal)' },
  ]);

  // Modal State for Nova Condição de Pagamento
  const [isNovaCondicaoModalOpen, setIsNovaCondicaoModalOpen] = useState(false);
  const [novaCondicaoNome, setNovaCondicaoNome] = useState('');
  const [novaCondicaoParcelas, setNovaCondicaoParcelas] = useState(1);
  const [novaCondicaoIntervalo, setNovaCondicaoIntervalo] = useState(30);
  const [novaCondicaoObs, setNovaCondicaoObs] = useState('');

  const handleSaveNovaCondicao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaCondicaoNome.trim()) return;

    const newValue = novaCondicaoNome.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    const newOption = {
      value: newValue,
      label: novaCondicaoNome.trim(),
    };

    setConditionOptions((prev) => [...prev, newOption]);
    setCondition(newValue);
    if (novaCondicaoParcelas > 1) {
      setInstallments(novaCondicaoParcelas);
    }
    setIsNovaCondicaoModalOpen(false);

    setNovaCondicaoNome('');
    setNovaCondicaoParcelas(1);
    setNovaCondicaoIntervalo(30);
    setNovaCondicaoObs('');

    showToast(`Condição "${newOption.label}" cadastrada com sucesso!`);
  };

  const [installments, setInstallments] = useState(1);
  const [accountOrigin, setAccountOrigin] = useState('caixa_recepcao');
  
  // List of accounts state
  const [accountOptions, setAccountOptions] = useState([
    { value: 'caixa_recepcao', label: 'Gaveta / Caixa Recepção' },
    { value: 'banco_itau', label: 'Banco Itaú - Conta Principal' },
    { value: 'banco_bb', label: 'Banco do Brasil' },
    { value: 'cofre', label: 'Cofre Administrativo' },
  ]);

  // Modal State for Nova Conta de Saída / Origem
  const [isNovaContaModalOpen, setIsNovaContaModalOpen] = useState(false);
  const [novaContaNome, setNovaContaNome] = useState('');
  const [novaContaTipo, setNovaContaTipo] = useState('banco');
  const [novaContaSaldo, setNovaContaSaldo] = useState('0');
  const [novaContaObs, setNovaContaObs] = useState('');

  const handleSaveNovaConta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaContaNome.trim()) return;

    const newValue = novaContaNome.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    const newOption = {
      value: newValue,
      label: novaContaNome.trim(),
    };

    setAccountOptions((prev) => [...prev, newOption]);
    setAccountOrigin(newValue);
    setIsNovaContaModalOpen(false);

    setNovaContaNome('');
    setNovaContaTipo('banco');
    setNovaContaSaldo('0');
    setNovaContaObs('');

    showToast(`Conta "${newOption.label}" cadastrada com sucesso!`);
  };
  
  const [notes, setNotes] = useState('');
  
  // File upload state
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCpfCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpfCnpj(maskCpfCnpj(e.target.value));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAttachedFile(file);
      setAttachedFileName(file.name);
      showToast(`Arquivo "${file.name}" anexado com sucesso!`);
    }
  };

  const removeFile = () => {
    setAttachedFile(null);
    setAttachedFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      showToast('Por favor, informe a descrição da despesa.');
      return;
    }
    if (!category) {
      showToast('Por favor, selecione uma categoria.');
      return;
    }
    if (!supplier.trim()) {
      showToast('Por favor, informe o fornecedor/credor.');
      return;
    }
    if (!amount || parseFloat(amount.replace(',', '.')) <= 0) {
      showToast('Por favor, informe um valor válido.');
      return;
    }

    showToast('Conta a pagar cadastrada com sucesso!');
    setTimeout(() => {
      if (onSaveSuccess) {
        onSaveSuccess();
      } else {
        onBack();
      }
    }, 1200);
  };

  return (
    <div className="bg-[#f8f9fc] min-h-screen p-4 sm:p-6 md:p-10 text-slate-800 font-sans antialiased pb-28 sm:pb-16">
      
      {/* TOAST SYSTEM STANDARD (VERDE CLARO COM FONTE PRETA E NEGRITO) */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#d1fae5] border border-emerald-300 text-black font-bold px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3">
          <span className="material-symbols-outlined text-[#003400] text-xl">check_circle</span>
          <span className="text-sm text-black font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Hidden File Input for Native Desktop/Mobile Picker */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="application/pdf,image/*" 
        className="hidden" 
      />

      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* HEADER / NAVIGATION */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 sm:pb-6 border-b border-slate-200 gap-3">
          <div>
            <button
              onClick={onBack}
              type="button"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#003400] hover:text-emerald-950 transition-colors cursor-pointer mb-1.5"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              <span>Voltar para Contas a Pagar</span>
            </button>
            <h1 className="text-xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Cadastro de Conta a Pagar
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Preencha as informações do compromisso financeiro, parcelamento e conciliação.
            </p>
          </div>
        </div>

        {/* FORMULARIO EM CARDS */}
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* BLOCO 1: STATUS & DADOS BÁSICOS */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-lg bg-emerald-50 text-[#003400] shrink-0">
                  <span className="material-symbols-outlined text-xl">receipt_long</span>
                </span>
                <span className="font-semibold text-slate-900 text-sm sm:text-base">Informações Principais</span>
              </div>

              {/* Switch de Status / Situação */}
              <div className="flex items-center justify-between sm:justify-end gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200/60">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Situação da Conta</span>
                <div className="flex items-center gap-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={statusPendente} 
                      onChange={(e) => setStatusPendente(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-10 h-5.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-[#003400]"></div>
                  </label>
                  <span className={`text-xs sm:text-sm font-semibold ${statusPendente ? 'text-emerald-700' : 'text-slate-600'}`}>
                    {statusPendente ? 'Pendente' : 'Paga'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Descrição da Despesa / Título <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Conta de Luz Enel - Maio / Manutenção Elétrica" 
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-sm bg-slate-50/50 focus:bg-white transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Categoria de Despesa <span className="text-rose-500">*</span>
                </label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-sm bg-slate-50/50 focus:bg-white transition-all"
                  required
                >
                  <option value="">Selecione a categoria...</option>
                  <option value="energia">Energia Elétrica & Água</option>
                  <option value="manutencao">Manutenção & Reparos</option>
                  <option value="fornecedores">Fornecedores / Frigobar</option>
                  <option value="lavanderia">Lavanderia & Limpeza</option>
                  <option value="salarios">Folha de Pagamento & Equipe</option>
                  <option value="impostos">Impostos & Tributos</option>
                  <option value="marketing">Marketing & Software</option>
                  <option value="outros">Outras Despesas Operacionais</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Fornecedor / Credor <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="Ex: Enel Distribuição / ClimaTech Soluções" 
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-sm bg-slate-50/50 focus:bg-white transition-all"
                    required
                  />
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">storefront</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    CNPJ / CPF do Credor
                  </label>
                  {docValidation.isComplete && (
                    <span className={`text-[10px] font-bold flex items-center gap-0.5 ${
                      docValidation.isValid ? 'text-emerald-700' : 'text-rose-600'
                    }`}>
                      <span className="material-symbols-outlined text-[12px]">
                        {docValidation.isValid ? 'verified' : 'cancel'}
                      </span>
                      {docValidation.isValid ? 'Válido' : 'Inválido'}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    value={cpfCnpj}
                    onChange={handleCpfCnpjChange}
                    placeholder="000.000.000-00 ou CNPJ" 
                    maxLength={18}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono transition-all ${
                      docValidation.isComplete
                        ? docValidation.isValid
                          ? 'bg-emerald-50/20 border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                          : 'bg-rose-50/30 border-rose-400 focus:ring-2 focus:ring-rose-500/20 text-rose-950'
                        : 'border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] bg-slate-50/50 focus:bg-white'
                    }`}
                  />
                  {docValidation.isComplete && (
                    <span className={`absolute right-3 top-2.5 material-symbols-outlined text-lg pointer-events-none ${
                      docValidation.isValid ? 'text-emerald-600' : 'text-rose-500'
                    }`}>
                      {docValidation.isValid ? 'check_circle' : 'error'}
                    </span>
                  )}
                </div>
                {docValidation.isComplete && !docValidation.isValid && (
                  <p className="text-[10px] text-rose-600 font-medium flex items-center gap-1 mt-1 animate-fadeIn">
                    <span className="material-symbols-outlined text-xs">warning</span>
                    Documento inválido ou falso.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Nº do Documento / Nota Fiscal / Boleto
                </label>
                <input 
                  type="text" 
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="Ex: NF 12903 / NF-e 84.921" 
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-sm bg-slate-50/50 focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>

          {/* BLOCO 2: VALORES, VENCIMENTO & PAGAMENTO */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
              <span className="p-2 rounded-lg bg-emerald-50 text-[#003400] shrink-0">
                <span className="material-symbols-outlined text-xl">event_available</span>
              </span>
              <span className="font-semibold text-slate-900 text-sm sm:text-base">Valores, Vencimento & Pagamento</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Valor Total (R$) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-500 text-sm font-semibold">R$</span>
                  <input 
                    type="text" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00" 
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-sm font-bold text-slate-900 bg-slate-50/50 focus:bg-white transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Data de Emissão <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="date" 
                  value={emissionDate}
                  onChange={(e) => setEmissionDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-xs sm:text-sm bg-slate-50/50 focus:bg-white transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Data de Vencimento <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="date" 
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-xs sm:text-sm font-semibold text-rose-700 bg-slate-50/50 focus:bg-white transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Forma de Pagamento
                </label>
                <select 
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-sm bg-slate-50/50 focus:bg-white transition-all"
                >
                  <option value="pix">PIX</option>
                  <option value="boleto">Boleto Bancário</option>
                  <option value="transferencia">Transferência Bancária (TED/DOC)</option>
                  <option value="dinheiro">Dinheiro (Caixa Gaveta)</option>
                  <option value="cartao">Cartão de Débito/Crédito Corporativo</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
            </div>

            {/* PARCELAMENTO E CONDIÇÃO */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Condição de Pagamento
                </label>
                <div className="flex items-center gap-2">
                  <select 
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-xs sm:text-sm bg-slate-50/50 focus:bg-white transition-all"
                  >
                    {conditionOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsNovaCondicaoModalOpen(true)}
                    className="w-10 h-10 rounded-xl bg-[#d1fae5] hover:bg-emerald-200 border border-emerald-400 text-black font-bold flex items-center justify-center shrink-0 shadow-xs transition-all cursor-pointer"
                    title="Cadastrar Nova Condição de Pagamento"
                  >
                    <span className="material-symbols-outlined text-lg text-black font-bold">add</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Quantidade de Parcelas
                </label>
                <input 
                  type="number" 
                  min="1" 
                  max="60" 
                  value={installments}
                  onChange={(e) => setInstallments(parseInt(e.target.value) || 1)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-xs sm:text-sm bg-slate-50/50 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Conta de Saída / Origem
                </label>
                <div className="flex items-center gap-2">
                  <select 
                    value={accountOrigin}
                    onChange={(e) => setAccountOrigin(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-xs sm:text-sm bg-slate-50/50 focus:bg-white transition-all"
                  >
                    {accountOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsNovaContaModalOpen(true)}
                    className="w-10 h-10 rounded-xl bg-[#d1fae5] hover:bg-emerald-200 border border-emerald-400 text-black font-bold flex items-center justify-center shrink-0 shadow-xs transition-all cursor-pointer"
                    title="Cadastrar Nova Conta de Saída / Origem"
                  >
                    <span className="material-symbols-outlined text-lg text-black font-bold">add</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* BLOCO 3: ANEXO DO BOLETO / COMPROVANTE */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <span className="p-2 rounded-lg bg-emerald-50 text-[#003400] shrink-0">
                <span className="material-symbols-outlined text-xl">attach_file</span>
              </span>
              <span className="font-semibold text-slate-900 text-sm sm:text-base">Anexo do Documento (Boleto, Nota Fiscal ou Recibo)</span>
            </div>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-5 sm:p-8 text-center bg-slate-50/40 hover:bg-slate-50 transition-all cursor-pointer group"
            >
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 text-[#003400] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-2xl">cloud_upload</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slate-700">
                {attachedFileName ? `Arquivo selecionado: ${attachedFileName}` : 'Arraste e solte o arquivo ou toque para selecionar'}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-1">Formatos aceitos: PDF, JPG, PNG até 10MB (Boleto, NF-e, Comprovante)</p>
              
              <div className="mt-4 flex items-center justify-center gap-2">
                <button 
                  type="button" 
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors inline-flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-base text-emerald-800">upload_file</span>
                  <span>{attachedFileName ? 'Alterar Arquivo' : 'Selecionar do Computador/Celular'}</span>
                </button>
                {attachedFileName && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeFile(); }}
                    className="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition-colors inline-flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                    <span>Remover</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* BLOCO 4: OBSERVAÇÕES & DETALHES ADICIONAIS */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <span className="p-2 rounded-lg bg-emerald-50 text-[#003400] shrink-0">
                <span className="material-symbols-outlined text-xl">notes</span>
              </span>
              <span className="font-semibold text-slate-900 text-sm sm:text-base">Observações & Detalhes Adicionais</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                Observações Internas
              </label>
              <textarea 
                rows={3} 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Informações de autorização, chave PIX para pagamento, código de barras do boleto ou instruções para o turno..." 
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-xs sm:text-sm bg-slate-50/50 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* BOTÕES DE AÇÃO INFERIOR */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
            <button 
              type="button" 
              onClick={onBack}
              className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-sm text-slate-700 transition-colors shadow-2xs cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-[#003400] hover:bg-emerald-950 font-semibold text-sm text-white transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">check_circle</span>
              <span>Salvar Conta a Pagar</span>
            </button>
          </div>

        </form>
      </div>

      {/* MODAL DE CADASTRO DE NOVA CONTA DE SAÍDA / ORIGEM */}
      {isNovaContaModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#003400] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-emerald-400">account_balance_wallet</span>
                <h3 className="font-bold text-base text-white">Nova Conta de Saída / Origem</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNovaContaModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-[#b91c1c] hover:bg-red-800 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveNovaConta} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Nome da Conta / Origem *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Banco Bradesco, Mercado Pago, Caixa Cozinha..."
                  value={novaContaNome}
                  onChange={(e) => setNovaContaNome(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-xs sm:text-sm bg-slate-50/50 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Tipo de Conta
                </label>
                <select
                  value={novaContaTipo}
                  onChange={(e) => setNovaContaTipo(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-xs sm:text-sm bg-slate-50/50 focus:bg-white transition-all"
                >
                  <option value="caixa">Caixa Físico / Gaveta</option>
                  <option value="banco">Conta Corrente Bancária</option>
                  <option value="poupanca">Conta Poupança</option>
                  <option value="digital">Carteira Digital / Pix</option>
                  <option value="cofre">Cofre Administrativo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Saldo Inicial (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={novaContaSaldo}
                  onChange={(e) => setNovaContaSaldo(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-xs sm:text-sm bg-slate-50/50 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Observações / Descrição
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalhes ou especificações da conta..."
                  value={novaContaObs}
                  onChange={(e) => setNovaContaObs(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-xs sm:text-sm bg-slate-50/50 focus:bg-white transition-all resize-none"
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNovaContaModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#003400] hover:bg-emerald-950 text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  <span>Salvar Conta</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CADASTRO DE NOVA CONDIÇÃO DE PAGAMENTO */}
      {isNovaCondicaoModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#003400] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-emerald-400">payments</span>
                <h3 className="font-bold text-base text-white">Nova Condição de Pagamento</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNovaCondicaoModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-[#b91c1c] hover:bg-red-800 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveNovaCondicao} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Nome da Condição *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 4x Sem Juros, Entrada + 3x, Quinzena, 30/60/90 Dias..."
                  value={novaCondicaoNome}
                  onChange={(e) => setNovaCondicaoNome(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-xs sm:text-sm bg-slate-50/50 focus:bg-white transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                    Qtd. de Parcelas
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={novaCondicaoParcelas}
                    onChange={(e) => setNovaCondicaoParcelas(parseInt(e.target.value) || 1)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-xs sm:text-sm bg-slate-50/50 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                    Intervalo (Dias)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={novaCondicaoIntervalo}
                    onChange={(e) => setNovaCondicaoIntervalo(parseInt(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-xs sm:text-sm bg-slate-50/50 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Observações / Descrição
                </label>
                <textarea
                  rows={2}
                  placeholder="Instruções adicionais da condição..."
                  value={novaCondicaoObs}
                  onChange={(e) => setNovaCondicaoObs(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-xs sm:text-sm bg-slate-50/50 focus:bg-white transition-all resize-none"
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNovaCondicaoModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#003400] hover:bg-emerald-950 text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  <span>Salvar Condição</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CadastroContaPagar;
