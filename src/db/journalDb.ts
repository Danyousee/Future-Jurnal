import Dexie, { Table } from 'dexie';
import { 
  TradeJournalEntry, 
  CalculatorState, 
  TradingPlan, 
  BacktestSession, 
  BacktestTrade,
  OpenPosition 
} from '../types';
import { normalizeJournalTrade, normalizeOpenPosition, normalizeCalculatorState } from '../utils/risk/normalization';

export const DEFAULT_TRADING_PLAN: TradingPlan = {
  startingCapital: 10000,
  defaultRiskPerTrade: 1.0,
  riskPerTradePct: 1.0,
  maxRiskPerTrade: 2.0,
  maxRiskPerTradePct: 2.0,
  maxDailyLossPercent: 3.0,
  maxDailyLossPct: 3.0,
  maxDailyLossAmount: 300,
  maxWeeklyLossPercent: 6.0,
  maxWeeklyLossAmount: 600,
  maxTradesPerDay: 5,
  maxConsecutiveLosses: 3,
  minRiskRewardRatio: 1.5,
  maxLeverage: 20,
  preferredCryptos: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'SUIUSDT'],
  allowedSetups: [
    'Breakout',
    'Support / Resistance',
    'Liquidity Sweep',
    'Trend Following',
    'Mean Reversion',
    'Market Structure Shift (MSS)',
    'Order Block Retest',
    'Fair Value Gap (FVG)',
    'Range Deviation / Fakeout',
    'Funding Arbitrage / Mean Reversion'
  ],
  requireConfirmation: true,
  requireStopLoss: true,
  requireTakeProfit: true,
  killSwitchActive: false,
  lastResetDate: new Date().toISOString().split('T')[0],
};

export class TradingJournalDatabase extends Dexie {
  trades!: Table<TradeJournalEntry, number>;
  openPositions!: Table<OpenPosition, number>;
  settings!: Table<{ key: string; value: any }, string>;
  backtestSessions!: Table<BacktestSession, string>;
  backtestTrades!: Table<BacktestTrade, number>;

  constructor() {
    super('TradingJournalDB');
    this.version(3).stores({
      trades: '++id, date, pair, exchange, direction, isWin, favorite, strategy, timeframe, createdAt, leverage',
      openPositions: '++id, pair, direction, createdAt, correlationGroup',
      settings: 'key',
      backtestSessions: 'id, name, strategy, cryptoPair, createdAt',
      backtestTrades: '++id, sessionId, date, pair, direction, isWin',
    });
  }
}

export const db = new TradingJournalDatabase();

export async function loadOpenPositions(): Promise<OpenPosition[]> {
  try {
    const raw = await db.openPositions.toArray();
    return raw.map(normalizeOpenPosition);
  } catch (err) {
    console.warn('Error loading open positions:', err);
    return [];
  }
}

export async function loadJournalTrades(): Promise<TradeJournalEntry[]> {
  try {
    const raw = await db.trades.toArray();
    return raw.map(normalizeJournalTrade);
  } catch (err) {
    console.warn('Error loading journal trades:', err);
    return [];
  }
}

export async function saveOpenPosition(
  pos: Omit<OpenPosition, 'id'>, 
  idToUpdate?: number
): Promise<number> {
  if (idToUpdate) {
    await db.openPositions.update(idToUpdate, pos);
    return idToUpdate;
  } else {
    return await db.openPositions.add(pos as OpenPosition);
  }
}

export async function deleteOpenPosition(id: number): Promise<void> {
  await db.openPositions.delete(id);
}

export async function clearAllOpenPositions(): Promise<void> {
  await db.openPositions.clear();
}

