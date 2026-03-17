'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_FORMULA_PARAMS, FormulaParams, FormulaType, FORMULA_META } from '@/types/orderbook';
import { useOrderbook } from '@/hooks/useOrderbook';
import { useZoOrderbook } from '@/hooks/useZoOrderbook';
import { useHotstuffOrderbook } from '@/hooks/useHotstuffOrderbook';
import { LeaderboardEntry } from '@/components/Leaderboard';
import dynamic from 'next/dynamic';
import styles from './page.module.css';

const Leaderboard = dynamic(() => import('@/components/Leaderboard'), { ssr: false });

// ── DEX registry ────────────────────────────────────────────────────────
const DEXES = [
  { id: 'pacifica', name: 'Pacifica',    route: '/pacifica', color: '#00ff88', symbols: ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC'] },
  { id: '01',       name: '01 Exchange', route: '/01',       color: '#6366f1', symbols: ['BTC', 'ETH', 'SOL'] },
  { id: 'hotstuff', name: 'HotStuff',    route: '/hotstuff', color: '#f97316', symbols: ['ETH', 'SOL'] },
];

const SHARED_SYMBOLS = ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC'];

const ZO_SYMBOL_MAP: Record<string, string> = {
  BTC: 'BTCUSD', ETH: 'ETHUSD', SOL: 'SOLUSD',
};

// HotStuff live instruments: ETH-PERP, SOL-PERP (BTC-PERP not listed yet)
const HOTSTUFF_SYMBOL_MAP: Record<string, string> = {
  ETH: 'ETH-PERP',
  SOL: 'SOL-PERP',
};

const FORMULA_NAMES: FormulaType[] = [
  'distanceWeighted', 'nearMid', 'ofi', 'microprice', 'powerLaw',
];

const SIGNIFICANCE_ITEMS = [
  { title: 'Price prediction signal',  body: 'Short-term price direction shows strong empirical correlation with orderbook imbalance across liquid markets.' },
  { title: 'Liquidity mapping',        body: 'Reveals where capital is concentrated across price levels — identifying support, resistance, and thin zones.' },
  { title: 'Order flow insight',       body: 'Distinguishes passive resting liquidity from aggressive directional intent, exposing hidden institutional positioning.' },
  { title: 'Cross-DEX arbitrage',      body: 'Divergent imbalances across venues signal mispricing opportunities before they close.' },
];

export default function LandingPage() {
  const [darkMode, setDarkMode] = useState(true);
  const [symbol, setSymbol]   = useState('BTC');
  const [formula, setFormula] = useState<FormulaType>('distanceWeighted');
  const [params, setParams]   = useState<FormulaParams>(DEFAULT_FORMULA_PARAMS);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const pacifica      = useOrderbook(symbol, 1, formula, params);
  const zoSymbol      = ZO_SYMBOL_MAP[symbol] ?? '';
  const zo            = useZoOrderbook(zoSymbol, formula, params);
  const hotstuffSym   = HOTSTUFF_SYMBOL_MAP[symbol] ?? '';
  const hotstuff      = useHotstuffOrderbook(hotstuffSym, formula, params);

  const calcSpread = (bids: typeof pacifica.state.bids, asks: typeof pacifica.state.asks) => {
    if (!bids.length || !asks.length) return 0;
    return parseFloat(asks[0].p) - parseFloat(bids[0].p);
  };

  const entries: LeaderboardEntry[] = [
    {
      id: 'pacifica', name: 'Pacifica', route: '/pacifica', color: '#00ff88',
      symbol,
      imbalance: pacifica.state.imbalance,
      bidVol:    pacifica.state.totalBidVol,
      askVol:    pacifica.state.totalAskVol,
      spread:    calcSpread(pacifica.state.bids, pacifica.state.asks),
      connected:  pacifica.state.connected,
      connecting: pacifica.state.connecting,
      supported:  DEXES[0].symbols.includes(symbol),
    },
    {
      id: '01', name: '01 Exchange', route: '/01', color: '#6366f1',
      symbol,
      imbalance: zo.state.imbalance,
      bidVol:    zo.state.totalBidVol,
      askVol:    zo.state.totalAskVol,
      spread:    calcSpread(zo.state.bids, zo.state.asks),
      connected:  zo.state.connected,
      connecting: zo.state.connecting,
      supported:  !!ZO_SYMBOL_MAP[symbol],
    },
    {
      id: 'hotstuff', name: 'HotStuff', route: '/hotstuff', color: '#f97316',
      symbol,
      imbalance: hotstuff.state.imbalance,
      bidVol:    hotstuff.state.totalBidVol,
      askVol:    hotstuff.state.totalAskVol,
      spread:    calcSpread(hotstuff.state.bids, hotstuff.state.asks),
      connected:  hotstuff.state.connected,
      connecting: hotstuff.state.connecting,
      supported:  !!HOTSTUFF_SYMBOL_MAP[symbol],
    },
  ];

  const meta      = FORMULA_META[formula];
  const hasLambda = formula === 'distanceWeighted';
  const hasXPct   = formula === 'nearMid';
  const hasAlpha  = formula === 'powerLaw';

  const anyLive = entries.some(e => e.connected);

  return (
    <div className={styles.page}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className={styles.nav}>
        <div className={styles.navBrand}>
          <span className={styles.navDot} />
          <span className={styles.navTitle}>Orderbook Imbalance</span>
        </div>
        <button className={styles.themeBtn} onClick={() => setDarkMode(d => !d)}>
          {darkMode ? '☀ Light' : '◑ Dark'}
        </button>
      </nav>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderInner}>
          <h1 className={styles.pageTitle}>Orderbook Imbalance</h1>
          <p className={styles.pageDesc}>
            Real-time bid/ask pressure across decentralised exchanges — mainnet WebSocket feeds.
          </p>
        </div>
      </div>

      {/* ── Comparison Widget ────────────────────────────────────────────── */}
      <section className={styles.widgetSection}>
        <div className={styles.widgetOuter}>

          {/* Widget title bar */}
          <div className={styles.widgetTitleBar}>
            <div className={styles.widgetTitleLeft}>
              <span className={styles.widgetName}>Live Comparison</span>
              <span className={styles.widgetHint}>ranked by smallest absolute imbalance · refreshes every 1.5 s</span>
            </div>
            <div className={styles.widgetLive} data-live={anyLive}>
              <span className={styles.liveDot} />
              <span className={styles.liveText}>{anyLive ? 'Live' : 'Connecting'}</span>
            </div>
          </div>

          {/* Controls row — feels like a Notion filter/sort bar */}
          <div className={styles.widgetControls}>
            <div className={styles.ctrlGroup}>
              <span className={styles.ctrlLabel}>Symbol</span>
              <div className={styles.symbolPills}>
                {SHARED_SYMBOLS.map(s => (
                  <button
                    key={s}
                    className={`${styles.symbolPill} ${symbol === s ? styles.symbolPillActive : ''}`}
                    onClick={() => setSymbol(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <span className={styles.ctrlDivider} />

            <div className={styles.ctrlGroup}>
              <span className={styles.ctrlLabel}>Formula</span>
              <select
                className={styles.ctrlSelect}
                value={formula}
                onChange={e => setFormula(e.target.value as FormulaType)}
              >
                {FORMULA_NAMES.map((f, i) => (
                  <option key={f} value={f}>{i + 1}. {FORMULA_META[f].label}</option>
                ))}
              </select>
            </div>

            {hasLambda && (
              <div className={styles.ctrlGroup}>
                <span className={styles.ctrlLabel}>Decay λ</span>
                <input
                  type="range" min={0.1} max={100} step={0.1}
                  value={params.lambda}
                  onChange={e => setParams(p => ({ ...p, lambda: parseFloat(e.target.value) }))}
                  className={styles.ctrlSlider}
                />
                <span className={styles.ctrlSliderVal}>{params.lambda.toFixed(1)}</span>
              </div>
            )}
            {hasXPct && (
              <div className={styles.ctrlGroup}>
                <span className={styles.ctrlLabel}>Band x%</span>
                <input
                  type="range" min={0.1} max={5} step={0.1}
                  value={params.xPct}
                  onChange={e => setParams(p => ({ ...p, xPct: parseFloat(e.target.value) }))}
                  className={styles.ctrlSlider}
                />
                <span className={styles.ctrlSliderVal}>{params.xPct.toFixed(1)}%</span>
              </div>
            )}
            {hasAlpha && (
              <div className={styles.ctrlGroup}>
                <span className={styles.ctrlLabel}>Exponent α</span>
                <input
                  type="range" min={0.5} max={3} step={0.1}
                  value={params.alpha}
                  onChange={e => setParams(p => ({ ...p, alpha: parseFloat(e.target.value) }))}
                  className={styles.ctrlSlider}
                />
                <span className={styles.ctrlSliderVal}>{params.alpha.toFixed(1)}</span>
              </div>
            )}

            <span className={styles.ctrlDivider} />

            <span className={styles.ctrlFormulaDesc}>
              <span className={styles.ctrlFormulaBadge}>{meta.short}</span>
              {meta.description}
            </span>
          </div>

          {/* The Notion-style table */}
          <Leaderboard entries={entries} />

        </div>
      </section>

      {/* ── Blog ─────────────────────────────────────────────────────────── */}
      <section className={styles.blog}>
        <div className={styles.blogInner}>
          <div className={styles.blogLeft}>
            <p className={styles.sectionTag}>Market microstructure</p>
            <h2 className={styles.blogTitle}>What is orderbook imbalance?</h2>
            <p className={styles.blogBody}>
              Every trade on a decentralized exchange is preceded by an intention —
              a bid to buy or an offer to sell, resting in the orderbook.
              Orderbook imbalance measures the relative weight of these intentions,
              comparing the volume of buy orders against sell orders at any given moment.
            </p>
            <p className={styles.blogBody}>
              When bids significantly outweigh asks, the market leans bullish —
              buyers are aggressive and prices tend to move up. When asks dominate,
              selling pressure can precede price declines. Imbalance is one of the most
              direct, real-time signals available in quantitative market analysis.
            </p>
            <div className={styles.formulaChips}>
              <p className={styles.formulaChipsLabel}>Analysis methods</p>
              <div className={styles.chipRow}>
                {FORMULA_NAMES.map(f => (
                  <span key={f} className={styles.formulaChip}>{FORMULA_META[f].label}</span>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.blogRight}>
            {SIGNIFICANCE_ITEMS.map((item, i) => (
              <div key={i} className={styles.sigRow}>
                <div className={styles.sigNum}>0{i + 1}</div>
                <div>
                  <div className={styles.sigTitle}>{item.title}</div>
                  <div className={styles.sigBody}>{item.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <span className={styles.footerBrand}>Orderbook Imbalance Monitor</span>
        <span className={styles.footerNote}>Mainnet only · Real-time WebSocket feeds</span>
      </footer>
    </div>
  );
}
