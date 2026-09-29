import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Check } from 'lucide-react';
import { ALL_COUNTRIES } from '../data/countries';
import { CountryFlag } from './CountryFlag';

interface CountryFlagDropdownProps {
  isOpen: boolean;
  selectedCountry: string;
  onSelectCountry: (countryName: string) => void;
  onClose: () => void;
}

export const CountryFlagDropdown: React.FC<CountryFlagDropdownProps> = ({
  isOpen,
  selectedCountry,
  onSelectCountry,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const query = searchQuery.trim().toLowerCase();
  const filteredCountries = ALL_COUNTRIES.filter(
    (c) => c.name.toLowerCase().includes(query) || c.code.toLowerCase().includes(query)
  );

  return (
    <div
      ref={dropdownRef}
      id="country-flag-dropdown"
      className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 w-64 sm:w-72 bg-neutral-900/95 border-2 border-black rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.85)] p-2.5 text-white flex flex-col font-sans select-none animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
    >
      {/* 1. Search Bar First */}
      <div className="relative mb-2">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search country..."
          className="w-full bg-white/10 border border-white/15 focus:border-amber-400 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-white/40 outline-none font-sans transition-colors"
        />
        {searchQuery.length > 0 && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-0.5"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* 2. Flags in List Order */}
      <div className="max-h-56 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
        {filteredCountries.length === 0 ? (
          <div className="py-6 text-center text-xs text-white/40 font-bold uppercase tracking-wider">
            No country found
          </div>
        ) : (
          filteredCountries.map((country) => {
            const isSelected =
              country.name.toLowerCase() === selectedCountry.toLowerCase() ||
              country.code.toLowerCase() === selectedCountry.toLowerCase();

            return (
              <button
                key={country.code}
                type="button"
                onClick={() => {
                  onSelectCountry(country.name);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left transition-colors cursor-pointer group ${
                  isSelected
                    ? 'bg-amber-400 text-black font-black shadow-[0_1.5px_0_#000]'
                    : 'hover:bg-white/10 text-white/90 font-bold'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base shrink-0 leading-none">{country.flag}</span>
                  <span className="text-xs truncate tracking-wide">{country.name}</span>
                </div>
                {isSelected && <Check size={14} className="text-black shrink-0 ml-1" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
