'use client';

import { useEffect, useMemo, useState } from 'react';
import { FORMULA_META, FormulaType } from '@/types/orderbook';
import { useDexOrderbook } from '@/hooks/useDexOrderbook';
import { useBinancePrice } from '@/hooks/useBinancePrice';
import { useAppStore } from '@/store/useAppStore';
import { ADAPTERS } from '@/lib/dexAdapters';
import { getAllPairs } from '@/lib/pairs';
import { LeaderboardEntry } from '@/components/Leaderboard';
import IntegrateButton from '@/components/IntegrateButton';
import dynamic from 'next/dynamic';
import styles from './page.module.css';

const Leaderboard    = dynamic(() => import('@/components/Leaderboard'),    { ssr: false });
const MarketSelector = dynamic(() => import('@/components/MarketSelector'), { ssr: false });

const FORMULA_NAMES: FormulaType[] = [
  'distanceWeighted', 'nearMid', 'ofi', 'microprice', 'powerLaw',
];

const ALL_PAIRS = getAllPairs();

const SIGNIFICANCE_ITEMS = [
  { title: 'Price prediction signal',  body: 'Short-term price direction shows strong empirical correlation with orderbook imbalance across liquid markets.' },
  { title: 'Liquidity mapping',        body: 'Reveals where capital is concentrated across price levels — identifying support, resistance, and thin zones.' },
  { title: 'Order flow insight',       body: 'Distinguishes passive resting liquidity from aggressive directional intent, exposing hidden institutional positioning.' },
  { title: 'Cross-DEX arbitrage',      body: 'Divergent imbalances across venues signal mispricing opportunities before they close.' },
];

const RANKING_TOOLTIP =
  'Ranked by strongest sustained directional pressure. ' +
  'Uses a time-smoothed EMA (exponential moving average) with a ~1 s half-life ' +
  'so exchanges with fast and slow feeds are compared fairly.';

