import React from 'react';
import { THEME } from '@/lib/theme-config';

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
}

export function LiquidationMatrix({ data, exchanges, symbols }: LiquidationMatrixProps) {
  // Format numbers to M, K
  const formatValue = (val: number) => {
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
    return `$${val.toFixed(2)}`;
  };

  // Find max value to determine color opacity scaling
  const maxValue = Math.max(...data.map(d => d.value), 1);

  // Map data to a fast lookup dictionary
  const cellMap = new Map<string, MatrixCell>();
  data.forEach(d => {
    cellMap.set(`${d.symbol}-${d.exchange}`, d);
  });

  return (
    <div style={{
      width: '100%',
      backgroundColor: THEME.colors.surface,
      border: `1px solid ${THEME.colors.border}`,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: THEME.typography.fontFamily.mono,
      fontSize: THEME.typography.sizes.xs,
      overflowX: 'auto'
    }}>
      {/* Header Row */}
      <div style={{
        display: 'flex',
        borderBottom: `1px solid ${THEME.colors.border}`,
        backgroundColor: THEME.colors.background,
        color: THEME.colors.foregroundMuted,
      }}>
        <div style={{ width: '100px', flexShrink: 0, padding: '12px 16px', fontWeight: 600 }}>Symbol</div>
        {exchanges.map(ex => (
          <div key={ex} style={{ flex: 1, minWidth: '100px', padding: '12px 8px', textAlign: 'center', fontWeight: 600 }}>
            {ex}
          </div>
        ))}
      </div>

      {/* Matrix Rows */}
      {symbols.map(sym => (
        <div key={sym} style={{
          display: 'flex',
          borderBottom: `1px solid ${THEME.colors.border}`,
        }}>
          {/* Symbol Label */}
          <div style={{ 
            width: '100px', 
            flexShrink: 0, 
            padding: '12px 16px', 
            fontWeight: 600,
            color: THEME.colors.foreground,
            borderRight: `1px solid ${THEME.colors.border}`,
            backgroundColor: THEME.colors.background,
          }}>
            {sym}
          </div>

          {/* Exchange Cells */}
          {exchanges.map(ex => {
            const cell = cellMap.get(`${sym}-${ex}`);
            if (!cell || cell.value === 0) {
              return (
                <div key={`${sym}-${ex}`} style={{
                  flex: 1,
                  minWidth: '100px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: THEME.colors.foregroundMuted,
                  opacity: 0.3
                }}>
                  -
                </div>
              );
            }

            const isGreen = cell.shortValue >= cell.longValue;
            
            // Normalize opacity from 0.1 to 1.0 based on value relative to maxValue
            // We use a log scale so small values are still somewhat visible
            const intensity = Math.max(0.1, Math.min(1, Math.log10(cell.value) / Math.log10(maxValue || 10)));
            
            const bgColor = isGreen 
              ? `rgba(30, 200, 83, ${intensity})` 
              : `rgba(230, 50, 75, ${intensity})`;

            return (
              <div key={`${sym}-${ex}`} style={{
                flex: 1,
                minWidth: '100px',
                padding: '12px 8px',
                textAlign: 'center',
                backgroundColor: bgColor,
                color: '#fff',
                fontWeight: 600,
                textShadow: '0px 1px 2px rgba(0,0,0,0.8)',
                cursor: 'pointer',
                transition: 'filter 0.2s',
              }}
              title={`${sym} on ${ex}: Longs ${formatValue(cell.longValue)}, Shorts ${formatValue(cell.shortValue)}`}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = 'brightness(1.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'brightness(1)';
              }}
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
