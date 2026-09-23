import React, { useState, useEffect, useRef } from 'react';
import { currentHotelService, HotelAtivo } from '../services/supabaseService';

export interface HotelSelectorProps {
  isMobile?: boolean;
  onNavigateToHoteis?: () => void;
  userRole?: string;
  isAdmin?: boolean;
}

export const HotelSelector: React.FC<HotelSelectorProps> = ({ 
  isMobile = false, 
  onNavigateToHoteis,
  userRole,
  isAdmin
}) => {
  const [currentRole, setCurrentRole] = useState<string>(() => {
    if (userRole) return userRole;
    try {
      return localStorage.getItem('hotelnozap_user_role') || 'Administrador';
    } catch {
      return 'Administrador';
    }
  });

  useEffect(() => {
    if (userRole) {
      setCurrentRole(userRole);
    }
    const handleRole = (e: any) => {
      if (e.detail) setCurrentRole(e.detail);
    };
    window.addEventListener('user_role_changed', handleRole);
    return () => window.removeEventListener('user_role_changed', handleRole);
  }, [userRole]);

  // Se for usuário do tipo hotel ou não for administrador, esta opção não deve ficar visível
  const isHotelUser = isAdmin !== undefined
    ? !isAdmin
    : (currentRole.toLowerCase().includes('hotel') || (!currentRole.toLowerCase().includes('admin') && !currentRole.toLowerCase().includes('administrador')));

  if (isHotelUser) {
    return null;
  }

  const [currentHotel, setCurrentHotelState] = useState<HotelAtivo>(currentHotelService.getCurrentHotel());
  const [availableHoteis, setAvailableHoteis] = useState<HotelAtivo[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadHoteis = async () => {
    const list = await currentHotelService.getAvailableHoteis();
    setAvailableHoteis(list);
    setCurrentHotelState(currentHotelService.getCurrentHotel());
  };

  useEffect(() => {
    loadHoteis();

    const handleHotelChanged = (e: any) => {
      if (e.detail) {
        setCurrentHotelState(e.detail);
      } else {
        setCurrentHotelState(currentHotelService.getCurrentHotel());
      }
    };

    const handleNovoHotel = () => {
      loadHoteis();
    };

    window.addEventListener('hotel_changed', handleHotelChanged);
    window.addEventListener('hotel_novo_hotel', handleNovoHotel);

    return () => {
      window.removeEventListener('hotel_changed', handleHotelChanged);
      window.removeEventListener('hotel_novo_hotel', handleNovoHotel);
    };
  }, []);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectHotel = (hotel: HotelAtivo) => {
    currentHotelService.setCurrentHotel(hotel);
    setCurrentHotelState(hotel);
    setIsOpen(false);
  };

  if (isMobile) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border border-white/20 text-left"
          title="Clique para alternar o hotel gerenciado"
        >
          <span className="material-symbols-outlined text-[#6cf8bb] text-base">apartment</span>
          <div className="flex flex-col min-w-0 max-w-[120px]">
            <span className="text-[11px] font-bold text-white truncate leading-tight">{currentHotel.name}</span>
            <span className="text-[9px] text-[#6cf8bb] truncate">Alternar hotel ▾</span>
          </div>
        </button>

        {isOpen && (
          <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-2xl p-2 z-[200] animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-2 border-b border-slate-100 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Selecione o Hotel Ativo</span>
              <p className="text-[11px] text-slate-400">Você só visualizará dados deste hotel</p>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1">
              {availableHoteis.map(h => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => handleSelectHotel(h)}
                  className={`w-full p-2.5 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer ${
                    h.id === currentHotel.id 
                      ? 'bg-emerald-50 text-[#003400] font-bold border border-emerald-200' 
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      h.id === currentHotel.id ? 'bg-[#003400] text-emerald-400' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <span className="material-symbols-outlined text-base">apartment</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate text-slate-900">{h.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{h.cityUf || 'Hotel Cadastrado'}</div>
                    </div>
                  </div>
                  {h.id === currentHotel.id && (
                    <span className="material-symbols-outlined text-emerald-600 text-base shrink-0">check_circle</span>
                  )}
                </button>
              ))}
            </div>

            {onNavigateToHoteis && (
              <div className="pt-2 mt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setIsOpen(false); onNavigateToHoteis(); }}
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm text-[#003400]">add_business</span>
                  <span>Gerenciar / Cadastrar Hotéis</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-600/60 shadow-xs transition-all cursor-pointer group"
        title="Clique para alternar o hotel em gerenciamento"
      >
        <div className="w-8 h-8 rounded-lg bg-[#003400] text-emerald-400 flex items-center justify-center shadow-xs">
          <span className="material-symbols-outlined text-lg">apartment</span>
        </div>
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-slate-900 leading-tight group-hover:text-[#003400] transition-colors">{currentHotel.name}</span>
            <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-extrabold rounded-full uppercase tracking-wider">Ativo</span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium">{currentHotel.cityUf || 'Porto de Galinhas / PE'}</span>
        </div>
        <span className="material-symbols-outlined text-slate-400 text-lg group-hover:text-slate-700 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}>
          expand_more
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 border-b border-slate-100 mb-1.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-900 block">Hotel em Operação</span>
              <p className="text-[10px] text-slate-500">Todas as tabelas e CRUDs são isolados por hotel</p>
            </div>
            <span className="material-symbols-outlined text-emerald-700 text-lg">verified</span>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1 pr-0.5">
            {availableHoteis.map(h => {
              const isSelected = h.id === currentHotel.id;
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => handleSelectHotel(h)}
                  className={`w-full p-2.5 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-emerald-50 text-[#003400] font-bold border border-emerald-200 shadow-xs' 
                      : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                      isSelected ? 'bg-[#003400] text-emerald-400' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <span className="material-symbols-outlined text-lg">apartment</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate text-slate-900">{h.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{h.cityUf || 'Hotel Cadastrado'}</div>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="material-symbols-outlined text-emerald-700 text-lg shrink-0">check_circle</span>
                  )}
                </button>
              );
            })}
          </div>

          {onNavigateToHoteis && (
            <div className="pt-2 mt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => { setIsOpen(false); onNavigateToHoteis(); }}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-[#003400] border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-base text-emerald-700">add_business</span>
                <span>Gerenciar / Cadastrar Hotéis</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HotelSelector;
