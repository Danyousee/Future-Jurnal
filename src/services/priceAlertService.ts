import { PriceAlert, PriceAlertTargetType, PriceAlertCondition, TradingMode, SpotVenue } from '../types';
import { marketDataService } from './marketData/marketDataService';
import { cleanSymbol } from './marketData/symbolNormalizer';

const STORAGE_KEY = 'risk_calc_price_alerts_v1';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export interface AlertTriggerEvent {
  alert: PriceAlert;
  currentPrice: number;
  distancePct: number;
  message: string;
  timestamp: number;
}

type AlertListener = (alerts: PriceAlert[]) => void;
type TriggerListener = (event: AlertTriggerEvent) => void;

/**
 * Web Audio API synthesizer for crisp, distinctive notification chimes.
 * Requires no external audio files, works offline, and avoids HTTP asset failures.
 */
export function playAlertSound(type: 'alert' | 'success' | 'warning' = 'alert') {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'success') {
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.15); // G5
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc1.connect(gain);
      gain.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);
    } else if (type === 'warning') {
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(440, now); // A4
      osc1.frequency.setValueAtTime(370, now + 0.12); // F#4
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain);
      gain.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);
    } else {
      // High-precision dual-tone alert chime (D5 -> A5 + D6 harmony)
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.setValueAtTime(880, now + 0.1); // A5
      osc2.frequency.setValueAtTime(1174.66, now + 0.1); // D6

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now + 0.1);
      osc1.stop(now + 0.55);
      osc2.stop(now + 0.55);
    }
  } catch (err) {
    console.warn('PriceAlert audio chime error:', err);
  }
}

/**
 * Browser Notification API helper functions
 */
export function getBrowserNotificationPermission(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    return Notification.permission;
  } catch {
    return 'unsupported';
  }
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch (err) {
    console.warn('Browser notification permission request failed:', err);
    return 'denied';
  }
}

export function sendBrowserNotification(title: string, options?: NotificationOptions): Notification | null {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }
  if (Notification.permission !== 'granted') {
    return null;
  }

  try {
    const notification = new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      requireInteraction: false,
      ...options,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  } catch (err) {
    console.warn('Browser notification display failed:', err);
    return null;
  }
}

class PriceAlertService {
  private alerts: PriceAlert[] = [];
  private alertListeners: Set<AlertListener> = new Set();
  private triggerListeners: Set<TriggerListener> = new Set();
  private pollIntervalId: number | null = null;
  private isChecking = false;

  constructor() {
    this.loadAlerts();
    this.startLiveMonitoring();
  }

