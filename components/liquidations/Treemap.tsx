import React, { useMemo, useEffect, useState } from 'react';
import * as d3 from 'd3-hierarchy';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ZoomIn } from 'lucide-react';
import { PremiumLoader } from '@/components/ui/PremiumLoader';

export interface TreemapData {
  name: string;
  value: number;
  longValue: number;
  shortValue: number;
}

interface TreemapProps {
  data: TreemapData[];
  title?: string;
  isLoading?: boolean;
}

export function Treemap({ data, title = 'Symbols Liquidation Distribution', isLoading }: TreemapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ w: 400, h: 400 });
  const [isHovered, setIsHovered] = useState(false);
  const [activeTimeframe, setActiveTimeframe] = useState('24h');
  
  useEffect(() => {
    if (containerRef.current) {
      const { offsetWidth } = containerRef.current;
      setDimensions({
        w: offsetWidth,
        h: Math.max(300, offsetWidth * 0.6) // More cinematic rectangular ratio
      });
    }
  }, []);

  // Scroll Lock on Hover
  useEffect(() => {
    if (isHovered) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isHovered]);

  const root = useMemo(() => {
    if (!data || data.length === 0) {
      return d3.hierarchy({ name: 'root', children: [] }).sum(() => 0);
    }

    const hierarchyData = {
      name: 'root',
      children: data
    };

    const rootNode = d3.hierarchy(hierarchyData)
      .sum(d => (d as any).value)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    d3.treemap()
      .size([dimensions.w || 400, dimensions.h || 300])
      .paddingInner(2)
      .paddingOuter(0)
      .round(true)(rootNode as any);

    return rootNode;
  }, [data, dimensions]);

  if (isLoading) {
    return (
      <div style={{ 
        width: '100%', 
        height: dimensions.h || 400, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.05)'
      }}>
        <PremiumLoader compact text="LOADING DATA" />
      </div>
    );
  }

  const formatValue = (val: number) => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
    return `$${val.toFixed(2)}`;
  };

  if (!data || data.length === 0) {
    return <div className="treemap-empty">No Data</div>;
  }

  return (
    <div 
      className="treemap-outer-wrapper"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ width: '100%', marginBottom: '12px' }}
    >
      {/* Professional Header Section */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '8px 4px',
        borderBottom: '1.5px solid rgba(255,255,255,0.05)',
        marginBottom: '12px'
      }}>
        <div>
          <h3 style={{ 
            fontSize: '13px', 
            fontWeight: 800, 
            color: '#fff', 
            margin: 0,
            fontFamily: 'var(--font-sans)'
          }}>
            {title}
          </h3>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
            24h liquidation volume
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {['1h', '4h', '12h', '24h'].map(tf => (
            <button 
              key={tf}
              onClick={() => setActiveTimeframe(tf)}
              style={{
                background: activeTimeframe === tf ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                color: activeTimeframe === tf ? '#fff' : 'rgba(255,255,255,0.5)',
                fontSize: '9px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '2px',
                cursor: 'pointer'
              }}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div 
        ref={containerRef} 
        style={{ 
          position: 'relative', 
          width: '100%', 
          height: `${dimensions.h}px`,
          backgroundColor: '#0a0a0a',
          overflow: 'visible',
          borderRadius: '4px',
          cursor: 'default'
        }}
      >
        <AnimatePresence>
          {root.leaves().map((leaf: any, i: number) => {
            const d = leaf.data as TreemapData;
            const isGreen = d.shortValue >= d.longValue;
            const bgColor = isGreen ? '#10b981' : '#ef4444'; // Direct green/red for high-fidelity
            const sumVal = (d.longValue || 0) + (d.shortValue || 0);
            const ratio = sumVal > 0 ? Math.max(d.longValue || 0, d.shortValue || 0) / sumVal : 0.5;
            
            // Rich opacity logic
            const opacity = Math.min(Math.max(0.4 + (ratio * 0.4), 0.4), 0.9); 

            const boxWidth = Math.max(leaf.x1 - leaf.x0, 0) || 0;
            const boxHeight = Math.max(leaf.y1 - leaf.y0, 0) || 0;
            
            return (
              <motion.div
                key={`${d.name}-${i}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileHover={{ 
                  scale: 1.2, // Slightly more zoom
                  zIndex: 100,
                  opacity: 1,
                  boxShadow: '0 15px 50px rgba(0,0,0,0.9)',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                style={{
                  position: 'absolute',
                  left: leaf.x0,
                  top: leaf.y0,
                  width: boxWidth,
                  height: boxHeight,
                  backgroundColor: bgColor,
                  opacity,
                  border: '1px solid rgba(255,255,255,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transformOrigin: 'center center'
                }}
              >
                {/* Search/Zoom Icons for larger boxes */}
                {boxWidth > 70 && boxHeight > 50 && (
                  <div style={{ 
                    position: 'absolute', 
                    top: '8px', 
                    right: '8px', 
                    opacity: 0.6, 
                    display: 'flex', 
                    gap: '4px',
                    background: 'rgba(0,0,0,0.2)',
                    padding: '2px',
                    borderRadius: '2px'
                  }}>
                    <Search size={11} color="#fff" strokeWidth={3} />
                    <ZoomIn size={11} color="#fff" strokeWidth={3} />
                  </div>
                )}

                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  pointerEvents: 'none',
                  textAlign: 'center',
                  width: '95%'
                }}>
                  <span style={{ 
                    color: '#fff', 
                    fontWeight: 900, 
                    fontSize: Math.min(18, Math.max(9, boxWidth / 6)) + 'px',
                    fontFamily: 'var(--font-sans)',
                    lineHeight: 1.1,
                    textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                  }}>
                    {d.name}
                  </span>
                  
                  {boxHeight > 35 && (
                    <span style={{ 
                      color: '#fff', 
                      fontSize: Math.min(16, Math.max(8, boxWidth / 8)) + 'px',
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 800,
                      marginTop: '4px'
                    }}>
                      {formatValue(d.value)}
                    </span>
                  )}

                  {boxHeight > 55 && (
                    <span style={{ 
                      color: isGreen ? '#10b981' : '#f87171', 
                      fontSize: Math.min(12, Math.max(7, boxWidth / 12)) + 'px',
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 900,
                      marginTop: '2px'
                    }}>
                      {isGreen ? 'Short Bias' : 'Long Bias'} ({(ratio * 100).toFixed(1)}%)
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
