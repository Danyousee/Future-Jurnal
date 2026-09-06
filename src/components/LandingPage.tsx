import React from 'react';
import { 
  TrendingUp, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  Zap, 
  Calculator, 
  Flame,
  BarChart3
} from 'lucide-react';
import { NavTabType } from './BottomNav';

interface LandingPageProps {
  onLaunchApp: (targetTab?: NavTabType) => void;
  onOpenCalculator: () => void;
  onOpenJournal: () => void;
  onOpenDashboard: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchApp,
  onOpenCalculator,
}) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased selection:bg-[#1565ff] selection:text-white">
      {/* Top Navigation */}
      <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-40 backdrop-blur-md bg-white/95">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1565ff] text-white flex items-center justify-center font-bold shadow-sm">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-slate-900">
              RiskCalc <span className="text-[#1565ff]">PRO</span>
            </span>
          </div>

          <button
            type="button"
            id="nav-get-started-btn"
            onClick={() => onLaunchApp('calculator')}
            className="px-4 sm:px-5 py-2 sm:py-2.5 bg-[#1565ff] hover:bg-blue-700 active:scale-95 text-white text-sm font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col justify-center">
        {/* Hero Section */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-10 text-center">
          {/* Minimal Tag */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-[#1565ff] text-xs font-semibold mb-6">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Crypto Futures & Prop Risk Management</span>
          </div>

          {/* Simple Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.15] mb-4">
            Trade with Math, <br className="hidden sm:inline" />
            <span className="text-[#1565ff]">Not Emotion.</span>
          </h1>

          {/* Short Subtitle */}
          <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto mb-8 font-normal leading-relaxed">
            Calculate exact position sizes from your stop loss, protect your margin from liquidation, and keep your capital intact.
          </p>

          {/* Big Get Started Button */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              id="hero-get-started-btn"
              onClick={() => onLaunchApp('calculator')}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#1565ff] hover:bg-blue-700 active:scale-95 text-white text-base font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-6 mt-6 text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Free to use</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>100% Client-Side</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Offline Ready</span>
            </div>
          </div>
        </section>

        {/* Live Calculation Preview Card */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-12 w-full">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Live Sizing Preview • BTC/USDT
                </span>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-[#1565ff]">
                1.0% Risk Limit
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">Account Balance</span>
                <span className="text-base sm:text-lg font-bold text-slate-900 font-mono">$10,000</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">Max Risk (1%)</span>
                <span className="text-base sm:text-lg font-bold text-rose-600 font-mono">-$100.00</span>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100">
                <span className="text-[11px] font-semibold text-blue-700 block mb-1">Position Size</span>
                <span className="text-base sm:text-lg font-black text-[#1565ff] font-mono">0.77 BTC</span>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
                <span className="text-[11px] font-semibold text-emerald-700 block mb-1">Liq Safety</span>
                <span className="text-base sm:text-lg font-bold text-emerald-700 font-mono">+7.8% Safe</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Formula: <code className="text-slate-700 font-mono bg-slate-100 px-1 py-0.5 rounded">Risk $ ÷ Price Distance</code></span>
              <button 
                type="button"
                id="preview-open-calc-btn"
                onClick={onOpenCalculator}
                className="text-[#1565ff] font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Open in Calculator</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </section>

        {/* 3 Core Highlights (Simple & Clean) */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-16 w-full">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1565ff] flex items-center justify-center mb-3">
                <Calculator className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Instant Position Sizing</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Compute exact contracts and leverage based on stop loss distance and fees.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Liquidation Shield</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Pre-trade liquidation warnings and required margin check before entering.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200">
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
                <Flame className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Discipline Kill-Switch</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Automated daily loss and consecutive streak breakers to eliminate revenge trading.
              </p>
            </div>
          </div>
        </section>

        {/* Simple Bottom CTA Banner */}
        <section className="bg-white border-t border-slate-200 py-10">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">
              Ready to take control of your risk?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mb-5">
              No sign-up required. Start sizing trades accurately right away.
            </p>
            <button
              type="button"
              id="cta-get-started-btn"
              onClick={() => onLaunchApp('calculator')}
              className="px-7 py-3 bg-[#1565ff] hover:bg-blue-700 active:scale-95 text-white text-sm font-bold rounded-xl shadow-xs transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full bg-slate-50 border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto px-4">
          <p className="font-semibold text-slate-700 mb-1">RiskCalc PRO</p>
          <p className="text-[11px] text-slate-500">
            For risk management and educational purposes. Always trade responsibly.
          </p>
        </div>
      </footer>
    </div>
  );
};
