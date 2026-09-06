import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Wrench, 
  Scale, 
  Check, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';
import { PreTradeValidationResult, CalculatorState, CalculationResult, TradingPlan } from '../types';
import { formatCurrency, formatNumber } from '../utils/calculator';

// ==========================================
// 1. TRADE STATUS CARD (COMPACT + EXPANDABLE)
// ==========================================
interface TradeStatusCardProps {
  validation: PreTradeValidationResult;
  result: CalculationResult;
  onFixField: (field: string, suggestedValue?: string | number) => void;
  onSaveToJournal?: () => void;
  killSwitchActive?: boolean;
  defaultExpanded?: boolean;
}

export const TradeStatusCard: React.FC<TradeStatusCardProps> = ({
  validation,
  result,
  onFixField,
  onSaveToJournal,
  killSwitchActive,
  defaultExpanded = false,
}) => {
  const [showViolations, setShowViolations] = useState(defaultExpanded);
  const { isApproved, blockedReasons, warnings } = validation;

  return (
    <div 
      id="trade-status-card"
      className={`rounded-2xl border p-4 shadow-xs transition-all ${
        isApproved
          ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
          : 'bg-rose-50/80 border-rose-300 text-rose-950'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl text-white shadow-2xs shrink-0 flex items-center justify-center ${
              isApproved ? 'bg-[#22a65e]' : 'bg-[#ff3b4a]'
            }`}
          >
            {isApproved ? (
              <ShieldCheck className="w-5 h-5" />
            ) : (
              <ShieldAlert className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black tracking-tight truncate">
                {isApproved ? '🟢 TRADE APPROVED' : '🔴 TRADE BLOCKED'}
              </h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider shrink-0 ${
                  isApproved
                    ? 'bg-emerald-200 text-emerald-900'
                    : 'bg-rose-200 text-rose-900'
                }`}
              >
                {isApproved ? 'Risk Gate Passed' : 'Rule Violation'}
              </span>
            </div>
            <p className="text-xs text-slate-700 mt-0.5 truncate">
              {isApproved
                ? 'All pre-trade risk criteria & limits satisfied'
                : `${blockedReasons.length} violation${blockedReasons.length !== 1 ? 's' : ''} need attention`}
            </p>
          </div>
        </div>

        {/* Expand / Collapse Button */}
        <button
          type="button"
          onClick={() => setShowViolations(!showViolations)}
          aria-expanded={showViolations}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer shrink-0 ${
            isApproved
              ? 'bg-emerald-100/90 hover:bg-emerald-200 text-emerald-900'
              : 'bg-rose-100/90 hover:bg-rose-200 text-rose-900'
          }`}
        >
          <span>{showViolations ? 'Hide ▲' : isApproved ? 'Details ▼' : 'View Violations ▼'}</span>
        </button>
      </div>

      {/* EXPANDABLE VIOLATIONS & FIXES */}
      {showViolations && (
        <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-2.5 animate-in fade-in duration-150">
          {!isApproved && blockedReasons.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-900 block">
                Exact Reasons for Block & Recommended Corrections:
              </span>
              {blockedReasons.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="p-2.5 bg-white/95 rounded-xl border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-xs font-bold text-rose-950 flex items-start gap-1.5">
                      <span className="text-[#ff3b4a] font-black shrink-0">❌</span>
                      <span>{item.reason}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 pl-4">
                      {item.actionText}
                    </p>
                  </div>

                  {/* Fix & Recalculate Button */}
                  {item.fieldKey && (
                    <button
                      type="button"
                      onClick={() => onFixField(item.fieldKey!, item.suggestedFix)}
                      className="shrink-0 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs self-start sm:self-auto active:scale-95"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>
                        Fix {item.fieldKey === 'balance' ? 'Field' : item.fieldKey === 'stopLoss' ? 'Stop-Loss' : item.fieldKey === 'takeProfit' ? 'Take-Profit' : item.fieldKey === 'riskPct' ? 'Risk %' : item.fieldKey === 'leverage' ? 'Leverage' : 'Field'}
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {isApproved && (
            <div className="p-3 bg-white/90 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
              <p className="font-semibold">
                ✓ Position sizing conforms to your capital preservation rules.
              </p>
              <p className="text-[11px] text-slate-600">
                You can proceed with confidence or copy your parameters to your exchange.
              </p>
            </div>
          )}

          {/* WARNINGS / ADVISORIES (NON-BLOCKING) */}
          {warnings.length > 0 && (
            <div className="p-3 bg-amber-50/90 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Risk Gate Advisories (Non-blocking):</span>
              </div>
              <ul className="space-y-0.5 pl-5 list-disc text-[11px] text-amber-800">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ==========================================
// 2. PRE-TRADE CHECKLIST (COMPACT + EXPANDABLE)
// ==========================================
interface PreTradeChecklistCardProps {
  checklist: PreTradeValidationResult['checklist'];
  onFixField: (field: string, suggestedValue?: string | number) => void;
  defaultExpanded?: boolean;
}

export const PreTradeChecklistCard: React.FC<PreTradeChecklistCardProps> = ({
  checklist,
  onFixField,
  defaultExpanded = false,
}) => {
  const [showChecklist, setShowChecklist] = useState(defaultExpanded);

  const passedCount = checklist.filter((item) => item.passed).length;
  const failedCount = checklist.length - passedCount;

  return (
    <div 
      id="pre-trade-checklist-card"
      className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Pre-Trade Checklist
          </h4>
          <div className="flex items-center gap-3 mt-1 text-xs font-bold font-mono">
            <span className="text-[#22a65e] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#22a65e]"></span>
              {passedCount} PASS
            </span>
            <span className={`flex items-center gap-1 ${failedCount > 0 ? 'text-[#ff3b4a]' : 'text-slate-400'}`}>
              <span className={`w-2 h-2 rounded-full ${failedCount > 0 ? 'bg-[#ff3b4a]' : 'bg-slate-300'}`}></span>
              {failedCount} FAIL
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowChecklist(!showChecklist)}
          aria-expanded={showChecklist}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer shrink-0"
        >
          <span>{showChecklist ? 'View Checklist ▲' : 'View Checklist ▼'}</span>
        </button>
      </div>

      {/* EXPANDABLE CHECKLIST ITEMS */}
      {showChecklist && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {checklist.map((item) => (
              <div
                key={item.id}
                className={`p-2.5 rounded-xl border flex items-start gap-2.5 transition-colors ${
                  item.passed
                    ? 'bg-emerald-50/40 border-emerald-200/80 text-emerald-950'
                    : 'bg-rose-50/60 border-rose-200 text-rose-950'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {item.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-[#22a65e]" />
                  ) : (
                    <XCircle className="w-4 h-4 text-[#ff3b4a]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-xs font-bold truncate ${
                      item.passed ? 'text-slate-800' : 'text-rose-900 font-black'
                    }`}>
                      {item.title}
                    </span>
                    <span className={`text-[10px] font-extrabold uppercase ${
                      item.passed ? 'text-[#22a65e]' : 'text-[#ff3b4a]'
                    }`}>
                      {item.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                    {item.detail}
                  </p>
                  {!item.passed && item.suggestedFix && item.fieldKey && (
                    <button
                      type="button"
                      onClick={() => onFixField(item.fieldKey!, item.suggestedFix)}
                      className="mt-1 text-[10px] text-[#1565ff] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Wrench className="w-3 h-3" /> Quick Fix
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 3. RISK BUDGET CARD (COMPACT + EXPANDABLE)
// ==========================================
interface RiskBudgetCardProps {
  metrics: PreTradeValidationResult['metrics'];
  result: CalculationResult;
  plan: TradingPlan;
  defaultExpanded?: boolean;
}

export const RiskBudgetCard: React.FC<RiskBudgetCardProps> = ({
  metrics,
  result,
  plan,
  defaultExpanded = false,
}) => {
  const [showRiskDetails, setShowRiskDetails] = useState(defaultExpanded);

  return (
    <div 
      id="risk-budget-card"
      className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-[#1565ff]" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Risk Budget
            </h4>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs font-mono">
            <span className="text-slate-800 font-bold">
              {formatCurrency(result.riskAmount)} Target Risk
            </span>
            <span className={`font-bold ${metrics.remainingDailyRisk > 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'}`}>
              {formatCurrency(metrics.remainingDailyRisk)} Remaining
            </span>
            <span className="text-slate-500 font-medium">
              {metrics.todayTradesCount}/{metrics.maxTradesPerDay} Trades
            </span>
            <span className="text-slate-500 font-medium">
              {metrics.currentConsecutiveLosses}/{metrics.maxConsecutiveLosses} Losses
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowRiskDetails(!showRiskDetails)}
          aria-expanded={showRiskDetails}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer shrink-0"
        >
          <span>{showRiskDetails ? 'View Details ▲' : 'View Risk Details ▼'}</span>
        </button>
      </div>

      {/* EXPANDABLE RISK AUDIT DETAILS */}
      {showRiskDetails && (
        <div className="mt-3 pt-3 border-t border-slate-100 animate-in fade-in duration-150 space-y-2">
          <div className="text-[11px] font-mono text-slate-500 mb-1">
            Plan Boundaries: Max Risk {plan.maxRiskPerTrade}% • Max Lev {plan.maxLeverage}x
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-slate-500 font-semibold uppercase block truncate">Target Dollar Risk</span>
              <span className="text-sm font-black text-slate-900 mt-0.5 block font-mono">
                {formatCurrency(result.riskAmount)}
              </span>
              <span className="text-[10px] text-slate-400">
                Limit: {formatCurrency(metrics.maxRiskAllowedAmount)}
              </span>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-slate-500 font-semibold uppercase block truncate">Remaining Daily Risk</span>
              <span className={`text-sm font-black mt-0.5 block font-mono ${
                metrics.remainingDailyRisk > 0 ? 'text-[#22a65e]' : 'text-[#ff3b4a]'
              }`}>
                {formatCurrency(metrics.remainingDailyRisk)}
              </span>
              <span className="text-[10px] text-slate-400">
                Daily Cap: {formatCurrency(metrics.dailyLossLimit)}
              </span>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-slate-500 font-semibold uppercase block truncate">Today's Trades</span>
              <span className="text-sm font-black text-slate-900 mt-0.5 block font-mono">
                {metrics.todayTradesCount} / {metrics.maxTradesPerDay}
              </span>
              <span className="text-[10px] text-slate-400">
                {Math.max(0, metrics.maxTradesPerDay - metrics.todayTradesCount)} allowance left
              </span>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-slate-500 font-semibold uppercase block truncate">Consecutive Losses</span>
              <span className={`text-sm font-black mt-0.5 block font-mono ${
                metrics.currentConsecutiveLosses > 0 ? 'text-amber-600' : 'text-slate-900'
              }`}>
                {metrics.currentConsecutiveLosses} / {metrics.maxConsecutiveLosses}
              </span>
              <span className="text-[10px] text-slate-400">
                Discipline trigger
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 4. COMBINED PRE-TRADE RISK GATE CARD (BACKWARDS COMPATIBILITY)
// ==========================================
interface PreTradeRiskGateCardProps {
  validation: PreTradeValidationResult;
  calcState: CalculatorState;
  result: CalculationResult;
  plan: TradingPlan;
  onFixField: (field: string, suggestedValue?: string | number) => void;
  onSaveToJournal: () => void;
  killSwitchActive?: boolean;
}

export const PreTradeRiskGateCard: React.FC<PreTradeRiskGateCardProps> = ({
  validation,
  calcState,
  result,
  plan,
  onFixField,
  onSaveToJournal,
  killSwitchActive,
}) => {
  return (
    <div id="pre-trade-risk-gate" className="space-y-3">
      <TradeStatusCard
        validation={validation}
        result={result}
        onFixField={onFixField}
        onSaveToJournal={onSaveToJournal}
        killSwitchActive={killSwitchActive}
        defaultExpanded={false}
      />

      <PreTradeChecklistCard
        checklist={validation.checklist}
        onFixField={onFixField}
        defaultExpanded={false}
      />

      <RiskBudgetCard
        metrics={validation.metrics}
        result={result}
        plan={plan}
        defaultExpanded={false}
      />
    </div>
  );
};
