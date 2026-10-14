'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const STARTING_CHIPS = 1_000_000;
const DEAL_DELAY = 1100;
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = [
  ['A', 1], ['2', 2], ['3', 3], ['4', 4], ['5', 5], ['6', 6], ['7', 7],
  ['8', 8], ['9', 9], ['10', 0], ['J', 0], ['Q', 0], ['K', 0],
];
const BETS = {
  playerPair: { label: '플레이어 페어', odds: '10:1', baseProfit: 10 },
  player: { label: '플레이어', odds: '1:1', baseProfit: 1 },
  tie: { label: '무', odds: '5:1', baseProfit: 5 },
  banker: { label: '뱅커', odds: '1:1', baseProfit: 1 },
  bankerPair: { label: '뱅커 페어', odds: '10:1', baseProfit: 10 },
};
const BOOST_MULTIPLIERS = [2, 2, 2, 2, 3, 3, 4, 5, 8, 10];
const CHIP_OPTIONS = [
  { value: 1000, label: '1000', cls: 'chip-bronze' },
  { value: 2000, label: '2000', cls: 'chip-black' },
  { value: 4000, label: '4000', cls: 'chip-purple' },
  { value: 10000, label: '10k', cls: 'chip-red' },
  { value: 50000, label: '50k', cls: 'chip-green' },
  { value: 200000, label: '200k', cls: 'chip-charcoal' },
];
const BIG_ROAD_ROWS = 6;
const BIG_ROAD_MIN_COLUMNS = 22;

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

function buildBigRoad(rounds, rowCount = BIG_ROAD_ROWS) {
  const columns = [];
  let currentColumn = 0;
  let currentRow = 0;
  let previousWinner = null;
  const place = (col, row, winner) => {
    while (!columns[col]) columns[col] = Array(rowCount).fill(null);
    columns[col][row] = { winner };
  };

  for (const round of rounds) {
    const winner = round?.winner;
    if (!winner) continue;
    if (previousWinner === null) {
      place(0, 0, winner);
      previousWinner = winner;
      continue;
    }
    if (winner === previousWinner) {
      const canGoDown = currentRow + 1 < rowCount && !columns[currentColumn]?.[currentRow + 1];
      if (canGoDown) currentRow += 1;
      else currentColumn += 1;
      place(currentColumn, currentRow, winner);
    } else {
      currentColumn += 1;
      currentRow = 0;
      place(currentColumn, currentRow, winner);
      previousWinner = winner;
    }
  }
  return columns;
}

function PlayingCard({ card }) {
  if (!card) return <div className="playing-card placeholder" />;
  const red = card.suit === '♥' || card.suit === '♦';
  return (
    <div className={`playing-card ${red ? 'red' : ''}`}>
      <div className="rank">{card.rank}</div>
      <div className="suit">{card.suit}</div>
      <div className="mini-rank">{card.rank}</div>
      <div className="mini-suit">{card.suit}</div>
    </div>
  );
}

function BoostCard({ boost, hit }) {
  const red = boost.suit === '♥' || boost.suit === '♦';
  return (
    <div className={`boost-card ${hit ? 'hit' : ''}`}>
      <div className="boost-top">{boost.mult}x</div>
      <div className={`boost-face ${red ? 'red' : ''}`}>
        <span>{boost.rank}</span><span>{boost.suit}</span>
      </div>
    </div>
  );
}

