'use client';

import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import styles from './VolumeChart.module.css';
import { LiquidationsChartData } from '@/store/useLiquidationsStore';
import { THEME } from '@/lib/theme-config';
import { useAppStore } from '@/store/useAppStore';
import { PremiumLoader } from '@/components/ui/PremiumLoader';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface VolumeChartProps {
  data: LiquidationsChartData[];
  isLoading: boolean;
}

export function VolumeChart({ data, isLoading }: VolumeChartProps) {
  const theme = useAppStore(s => s.theme);
  // Force re-render of chart when theme changes so CSS vars are re-evaluated if needed
  const [chartKey, setChartKey] = useState(0);
  
  useEffect(() => {
    setChartKey(prev => prev + 1);
  }, [theme]);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>24H LIQUIDATION VOLUME</h2>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PremiumLoader compact text="CALCULATING TRENDS" />
        </div>
      </div>
    );
  }

  const labels = data.map(d => {
    const date = new Date(d.time);
    return date.getHours().toString().padStart(2, '0') + ':00';
  });

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Shorts Liquidated',
        data: data.map(d => d.short),
        backgroundColor: THEME.colors.bid,
      },
      {
        label: 'Longs Liquidated',
        data: data.map(d => d.long),
        backgroundColor: THEME.colors.ask,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        grid: {
          color: THEME.colors.border,
          drawBorder: false,
        },
        ticks: {
          color: THEME.colors.foregroundMuted,
          font: {
            family: THEME.typography.fontFamily.mono,
            size: 10,
          }
        }
      },
      y: {
        stacked: true,
        grid: {
          color: THEME.colors.border,
          drawBorder: false,
        },
        ticks: {
          color: THEME.colors.foregroundMuted,
          font: {
            family: THEME.typography.fontFamily.mono,
            size: 10,
          },
          callback: (value: any) => {
            if (value >= 1e6) return '$' + (value / 1e6).toFixed(1) + 'M';
            if (value >= 1e3) return '$' + (value / 1e3).toFixed(1) + 'K';
            return '$' + value;
          }
        }
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: THEME.colors.surfaceMuted,
        titleColor: THEME.colors.foreground,
        bodyColor: THEME.colors.foreground,
        borderColor: THEME.colors.border,
        borderWidth: 1,
        font: {
          family: THEME.typography.fontFamily.mono,
        },
        callbacks: {
          label: (context: any) => {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
            }
            return label;
          }
        }
      }
    },
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>24H LIQUIDATION VOLUME</h2>
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <div className={styles.legendColor} style={{ backgroundColor: THEME.colors.bid }} />
            <span>SHORTS</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendColor} style={{ backgroundColor: THEME.colors.ask }} />
            <span>LONGS</span>
          </div>
        </div>
      </div>
      <div className={styles.chartWrapper}>
        <Bar key={chartKey} options={options} data={chartData} />
      </div>
    </div>
  );
}