export async function initializeDatabase(): Promise<void> {
  try {
    // 1. One-time new user preparation check: purge any legacy sample data
    const hasInitializedClean = localStorage.getItem('riskcalc_new_user_ready_v1');
    if (!hasInitializedClean) {
      await db.trades.clear();
      await db.openPositions.clear();
      await db.backtestTrades.clear();
      await db.backtestSessions.clear();
      localStorage.setItem('riskcalc_new_user_ready_v1', 'true');
    }

    // 2. Extra safety: detect and purge any remaining sample data matching demo signatures
    const existingTrades = await db.trades.toArray();
    const sampleTradeIds = existingTrades
      .filter((t) => 
        (t.entryReason && t.entryReason.includes('Clean 4H close above weekly consolidation')) ||
        (t.notes && t.notes.includes('Executed with strict adherence to 1% risk rule.')) ||
        (t.notes && t.notes.includes('Do not short high beta assets when BTC')) ||
        (t.setup === '4H Range Breakout' && t.pair === 'BTCUSDT' && t.entryPrice === 62450) ||
        (t.date === '2026-08-14' && t.pair === 'BTC/USDT' && t.entryPrice === 61200)
      )
      .map((t) => t.id)
      .filter((id): id is number => typeof id === 'number');

    if (sampleTradeIds.length > 0) {
      await db.trades.bulkDelete(sampleTradeIds);
    }

    const existingPositions = await db.openPositions.toArray();
    const samplePositionIds = existingPositions
      .filter((p) => 
        (p.notes && p.notes.includes('Active 4H continuation swing.')) ||
        (p.notes && p.notes.includes('Holding through retest of 15m breakout level.')) ||
        (p.pair === 'BTCUSDT' && p.entryPrice === 62800 && p.stopLoss === 62100) ||
        (p.pair === 'SOLUSDT' && p.entryPrice === 145.20 && p.stopLoss === 142.80)
      )
      .map((p) => p.id)
      .filter((id): id is number => typeof id === 'number');

    if (samplePositionIds.length > 0) {
      await db.openPositions.bulkDelete(samplePositionIds);
    }

    // 3. Clean legacy sample calculator settings
    const calcRecord = await db.settings.get('calculatorSettings');
    if (calcRecord && calcRecord.value && (calcRecord.value.entryPrice === 62500 || calcRecord.value.entryPrice === 61200)) {
      await db.settings.delete('calculatorSettings');
      localStorage.removeItem('riskcalc_calculator_settings');
    }

    // 4. Initialize Trading Plan if not set
    const planRecord = await db.settings.get('tradingPlan');
    if (!planRecord) {
      await db.settings.put({ key: 'tradingPlan', value: DEFAULT_TRADING_PLAN });
    }

    // 5. Safe 3-Mode Schema Migration for Existing Trades
    const allStoredTrades = await db.trades.toArray();
    const migratedTrades: TradeJournalEntry[] = [];
    for (const trade of allStoredTrades) {
      let needsUpdate = false;
      const t = { ...trade };

      const rawMode = ((t.tradeMode as string) || '').toUpperCase();
      const hasDexSignals = rawMode === 'DEX' || Boolean(t.dexChain || t.dexProtocol || t.dexGasFee || t.dex || (t.spotVenue && String(t.spotVenue).toUpperCase() === 'DEX'));
      const hasForexSignals = rawMode === 'FOREX' || Boolean(t.lotSize || t.pipsRisk || t.pipsGain || (t.pair && t.pair.includes('/')));
      const hasSpotSignals = rawMode === 'SPOT' || t.leverage === 1;

      if (hasDexSignals) {
        if (t.tradeMode !== 'SPOT' || t.spotVenue !== 'DEX') {
          t.tradeMode = 'SPOT';
          t.spotVenue = 'DEX';
          needsUpdate = true;
        }
      } else if (hasForexSignals) {
        if (t.tradeMode !== 'FOREX') {
          t.tradeMode = 'FOREX';
          needsUpdate = true;
        }
      } else if (hasSpotSignals) {
        if (t.tradeMode !== 'SPOT') {
          t.tradeMode = 'SPOT';
          t.spotVenue = t.spotVenue || 'CEX';
          needsUpdate = true;
        }
      } else {
        // Default historical futures trades to PERPETUAL
        if (t.tradeMode !== 'PERPETUAL') {
          t.tradeMode = 'PERPETUAL';
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        migratedTrades.push(t);
      }
    }

    if (migratedTrades.length > 0) {
      await db.trades.bulkPut(migratedTrades);
    }

    // 6. Safe 3-Mode Schema Migration for Existing Open Positions
    const allStoredPositions = await db.openPositions.toArray();
    const migratedPositions: OpenPosition[] = [];
    for (const pos of allStoredPositions) {
      let needsUpdate = false;
      const p = { ...pos };

      const rawMode = ((p.tradeMode as string) || '').toUpperCase();
      const hasDexSignals = rawMode === 'DEX' || Boolean(p.dexProtocol || p.dexGasFee || (p.spotVenue && String(p.spotVenue).toUpperCase() === 'DEX'));
      const hasForexSignals = rawMode === 'FOREX' || Boolean(p.lotSize || p.pipSize || p.pipValue);
      const hasSpotSignals = rawMode === 'SPOT' || p.leverage === 1;

      if (hasDexSignals) {
        if (p.tradeMode !== 'SPOT' || p.spotVenue !== 'DEX') {
          p.tradeMode = 'SPOT';
          p.spotVenue = 'DEX';
          needsUpdate = true;
        }
      } else if (hasForexSignals) {
        if (p.tradeMode !== 'FOREX') {
          p.tradeMode = 'FOREX';
          needsUpdate = true;
        }
      } else if (hasSpotSignals) {
        if (p.tradeMode !== 'SPOT') {
          p.tradeMode = 'SPOT';
          p.spotVenue = p.spotVenue || 'CEX';
          needsUpdate = true;
        }
      } else {
        if (p.tradeMode !== 'PERPETUAL') {
          p.tradeMode = 'PERPETUAL';
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        migratedPositions.push(p);
      }
    }

    if (migratedPositions.length > 0) {
      await db.openPositions.bulkPut(migratedPositions);
    }
  } catch (error) {
    console.warn('IndexedDB initialization notice:', error);
  }
}

export async function saveCalculatorSettings(state: CalculatorState): Promise<void> {
  try {
    await db.settings.put({ key: 'calculatorSettings', value: state });
  } catch (e) {
    localStorage.setItem('riskcalc_calculator_settings', JSON.stringify(state));
  }
}

export async function loadCalculatorSettings(): Promise<CalculatorState | null> {
  try {
    const record = await db.settings.get('calculatorSettings');
    if (record && record.value) return normalizeCalculatorState(record.value);
  } catch (e) {
    // fallback
  }
  const local = localStorage.getItem('riskcalc_calculator_settings');
  if (local) {
    try {
      const parsed = JSON.parse(local);
      return parsed ? normalizeCalculatorState(parsed) : null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function saveTradingPlan(plan: TradingPlan): Promise<void> {
  try {
    await db.settings.put({ key: 'tradingPlan', value: plan });
  } catch (e) {
    localStorage.setItem('riskcalc_trading_plan', JSON.stringify(plan));
  }
}

export async function loadTradingPlan(): Promise<TradingPlan> {
  try {
    const record = await db.settings.get('tradingPlan');
    if (record && record.value) {
      return { ...DEFAULT_TRADING_PLAN, ...record.value };
    }
  } catch (e) {
    // fallback
  }
  const local = localStorage.getItem('riskcalc_trading_plan');
  if (local) {
    try {
      return { ...DEFAULT_TRADING_PLAN, ...JSON.parse(local) };
    } catch {
      return DEFAULT_TRADING_PLAN;
    }
  }
  return DEFAULT_TRADING_PLAN;
}

/**
 * Rename a tag across all journal trades in IndexedDB.
 */
export async function renameTagInDb(oldTag: string, newTag: string): Promise<number> {
  const cleanOld = oldTag.trim();
  const cleanNew = newTag.trim();
  if (!cleanOld || !cleanNew || cleanOld === cleanNew) return 0;

  const allTrades = await db.trades.toArray();
  const tradesToUpdate: TradeJournalEntry[] = [];

  for (const trade of allTrades) {
    if (Array.isArray(trade.tags) && trade.tags.length > 0) {
      const matchIndex = trade.tags.findIndex((t) => t.toLowerCase() === cleanOld.toLowerCase());
      if (matchIndex !== -1) {
        const updatedTags = Array.from(
          new Set(
            trade.tags.map((t) => (t.toLowerCase() === cleanOld.toLowerCase() ? cleanNew : t.trim()))
          )
        ).filter(Boolean);

        tradesToUpdate.push({
          ...trade,
          tags: updatedTags,
        });
      }
    }
  }

  if (tradesToUpdate.length > 0) {
    await db.trades.bulkPut(tradesToUpdate);
  }

  return tradesToUpdate.length;
}

/**
 * Delete a tag from all trades in IndexedDB.
 */
export async function deleteTagFromDb(tagToDelete: string): Promise<number> {
  const cleanTag = tagToDelete.trim().toLowerCase();
  if (!cleanTag) return 0;

  const allTrades = await db.trades.toArray();
  const tradesToUpdate: TradeJournalEntry[] = [];

  for (const trade of allTrades) {
    if (Array.isArray(trade.tags) && trade.tags.length > 0) {
      const hasTag = trade.tags.some((t) => t.toLowerCase() === cleanTag);
      if (hasTag) {
        const updatedTags = trade.tags.filter((t) => t.toLowerCase() !== cleanTag);
        tradesToUpdate.push({
          ...trade,
          tags: updatedTags,
        });
      }
    }
  }

  if (tradesToUpdate.length > 0) {
    await db.trades.bulkPut(tradesToUpdate);
  }

  return tradesToUpdate.length;
}

export async function mergeTagsInDb(sourceTags: string[], targetTag: string): Promise<number> {
  const cleanTarget = targetTag.trim();

  const lowerSources = sourceTags.map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!cleanTarget || lowerSources.length === 0) return 0;

  const allTrades = await db.trades.toArray();
  const tradesToUpdate: TradeJournalEntry[] = [];

  for (const trade of allTrades) {
    if (Array.isArray(trade.tags) && trade.tags.length > 0) {
      let matched = false;
      const updatedList: string[] = [];

      for (const t of trade.tags) {
        if (lowerSources.includes(t.toLowerCase())) {
          matched = true;
          updatedList.push(cleanTarget);
        } else {
          updatedList.push(t);
        }
      }

      if (matched) {
        const deduplicated = Array.from(new Set(updatedList)).filter(Boolean);
        tradesToUpdate.push({
          ...trade,
          tags: deduplicated,
        });
      }
    }
  }

  if (tradesToUpdate.length > 0) {
    await db.trades.bulkPut(tradesToUpdate);
  }

  return tradesToUpdate.length;
}
