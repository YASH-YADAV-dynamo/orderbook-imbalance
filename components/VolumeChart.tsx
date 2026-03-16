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

interface VolumeChartProps {
  history: HistoryPoint[];
}

export default function VolumeChart({ history }: VolumeChartProps) {
  const data: ChartData<'line'> = useMemo(() => ({
    datasets: [
      {
        label: 'BID',
        data: history.map(p => ({ x: p.t, y: parseFloat(p.bidVol.toFixed(2)) })),
        borderColor: '#00ff88',
        borderWidth: 1,
        backgroundColor: 'rgba(0,255,136,0.06)',
        pointRadius: 0,
        tension: 0.3,
        fill: true,
      },
      {
        label: 'ASK',
        data: history.map(p => ({ x: p.t, y: parseFloat(p.askVol.toFixed(2)) })),
        borderColor: '#ff3366',
        borderWidth: 1,
        backgroundColor: 'rgba(255,51,102,0.06)',
        pointRadius: 0,
        tension: 0.3,
        fill: true,
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
        min: 0,
        grid: { color: '#111', lineWidth: 1 },
        ticks: {
          color: '#444',
          font: { family: 'var(--font-mono)', size: 9 },
          callback: (v) => {
            const n = Number(v);
            if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
            return String(v);
          },
          maxTicksLimit: 5,
        },
        border: { color: '#222' },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          color: '#555',
          font: { family: 'var(--font-mono)', size: 9 },
          boxWidth: 8,
          boxHeight: 8,
          padding: 12,
        },
      },
      tooltip: {
        backgroundColor: '#111',
        borderColor: '#333',
        borderWidth: 1,
        titleColor: '#888',
        bodyColor: '#eee',
        titleFont: { family: 'var(--font-mono)', size: 10 },
        bodyFont: { family: 'var(--font-mono)', size: 11 },
      },
    },
  }), []);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>BID / ASK VOLUME</span>
        <span className={styles.panelSub}>60s WINDOW · AGGREGATED</span>
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
