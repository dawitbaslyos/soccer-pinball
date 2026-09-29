import React from 'react';
import { getCountryFlagUrl, resolveCountryFlagFile } from '../data/countries';

export type CountryCode = string;

export function resolveCountryCode(nameOrBadgeOrCode?: string): string {
  return resolveCountryFlagFile(nameOrBadgeOrCode).replace('.png', '');
}

interface CountryFlagProps {
  country?: string;
  code?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  hasBorder?: boolean;
  shadow?: boolean;
}

/**
 * Authentic, crisp country flag image component loading real high-res PNG flags
 * from /public/CountryFlags.
 */
export const CountryFlag: React.FC<CountryFlagProps> = ({
  country,
  code: directCode,
  className = '',
  size = 'md',
  rounded = 'md',
  hasBorder = true,
  shadow = true,
}) => {
  const src = getCountryFlagUrl(directCode || country);

  const sizeClasses = {
    xs: 'w-5 h-3.5',
    sm: 'w-7 h-5',
    md: 'w-9 h-6 sm:w-10 sm:h-7',
    lg: 'w-12 h-8 sm:w-14 sm:h-9.5',
    xl: 'w-16 h-11 sm:w-20 sm:h-13.5',
  }[size];

  const roundedClasses = {
    none: 'rounded-none',
    sm: 'rounded-xs',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  }[rounded];

  const borderClass = hasBorder ? 'border-2 border-black/90' : '';
  const shadowClass = shadow ? 'shadow-[0_2px_0_rgba(0,0,0,0.8)]' : '';

  return (
    <div
      data-country-flag={country || directCode}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden select-none bg-neutral-900 ${sizeClasses} ${roundedClasses} ${borderClass} ${shadowClass} ${className}`}
      style={{ aspectRatio: '3 / 2' }}
    >
      <img
        src={src}
        alt={country || 'Country Flag'}
        className="w-full h-full object-cover block select-none"
        loading="lazy"
        draggable={false}
        onError={(e) => {
          // Graceful fallback to Brazil if specific flag fails to load
          const base = import.meta.env.BASE_URL.endsWith('/')
            ? import.meta.env.BASE_URL
            : `${import.meta.env.BASE_URL}/`;
          (e.currentTarget as HTMLImageElement).src = `${base}CountryFlags/br.png`;
        }}
      />
    </div>
  );
};
