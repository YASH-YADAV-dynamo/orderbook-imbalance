import React, { useState, useEffect, useRef } from 'react';
import { THEME } from '@/lib/theme-config';
import { PremiumLoader } from '@/components/ui/PremiumLoader';

export interface MatrixCell {
  exchange: string;
  symbol: string;
  value: number;
  longValue: number;
  shortValue: number;
}

interface LiquidationMatrixProps {
  data: MatrixCell[];
  exchanges: string[];
  symbols: string[];
  isLoading?: boolean;
}

export function LiquidationMatrix({ data, exchanges, symbols, isLoading }: LiquidationMatrixProps) {
  const [lastUpdateMap, setLastUpdateMap] = useState<Record<string, number>>({});
  const prevDataRef = useRef<Record<string, number>>({});

  // Detect changes and trigger flash animation
  useEffect(() => {
    if (isLoading) return; // Skip logic if loading but keep the hook call

    const newUpdates: Record<string, number> = { ...lastUpdateMap };
    let changed = false;

    data.forEach(d => {
      const key = `${d.symbol}-${d.exchange}`;
      // Use a small epsilon for float comparison to handle precision
      if (Math.abs((prevDataRef.current[key] || 0) - d.value) > 0.01) {
        newUpdates[key] = Date.now();
        prevDataRef.current[key] = d.value;
        changed = true;
      }
    });

    if (changed) {
      setLastUpdateMap(newUpdates);
    }
    
    // Auto-clear old flashes after 1s to ensure UI stay fresh
    const timer = setTimeout(() => {
      setLastUpdateMap(prev => {
        const next = { ...prev };
        let hasChanges = false;
        const now = Date.now();
        Object.keys(next).forEach(k => {
          if (now - next[k] > 1000) {
            delete next[k];
            hasChanges = true;
          }
        });
        return hasChanges ? next : prev;
      });
    }, 1100);

    return () => clearTimeout(timer);
  }, [data, isLoading]);

  if (isLoading) {
    return (
      <div style={{
        width: '100%',
        height: '350px',
        border: `1px solid var(--border)`,
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.02)',
        marginBottom: '20px'
      }}>
        <PremiumLoader text="SYNCHRONIZING MATRIX" />
      </div>
    );
  }

  const formatValue = (val: number) => {
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
    return `$${val.toFixed(0)}`;
  };

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const cellMap = new Map<string, MatrixCell>();
  data.forEach(d => {
    cellMap.set(`${d.symbol}-${d.exchange}`, d);
  });

  return (
    <div style={{
      width: '100%',
      backgroundColor: 'transparent',
      border: `1px solid var(--border)`,
      borderRadius: '4px',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      overflowX: 'auto',
      marginBottom: '20px'
    }}>
      {/* Header Row */}
      <div style={{
        display: 'flex',
        borderBottom: `1px solid var(--border)`,
        backgroundColor: 'var(--bg-glass-light)',
        color: 'var(--fg-muted)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backdropFilter: 'blur(10px)'
      }}>
      <div style={{ width: '80px', flexShrink: 0, padding: '8px 12px', fontWeight: 600, borderRight: `1px solid var(--border)` }}>ASSET</div>
        {exchanges.map(ex => (
          <div key={ex} style={{ flex: 1, minWidth: '80px', padding: '8px 4px', textAlign: 'center', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {ex}
          </div>
        ))}
      </div>

      {/* Matrix Rows */}
      {symbols.map(sym => (
        <div key={sym} style={{
          display: 'flex',
          borderBottom: `1px solid var(--border)`,
          height: '32px'
        }}>
          {/* Symbol Label */}
          <div style={{ 
            width: '80px', 
            flexShrink: 0, 
            padding: '8px 12px', 
            fontWeight: 700,
            color: 'var(--fg)',
            borderRight: `1px solid var(--border)`,
            backgroundColor: 'var(--bg-glass-light)',
          }}>
            {sym}
          </div>

          {/* Exchange Cells */}
          {exchanges.map(ex => {
            const key = `${sym}-${ex}`;
            const cell = cellMap.get(key);
            const isRecent = Date.now() - (lastUpdateMap[key] || 0) < 1000;
            
            if (!cell || cell.value === 0) {
              return (
                <div key={key} style={{
                  flex: 1,
                  minWidth: '80px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255, 255, 255, 0.05)',
                  borderRight: `0.5px solid rgba(255, 255, 255, 0.05)`
                }}>
                  ·
                </div>
              );
            }

            const isGreen = cell.shortValue >= cell.longValue;
            const safeMaxValue = Math.max(maxValue, 100);
            const logMax = Math.log10(safeMaxValue);
            const logVal = Math.log10(Math.max(cell.value, 1));
            const intensity = Math.min(Math.max(logVal / logMax, 0.1), 0.9);
            
            const colorVar = isGreen ? 'var(--bid-rgb)' : 'var(--ask-rgb)';
            const bgColor = isRecent 
              ? `rgba(${colorVar}, 0.6)` // Flash state
              : `rgba(${colorVar}, ${intensity * 0.5})`;

            return (
              <div key={key} style={{
                flex: 1,
                minWidth: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: bgColor,
                color: '#fff',
                fontWeight: 600,
                cursor: 'crosshair',
                transition: 'background-color 0.8s ease-out',
                borderRight: `0.5px solid var(--border)`,
                position: 'relative'
              }}
              title={`${sym} on ${ex}: $${cell.value.toLocaleString()}`}
              >
                {formatValue(cell.value)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