export default function LandingPage() {
  const darkMode       = useAppStore(s => s.darkMode);
  const toggleDarkMode = useAppStore(s => s.toggleDarkMode);
  const symbol         = useAppStore(s => s.leaderboardSymbol);
  const formula        = useAppStore(s => s.leaderboardFormula);
  const params         = useAppStore(s => s.leaderboardParams);
  const setSymbol      = useAppStore(s => s.setLeaderboardSymbol);
  const setFormula     = useAppStore(s => s.setLeaderboardFormula);
  const setParams      = useAppStore(s => s.setLeaderboardParams);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const [showTooltip, setShowTooltip] = useState(false);

  const refMid = useBinancePrice(symbol);

  const pacifica    = useDexOrderbook(ADAPTERS.pacifica,     symbol, formula, params, undefined, refMid);
  const zo          = useDexOrderbook(ADAPTERS['01'],       symbol, formula, params, undefined, refMid);
  const hotstuff    = useDexOrderbook(ADAPTERS.hotstuff,    symbol, formula, params, undefined, refMid);
  const paradex     = useDexOrderbook(ADAPTERS.paradex,     symbol, formula, params, undefined, refMid);
  const hibachi     = useDexOrderbook(ADAPTERS.hibachi,     symbol, formula, params, undefined, refMid);
  const hyperliquid = useDexOrderbook(ADAPTERS.hyperliquid, symbol, formula, params, undefined, refMid);
  const extended    = useDexOrderbook(ADAPTERS.extended,    symbol, formula, params, undefined, refMid);
  const aster       = useDexOrderbook(ADAPTERS.aster,       symbol, formula, params, undefined, refMid);
  const nado        = useDexOrderbook(ADAPTERS.nado,        symbol, formula, params, undefined, refMid);

  const hookByAdapter = {
    pacifica, '01': zo, hotstuff, paradex, hibachi, hyperliquid, extended, aster, nado,
  } as const;

  const entries: LeaderboardEntry[] = useMemo(() =>
    (Object.entries(ADAPTERS) as [keyof typeof ADAPTERS, (typeof ADAPTERS)[keyof typeof ADAPTERS]][])
      .map(([id, adapter]) => {
        const { state } = hookByAdapter[id];
        const wsSymbol  = adapter.toWsSymbol(symbol);
        const primaryImbalance = state.tradingSignal?.value ?? state.emaImbalance;
        return {
          id:            adapter.id,
          name:          adapter.name,
          route:         adapter.route,
          color:         adapter.color,
          symbol,
          imbalance:     primaryImbalance,
          emaImbalance:  primaryImbalance,
          bidVol:        state.totalBidVol,
          askVol:        state.totalAskVol,
          spread:        state.bids[0] && state.asks[0]
                           ? parseFloat(state.asks[0].p) - parseFloat(state.bids[0].p)
                           : 0,
          connected:     state.connected,
          connecting:    state.connecting,
          supported:     !!wsSymbol,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      symbol,
      pacifica.state, zo.state, hotstuff.state, paradex.state, hibachi.state, hyperliquid.state, extended.state, aster.state, nado.state,
    ],
  );

  const meta      = FORMULA_META[formula];
  const hasLambda = formula === 'distanceWeighted';
  const hasXPct   = formula === 'nearMid';
  const hasAlpha  = formula === 'powerLaw';
  const anyLive   = entries.some(e => e.connected);

  return (
    <div className={styles.page}>

      <nav className={styles.nav}>
        <div className={styles.navBrand}>
          <img src="/image.jpg" alt="" className={styles.navLogo} />
          <span className={styles.navTitle}>Orderbook Imbalance</span>
        </div>
        <button className={styles.themeBtn} onClick={toggleDarkMode}>
          {darkMode ? '☀ Light' : '◑ Dark'}
        </button>
      </nav>

      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderInner}>
          <h1 className={styles.pageTitle}>Orderbook Imbalance</h1>
          <p className={styles.pageDesc}>
            Real-time bid/ask pressure across decentralised exchanges — mainnet WebSocket feeds.
          </p>
          <div className={styles.integrateWrap}>
            <IntegrateButton />
          </div>
        </div>
      </div>

      <section className={styles.widgetSection}>
        <div className={styles.widgetOuter}>

          <div className={styles.widgetTitleBar}>
            <div className={styles.widgetTitleLeft}>
              <span className={styles.widgetName}>Live Comparison</span>
              <span
                className={styles.widgetHint}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              >
                ranked by strongest directional pressure
                <span className={styles.infoIcon}>?</span>
                {showTooltip && (
                  <span className={styles.tooltip}>{RANKING_TOOLTIP}</span>
                )}
              </span>
            </div>
            <div className={styles.widgetTitleRight}>
              <div className={styles.widgetLive} data-live={anyLive}>
                <span className={styles.liveDot} />
                <span className={styles.liveText}>{anyLive ? 'Live' : 'Connecting'}</span>
              </div>
            </div>
          </div>

          <div className={styles.widgetControls}>
            <div className={styles.ctrlGroup}>
              <span className={styles.ctrlLabel}>Market</span>
              <MarketSelector
                pairs={ALL_PAIRS}
                selected={symbol}
                onSelect={setSymbol}
                showDexBadges
              />
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
                  onChange={e => setParams({ lambda: parseFloat(e.target.value) })}
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
                  onChange={e => setParams({ xPct: parseFloat(e.target.value) })}
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
                  onChange={e => setParams({ alpha: parseFloat(e.target.value) })}
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

          <Leaderboard entries={entries} />

        </div>
      </section>

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

      <footer className={styles.footer}>
        <span className={styles.footerBrand}>Orderbook Imbalance Monitor</span>
        <span className={styles.footerNote}>Mainnet only · Real-time WebSocket feeds</span>
        <a
          href="https://x.com/yashastro23"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.footerLove}
        >
          made with love by dynamo
          <span className={styles.footerX} aria-label="X">𝕏</span>
        </a>
      </footer>
    </div>
  );
}
