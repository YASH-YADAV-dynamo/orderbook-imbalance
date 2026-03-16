'use client';

import { useMemo } from 'react';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Filler,
  Tooltip,
  ChartOptions,
  ChartData,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { Line } from 'react-chartjs-2';
import { HistoryPoint } from '@/types/orderbook';
import styles from './Chart.module.css';

ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Filler, Tooltip);

interface ImbalanceChartProps {
  history: HistoryPoint[];
}

export default function ImbalanceChart({ history }: ImbalanceChartProps) {
  const data: ChartData<'line'> = useMemo(() => ({
    datasets: [
      {
        data: history.map(p => ({ x: p.t, y: parseFloat((p.imbalance * 100).toFixed(2)) })),
        borderColor: (ctx) => {
          const chart = ctx.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return '#00ff88';
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, '#00ff88');
          gradient.addColorStop(0.5, '#888888');
          gradient.addColorStop(1, '#ff3366');
          return gradient;
        },
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.3,
        fill: false,
      },
    ],
  }), [history]);

  const options: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      x: {
        type: 'time',
        time: { unit: 'second', displayFormats: { second: 'HH:mm:ss' } },
        grid: { color: '#1a1a1a', lineWidth: 1 },
        ticks: {
          color: '#444',
          font: { family: 'var(--font-mono)', size: 9 },
          maxTicksLimit: 8,
        },
        border: { color: '#222' },
      },
      y: {
        min: -100,
        max: 100,
        grid: {
          color: (ctx) => ctx.tick.value === 0 ? '#333' : '#111',
          lineWidth: (ctx) => ctx.tick.value === 0 ? 1 : 1,
        },
        ticks: {
          color: '#444',
          font: { family: 'var(--font-mono)', size: 9 },
          callback: (v) => `${Number(v) > 0 ? '+' : ''}${v}%`,
          maxTicksLimit: 7,
        },
        border: { color: '#222' },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111',
        borderColor: '#333',
        borderWidth: 1,
        titleColor: '#888',
        bodyColor: '#eee',
        titleFont: { family: 'var(--font-mono)', size: 10 },
        bodyFont: { family: 'var(--font-mono)', size: 11 },
        callbacks: {
          label: (ctx) => {
            const y = ctx.parsed.y ?? 0;
            return ` ${y > 0 ? '+' : ''}${y.toFixed(1)}%`;
          },
        },
      },
    },
  }), []);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>IMBALANCE</span>
        <span className={styles.panelSub}>60s WINDOW · 100ms RESOLUTION</span>
      </div>
      <div className={styles.chartArea}>
        {history.length > 1 ? (
          <Line data={data} options={options} />
        ) : (
          <div className={styles.empty}>WAITING FOR DATA...</div>
        )}
      </div>
    </div>
  );
}
