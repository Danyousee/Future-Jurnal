import React, { useRef, useState, useEffect } from 'react';
import { 
  Calculator, 
  Layers, 
  BookOpen, 
  BarChart3,
  Plus,
  Zap,
  X,
  PlusCircle
} from 'lucide-react';

export type NavTabType = 'calculator' | 'portfolio' | 'journal' | 'analytics' | 'pdf' | 'data';

interface BottomNavProps {
  activeTab: NavTabType;
  setActiveTab: (tab: NavTabType) => void;
  totalTrades: number;
  openPositionsCount?: number;
  onOpenNewTrade?: () => void;
  onOpenQuickEntry?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  totalTrades,
  openPositionsCount = 0,
  onOpenNewTrade,
  onOpenQuickEntry,
}) => {
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 400,
    height: 64,
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight || 64,
        });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(containerRef.current);
    window.addEventListener('resize', updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  const tabs = [
    {
      id: 'calculator' as NavTabType,
      label: 'Calculator',
      icon: Calculator,
      badge: null,
      domId: 'bottom-nav-calculator',
    },
    {
      id: 'portfolio' as NavTabType,
      label: 'Portfolio',
      icon: Layers,
      badge: openPositionsCount > 0 ? openPositionsCount : null,
      domId: 'bottom-nav-portfolio',
    },
    {
      id: 'journal' as NavTabType,
      label: 'Journal',
      icon: BookOpen,
      badge: totalTrades > 0 ? (totalTrades > 99 ? '99+' : totalTrades) : null,
      domId: 'bottom-nav-journal',
    },
    {
      id: 'analytics' as NavTabType,
      label: 'Analysis',
      icon: BarChart3,
      badge: null,
      domId: 'bottom-nav-analytics',
    },
  ];

  const w = dimensions.width || 400;
  const h = dimensions.height || 64;
  const c = w / 2;
  const notchHalf = 48;
  const notchDepth = 34;

  const p0x = c - notchHalf;
  const p3x = c + notchHalf;

  // Closed polygon for the solid white navigation bar background with circular notch
  const fillPath = `M 0,0.5 L ${p0x},0.5 C ${c - 28},0.5 ${c - 18},${notchDepth} ${c},${notchDepth} C ${c + 18},${notchDepth} ${c + 28},0.5 ${p3x},0.5 L ${w},0.5 L ${w},${h} L 0,${h} Z`;

  // Top contour line tracing the horizontal edges and smooth circular notch
  const strokePath = `M 0,0.5 L ${p0x},0.5 C ${c - 28},0.5 ${c - 18},${notchDepth} ${c},${notchDepth} C ${c + 18},${notchDepth} ${c + 28},0.5 ${p3x},0.5 L ${w},0.5`;

  const handleAction = (action: () => void) => {
    setIsQuickMenuOpen(false);
    action();
  };

  return (
    <>
      {/* Quick Actions Backdrop & Popover Menu */}
      {isQuickMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex flex-col justify-end items-center pb-24 px-4 transition-all animate-in fade-in duration-150"
          onClick={() => setIsQuickMenuOpen(false)}
        >
          <div 
            className="w-full max-w-xs bg-white rounded-2xl p-4 shadow-2xl border border-slate-200/90 space-y-2 animate-in slide-in-from-bottom-5 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Quick Actions
              </span>
              <button 
                onClick={() => setIsQuickMenuOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Action 1: Log Trade */}
            <button
              type="button"
              onClick={() => handleAction(() => onOpenNewTrade?.())}
              className="w-full p-3 rounded-xl hover:bg-blue-50/70 border border-transparent hover:border-blue-200 flex items-center gap-3 text-left transition-all cursor-pointer group min-h-[48px]"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-100/70 text-[#1565ff] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-900 group-hover:text-[#1565ff]">Log Trade</div>
                <div className="text-[11px] text-slate-500 truncate">Record a completed trade with full risk data</div>
              </div>
            </button>

            {/* Quick Action 2: Risk Calculator */}
            <button
              type="button"
              onClick={() => handleAction(() => setActiveTab('calculator'))}
              className="w-full p-3 rounded-xl hover:bg-emerald-50/70 border border-transparent hover:border-emerald-200 flex items-center gap-3 text-left transition-all cursor-pointer group min-h-[48px]"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-100/70 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Calculator className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-600">Risk Calculator</div>
                <div className="text-[11px] text-slate-500 truncate">Size position & check liquidation levels</div>
              </div>
            </button>

            {/* Quick Action 3: Quick Entry */}
            <button
              type="button"
              onClick={() => handleAction(() => (onOpenQuickEntry ? onOpenQuickEntry() : onOpenNewTrade?.()))}
              className="w-full p-3 rounded-xl hover:bg-amber-50/70 border border-transparent hover:border-amber-200 flex items-center gap-3 text-left transition-all cursor-pointer group min-h-[48px]"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-100/70 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Zap className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-900 group-hover:text-amber-600">Quick Entry</div>
                <div className="text-[11px] text-slate-500 truncate">Fast order logging with pre-filled limits</div>
              </div>
            </button>
          </div>
        </div>
      )}

      <div 
        ref={containerRef}
        id="bottom-nav" 
        className="no-print fixed bottom-0 left-0 right-0 z-40 w-full h-[62px] sm:h-[66px] pb-[max(env(safe-area-inset-bottom),0px)] select-none"
      >
        {/* Shaped SVG Background with Center Circular Cutout / Notch */}
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ filter: 'drop-shadow(0 -3px 10px rgba(15, 23, 42, 0.08))' }}
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          aria-hidden="true"
        >
          <path
            d={fillPath}
            fill="#ffffff"
          />
          <path
            d={strokePath}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="1"
          />
        </svg>

        {/* Floating Action Button (FAB) resting naturally inside the circular cutout with white separation ring */}
        {(onOpenNewTrade || onOpenQuickEntry) && (
          <div className="absolute left-1/2 -translate-x-1/2 -top-5 sm:-top-5.5 z-50 pointer-events-auto">
            <button
              type="button"
              id="bottom-nav-floating-action-btn"
              onClick={() => setIsQuickMenuOpen(!isQuickMenuOpen)}
              className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#1565ff] hover:bg-[#0c53dc] text-white flex items-center justify-center shadow-xl shadow-blue-600/35 border-4 border-white active:scale-95 transition-all duration-200 cursor-pointer ${
                isQuickMenuOpen ? 'rotate-45 bg-slate-800' : ''
              }`}
              title="Quick Actions"
              aria-label="Quick Actions"
            >
              <Plus className="w-6 h-6 sm:w-7 sm:h-7 text-white stroke-[2.8]" />
            </button>
          </div>
        )}

        {/* 4 Navigation Items evenly distributed around the center button */}
        <nav 
          id="dashboard-bottom-navigation"
          aria-label="Dashboard Bottom Navigation"
          className="w-full max-w-md mx-auto grid grid-cols-5 items-center relative h-full px-2"
        >
          {/* Tab 1: Calculator */}
          <button
            key={tabs[0].id}
            id={tabs[0].domId}
            type="button"
            onClick={() => setActiveTab(tabs[0].id)}
            className={`col-span-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all duration-150 relative cursor-pointer select-none active:scale-95 min-h-[44px] ${
              activeTab === tabs[0].id
                ? 'text-[#1565ff] font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {activeTab === tabs[0].id && (
              <span className="absolute top-0 w-7 h-1 bg-[#1565ff] rounded-full shadow-xs" />
            )}
            <div className="relative flex items-center justify-center mb-0.5 shrink-0">
              <div className={`p-1.5 rounded-lg transition-all ${
                activeTab === tabs[0].id
                  ? 'bg-blue-50 text-[#1565ff] scale-105'
                  : 'text-slate-500'
              }`}>
                <Calculator className="w-5 h-5 shrink-0" />
              </div>
            </div>
            <span className="text-[10px] sm:text-xs tracking-tight truncate max-w-full">
              {tabs[0].label}
            </span>
          </button>

          {/* Tab 2: Portfolio */}
          <button
            key={tabs[1].id}
            id={tabs[1].domId}
            type="button"
            onClick={() => setActiveTab(tabs[1].id)}
            className={`col-span-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all duration-150 relative cursor-pointer select-none active:scale-95 min-h-[44px] ${
              activeTab === tabs[1].id
                ? 'text-[#1565ff] font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {activeTab === tabs[1].id && (
              <span className="absolute top-0 w-7 h-1 bg-[#1565ff] rounded-full shadow-xs" />
            )}
            <div className="relative flex items-center justify-center mb-0.5 shrink-0">
              <div className={`p-1.5 rounded-lg transition-all ${
                activeTab === tabs[1].id
                  ? 'bg-blue-50 text-[#1565ff] scale-105'
                  : 'text-slate-500'
              }`}>
                <Layers className="w-5 h-5 shrink-0" />
              </div>
              {tabs[1].badge !== null && (
                <span className="absolute -top-1 -right-2 bg-[#1565ff] text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full shadow-xs">
                  {tabs[1].badge}
                </span>
              )}
            </div>
            <span className="text-[10px] sm:text-xs tracking-tight truncate max-w-full">
              {tabs[1].label}
            </span>
          </button>

          {/* Center Space Reserved for Floating Action Button and Cutout */}
          <div className="col-span-1 h-full pointer-events-none" aria-hidden="true" />

          {/* Tab 3: Journal */}
          <button
            key={tabs[2].id}
            id={tabs[2].domId}
            type="button"
            onClick={() => setActiveTab(tabs[2].id)}
            className={`col-span-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all duration-150 relative cursor-pointer select-none active:scale-95 min-h-[44px] ${
              activeTab === tabs[2].id
                ? 'text-[#1565ff] font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {activeTab === tabs[2].id && (
              <span className="absolute top-0 w-7 h-1 bg-[#1565ff] rounded-full shadow-xs" />
            )}
            <div className="relative flex items-center justify-center mb-0.5 shrink-0">
              <div className={`p-1.5 rounded-lg transition-all ${
                activeTab === tabs[2].id
                  ? 'bg-blue-50 text-[#1565ff] scale-105'
                  : 'text-slate-500'
              }`}>
                <BookOpen className="w-5 h-5 shrink-0" />
              </div>
              {tabs[2].badge !== null && (
                <span className="absolute -top-1 -right-2 bg-[#1565ff] text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full shadow-xs">
                  {tabs[2].badge}
                </span>
              )}
            </div>
            <span className="text-[10px] sm:text-xs tracking-tight truncate max-w-full">
              {tabs[2].label}
            </span>
          </button>

          {/* Tab 4: Analysis */}
          <button
            key={tabs[3].id}
            id={tabs[3].domId}
            type="button"
            onClick={() => setActiveTab(tabs[3].id)}
            className={`col-span-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all duration-150 relative cursor-pointer select-none active:scale-95 min-h-[44px] ${
              activeTab === tabs[3].id
                ? 'text-[#1565ff] font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {activeTab === tabs[3].id && (
              <span className="absolute top-0 w-7 h-1 bg-[#1565ff] rounded-full shadow-xs" />
            )}
            <div className="relative flex items-center justify-center mb-0.5 shrink-0">
              <div className={`p-1.5 rounded-lg transition-all ${
                activeTab === tabs[3].id
                  ? 'bg-blue-50 text-[#1565ff] scale-105'
                  : 'text-slate-500'
              }`}>
                <BarChart3 className="w-5 h-5 shrink-0" />
              </div>
            </div>
            <span className="text-[10px] sm:text-xs tracking-tight truncate max-w-full">
              {tabs[3].label}
            </span>
          </button>
        </nav>
      </div>
    </>
  );
};
