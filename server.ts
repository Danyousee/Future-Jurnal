import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Server-side market data caching
interface ServerCachedPrice {
  price: number;
  timestamp: number;
  source: string;
  high24h?: number;
  low24h?: number;
  change24h?: number;
}
const serverPriceCache = new Map<string, ServerCachedPrice>();
const SERVER_CACHE_TTL_MS = 3000; // 3-second cache to prevent upstream rate limits

// Helpers for Server-Side Market Data
async function fetchBinanceSpot(symbol: string): Promise<ServerCachedPrice | null> {
  const clean = symbol.replace(/[\/\-_]/g, '').toUpperCase().trim();
  const cacheKey = `SPOT:CEX:${clean}`;
  const cached = serverPriceCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < SERVER_CACHE_TTL_MS)) {
    return cached;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${clean}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (!resp.ok) return null;
    const data = await resp.json();
    const price = parseFloat(data.price);
    if (isNaN(price) || !isFinite(price) || price <= 0) return null;

    const entry: ServerCachedPrice = {
      price,
      timestamp: Date.now(),
      source: 'Binance Spot',
    };
    serverPriceCache.set(cacheKey, entry);
    return entry;
  } catch {
    return null;
  }
}

async function fetchBinanceFutures(symbol: string): Promise<ServerCachedPrice | null> {
  const clean = symbol.replace(/[\/\-_]/g, '').toUpperCase().trim();
  const cacheKey = `PERPETUAL:${clean}`;
  const cached = serverPriceCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < SERVER_CACHE_TTL_MS)) {
    return cached;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${clean}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (!resp.ok) return null;
    const data = await resp.json();
    const price = parseFloat(data.price);
    if (isNaN(price) || !isFinite(price) || price <= 0) return null;

    const entry: ServerCachedPrice = {
      price,
      timestamp: Date.now(),
      source: 'Binance Futures',
    };
    serverPriceCache.set(cacheKey, entry);
    return entry;
  } catch {
    return null;
  }
}