function BigRoad({ history }) {
  const chronological = useMemo(() => [...history].reverse(), [history]);
  const columns = useMemo(() => buildBigRoad(chronological), [chronological]);
  const totalColumns = Math.max(BIG_ROAD_MIN_COLUMNS, columns.length + 2);
  return (
    <div className="road-area">
      <div className="road-meta">
        <span># {history.length}</span>
        <span className="player">P {history.filter((h) => h.winner === 'player').length}</span>
        <span className="banker">B {history.filter((h) => h.winner === 'banker').length}</span>
        <span className="tie">T {history.filter((h) => h.winner === 'tie').length}</span>
      </div>
      <div className="road-scroll">
        <div className="road-board">
          {Array.from({ length: totalColumns }).map((_, colIdx) => (
            <div className="road-column" key={colIdx}>
              {Array.from({ length: BIG_ROAD_ROWS }).map((__, rowIdx) => {
                const cell = columns[colIdx]?.[rowIdx];
                return (
                  <div className="road-cell" key={`${colIdx}-${rowIdx}`}>
                    {cell && <span className={`road-ball ${cell.winner}`}></span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
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
      const savedBalance = localStorage.getItem('velvet-balance-v3');
      const savedHistory = localStorage.getItem('velvet-history-v3');
      if (savedBalance !== null && Number.isFinite(Number(savedBalance))) setBalance(Number(savedBalance));
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem('velvet-balance-v3', String(balance));
  }, [balance, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem('velvet-history-v3', JSON.stringify(history.slice(0, 180)));
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
    await sleep(250);
    p.push(drawFromShoe()); setPlayerCards([...p]);
    await sleep(DEAL_DELAY);
    b.push(drawFromShoe()); setBankerCards([...b]);
    await sleep(DEAL_DELAY);
    p.push(drawFromShoe()); setPlayerCards([...p]);
    await sleep(DEAL_DELAY);
    b.push(drawFromShoe()); setBankerCards([...b]);
    await sleep(DEAL_DELAY);

    const playerPair = p[0]?.rank === p[1]?.rank;
    const bankerPair = b[0]?.rank === b[1]?.rank;

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
    let outcome = 'lose';
    let profit = 0;
    let returned = 0;
    let appliedMultiplier = 1;

    const pairWin = betType === 'playerPair' ? playerPair : betType === 'bankerPair' ? bankerPair : false;

    if (betType === 'playerPair' || betType === 'bankerPair') {
      if (pairWin) {
        outcome = 'win';
        profit = betAmount * BETS[betType].baseProfit;
        returned = betAmount + profit;
      }
    } else if (winner === betType) {
      outcome = 'win';
      if (winner === 'player') appliedMultiplier = pBoost;
      else if (winner === 'banker') appliedMultiplier = bBoost;
      profit = betAmount * BETS[betType].baseProfit * appliedMultiplier;
      returned = betAmount + profit;
    } else if (winner === 'tie' && (betType === 'player' || betType === 'banker')) {
      outcome = 'push';
      returned = betAmount;
    }

    if (returned > 0) setBalance((bal) => bal + returned);
    setResult({ winner, pTotal, bTotal, outcome, profit, appliedMultiplier, pBoost, bBoost, playerPair, bankerPair, betType });
    setHistory((h) => [{ winner, pTotal, bTotal, playerPair, bankerPair }, ...h].slice(0, 180));
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
    <main className="casino-shell">
      <header className="hud">
        <div className="hud-left">
          <button className="round-icon">×</button>
          <div><strong>VELVET LIVE BACCARAT</strong><span>가상머니 테이블</span></div>
        </div>
        <div className="hud-right"><span>●</span><span>◉</span><span>◌</span><span>⚙</span><span>?</span></div>
      </header>

      <section className="felt-table">
        <div className="top-pointer">▼</div>
        <div className="boost-headline">BOOST ROUND</div>

        <div className="table-side player-side">
          <div className="side-name">PLAYER</div>
          <div className="cards-row">{playerCards.map((c) => <PlayingCard key={c.id} card={c} />)}</div>
          <div className="total-bracket">{playerCards.length ? baccaratTotal(playerCards) : '–'}</div>
        </div>

        <div className="table-side banker-side">
          <div className="side-name">BANKER</div>
          <div className="cards-row">{bankerCards.map((c) => <PlayingCard key={c.id} card={c} />)}</div>
          <div className="total-bracket">{bankerCards.length ? baccaratTotal(bankerCards) : '–'}</div>
        </div>

        {result && !dealing && (
          <div className={`result-float ${result.outcome}`}>
            {result.outcome === 'win' && <><b>{BETS[result.betType].label} 적중</b><span>+₩{money(result.profit)}{result.appliedMultiplier > 1 ? ` · ${result.appliedMultiplier}x` : ''}</span></>}
            {result.outcome === 'lose' && <b>패배</b>}
            {result.outcome === 'push' && <><b>무승부</b><span>베팅금 반환</span></>}
          </div>
        )}
      </section>

      <section className="lower-console">
        <div className="boost-strip">
          {boosts.map((boost) => <BoostCard key={boost.id} boost={boost} hit={hitBoostIds.has(boost.id)} />)}
        </div>

        <div className="bet-zone">
          <button className={`pair-bet player-pair ${betType === 'playerPair' ? 'active' : ''}`} onClick={() => setBetType('playerPair')} disabled={dealing}>
            <span>플레이어 페어</span><small>10:1</small>
          </button>
          <button className={`main-bet player ${betType === 'player' ? 'active' : ''}`} onClick={() => setBetType('player')} disabled={dealing}>
            <span>플레이어</span><small>1:1</small>
          </button>
          <button className={`main-bet tie ${betType === 'tie' ? 'active' : ''}`} onClick={() => setBetType('tie')} disabled={dealing}>
            <span>무</span><small>5:1</small>
          </button>
          <button className={`main-bet banker ${betType === 'banker' ? 'active' : ''}`} onClick={() => setBetType('banker')} disabled={dealing}>
            <span>뱅커</span><small>1:1</small>
          </button>
          <button className={`pair-bet banker-pair ${betType === 'bankerPair' ? 'active' : ''}`} onClick={() => setBetType('bankerPair')} disabled={dealing}>
            <span>뱅커 페어</span><small>10:1</small>
          </button>
        </div>

        <BigRoad history={history} />

        <div className="bank-panel">
          <div className="balance-card"><span>잔고</span><strong>₩{money(balance)}</strong></div>
          <div className="bet-card"><span>총 베팅금</span><strong>₩{money(betAmount)}</strong></div>
          <div className="chip-rack">
            {CHIP_OPTIONS.map((chip) => (
              <button
                key={chip.value}
                className={`casino-chip ${chip.cls} ${betAmount === chip.value ? 'selected' : ''}`}
                onClick={() => adjustBet(chip.value)}
                disabled={dealing}
                aria-label={`₩${money(chip.value)} 칩`}
              >
                <span className="chip-inner">{chip.label}</span>
              </button>
            ))}
          </div>
          <button className="deal-button" onClick={runDeal} disabled={dealing || betAmount > balance || balance <= 0}>{dealing ? 'DEALING…' : 'DEAL'}</button>
          <button className="refill-button" onClick={refill} disabled={dealing}>REFILL</button>
        </div>
      </section>

      <div className="demo-note">NO REAL MONEY · NO DEPOSIT · NO WITHDRAWAL · ENTERTAINMENT DEMO ONLY</div>
    </main>
  );
}
