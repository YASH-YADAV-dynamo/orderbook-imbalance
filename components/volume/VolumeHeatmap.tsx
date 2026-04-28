import React, { useMemo } from 'react';
import styles from './VolumeHeatmap.module.css';

interface VolumeHeatmapProps {
  assetVolumeMap: Record<string, number>;
  exchangeVolumeMap: Record<string, number>;
  exchangeSymbolVolumeMap: Record<string, number>;
  buckets: any[];
  isLoading: boolean;
}

export const VolumeHeatmap: React.FC<VolumeHeatmapProps> = (props) => {
  const { assetVolumeMap, exchangeVolumeMap, exchangeSymbolVolumeMap, buckets, isLoading } = props;
  
  const exchanges = ['BINANCE', 'BYBIT', 'OKX', 'HYPERLIQUID', 'BITGET'];
  const symbols = useMemo(() => {
    return Object.keys(assetVolumeMap)
      .sort((a, b) => assetVolumeMap[b] - assetVolumeMap[a])
      .slice(0, 10);
  }, [assetVolumeMap]);

  const formatUSD = (val: number) => {
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}k`;
    return `$${val.toFixed(0)}`;
  };

  if (isLoading) return <div className={styles.loading}>ANALYZING MARKET CONCENTRATION...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.corner}>ASSET</div>
        {exchanges.map(ex => (
          <div key={ex} className={styles.exLabel}>{ex}</div>
        ))}
      </div>
      <div className={styles.body}>
        {symbols.map(sym => (
          <div key={sym} className={styles.row}>
            <div className={styles.symLabel}>{sym}</div>
            {exchanges.map(ex => {
              const val = exchangeSymbolVolumeMap[`${ex}-${sym}`] || 0;
              const totalAssetVol = assetVolumeMap[sym] || 1;
              const intensity = Math.min(val / (totalAssetVol * 0.5), 1); 

              return (
                <div 
                  key={ex} 
                  className={styles.cell}
                  style={{
                    backgroundColor: val > 0 ? `rgba(var(--accent-rgb), ${0.05 + intensity * 0.7})` : 'transparent',
                    border: val > 0 ? `1px solid rgba(var(--accent-rgb), ${intensity * 0.2})` : '1px solid transparent'
                  }}
                  title={`${sym} on ${ex}: ${formatUSD(val)}`}
                >
                  {val > 0 ? formatUSD(val) : '·'}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