  private loadAlerts(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.alerts = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load price alerts from storage:', e);
      this.alerts = [];
    }
  }

  private saveAlerts(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.alerts));
      this.notifyAlertListeners();
    } catch (e) {
      console.warn('Failed to save price alerts to storage:', e);
    }
  }

  private notifyAlertListeners(): void {
    const copy = [...this.alerts];
    this.alertListeners.forEach((l) => l(copy));
  }

  private notifyTriggerListeners(event: AlertTriggerEvent): void {
    this.triggerListeners.forEach((l) => l(event));
  }

  public getAlerts(): PriceAlert[] {
    return [...this.alerts];
  }

  public getAlertsForPair(pair: string): PriceAlert[] {
    const clean = cleanSymbol(pair);
    return this.alerts.filter((a) => cleanSymbol(a.pair) === clean);
  }

  public getActiveCount(): number {
    return this.alerts.filter((a) => a.isActive && !a.isTriggered).length;
  }

  public addAlert(params: {
    pair: string;
    tradeMode: TradingMode;
    spotVenue?: SpotVenue;
    targetType: PriceAlertTargetType;
    targetPrice: number;
    proximityPct?: number;
    condition?: PriceAlertCondition;
    note?: string;
    initialPrice?: number;
    soundEnabled?: boolean;
  }): PriceAlert {
    const clean = cleanSymbol(params.pair);
    const newAlert: PriceAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      pair: clean || params.pair.toUpperCase().trim(),
      tradeMode: params.tradeMode,
      spotVenue: params.spotVenue,
      targetType: params.targetType,
      targetPrice: Number(params.targetPrice),
      initialPrice: params.initialPrice ? Number(params.initialPrice) : undefined,
      proximityPct: params.proximityPct !== undefined ? Number(params.proximityPct) : 0.5,
      condition: params.condition || 'APPROACHING',
      note: params.note?.trim(),
      createdAt: new Date().toISOString(),
      isActive: true,
      isTriggered: false,
      soundEnabled: params.soundEnabled ?? true,
    };

    this.alerts.unshift(newAlert);
    this.saveAlerts();

    // Immediately evaluate in case current price already satisfies
    if (params.initialPrice && params.initialPrice > 0) {
      this.evaluatePrice(newAlert.pair, params.initialPrice, newAlert.tradeMode, newAlert.spotVenue);
    }

    return newAlert;
  }

  public updateAlert(id: string, updates: Partial<PriceAlert>): void {
    this.alerts = this.alerts.map((a) => (a.id === id ? { ...a, ...updates } : a));
    this.saveAlerts();
  }

  public toggleAlert(id: string, active?: boolean): void {
    this.alerts = this.alerts.map((a) => {
      if (a.id === id) {
        const nextActive = active !== undefined ? active : !a.isActive;
        return {
          ...a,
          isActive: nextActive,
          // If reactivating a triggered alert, un-trigger it so it monitors again
          isTriggered: nextActive ? false : a.isTriggered,
        };
      }
      return a;
    });
    this.saveAlerts();
  }

  public rearmAlert(id: string): void {
    this.alerts = this.alerts.map((a) => {
      if (a.id === id) {
        return {
          ...a,
          isActive: true,
          isTriggered: false,
          triggeredAt: undefined,
          triggeredPrice: undefined,
        };
      }
      return a;
    });
    this.saveAlerts();
  }

  public deleteAlert(id: string): void {
    this.alerts = this.alerts.filter((a) => a.id !== id);
    this.saveAlerts();
  }

  public clearAllTriggered(): void {
    this.alerts = this.alerts.filter((a) => !a.isTriggered);
    this.saveAlerts();
  }

  public clearAllAlerts(): void {
    this.alerts = [];
    this.saveAlerts();
  }

  public subscribe(listener: AlertListener): () => void {
    this.alertListeners.add(listener);
    listener([...this.alerts]);
    return () => {
      this.alertListeners.delete(listener);
    };
  }

  public onTrigger(listener: TriggerListener): () => void {
    this.triggerListeners.add(listener);
    return () => {
      this.triggerListeners.delete(listener);
    };
  }

  /**
   * Evaluates a current price against active alerts.
   * Returns triggered alerts.
   */
  public evaluatePrice(
    pair: string,
    currentPrice: number,
    mode?: TradingMode,
    spotVenue?: SpotVenue
  ): PriceAlert[] {
    if (!currentPrice || currentPrice <= 0 || isNaN(currentPrice)) return [];

    const clean = cleanSymbol(pair);
    const triggeredList: PriceAlert[] = [];
    let updated = false;

    this.alerts = this.alerts.map((alert) => {
      if (!alert.isActive || alert.isTriggered) return alert;

      const alertClean = cleanSymbol(alert.pair);
      if (alertClean !== clean) return alert;

      // Calculate distance percentage to target
      const diff = Math.abs(currentPrice - alert.targetPrice);
      const distancePct = alert.targetPrice > 0 ? (diff / alert.targetPrice) * 100 : 0;

      let isConditionMet = false;
      let reasonText = '';

      if (alert.condition === 'APPROACHING') {
        if (distancePct <= alert.proximityPct) {
          isConditionMet = true;
          reasonText = `Price is within ${distancePct.toFixed(2)}% of ${this.formatTargetLabel(alert.targetType)}`;
        }
      } else if (alert.condition === 'AT_OR_ABOVE') {
        if (currentPrice >= alert.targetPrice) {
          isConditionMet = true;
          reasonText = `Price reached or crossed above ${this.formatTargetLabel(alert.targetType)}`;
        }
      } else if (alert.condition === 'AT_OR_BELOW') {
        if (currentPrice <= alert.targetPrice) {
          isConditionMet = true;
          reasonText = `Price reached or dropped below ${this.formatTargetLabel(alert.targetType)}`;
        }
      }

      if (isConditionMet) {
        updated = true;
        const targetName = this.formatTargetLabel(alert.targetType);
        const message = `${alert.pair} ${targetName} Alert! Current: $${this.formatNumber(currentPrice)} (Target: $${this.formatNumber(alert.targetPrice)}, ${distancePct.toFixed(2)}% away).`;

        // 1. Play sound chime if enabled
        if (alert.soundEnabled) {
          const soundType = alert.targetType === 'STOP_LOSS' ? 'warning' : alert.targetType === 'TAKE_PROFIT' ? 'success' : 'alert';
          playAlertSound(soundType);
        }

        // 2. Browser Notification API
        sendBrowserNotification(`🚨 Price Alert: ${alert.pair} (${targetName})`, {
          body: message,
          tag: alert.id,
        });

        // 3. In-App Trigger Event
        const triggerEvent: AlertTriggerEvent = {
          alert: {
            ...alert,
            isTriggered: true,
            triggeredAt: new Date().toISOString(),
            triggeredPrice: currentPrice,
            lastCheckedPrice: currentPrice,
          },
          currentPrice,
          distancePct,
          message,
          timestamp: Date.now(),
        };

        this.notifyTriggerListeners(triggerEvent);
        triggeredList.push(triggerEvent.alert);

        return {
          ...alert,
          isTriggered: true,
          triggeredAt: new Date().toISOString(),
          triggeredPrice: currentPrice,
          lastCheckedPrice: currentPrice,
        };
      }

      // Update last checked price
      return {
        ...alert,
        lastCheckedPrice: currentPrice,
      };
    });

    if (updated) {
      this.saveAlerts();
    }

    return triggeredList;
  }

  /**
   * Periodically check prices of active alerts in the background
   */
  private startLiveMonitoring(): void {
    if (typeof window === 'undefined') return;

    // Listen to marketDataService price broadcasts
    marketDataService.subscribeAll((cachedPrices) => {
      if (this.isChecking) return;
      this.checkActiveAlertsAgainstCache(cachedPrices);
    });

    // Check periodically every 5 seconds
    this.pollIntervalId = window.setInterval(async () => {
      await this.pollActiveAlertPrices();
    }, 5000);
  }

  private checkActiveAlertsAgainstCache(cachedPrices: Record<string, { price?: number }>): void {
    const activeAlerts = this.alerts.filter((a) => a.isActive && !a.isTriggered);
    if (activeAlerts.length === 0) return;

    for (const alert of activeAlerts) {
      const clean = cleanSymbol(alert.pair);
      // Check cache
      const cached = cachedPrices[clean] || Object.values(cachedPrices).find((p: any) => p?.symbol === clean);
      if (cached && cached.price && cached.price > 0) {
        this.evaluatePrice(alert.pair, cached.price, alert.tradeMode, alert.spotVenue);
      }
    }
  }

  public async pollActiveAlertPrices(): Promise<void> {
    if (this.isChecking) return;
    const activeAlerts = this.alerts.filter((a) => a.isActive && !a.isTriggered);
    if (activeAlerts.length === 0) return;

    this.isChecking = true;
    try {
      const uniqueSymbols = Array.from(new Set(activeAlerts.map((a) => a.pair)));
      for (const sym of uniqueSymbols) {
        const matchingAlert = activeAlerts.find((a) => a.pair === sym);
        if (!matchingAlert) continue;

        try {
          const fetched = await marketDataService.getPrice(sym, {
            allowCache: true,
            context: {
              mode: matchingAlert.tradeMode,
              spotVenue: matchingAlert.spotVenue,
            },
          });
          if (fetched && fetched.price && fetched.price > 0) {
            this.evaluatePrice(sym, fetched.price, matchingAlert.tradeMode, matchingAlert.spotVenue);
          }
        } catch {
          // Ignore individual fetch failure
        }
      }
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Test browser notification & sound
   */
  public testNotification(): void {
    playAlertSound('alert');
    sendBrowserNotification('🔔 Price Alert Test Successful', {
      body: 'Browser notification integration is armed and working properly! You will be alerted when entry or exit prices approach.',
      tag: 'test-notification',
    });

    this.notifyTriggerListeners({
      alert: {
        id: 'test-alert',
        pair: 'BTC/USDT',
        tradeMode: 'PERPETUAL',
        targetType: 'ENTRY',
        targetPrice: 65000,
        proximityPct: 0.5,
        condition: 'APPROACHING',
        note: 'Test verification alert',
        createdAt: new Date().toISOString(),
        isActive: true,
        isTriggered: true,
        soundEnabled: true,
      },
      currentPrice: 65120,
      distancePct: 0.18,
      message: 'Test notification fired! Audio chime and browser alert verified.',
      timestamp: Date.now(),
    });
  }

  public formatTargetLabel(type: PriceAlertTargetType): string {
    switch (type) {
      case 'ENTRY':
        return 'Entry Price';
      case 'STOP_LOSS':
        return 'Stop Loss';
      case 'TAKE_PROFIT':
        return 'Take Profit';
      case 'CUSTOM':
        return 'Custom Target';
      default:
        return 'Target';
    }
  }

  private formatNumber(num: number): string {
    if (num >= 1000) {
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (num >= 1) {
      return num.toFixed(4);
    }
    return num.toFixed(6);
  }
}

export const priceAlertService = new PriceAlertService();
