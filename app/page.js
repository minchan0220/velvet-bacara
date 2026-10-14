'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const STARTING_CHIPS = 1_000_000;
const DEAL_DELAY = 1200;
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = [
  ['A', 1], ['2', 2], ['3', 3], ['4', 4], ['5', 5], ['6', 6], ['7', 7],
  ['8', 8], ['9', 9], ['10', 0], ['J', 0], ['Q', 0], ['K', 0],
];
const BETS = {
  player: { label: 'PLAYER', baseProfit: 1 },
  tie: { label: 'TIE', baseProfit: 8 },
  banker: { label: 'BANKER', baseProfit: 0.95 },
};
const BOOST_MULTIPLIERS = [2, 2, 2, 3, 3, 4, 5, 8, 10];
const QUICK_BETS = [10000, 25000, 50000, 100000, 250000];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const money = (n) => new Intl.NumberFormat('ko-KR').format(Math.floor(n));

function createShoe(decks = 8) {
  const cards = [];
  let id = 0;
  for (let d = 0; d < decks; d += 1) {
    for (const suit of SUITS) {
      for (const [rank, value] of RANKS) {
        cards.push({ rank, value, suit, id: `${d}-${id++}-${Math.random()}` });
      }
    }
  }
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function baccaratTotal(cards) {
  return cards.reduce((sum, card) => sum + card.value, 0) % 10;
}

function shouldBankerDraw(bankerTotal, playerThird) {
  if (!playerThird) return bankerTotal <= 5;
  const p = playerThird.value;
  if (bankerTotal <= 2) return true;
  if (bankerTotal === 3) return p !== 8;
  if (bankerTotal === 4) return [2, 3, 4, 5, 6, 7].includes(p);
  if (bankerTotal === 5) return [4, 5, 6, 7].includes(p);
  if (bankerTotal === 6) return [6, 7].includes(p);
  return false;
}

function makeBoosts() {
  return Array.from({ length: 8 }, (_, index) => {
    const [rank] = RANKS[Math.floor(Math.random() * RANKS.length)];
    const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
    const mult = BOOST_MULTIPLIERS[Math.floor(Math.random() * BOOST_MULTIPLIERS.length)];
    return { rank, suit, mult, id: `boost-${index}-${Math.random()}` };
  });
}

function cardKey(card) {
  return `${card.rank}${card.suit}`;
}

function sideBoost(cards, boosts) {
  let multiplier = 1;
  const matches = [];
  for (const card of cards) {
    const matching = boosts.filter((b) => b.rank === card.rank && b.suit === card.suit);
    for (const boost of matching) {
      multiplier *= boost.mult;
      matches.push(boost);
    }
  }
  return { multiplier, matches };
}

function PlayingCard({ card, compact = false }) {
  if (!card) return <div className={`playing-card placeholder ${compact ? 'compact' : ''}`} />;
  const red = card.suit === '♥' || card.suit === '♦';
  return (
    <div className={`playing-card ${red ? 'red' : ''} ${compact ? 'compact' : ''}`}>
      <div className="rank">{card.rank}</div>
      <div className="suit">{card.suit}</div>
    </div>
  );
}

function BoostCard({ boost, hit }) {
  const red = boost.suit === '♥' || boost.suit === '♦';
  return (
    <div className={`boost-card ${hit ? 'hit' : ''}`}>
      <div className={`boost-face ${red ? 'red' : ''}`}>
        <span>{boost.rank}</span><span>{boost.suit}</span>
      </div>
      <div className="boost-mult">×{boost.mult}</div>
    </div>
  );
}

export default function Home() {
  const [balance, setBalance] = useState(STARTING_CHIPS);
  const [betType, setBetType] = useState('player');
  const [betAmount, setBetAmount] = useState(50000);
  const [boosts, setBoosts] = useState(makeBoosts);
  const [playerCards, setPlayerCards] = useState([]);
  const [bankerCards, setBankerCards] = useState([]);
  const [dealing, setDealing] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const shoeRef = useRef(createShoe());

  useEffect(() => {
    try {
      const savedBalance = localStorage.getItem('velvet-balance-v2');
      const savedHistory = localStorage.getItem('velvet-history-v2');
      if (savedBalance !== null && Number.isFinite(Number(savedBalance))) setBalance(Number(savedBalance));
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem('velvet-balance-v2', String(balance));
  }, [balance, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem('velvet-history-v2', JSON.stringify(history.slice(0, 30)));
  }, [history, hydrated]);

  const playerBoost = useMemo(() => sideBoost(playerCards, boosts), [playerCards, boosts]);
  const bankerBoost = useMemo(() => sideBoost(bankerCards, boosts), [bankerCards, boosts]);
  const hitBoostIds = useMemo(() => new Set([...playerBoost.matches, ...bankerBoost.matches].map((b) => b.id)), [playerBoost, bankerBoost]);

  function drawFromShoe() {
    if (shoeRef.current.length < 60) shoeRef.current = createShoe();
    return shoeRef.current.pop();
  }

  async function runDeal() {
    if (dealing || betAmount <= 0 || betAmount > balance) return;
    setDealing(true);
    setResult(null);
    setPlayerCards([]);
    setBankerCards([]);
    const roundBoosts = makeBoosts();
    setBoosts(roundBoosts);
    setBalance((b) => b - betAmount);

    const p = [];
    const b = [];

    await sleep(300);
    p.push(drawFromShoe()); setPlayerCards([...p]);
    await sleep(DEAL_DELAY);
    b.push(drawFromShoe()); setBankerCards([...b]);
    await sleep(DEAL_DELAY);
    p.push(drawFromShoe()); setPlayerCards([...p]);
    await sleep(DEAL_DELAY);
    b.push(drawFromShoe()); setBankerCards([...b]);
    await sleep(DEAL_DELAY);

    let pTotal = baccaratTotal(p);
    let bTotal = baccaratTotal(b);
    const natural = pTotal >= 8 || bTotal >= 8;
    let playerThird = null;

    if (!natural && pTotal <= 5) {
      playerThird = drawFromShoe();
      p.push(playerThird); setPlayerCards([...p]);
      await sleep(DEAL_DELAY);
      pTotal = baccaratTotal(p);
    }

    if (!natural && shouldBankerDraw(bTotal, playerThird)) {
      b.push(drawFromShoe()); setBankerCards([...b]);
      await sleep(DEAL_DELAY);
      bTotal = baccaratTotal(b);
    }

    let winner = 'tie';
    if (pTotal > bTotal) winner = 'player';
    if (bTotal > pTotal) winner = 'banker';

    const pBoost = sideBoost(p, roundBoosts).multiplier;
    const bBoost = sideBoost(b, roundBoosts).multiplier;
    let returned = 0;
    let profit = 0;
    let outcome = 'lose';
    let appliedMultiplier = 1;

    if (winner === betType) {
      outcome = 'win';
      if (winner === 'player') appliedMultiplier = pBoost;
      else if (winner === 'banker') appliedMultiplier = bBoost;
      else appliedMultiplier = 1;
      profit = betAmount * BETS[betType].baseProfit * appliedMultiplier;
      returned = betAmount + profit;
    } else if (winner === 'tie' && betType !== 'tie') {
      outcome = 'push';
      returned = betAmount;
    }

    if (returned > 0) setBalance((bal) => bal + returned);
    const finalResult = { winner, pTotal, bTotal, outcome, profit, appliedMultiplier, pBoost, bBoost };
    setResult(finalResult);
    setHistory((h) => [{ winner, pTotal, bTotal }, ...h].slice(0, 30));
    setDealing(false);
  }

  function adjustBet(amount) {
    if (dealing) return;
    setBetAmount(Math.min(balance, Math.max(1000, amount)));
  }

  function refill() {
    if (dealing) return;
    setBalance(STARTING_CHIPS);
    setBetAmount(50000);
    setResult(null);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand">VELVET</div>
          <div className="brand-sub">BACCARAT • VIRTUAL TABLE</div>
        </div>
        <div className="balance-box">
          <span>VIRTUAL BALANCE</span>
          <strong>₩{money(balance)}</strong>
        </div>
      </header>

      <section className="table-stage">
        <div className="table-glow" />
        <div className="bonus-panel">
          <div className="bonus-title"><span>BOOST CARDS</span><small>매 판 8장 · 중복 가능 · 같은 카드 적중 시 배율 모두 곱연산</small></div>
          <div className="boost-row">
            {boosts.map((boost) => <BoostCard key={boost.id} boost={boost} hit={hitBoostIds.has(boost.id)} />)}
          </div>
        </div>

        <div className="hands-grid">
          <div className="hand-zone player-zone">
            <div className="side-label player-color">PLAYER</div>
            <div className="score-orb player-orb">{playerCards.length ? baccaratTotal(playerCards) : '—'}</div>
            <div className="card-line">{playerCards.map((c) => <PlayingCard key={c.id} card={c} />)}</div>
            <div className="boost-readout">BOOST ×{playerBoost.multiplier}</div>
          </div>

          <div className="center-mark">VS</div>

          <div className="hand-zone banker-zone">
            <div className="side-label banker-color">BANKER</div>
            <div className="score-orb banker-orb">{bankerCards.length ? baccaratTotal(bankerCards) : '—'}</div>
            <div className="card-line">{bankerCards.map((c) => <PlayingCard key={c.id} card={c} />)}</div>
            <div className="boost-readout">BOOST ×{bankerBoost.multiplier}</div>
          </div>
        </div>

        {result && !dealing && (
          <div className={`result-banner ${result.outcome}`}>
            {result.outcome === 'win' && <><strong>{BETS[result.winner].label} 승리</strong><span>+₩{money(result.profit)} {result.appliedMultiplier > 1 ? `· BOOST ×${result.appliedMultiplier}` : ''}</span></>}
            {result.outcome === 'lose' && <strong>패배</strong>}
            {result.outcome === 'push' && <><strong>무승부</strong><span>베팅금 반환</span></>}
          </div>
        )}
      </section>

      <section className="history-strip">
        <span className="history-label">ROAD</span>
        <div className="history-items">
          {history.length === 0 && <span className="muted">아직 결과 없음</span>}
          {history.map((h, i) => <span key={`${h.winner}-${i}`} className={`road-dot ${h.winner}`}>{h.winner === 'player' ? 'P' : h.winner === 'banker' ? 'B' : 'T'}</span>)}
        </div>
      </section>

      <section className="bet-dock">
        <div className="bet-types">
          {Object.entries(BETS).map(([key, cfg]) => (
            <button key={key} disabled={dealing} className={`bet-type ${key} ${betType === key ? 'active' : ''}`} onClick={() => setBetType(key)}>
              <span>{cfg.label}</span>
              <small>{key === 'player' ? '1 : 1' : key === 'banker' ? '0.95 : 1' : '8 : 1'}</small>
            </button>
          ))}
        </div>

        <div className="bet-controls">
          <button disabled={dealing} className="adjust-btn" onClick={() => adjustBet(Math.floor(betAmount / 2))}>½</button>
          <div className="bet-amount">
            <span>BET</span>
            <strong>₩{money(betAmount)}</strong>
          </div>
          <button disabled={dealing} className="adjust-btn" onClick={() => adjustBet(betAmount * 2)}>×2</button>
        </div>

        <div className="quick-row">
          {QUICK_BETS.map((q) => <button disabled={dealing} key={q} onClick={() => adjustBet(q)}>₩{money(q)}</button>)}
        </div>

        <div className="action-row">
          <button className="refill-btn" disabled={dealing} onClick={refill}>REFILL</button>
          <button className="deal-btn" disabled={dealing || betAmount > balance || balance <= 0} onClick={runDeal}>{dealing ? 'DEALING…' : 'DEAL'}</button>
        </div>
        <div className="legal-note">NO REAL MONEY • NO DEPOSIT • NO WITHDRAWAL • ENTERTAINMENT DEMO ONLY</div>
      </section>
    </main>
  );
}
