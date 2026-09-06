import React, { useState } from 'react';
import {
  SlidersHorizontal,
  GripVertical,
  Eye,
  EyeOff,
  MoveUp,
  MoveDown,
  RotateCcw,
  Check,
  X,
  Activity,
  PieChart,
  Calendar,
  Layers,
  Tag,
  Sparkles,
  BarChart3,
  CheckCircle2,
  LayoutGrid,
  Info
} from 'lucide-react';

export interface AnalyticsWidgetConfig {
  id: string;
  title: string;
  category: 'charts' | 'performance' | 'insights' | 'metrics';
  description: string;
  iconName: 'Activity' | 'PieChart' | 'Calendar' | 'Layers' | 'Tag' | 'Sparkles' | 'BarChart3';
  enabled: boolean;
}

export const DEFAULT_ANALYTICS_WIDGETS: AnalyticsWidgetConfig[] = [
  {
    id: 'kpi_summary',
    title: 'Key Metrics & Trade Statistics',
    category: 'metrics',
    description: 'High-level trading KPI cards including Profit Factor, Expectancy, and Streaks',
    iconName: 'BarChart3',
    enabled: true,
  },
  {
    id: 'equity_curve',
    title: 'Equity Curve (Balance Progression)',
    category: 'charts',
    description: 'Cumulative balance progression chart with timeline and peak performance',
    iconName: 'Activity',
    enabled: true,
  },
  {
    id: 'win_loss_pie',
    title: 'Win / Loss Distribution',
    category: 'charts',
    description: 'Circular donut distribution of Wins, Losses, and Breakeven trades',
    iconName: 'PieChart',
    enabled: true,
  },
  {
    id: 'monthly_pnl',
    title: 'Monthly P&L Distribution',
    category: 'performance',
    description: 'Historical breakdown of Net P&L and volume across all trading months',
    iconName: 'Calendar',
    enabled: true,
  },
  {
    id: 'pair_performance',
    title: 'Performance by Trading Pair',
    category: 'performance',
    description: 'Asset profitability table comparing win rates, volume, and net P&L by pair',
    iconName: 'Layers',
    enabled: true,
  },
  {
    id: 'tag_performance',
    title: 'Tag Performance & Setup Analytics',
    category: 'performance',
    description: 'Setup edge analysis and direct access to centralized tag management',
    iconName: 'Tag',
    enabled: true,
  },
  {
    id: 'smart_insights',
    title: 'Smart Algorithmic Insights',
    category: 'insights',
    description: 'Automated discipline rules, risk checks, and psychological feedback',
    iconName: 'Sparkles',
    enabled: true,
  },
];

interface AnalyticsLayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  widgets: AnalyticsWidgetConfig[];
  onSaveWidgets: (updatedWidgets: AnalyticsWidgetConfig[]) => void;
  onResetToDefault: () => void;
}