async function fetchForexRate(symbol: string): Promise<ServerCachedPrice | null> {
  const clean = symbol.replace(/[\/\-_]/g, '').toUpperCase().trim();
  let base = '';
  let quote = '';

  if (symbol.includes('/')) {
    const parts = symbol.split('/');
    base = parts[0].trim().toUpperCase();
    quote = parts[1].trim().toUpperCase();
  } else if (clean.length === 6) {
    base = clean.slice(0, 3);
    quote = clean.slice(3, 6);
  } else {
    return null;
  }

  const cacheKey = `FOREX:${base}${quote}`;
  const cached = serverPriceCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < SERVER_CACHE_TTL_MS * 5)) {
    return cached;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(`https://api.frankfurter.app/latest?from=${base}&to=${quote}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (!resp.ok) return null;
    const data = await resp.json();
    const rate = data?.rates?.[quote];
    if (typeof rate === 'number' && !isNaN(rate) && isFinite(rate) && rate > 0) {
      const entry: ServerCachedPrice = {
        price: rate,
        timestamp: Date.now(),
        source: 'ECB Reference Rate',
      };
      serverPriceCache.set(cacheKey, entry);
      return entry;
    }
    return null;
  } catch {
    return null;
  }
}

// Market Data Proxy: Single Price
app.get('/api/market-data/price', async (req, res) => {
  try {
    const rawSymbol = String(req.query.symbol || '').trim();
    const mode = String(req.query.mode || 'SPOT').toUpperCase();
    const venue = String(req.query.venue || 'CEX').toUpperCase();

    if (!rawSymbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    // Handle DEX venue
    if (venue === 'DEX') {
      return res.json({
        symbol: rawSymbol,
        price: null,
        isLive: false,
        source: 'Live DEX Price Unavailable',
        status: 'UNAVAILABLE',
        message: 'Live DEX Price Unavailable',
      });
    }

    // Handle Forex
    if (mode === 'FOREX') {
      const forex = await fetchForexRate(rawSymbol);
      if (forex) {
        return res.json({
          symbol: rawSymbol,
          price: forex.price,
          timestamp: forex.timestamp,
          source: 'ECB Reference Rate',
          isLive: false,
          status: 'REFERENCE',
        });
      }
      return res.json({
        symbol: rawSymbol,
        price: null,
        isLive: false,
        source: 'ECB Reference Rate',
        status: 'UNAVAILABLE',
        message: 'Forex Reference Rate Unavailable',
      });
    }

    // Handle Perpetual / Futures (Strict: never fall back to Spot)
    if (mode === 'PERPETUAL' || mode === 'FUTURES') {
      const perp = await fetchBinanceFutures(rawSymbol);
      if (perp) {
        return res.json({
          symbol: rawSymbol,
          price: perp.price,
          timestamp: perp.timestamp,
          source: 'Binance Futures',
          isLive: true,
          status: 'LIVE',
        });
      }
      return res.json({
        symbol: rawSymbol,
        price: null,
        isLive: false,
        source: 'Binance Futures',
        status: 'UNAVAILABLE',
        message: 'Binance Futures Price Unavailable',
      });
    }

    // Handle Spot
    const spot = await fetchBinanceSpot(rawSymbol);
    if (spot) {
      return res.json({
        symbol: rawSymbol,
        price: spot.price,
        timestamp: spot.timestamp,
        source: 'Binance Spot',
        isLive: true,
        status: 'LIVE',
      });
    }

    // Could not fetch live price
    return res.json({
      symbol: rawSymbol,
      price: null,
      isLive: false,
      source: 'Binance Spot',
      status: 'UNAVAILABLE',
      message: 'Live Price Unavailable',
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Failed to fetch market price' });
  }
});

// Market Data Proxy: Batch Prices
app.post('/api/market-data/prices', async (req, res) => {
  try {
    const { symbols, mode = 'SPOT', venue = 'CEX' } = req.body;
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.json({});
    }

    if (venue === 'DEX') {
      return res.json({});
    }

    const isPerp = mode === 'PERPETUAL' || mode === 'FUTURES';
    const isForex = mode === 'FOREX';
    const results: Record<string, any> = {};

    if (isForex) {
      await Promise.all(
        symbols.map(async (s: string) => {
          const fx = await fetchForexRate(s);
          if (fx) {
            results[s] = {
              ...fx,
              isLive: false,
              status: 'REFERENCE',
              source: 'ECB Reference Rate'
            };
          }
        })
      );
      return res.json(results);
    }

    // For crypto, fetch strictly based on mode
    await Promise.all(
      symbols.map(async (s: string) => {
        const price = isPerp ? await fetchBinanceFutures(s) : await fetchBinanceSpot(s);
        if (price) {
          results[s] = {
            ...price,
            isLive: true,
            status: 'LIVE',
            source: isPerp ? 'Binance Futures' : 'Binance Spot'
          };
        }
      })
    );

    return res.json(results);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Failed to batch fetch market prices' });
  }
});

// AI Trading Coach Endpoint
app.post('/api/ai-coach', async (req, res) => {
  try {
    const { trades, startingBalance, plan, prompt } = req.body;

    if (!trades || !Array.isArray(trades)) {
      return res.status(400).json({ error: 'Trades array is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Fallback message indicating API key not set, client will use algorithmic coach
      return res.status(200).json({
        fallback: true,
        message: 'No GEMINI_API_KEY detected. Using institutional algorithmic risk engine.',
      });
    }

    // Format trade summary for Gemini
    const tradeSummary = trades.slice(-50).map((t: any, i: number) => ({
      index: i + 1,
      date: t.date,
      pair: t.pair,
      direction: t.direction,
      leverage: `${t.leverage}x`,
      entry: t.entryPrice,
      exit: t.exitPrice,
      stopLoss: t.stopLoss,
      takeProfit: t.takeProfit,
      pnl: t.pnl,
      pnlPct: t.pnlPercentage,
      rMultiple: t.rMultiple,
      setup: t.setup || t.strategy,
      isWin: t.isWin,
      planCompliance: t.planCompliance !== false,
      emotionBefore: t.emotionBefore,
      emotionAfter: t.emotionAfter,
      reviewNotes: t.notes || t.mistakesMade || t.entryReason,
    }));

    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = `You are a world-class institutional Crypto Perpetual Futures Trading Coach and Quantitative Risk Officer.
Your objective is to analyze the trader's historical crypto perpetual trades (BTCUSDT, ETHUSDT, SOLUSDT, altcoins) and provide ruthlessly objective, highly actionable, and mathematically grounded risk management feedback.

Rules:
1. FOCUS EXCLUSIVELY on Crypto Perpetual Futures (Long/Short, Leverage, Margin, Liquidation risk, Funding, R:R).
2. NEVER mention Forex, Stocks, London/Asian/NY sessions, or traditional economic calendars.
3. Be direct, professional, encouraging yet disciplined.
4. Analyze:
   - Most profitable vs least profitable cryptocurrency pairs
   - Best vs worst setups
   - Long vs Short asymmetry
   - Leverage discipline (flag any trades >20x or revenge sizing)
   - Stop-Loss consistency and plan compliance
   - Overtrading and tilt patterns
5. Always provide a concrete 3-step action plan to protect capital and expand expectancy.
6. Provide output in clear JSON format with keys:
   - executiveSummary (string)
   - strengths (array of strings)
   - criticalRisks (array of strings)
   - bestPerformingCrypto (object: { pair, winRate, avgR, pnl, insight })
   - worstPerformingCrypto (object: { pair, winRate, avgR, pnl, insight })
   - bestStrategy (object: { name, winRate, avgR, pnl })
   - worstStrategy (object: { name, winRate, avgR, pnl })
   - longVsShortInsight (string)
   - leverageDisciplineInsight (string)
   - stopLossDisciplineInsight (string)
   - revengeTradingDetected (boolean)
   - revengeTradingInsight (string or null)
   - overtradingDetected (boolean)
   - overtradingInsight (string or null)
   - actionPlan (array of strings)
`;

    const userMessage = `Here is the trader's starting balance: $${startingBalance || 10000}
Trading Plan Rules: Max Risk: ${plan?.maxRiskPerTrade || 2}%, Max Daily Loss: $${plan?.maxDailyLossAmount || 300}, Max Leverage: ${plan?.maxLeverage || 20}x.

Trader's Recent 50 Crypto Perpetual Trades:
${JSON.stringify(tradeSummary, null, 2)}

${prompt ? `Specific Trader Question: "${prompt}"` : 'Please perform a full risk & behavioral audit.'}
Respond ONLY in valid JSON conforming to the requested schema.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userMessage,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '';
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      // Return raw text if JSON parse fails
      parsedData = { executiveSummary: responseText, strengths: [], criticalRisks: [], actionPlan: [] };
    }

    return res.json({
      success: true,
      report: {
        ...parsedData,
        generatedAt: new Date().toISOString(),
        isAiGenerated: true,
      },
    });
  } catch (error: any) {
    console.error('Error generating AI Coach response:', error);
    return res.status(500).json({ error: error.message || 'AI generation failed' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Crypto Risk & Journal Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
