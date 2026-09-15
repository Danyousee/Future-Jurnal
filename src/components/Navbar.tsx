import React from 'react';
import { Menu, Bell, Sparkles } from 'lucide-react';
import { BalanceSummaryCard } from './BalanceSummaryCard';
import { TradeJournalEntry } from '../types';

interface NavbarProps {
  onOpenHamburger: () => void;
  onOpenNotifications: () => void;
  onOpenLandingPage?: () => void;
  showBalanceSummary?: boolean;
  totalBalance?: number;
  todayProfit?: number;
  totalProfitLoss?: number;
  trades?: TradeJournalEntry[];
  pageTitle?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenHamburger,
  onOpenNotifications,
  onOpenLandingPage,
  showBalanceSummary = false,
  totalBalance = 10000,
  todayProfit = 0,
  totalProfitLoss = 0,
  trades = [],
  pageTitle,
}) => {
  return (
    <div 
      id="dashboard-header-hero-container"
      className={`no-print w-full bg-[#1565ff] text-white transition-all ${
        showBalanceSummary 
          ? 'pb-2.5 sm:pb-3 rounded-b-[1.25rem] sm:rounded-b-[1.5rem] shadow-sm' 
          : 'shadow-xs'
      }`}
    >
      {/* Top Header: Hamburger on the left, Title in center, Bell and Landing on the right */}
      <header className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-13 sm:h-14 flex items-center justify-between">
        {/* Left: Hamburger Menu Icon */}
        <button
          type="button"
          id="header-hamburger-btn"
          onClick={onOpenHamburger}
          className="w-11 h-11 flex items-center justify-center rounded-xl text-white hover:bg-white/15 transition-colors cursor-pointer active:scale-95 shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-white stroke-[2.2]" />
        </button>

        {/* Center: Page Title */}
        <h1 className="text-base sm:text-lg font-bold text-white tracking-tight text-center truncate px-2">
          {pageTitle || ''}
        </h1>

        {/* Right: Notification / Bell Icon */}
        <button
          type="button"
          id="header-notification-btn"
          onClick={onOpenNotifications}
          className="relative w-11 h-11 flex items-center justify-center rounded-xl text-white hover:bg-white/15 transition-colors cursor-pointer active:scale-95 shrink-0"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-white stroke-[2.2]" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-emerald-400 rounded-full border-2 border-[#1565ff]" />
        </button>
      </header>

      {/* Balance Summary Card: Sitting seamlessly on top of the continuous blue background */}
      {showBalanceSummary && (
        <div className="w-full max-w-md sm:max-w-lg mx-auto px-3 sm:px-4 pt-0">
          <BalanceSummaryCard
            totalBalance={totalBalance}
            todayProfit={todayProfit}
            totalProfitLoss={totalProfitLoss}
            trades={trades}
          />
        </div>
      )}
    </div>
  );
};