export const AnalyticsLayoutModal: React.FC<AnalyticsLayoutModalProps> = ({
  isOpen,
  onClose,
  widgets,
  onSaveWidgets,
  onResetToDefault,
}) => {
  const [localWidgets, setLocalWidgets] = useState<AnalyticsWidgetConfig[]>(widgets);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Sync state when opened
  React.useEffect(() => {
    setLocalWidgets(widgets);
  }, [widgets, isOpen]);

  if (!isOpen) return null;

  const handleToggleWidget = (id: string) => {
    const activeCount = localWidgets.filter((w) => w.enabled).length;
    const target = localWidgets.find((w) => w.id === id);

    // Prevent disabling all widgets
    if (target?.enabled && activeCount <= 1) {
      alert('At least one widget must remain visible on the dashboard.');
      return;
    }

    const updated = localWidgets.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w));
    setLocalWidgets(updated);
    onSaveWidgets(updated);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= localWidgets.length) return;

    const updated = [...localWidgets];
    const [movedItem] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, movedItem);

    setLocalWidgets(updated);
    onSaveWidgets(updated);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...localWidgets];
    const [movedItem] = updated.splice(draggedIndex, 1);
    updated.splice(index, 0, movedItem);

    setDraggedIndex(null);
    setDragOverIndex(null);
    setLocalWidgets(updated);
    onSaveWidgets(updated);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Presets
  const applyPreset = (presetType: 'all' | 'charts' | 'setups' | 'minimal') => {
    let updated: AnalyticsWidgetConfig[];

    if (presetType === 'all') {
      updated = localWidgets.map((w) => ({ ...w, enabled: true }));
    } else if (presetType === 'charts') {
      const chartIds = ['kpi_summary', 'equity_curve', 'win_loss_pie', 'monthly_pnl'];
      updated = localWidgets.map((w) => ({
        ...w,
        enabled: chartIds.includes(w.id),
      }));
    } else if (presetType === 'setups') {
      const setupIds = ['kpi_summary', 'tag_performance', 'smart_insights', 'pair_performance'];
      updated = localWidgets.map((w) => ({
        ...w,
        enabled: setupIds.includes(w.id),
      }));
    } else {
      // Minimalist
      const minIds = ['kpi_summary', 'equity_curve', 'win_loss_pie'];
      updated = localWidgets.map((w) => ({
        ...w,
        enabled: minIds.includes(w.id),
      }));
    }

    setLocalWidgets(updated);
    onSaveWidgets(updated);
  };

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'Activity':
        return <Activity className="w-4 h-4 text-[#1565ff]" />;
      case 'PieChart':
        return <PieChart className="w-4 h-4 text-[#22a65e]" />;
      case 'Calendar':
        return <Calendar className="w-4 h-4 text-[#1565ff]" />;
      case 'Layers':
        return <Layers className="w-4 h-4 text-[#1565ff]" />;
      case 'Tag':
        return <Tag className="w-4 h-4 text-[#1565ff]" />;
      case 'Sparkles':
        return <Sparkles className="w-4 h-4 text-amber-500" />;
      case 'BarChart3':
      default:
        return <BarChart3 className="w-4 h-4 text-[#1565ff]" />;
    }
  };

  const enabledCount = localWidgets.filter((w) => w.enabled).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-50 text-[#1565ff] border border-blue-100">
              <SlidersHorizontal className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Customize Analytics Dashboard
              </h2>
              <p className="text-xs text-slate-500">
                Toggle widgets on/off and drag or click arrows to reorder your summary layout.
              </p>
            </div>
          </div>

          <button
            id="close-analytics-layout-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets Bar */}
        <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <LayoutGrid className="w-3.5 h-3.5 text-[#1565ff]" />
              Quick Layout Presets:
            </span>
            <span className="text-[11px] font-mono font-bold text-[#1565ff]">
              {enabledCount} of {localWidgets.length} widgets active
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <button
              onClick={() => applyPreset('all')}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition-colors cursor-pointer"
            >
              All Widgets
            </button>
            <button
              onClick={() => applyPreset('charts')}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition-colors cursor-pointer"
            >
              Charts Focus
            </button>
            <button
              onClick={() => applyPreset('setups')}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition-colors cursor-pointer"
            >
              Setups & Discipline
            </button>
            <button
              onClick={() => applyPreset('minimal')}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition-colors cursor-pointer"
            >
              Minimal Overview
            </button>
          </div>
        </div>

        {/* Reorderable & Toggleable Widgets List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {localWidgets.map((widget, index) => {
            const isDragging = draggedIndex === index;
            const isOver = dragOverIndex === index;

            return (
              <div
                key={widget.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                  isDragging
                    ? 'opacity-40 bg-slate-100 border-dashed border-[#1565ff]'
                    : isOver
                    ? 'bg-blue-50 border-[#1565ff] ring-2 ring-blue-100'
                    : widget.enabled
                    ? 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                    : 'bg-slate-50/80 border-slate-200/60 opacity-60'
                }`}
              >
                {/* Drag handle & Widget Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing p-1"
                    title="Drag to reorder widget position"
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>

                  <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 shrink-0">
                    {renderIcon(widget.iconName)}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {widget.title}
                      </span>
                      {widget.enabled ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                          Hidden
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{widget.description}</p>
                  </div>
                </div>

                {/* Controls: Reorder Up/Down & Toggle Switch */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Move Up */}
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMove(index, 'up')}
                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                      index === 0
                        ? 'text-slate-300 border-transparent cursor-not-allowed'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 border-slate-200'
                    }`}
                    title="Move Up"
                  >
                    <MoveUp className="w-3.5 h-3.5" />
                  </button>

                  {/* Move Down */}
                  <button
                    type="button"
                    disabled={index === localWidgets.length - 1}
                    onClick={() => handleMove(index, 'down')}
                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                      index === localWidgets.length - 1
                        ? 'text-slate-300 border-transparent cursor-not-allowed'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 border-slate-200'
                    }`}
                    title="Move Down"
                  >
                    <MoveDown className="w-3.5 h-3.5" />
                  </button>

                  {/* Toggle Button */}
                  <button
                    type="button"
                    id={`toggle-widget-${widget.id}`}
                    onClick={() => handleToggleWidget(widget.id)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      widget.enabled
                        ? 'bg-[#1565ff] hover:bg-[#0051e6] text-white border-[#1565ff]'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300'
                    }`}
                  >
                    {widget.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{widget.enabled ? 'Shown' : 'Hidden'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onResetToDefault();
              setLocalWidgets(DEFAULT_ANALYTICS_WIDGETS);
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default Layout</span>
          </button>

          <button
            type="button"
            id="save-analytics-layout-btn"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-[#1565ff] hover:bg-[#0051e6] text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            Done Customizing
          </button>
        </div>
      </div>
    </div>
  );
};
