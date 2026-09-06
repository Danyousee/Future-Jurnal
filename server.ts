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
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Crypto Risk & Journal Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
