import React, { useMemo } from 'react';
import * as d3 from 'd3-hierarchy';
import { THEME } from '@/lib/theme-config';

export interface TreemapData {
  name: string;
  value: number;
  longValue: number;
  shortValue: number;
}

interface TreemapProps {
  data: TreemapData[];
  title: string;
  subtitle?: string;
  width?: number;
  height?: number;
}

export function Treemap({ data, title, subtitle, width = 600, height = 400 }: TreemapProps) {
  // We use D3 to calculate the layout.
  const root = useMemo(() => {
    // d3 hierarchy needs a root node
    const hierarchyData = {
      name: 'root',
      children: data
    };

    const rootNode = d3.hierarchy(hierarchyData)
      .sum(d => (d as any).value)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Calculate squarified layout
    d3.treemap()
      .size([width, height])
      .paddingInner(2)
      .paddingOuter(2)
      .round(true)(rootNode as any);

    return rootNode;
  }, [data, width, height]);

  // Format numbers to M, K
  const formatValue = (val: number) => {
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
    return `$${val.toFixed(2)}`;
  };

  if (!data || data.length === 0) {
    return (
      <div style={{
        width: '100%', 
        height, 
        border: `1px solid ${THEME.colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: THEME.colors.foregroundMuted,
        fontFamily: THEME.typography.fontFamily.mono,
        fontSize: THEME.typography.sizes.sm,
      }}>
        No data available
      </div>
    );
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h3 style={{ 
            color: THEME.colors.foreground, 
            fontSize: THEME.typography.sizes.sm,
            fontWeight: 600,
            margin: 0
          }}>
            {title}
          </h3>
          {subtitle && (
            <p style={{
              color: THEME.colors.foregroundMuted,
              fontSize: THEME.typography.sizes.xs,
              margin: 0,
              marginTop: '4px'
            }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div style={{ 
        position: 'relative', 
        width: '100%', 
        height: `${height}px`,
        backgroundColor: THEME.colors.surface,
        border: `1px solid ${THEME.colors.border}`,
        overflow: 'hidden'
      }}>
        {root.leaves().map((leaf: any, i: number) => {
          const d = leaf.data as TreemapData;
          // Determine color based on dominant side. If short > long, it's green (short liquidations = buys).
          const isGreen = d.shortValue >= d.longValue;
          
          // Generate an intensity for the color based on the ratio (more dominant = brighter color)
          // Default bright colors from screenshot
          const bgColor = isGreen ? '#1ec853' : '#e6324b';
          const darkerColor = isGreen ? '#0a421b' : '#4d1018';
          
          // Interpolate opacity or use fixed colors. We will use a mixed color approach to give variations.
          const ratio = Math.max(d.longValue, d.shortValue) / (d.longValue + d.shortValue || 1);
          const opacity = 0.4 + (ratio * 0.6); // 0.4 to 1.0

          const boxWidth = leaf.x1 - leaf.x0;
          const boxHeight = leaf.y1 - leaf.y0;

          // Don't render text if the box is too small
          const showText = boxWidth > 60 && boxHeight > 40;

          return (
            <div
              key={`${d.name}-${i}`}
              style={{
                position: 'absolute',
                left: leaf.x0,
                top: leaf.y0,
                width: boxWidth,
                height: boxHeight,
                backgroundColor: bgColor,
                opacity: opacity,
                border: '1px solid rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
                transition: 'opacity 0.2s',
                cursor: 'pointer',
              }}
              title={`${d.name}: ${formatValue(d.value)} (Longs: ${formatValue(d.longValue)} | Shorts: ${formatValue(d.shortValue)})`}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.border = `1px solid #fff`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = opacity.toString();
                e.currentTarget.style.border = '1px solid rgba(0,0,0,0.5)';
              }}
            >
              {showText && (
                <>
                  <span style={{ 
                    color: '#fff', 
                    fontWeight: 700, 
                    fontSize: THEME.typography.sizes.sm,
                    textShadow: '0px 1px 2px rgba(0,0,0,0.8)',
                    fontFamily: 'sans-serif'
                  }}>
                    {d.name}
                  </span>
                  <span style={{ 
                    color: '#fff', 
                    fontSize: THEME.typography.sizes.xs,
                    textShadow: '0px 1px 2px rgba(0,0,0,0.8)',
                    fontFamily: THEME.typography.fontFamily.mono
                  }}>
                    {formatValue(d.value)}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
