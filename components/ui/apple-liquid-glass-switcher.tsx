'use client';

import React, { useState, useEffect } from 'react';
import { Sun, Moon, Cloud } from 'lucide-react';

export type Theme = 'light' | 'dark' | 'dim';

interface ThemeOption {
  value: Theme;
  icon: React.ReactNode;
  cOption: string;
}

const themeOptions: ThemeOption[] = [
  { value: 'light', icon: <Sun size={14} />,  cOption: '1' },
  { value: 'dark',  icon: <Moon size={14} />,  cOption: '2' },
  { value: 'dim',   icon: <Cloud size={14} />, cOption: '3' },
];

interface ThemeSwitcherProps {
  value?: Theme;
  onValueChange?: (value: Theme) => void;
}

export function ThemeSwitcher({ value, onValueChange }: ThemeSwitcherProps) {
  const [internalValue, setInternalValue] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeValue = value ?? internalValue;

  const handleChange = (newValue: Theme) => {
    if (onValueChange) {
      onValueChange(newValue);
    } else {
      setInternalValue(newValue);
    }
  };

  // Prevent hydration flicker
  if (!mounted) {
    return <div style={{ width: 144, height: 36, background: 'var(--bg-glass-light)', borderRadius: 999 }} />;
  }

  return (
    <fieldset className="switcher" aria-label="Theme Switcher">
      {themeOptions.map((option) => (
        <label 
          key={option.value} 
          className="switcher__option"
          title={`${option.value.charAt(0).toUpperCase() + option.value.slice(1)} Mode`}
        >
          <input
            type="radio"
            name="theme"
            value={option.value}
            checked={activeValue === option.value}
            onChange={() => handleChange(option.value)}
            className="switcher__input"
            data-c-option={option.cOption}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
          />
          <span className="switcher__icon" style={{ color: 'var(--c)' }}>
            {option.icon}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
