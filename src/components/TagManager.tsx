import React, { useState, useMemo } from 'react';
import { 
  Tag, 
  Search, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpDown, 
  Filter, 
  Plus, 
  Layers, 
  Eye, 
  ExternalLink,
  Merge,
  Sparkles,
  Info,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { TradeJournalEntry, TagStat } from '../types';
import { calculateTagStats } from '../utils/analytics';
import { formatCurrency, formatPrice } from '../utils/calculator';
import { renameTagInDb, deleteTagFromDb, mergeTagsInDb } from '../db/journalDb';

interface TagManagerProps {
  trades: TradeJournalEntry[];
  onRefreshData: () => Promise<void>;
  onEditTrade?: (trade: TradeJournalEntry) => void;
}

export const TagManager: React.FC<TagManagerProps> = ({
  trades,
  onRefreshData,
  onEditTrade,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'count' | 'winrate' | 'pnl_desc' | 'pnl_asc' | 'name_asc' | 'name_desc'>('count');
  const [filterType, setFilterType] = useState<'all' | 'profitable' | 'loss' | 'high_winrate' | 'active'>('all');
  
  // Modals & Action States
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [tagToDelete, setTagToDelete] = useState<TagStat | null>(null);
  const [selectedTagForDetail, setSelectedTagForDetail] = useState<TagStat | null>(null);
  
  // Batch Mode
  const [batchMode, setBatchMode] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeTargetTag, setMergeTargetTag] = useState('');
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);

  // Quick Create Tag
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createTagName, setCreateTagName] = useState('');
  const [createSelectedTradeIds, setCreateSelectedTradeIds] = useState<number[]>([]);

  // Status Notification
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Compute tag stats
  const tagStats = useMemo(() => {
    return calculateTagStats(trades);
  }, [trades]);

  // Overall Tag Metrics
  const summary = useMemo(() => {
    const totalUnique = tagStats.length;
    const taggedTradesCount = trades.filter((t) => Array.isArray(t.tags) && t.tags.length > 0).length;
    const coveragePct = trades.length > 0 ? (taggedTradesCount / trades.length) * 100 : 0;

    let topPnlTag: TagStat | null = null;
    let topWinRateTag: TagStat | null = null;

    tagStats.forEach((t) => {
      if (!topPnlTag || t.totalPnl > topPnlTag.totalPnl) {
        topPnlTag = t;
      }
      if (t.count >= 2) {
        if (!topWinRateTag || t.winRate > topWinRateTag.winRate) {
          topWinRateTag = t;
        }
      }
    });

    return {
      totalUnique,
      taggedTradesCount,
      coveragePct,
      topPnlTag: topPnlTag && (topPnlTag as TagStat).totalPnl > 0 ? (topPnlTag as TagStat) : null,
      topWinRateTag,
    };
  }, [tagStats, trades]);

  // Filter and Sort Tags
  const filteredTags = useMemo(() => {
    return tagStats
      .filter((item) => {
        // Search term
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase().replace(/^#/, '');
          if (!item.tag.toLowerCase().includes(term)) return false;
        }

        // Filter Type
        if (filterType === 'profitable' && item.totalPnl <= 0) return false;
        if (filterType === 'loss' && item.totalPnl >= 0) return false;
        if (filterType === 'high_winrate' && item.winRate < 60) return false;
        if (filterType === 'active' && item.count < 3) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'count') return b.count - a.count;
        if (sortBy === 'winrate') return b.winRate - a.winRate;
        if (sortBy === 'pnl_desc') return b.totalPnl - a.totalPnl;
        if (sortBy === 'pnl_asc') return a.totalPnl - b.totalPnl;
        if (sortBy === 'name_asc') return a.tag.localeCompare(b.tag);
        if (sortBy === 'name_desc') return b.tag.localeCompare(a.tag);
        return 0;
      });
  }, [tagStats, searchTerm, filterType, sortBy]);

  // Handle Tag Rename
  const handleStartRename = (tag: string) => {
    setEditingTag(tag);
    setNewTagName(tag);
  };

  const handleConfirmRename = async (oldTag: string) => {
    const cleanNew = newTagName.trim().replace(/^#/, '');
    if (!cleanNew) {
      setNotification({ message: 'Tag name cannot be empty.', type: 'error' });
      return;
    }

    if (cleanNew.toLowerCase() === oldTag.toLowerCase() && cleanNew === oldTag) {
      setEditingTag(null);
      return;
    }

    setIsProcessing(true);
    try {
      const updatedCount = await renameTagInDb(oldTag, cleanNew);
      await onRefreshData();
      setEditingTag(null);
      setNotification({
        message: `Successfully renamed tag "${oldTag}" to "${cleanNew}" across ${updatedCount} trade(s).`,
        type: 'success',
      });
    } catch (err: any) {
      setNotification({ message: `Failed to rename tag: ${err.message || 'Unknown error'}`, type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Tag Deletion
  const handleConfirmDelete = async () => {
    if (!tagToDelete) return;
    setIsProcessing(true);
    try {
      const count = await deleteTagFromDb(tagToDelete.tag);
      await onRefreshData();
      setNotification({
        message: `Successfully removed tag "${tagToDelete.tag}" from ${count} trade(s).`,
        type: 'success',
      });
      setTagToDelete(null);
      if (selectedTagForDetail?.tag === tagToDelete.tag) {
        setSelectedTagForDetail(null);
      }
    } catch (err: any) {
      setNotification({ message: `Failed to delete tag: ${err.message || 'Unknown error'}`, type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Batch Selection
  const toggleSelectTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleSelectAll = () => {
    if (selectedTags.length === filteredTags.length) {
      setSelectedTags([]);
    } else {
      setSelectedTags(filteredTags.map((t) => t.tag));
    }
  };

  // Batch Delete
  const handleConfirmBatchDelete = async () => {
    if (selectedTags.length === 0) return;
    setShowBatchDeleteModal(false);
    setIsProcessing(true);
    try {
      let totalAffected = 0;
      for (const tag of selectedTags) {
        totalAffected += await deleteTagFromDb(tag);
      }
      await onRefreshData();
      setNotification({
        message: `Successfully deleted ${selectedTags.length} tag(s) from ${totalAffected} journal trade(s).`,
        type: 'success',
      });
      setSelectedTags([]);
      setBatchMode(false);
    } catch (err: any) {
      setNotification({ message: `Batch delete error: ${err.message}`, type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Batch Merge
  const handleConfirmMerge = async () => {
    const cleanTarget = mergeTargetTag.trim().replace(/^#/, '');
    if (!cleanTarget) {
      setNotification({ message: 'Please enter a target tag name.', type: 'error' });
      return;
    }
    if (selectedTags.length < 2) {
      setNotification({ message: 'Please select at least 2 tags to merge.', type: 'error' });
      return;
    }

    setIsProcessing(true);
    try {
      const affected = await mergeTagsInDb(selectedTags, cleanTarget);
      await onRefreshData();
      setNotification({
        message: `Successfully merged ${selectedTags.length} tags into "${cleanTarget}" across ${affected} trade(s).`,
        type: 'success',
      });
      setSelectedTags([]);
      setIsMergeModalOpen(false);
      setMergeTargetTag('');
      setBatchMode(false);
    } catch (err: any) {
      setNotification({ message: `Merge failed: ${err.message}`, type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Get Trades for Selected Detail Tag
  const tradesForSelectedTag = useMemo(() => {
    if (!selectedTagForDetail) return [];
    return trades.filter((t) =>
      Array.isArray(t.tags) &&
      t.tags.some((tag) => tag.toLowerCase() === selectedTagForDetail.tag.toLowerCase())
    );
  }, [selectedTagForDetail, trades]);

  return (
    <div className="space-y-6">
      
      {/* 1. Header & Summary Stats */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/90 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-[#1565ff]/15 text-[#1565ff] border border-[#1565ff]/30">
                <Tag className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Journal Tag Manager
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Centralized control to audit, rename, merge, and prune tags across all trading records.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="tag-manager-batch-toggle"
              onClick={() => {
                setBatchMode(!batchMode);
                if (batchMode) setSelectedTags([]);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                batchMode
                  ? 'bg-blue-50 border-blue-300 text-[#1565ff]'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              <span>{batchMode ? 'Cancel Batch' : 'Batch Select'}</span>
            </button>
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
          <div className="bg-slate-50/90 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Unique Tags</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-slate-900">{summary.totalUnique}</span>
              <span className="text-xs text-slate-500 font-medium">labels</span>
            </div>
          </div>

          <div className="bg-slate-50/90 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Tagged Coverage</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-[#1565ff]">
                {summary.coveragePct.toFixed(0)}%
              </span>
              <span className="text-xs text-slate-500 font-mono">({summary.taggedTradesCount}/{trades.length})</span>
            </div>
          </div>

          <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Top Earning Tag</span>
            <div className="mt-1 truncate">
              {summary.topPnlTag ? (
                <div className="flex items-baseline justify-between gap-1">
                  <span className="font-bold text-sm text-emerald-900 truncate">#{summary.topPnlTag.tag}</span>
                  <span className="text-xs font-bold font-mono text-emerald-600">
                    +{formatCurrency(summary.topPnlTag.totalPnl)}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-slate-400 font-mono">No profits logged yet</span>
              )}
            </div>
          </div>

          <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 block">Highest Win-Rate Tag</span>
            <div className="mt-1 truncate">
              {summary.topWinRateTag ? (
                <div className="flex items-baseline justify-between gap-1">
                  <span className="font-bold text-sm text-blue-900 truncate">#{summary.topWinRateTag.tag}</span>
                  <span className="text-xs font-bold font-mono text-[#1565ff]">
                    {summary.topWinRateTag.winRate.toFixed(0)}% ({summary.topWinRateTag.wins}W/{summary.topWinRateTag.losses}L)
                  </span>
                </div>
              ) : (
                <span className="text-xs text-slate-400 font-mono">Min. 2 trades required</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-mono shadow-xs ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-500 hover:text-slate-900 text-xs font-bold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Toolbar (Search, Filter, Sort, Batch Actions) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="tag-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tag name (e.g. Breakout, FOMO, HTF Support)..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1565ff] focus:bg-white transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                id="tag-filter-select"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="bg-transparent text-slate-700 font-semibold focus:outline-none cursor-pointer text-xs"
              >
                <option value="all">All Tags ({tagStats.length})</option>
                <option value="profitable">Profitable Only</option>
                <option value="loss">Drawdown / Loss Tags</option>
                <option value="high_winrate">High Win Rate (&ge;60%)</option>
                <option value="active">Active (&ge;3 trades)</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                id="tag-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-slate-700 font-semibold focus:outline-none cursor-pointer text-xs"
              >
                <option value="count">Most Used (Count)</option>
                <option value="pnl_desc">Highest Total P&L</option>
                <option value="pnl_asc">Lowest Total P&L</option>
                <option value="winrate">Highest Win Rate</option>
                <option value="name_asc">Name (A &rarr; Z)</option>
                <option value="name_desc">Name (Z &rarr; A)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Batch Actions Bar (when batch mode is active) */}
        {batchMode && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-blue-50/80 border border-blue-200 rounded-lg text-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-slate-700 hover:text-slate-900 font-semibold cursor-pointer"
              >
                {selectedTags.length === filteredTags.length && filteredTags.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-[#1565ff]" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>Select All ({filteredTags.length})</span>
              </button>
              <span className="text-slate-400">|</span>
              <span className="font-bold text-[#1565ff]">{selectedTags.length} selected</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={selectedTags.length < 2 || isProcessing}
                onClick={() => {
                  setMergeTargetTag(selectedTags[0] || '');
                  setIsMergeModalOpen(true);
                }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md font-bold text-xs transition-all cursor-pointer ${
                  selectedTags.length >= 2
                    ? 'bg-[#1565ff] text-white hover:bg-[#0051e6]'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Merge className="w-3.5 h-3.5" />
                <span>Merge Selected</span>
              </button>

              <button
                disabled={selectedTags.length === 0 || isProcessing}
                type="button"
                onClick={() => setShowBatchDeleteModal(true)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md font-bold text-xs transition-all cursor-pointer ${
                  selectedTags.length > 0
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedTags.length})</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Main Tag Grid & Table View */}
      {filteredTags.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Tag className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">
              {tagStats.length === 0 ? 'No Tags Found in Trading Journal' : 'No Tags Match Filter'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {tagStats.length === 0
                ? 'Tags help categorize your setups (e.g. #Breakout, #HTFSupport, #FOMO, #Reversal, #LiquiditySweep). Add tags when logging trades to unlock comprehensive tag analytics!'
                : 'Try adjusting your search query or reset the filter dropdown.'}
            </p>
          </div>

          {tagStats.length === 0 && (
            <div className="pt-2">
              <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto text-xs font-mono text-slate-600">
                <span className="px-2.5 py-1 bg-slate-100 rounded-full border border-slate-200">#Breakout</span>
                <span className="px-2.5 py-1 bg-slate-100 rounded-full border border-slate-200">#TrendFollow</span>
                <span className="px-2.5 py-1 bg-slate-100 rounded-full border border-slate-200">#HTFSupport</span>
                <span className="px-2.5 py-1 bg-slate-100 rounded-full border border-slate-200">#LiquiditySweep</span>
                <span className="px-2.5 py-1 bg-slate-100 rounded-full border border-slate-200">#FOMO</span>
                <span className="px-2.5 py-1 bg-slate-100 rounded-full border border-slate-200">#NewsEvent</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTags.map((item) => {
            const isEditing = editingTag === item.tag;
            const isSelected = selectedTags.includes(item.tag);
            const isProfitable = item.totalPnl >= 0;
            const hasExistingMatch =
              newTagName.trim().length > 0 &&
              newTagName.trim().toLowerCase() !== item.tag.toLowerCase() &&
              tagStats.some((t) => t.tag.toLowerCase() === newTagName.trim().toLowerCase());

            return (
              <div
                key={item.tag}
                className={`bg-white rounded-xl border transition-all shadow-xs flex flex-col justify-between ${
                  isSelected
                    ? 'border-[#1565ff] ring-2 ring-blue-100'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {/* Card Header: Tag Name & Actions */}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    {/* Checkbox for batch */}
                    {batchMode && (
                      <button
                        onClick={() => toggleSelectTag(item.tag)}
                        className="pt-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#1565ff]" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    )}

                    {/* Tag Name / Inline Edit */}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={newTagName}
                              onChange={(e) => setNewTagName(e.target.value)}
                              autoFocus
                              className="w-full bg-slate-50 border border-[#1565ff] rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none"
                              placeholder="New tag name"
                            />
                            <button
                              disabled={isProcessing}
                              onClick={() => handleConfirmRename(item.tag)}
                              title="Save Changes"
                              className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-2xs"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingTag(null)}
                              title="Cancel"
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {hasExistingMatch && (
                            <p className="text-[10px] text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200">
                              ⚠️ "{newTagName.trim()}" already exists. Saving will merge both tags!
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-bold font-mono border border-slate-200/90 truncate">
                            <Tag className="w-3 h-3 text-[#1565ff]" />
                            #{item.tag}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action buttons (Rename & Delete) */}
                    {!isEditing && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleStartRename(item.tag)}
                          title="Rename Tag"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#1565ff] hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setTagToDelete(item)}
                          title="Delete Tag from all trades"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Performance Metric Bars & Numbers */}
                  <div className="space-y-2 pt-1 font-mono text-xs">
                    
                    {/* Row 1: Total P&L & Win Rate */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total Net P&L</span>
                        <span className={`font-bold text-sm ${isProfitable ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isProfitable ? '+' : ''}{formatCurrency(item.totalPnl)}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 uppercase block font-semibold">Win Rate</span>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          item.winRate >= 50 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {item.winRate.toFixed(0)}% ({item.wins}W / {item.losses}L)
                        </span>
                      </div>
                    </div>

                    {/* Row 2: Trade Usage & Directions */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span>Used in <strong className="text-slate-800">{item.count}</strong> trades</span>
                      <span>{item.longs} Longs / {item.shorts} Shorts</span>
                    </div>

                    {/* Win rate visual progress bar */}
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${item.winRate}%` }}
                      ></div>
                      <div
                        className="h-full bg-rose-500"
                        style={{ width: `${100 - item.winRate}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Inspect Trades Button */}
                <div className="p-2.5 bg-slate-50/70 border-t border-slate-100 rounded-b-xl flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">
                    Avg: {item.avgPnl >= 0 ? '+' : ''}{formatCurrency(item.avgPnl)}/trade
                  </span>
                  <button
                    onClick={() => setSelectedTagForDetail(item)}
                    className="flex items-center gap-1 text-xs font-bold text-[#1565ff] hover:text-[#0051e6] cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View {item.count} Trades</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Delete Tag Confirmation Modal */}
      {tagToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delete Tag</h3>
                <p className="text-xs text-slate-500">Confirm removal of tag label</p>
              </div>
            </div>

            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <p className="text-slate-700 leading-relaxed">
                Are you sure you want to delete tag <strong className="font-mono text-slate-900">#{tagToDelete.tag}</strong>?
              </p>
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Affected Trades:</span>
                  <strong className="text-slate-900">{tagToDelete.count} trades</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Associated P&L:</span>
                  <strong className={tagToDelete.totalPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {tagToDelete.totalPnl >= 0 ? '+' : ''}{formatCurrency(tagToDelete.totalPnl)}
                  </strong>
                </div>
              </div>
              <p className="text-slate-500 text-[11px] italic">
                ℹ️ Note: Deleting this tag will NOT delete your trades. It only removes the tag name from the trades' tag list.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                disabled={isProcessing}
                onClick={() => setTagToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isProcessing}
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                {isProcessing ? 'Removing...' : 'Yes, Delete Tag'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Merge Tags Modal */}
      {isMergeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-[#1565ff]">
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                <Merge className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Merge Selected Tags</h3>
                <p className="text-xs text-slate-500">Combine multiple tags into a single unified tag</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-600 font-bold block mb-1">Source Tags to Merge ({selectedTags.length}):</label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2.5 bg-slate-50 rounded-xl border border-slate-200 font-mono">
                  {selectedTags.map((t) => (
                    <span key={t} className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-bold text-slate-700">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-600 font-bold block mb-1">Target Tag Name *</label>
                <input
                  type="text"
                  value={mergeTargetTag}
                  onChange={(e) => setMergeTargetTag(e.target.value)}
                  placeholder="e.g. TrendFollow"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#1565ff] focus:bg-white rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none font-mono"
                />
              </div>

              <p className="text-slate-500 text-[11px] italic bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                All trades currently containing any of the source tags will be updated to use the unified target tag. Duplicate tag entries on the same trade will be automatically consolidated.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                disabled={isProcessing}
                onClick={() => setIsMergeModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isProcessing || !mergeTargetTag.trim()}
                onClick={handleConfirmMerge}
                className="px-4 py-2 bg-[#1565ff] hover:bg-[#0051e6] text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                {isProcessing ? 'Merging...' : 'Confirm & Merge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {showBatchDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delete {selectedTags.length} Selected Tag(s)?</h3>
                <p className="text-xs text-slate-500">Remove tags across all journal entries</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-slate-600">
                Are you sure you want to remove the selected tags (<span className="font-mono font-bold text-slate-800">{selectedTags.map(t => `#${t}`).join(', ')}</span>) from all recorded trades?
              </p>
              <p className="text-slate-500 text-[11px] italic bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                Note: This only removes the tags from trades' tag lists; your underlying trade P&L and journal records are never deleted.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setShowBatchDeleteModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleConfirmBatchDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                {isProcessing ? 'Deleting...' : `Delete ${selectedTags.length} Tag(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Tag Trade Inspector Modal / Slide-over */}
      {selectedTagForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-50 text-[#1565ff] border border-blue-100">
                  <Tag className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 font-mono">
                    #{selectedTagForDetail.tag}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {tradesForSelectedTag.length} trades with this tag • Total Net P&L:{' '}
                    <strong className={selectedTagForDetail.totalPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      {selectedTagForDetail.totalPnl >= 0 ? '+' : ''}{formatCurrency(selectedTagForDetail.totalPnl)}
                    </strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedTagForDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Trade List Container */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {tradesForSelectedTag.map((trade) => {
                const isWin = (trade.pnl || 0) >= 0;
                return (
                  <div
                    key={trade.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white transition-all space-y-2 text-xs font-mono"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          trade.direction === 'LONG' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {trade.direction}
                        </span>
                        <strong className="text-slate-900 font-bold">{trade.pair}</strong>
                        <span className="text-slate-400 text-[11px]">{trade.date} {trade.time}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`font-bold text-sm ${isWin ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isWin ? '+' : ''}{formatCurrency(trade.pnl || 0)}
                        </span>
                        {onEditTrade && (
                          <button
                            onClick={() => {
                              setSelectedTagForDetail(null);
                              onEditTrade(trade);
                            }}
                            className="p-1 text-slate-400 hover:text-[#1565ff] cursor-pointer"
                            title="Edit Trade"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase">Entry</span>
                        <span className="text-slate-700">${formatPrice(trade.entryPrice)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase">Exit</span>
                        <span className="text-slate-700">${formatPrice(trade.exitPrice)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase">Strategy</span>
                        <span className="text-slate-700 truncate block">{trade.strategy || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase">Leverage</span>
                        <span className="text-slate-700">{trade.leverage}x</span>
                      </div>
                    </div>

                    {trade.notes && (
                      <p className="text-[11px] text-slate-600 italic bg-white p-2 rounded border border-slate-100 font-sans">
                        "{trade.notes}"
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedTagForDetail(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
