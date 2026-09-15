import React from 'react';
import { 
  X, 
  FileText, 
  Settings, 
  User, 
  Bell, 
  ShieldAlert, 
  PieChart, 
  Percent, 
  Sliders, 
  Activity, 
  Download, 
  Upload, 
  SlidersHorizontal, 
  HelpCircle, 
  ChevronRight,
  Flame,
  ShieldCheck,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { NavTabType } from './BottomNav';

interface HamburgerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: NavTabType) => void;
  onOpenProfile: () => void;
  onOpenNotifications: () => void;
  onOpenHelpAbout: () => void;
  onOpenRiskRules: () => void;
  onOpenFeeSettings: () => void;
  onOpenSlippageSettings: () => void;
  onOpenRiskBudget: () => void;
  onOpenAdvancedCalcSettings?: () => void;
  onOpenLandingPage?: () => void;
  killSwitchActive: boolean;
  totalTrades: number;
}

export const HamburgerMenu: React.FC<HamburgerMenuProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onOpenProfile,
  onOpenNotifications,
  onOpenHelpAbout,
  onOpenRiskRules,
  onOpenFeeSettings,
  onOpenSlippageSettings,
  onOpenRiskBudget,
  onOpenAdvancedCalcSettings,
  onOpenLandingPage,
  killSwitchActive,
  totalTrades,
}) => {
  if (!isOpen) return null;

  const handleItemClick = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Slide-over Drawer from Left */}
      <div 
        id="hamburger-menu-drawer"
        className="fixed top-0 bottom-0 left-0 z-50 w-80 max-w-[85vw] bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-left duration-250 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header with RiskCalc PRO Branding */}
        <div className="p-4 sm:p-5 bg-gradient-to-br from-[#1258ea] to-[#1565ff] text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs border border-white/30 flex items-center justify-center font-bold text-white shadow-xs">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-black tracking-tight text-white">
                  RiskCalc <span className="text-blue-200">PRO</span>
                </h2>
              </div>
              <p className="text-[10px] text-blue-100 font-medium">Position Sizer & Risk Gate</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {onOpenLandingPage && (
              <button
                type="button"
                id="hamburger-header-landing-btn"
                onClick={() => handleItemClick(onOpenLandingPage)}
                title="View Product Landing Page"
                className="px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-2xs"
                aria-label="View Landing Page"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                <span>Landing Page</span>
              </button>
            )}
            <button 
              id="close-hamburger-menu-btn"
              onClick={onClose}
              className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Strip */}
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between text-[11px] font-bold">
          <div className="flex items-center gap-1.5 text-blue-700">
            <ShieldCheck className="w-3.5 h-3.5 text-[#1565ff]" />
            <span>Risk Engine: Armed</span>
          </div>
          {killSwitchActive && (
            <span className="flex items-center gap-1 text-rose-600 bg-rose-100/80 px-2 py-0.5 rounded-full text-[10px]">
              <Flame className="w-3 h-3" /> Halted
            </span>
          )}
        </div>

        {/* Scrollable Menu Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-3">
          
          {/* Group 1: Risk & Rules */}
          <div className="pt-1">
            <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Risk & Strategy
            </div>
            <div className="space-y-0.5">
              <button
                type="button"
                id="hamburger-btn-risk-rules"
                onClick={() => handleItemClick(onOpenRiskRules)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#1565ff] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-red-50 text-red-600">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <span>Risk Rules & Kill Switch</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                type="button"
                id="hamburger-btn-risk-budget"
                onClick={() => handleItemClick(onOpenRiskBudget)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#1565ff] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-blue-50 text-[#1565ff]">
                    <PieChart className="w-4 h-4" />
                  </div>
                  <span>Risk Budget & Daily Cap</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Group 2: Calculator Settings */}
          <div className="pt-2">
            <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Calculator Parameters
            </div>
            <div className="space-y-0.5">
              <button
                type="button"
                id="hamburger-btn-fee-settings"
                onClick={() => handleItemClick(onOpenFeeSettings)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#1565ff] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                    <Percent className="w-4 h-4" />
                  </div>
                  <span>Fee Settings (Taker/Maker)</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                type="button"
                id="hamburger-btn-slippage-settings"
                onClick={() => handleItemClick(onOpenSlippageSettings)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#1565ff] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                    <Activity className="w-4 h-4" />
                  </div>
                  <span>Custom Slippage & MMR</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                type="button"
                id="hamburger-btn-advanced-calc"
                onClick={() => handleItemClick(onOpenAdvancedCalcSettings || (() => onNavigateTab('calculator')))}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#1565ff] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <span>Advanced Calculator Settings</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Group 3: Reports & Data Management */}
          <div className="pt-2">
            <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Reports & Data
            </div>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => handleItemClick(() => onNavigateTab('pdf'))}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#1565ff] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span>PDF Executive Report</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => handleItemClick(() => onNavigateTab('data'))}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#1565ff] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
                    <Download className="w-4 h-4" />
                  </div>
                  <span>Export / Import Data</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => handleItemClick(() => onNavigateTab('data'))}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#1565ff] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-cyan-50 text-cyan-600">
                    <Upload className="w-4 h-4" />
                  </div>
                  <span>Backup & Restore</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Group 4: Profile, Alerts & App Preferences */}
          <div className="pt-2">
            <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Account & Preferences
            </div>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => handleItemClick(onOpenProfile)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#1565ff] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-violet-50 text-violet-600">
                    <User className="w-4 h-4" />
                  </div>
                  <span>Trader Profile</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => handleItemClick(onOpenNotifications)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#1565ff] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                    <Bell className="w-4 h-4" />
                  </div>
                  <span>Notifications & Alerts</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => handleItemClick(() => onNavigateTab('data'))}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#1565ff] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
                    <Settings className="w-4 h-4" />
                  </div>
                  <span>Settings & App Preferences</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {onOpenLandingPage && (
                <button
                  type="button"
                  id="hamburger-landing-page-btn"
                  onClick={() => handleItemClick(onOpenLandingPage)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-[#1565ff] transition-all cursor-pointer bg-blue-50/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-blue-100 text-[#1565ff]">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <span>Product Landing Page & Tour</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}

              <button
                type="button"
                onClick={() => handleItemClick(onOpenHelpAbout)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#1565ff] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <span>Help / About</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 text-center text-[11px] text-slate-400 font-mono">
          RiskCalc PRO • Safe Trading System
        </div>
      </div>
    </>
  );
};
