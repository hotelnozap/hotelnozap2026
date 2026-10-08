import React from 'react';

export interface ZapHotelLogoProps {
  className?: string;
  size?: number | string;
  bubbleColor?: string;
  iconColor?: string;
}

/**
 * Ícone Oficial Hotel no Zap:
 * Card/squircle verde esmeralda com o prédio hoteleiro estilizado e recortado.
 * Renderiza nativamente tanto como imagem direta (/logo.png) com fallback vetorial inline
 * garantindo compatibilidade absoluta em qualquer navegador mobile (Android/iOS WebView).
 */
export const ZapHotelLogo: React.FC<ZapHotelLogoProps> = ({
  className = '',
  size = 36
}) => {
  const pixelSize = typeof size === 'number' ? `${size}px` : size;

  return (
    <img
      src="/logo.png"
      alt="Hotel no Zap"
      width={typeof size === 'number' ? size : undefined}
      height={typeof size === 'number' ? size : undefined}
      style={{ width: pixelSize, height: pixelSize }}
      className={`shrink-0 object-contain drop-shadow-xs transition-transform duration-200 select-none ${className}`}
      loading="eager"
      decoding="async"
    />
  );
};

export default ZapHotelLogo;
