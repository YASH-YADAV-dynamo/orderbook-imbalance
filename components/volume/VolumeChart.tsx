import React, { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { VolumeBucket } from '@/lib/volume/types';
import styles from './VolumeChart.module.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface VolumeChartProps {
  buckets: VolumeBucket[];
}

function formatUsdMillions(value: number): string {
  return `$${(value / 1e6).toFixed(2)}M`;
}

export const VolumeChart: React.FC<VolumeChartProps> = ({ buckets }) => {
  const theme = useAppStore(s => s.theme);

  const chartData = useMemo(() => {
    // Take last 60 buckets for a 1h view (assuming 1m buckets)
    // Or last 24h (1440 buckets) but sampled
    const displayBuckets = buckets.slice(-60);

    const labels = displayBuckets.map(b => {
      const date = new Date(b.time);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });

    const exchanges = Array.from(new Set(displayBuckets.flatMap(b => Object.keys(b.exchangeVolumes))));
    
    // Controlled color palette for exchanges (premium)
    const exchangeColors: Record<string, string> = {
      'BINANCE': '#F3BA2F',
      'BYBIT': '#FFB11A',
      'OKX': '#64748b',
      'HYPERLIQUID': '#00FFA3',
      'BITGET': '#00F0FF',
    };

    const datasets = exchanges.map(ex => ({
      label: ex,
      data: displayBuckets.map(b => b.exchangeVolumes[ex] || 0),
      backgroundColor: exchangeColors[ex] || '#666666',
      stack: 'stack0',
      barPercentage: 0.8,
      categoryPercentage: 0.9,
    }));

    return {
      labels,
      datasets
    };
  }, [buckets]);

  const options: any = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
          align: 'end' as const,
          labels: {
            boxWidth: 8,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 10, weight: '600' },
            color: theme === 'light' ? '#0f172a' : '#f8fafc',
          },
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleFont: { size: 12 },
          bodyFont: { size: 11 },
          padding: 10,
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          filter: (item: { parsed: { y?: number } }) => (item.parsed.y ?? 0) > 0,
          callbacks: {
            label: (ctx: { dataset: { label?: string }; parsed: { y?: number } }) => {
              const v = ctx.parsed.y ?? 0;
              const name = ctx.dataset.label ?? '';
              return `${name}: ${formatUsdMillions(v)}`;
            },
            footer: (items: { parsed: { y?: number } }[]) => {
              const sum = items.reduce((a, t) => a + (t.parsed.y ?? 0), 0);
              return `Total: ${formatUsdMillions(sum)}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: {
            maxRotation: 0,
            font: { size: 10 },
            color: theme === 'light' ? '#475569' : '#94a3b8',
            autoSkip: true,
            maxTicksLimit: 12,
          },
        },
        y: {
          stacked: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            font: { size: 10, family: "'JetBrains Mono', Menlo, Consolas, monospace" },
            color: theme === 'light' ? '#475569' : '#94a3b8',
            callback: (value: any) => `$${(value / 1e6).toFixed(0)}M`,
          },
        },
      },
    }),
    [theme]
  );

  return (
    <div className={styles.chartContainer}>
      <Bar data={chartData} options={options} />
    </div>
  );
};
