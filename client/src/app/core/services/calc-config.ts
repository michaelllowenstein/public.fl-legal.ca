import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { env } from '@env/environment';
import { TabId } from '@schema/models';
import { LoggerService } from './logger';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * One configurable line-item within a calculator tab.
 *
 * `included`  — whether the field is shown at all, and whether its value is
 *               added to the total. This is the "include/exclude" switch.
 * `taxable`   — whether this field's value counts toward the GST base (only
 *               meaningful for cost fields; omit for the `gst` field itself).
 * `label`     — the display label; editable so wording can be tuned without
 *               a code change.
 * `default`   — for fields with an editable input (e.g. Other Disbursements),
 *               the amount the calculator resets to on relaunch. For fixed
 *               fees that aren't user-editable (e.g. incorporation Filing
 *               Fee), this IS the fee amount.
 */
export interface CalculatorFieldConfig {
  included: boolean;
  taxable?: boolean;
  label?: string;
  default?: number;
}

export interface CalculatorTabConfig {
  fields: Record<string, CalculatorFieldConfig>;
  /** Footnote/disclaimer shown under the estimated breakdown for this tab. */
  disclaimer: string;
}

export type CalculatorConfig = Record<TabId, CalculatorTabConfig>;

/** Which sub-property of a field (or tab) a given write touched. */
export type CalculatorSyncProperty =
  | 'included'
  | 'taxable'
  | 'label'
  | 'default'
  | 'disclaimer'
  | 'importJson'
  | 'resetToDefaults';

/**
 * One entry in the in-memory sync log — one per write attempt. `status`
 * starts 'pending' the instant a write is fired, then flips to 'confirmed'
 * only once the API responds 2xx, or 'error' if the request failed (network
 * error, validation error, or — most commonly now — 401/403 because the
 * current session isn't a logged-in editor). This is what lets the admin
 * settings panel (or the browser console, via LoggerService's ring buffer)
 * show real verified state instead of just trusting an optimistic update.
 */
export interface CalculatorSyncLogEntry {
  id: string;
  timestamp: string;
  tab: TabId | 'all';
  field?: string;
  property?: CalculatorSyncProperty;
  previousValue?: unknown;
  newValue?: unknown;
  status: 'pending' | 'confirmed' | 'error';
  error?: string;
}

const SYNC_LOG_MAX_ENTRIES = 25;

// ── Default configuration ──────────────────────────────────────────────────────
//
// This is the calculator's model state expressed as a data tree: every line
// item per tab, whether it's currently switched on, whether it's taxable,
// and the disclaimer text shown alongside it. This is the JSON that the
// admin settings panel (gear icon → password "admin") reads and writes.
//
// Disbursements defaults (Other Disbursements / Disbursements est.):
//   purchase-mortgage (buy w/ mortgage): $250
//   sale (selling):                       $250
//   cash-purchase (buy cash):             $200
//   refinance:                            $200
//
// NOTE: these are only the CODE defaults. mergeWithDefaults() lets whatever
// is actually live on the server win for any field it has an explicit value
// for — so changing a number here does not retroactively change a value
// that's already been saved. Use the admin settings panel (or a direct
// PATCH /api/calc-config) to update what's live.

export const DEFAULT_CALCULATOR_CONFIG: CalculatorConfig = {
  'purchase-mortgage': {
    fields: {
      otherDisbursements: {
        included: true,
        taxable: true,
        label: 'Other Disbursements (est.)',
        default: 250,
      },
      titleInsurance: {
        included: false,
        taxable: true,
        label: 'Title Insurance (est.)',
        default: 300,
      },
      titleRegistration: {
        included: true,
        taxable: false,
        label: 'Land Titles — Title Registration',
      },
      mortgageRegistration: {
        included: true,
        taxable: false,
        label: 'Land Titles — Mortgage Registration',
      },
      gst: { included: true, label: 'GST (5% on legal fee & disbursements)' },
    },
    disclaimer:
      'Land Titles fees use the Government of Alberta\u2019s current registration formula ($50 + $5 per ' +
      '$5,000 of value, effective Oct. 2024) and are GST-exempt. Title insurance is not included in this ' +
      'estimate and may vary by lender, bank and/or circumstance.',
  },
  'cash-purchase': {
    fields: {
      otherDisbursements: {
        included: true,
        taxable: true,
        label: 'Other Disbursements (est.)',
        default: 200,
      },
      titleInsurance: {
        included: false,
        taxable: true,
        label: 'Title Insurance (est.)',
        default: 300,
      },
      titleRegistration: {
        included: true,
        taxable: false,
        label: 'Land Titles — Title Registration',
      },
      gst: { included: true, label: 'GST (5% on legal fee & disbursements)' },
    },
    disclaimer:
      'Land Titles fees use the Government of Alberta\u2019s current registration formula and are GST-exempt.',
  },
  sale: {
    fields: {
      rpr: {
        included: true,
        taxable: true,
        label: 'Real Property Report (est.)',
        default: 850,
      },
      condoEstoppel: {
        included: true,
        taxable: true,
        label: 'Condominium Estoppel Certificate (est.)',
        default: 250,
      },
      titleInsurance: {
        included: false,
        taxable: true,
        label: 'Title Insurance (est.)',
        default: 300,
      },
      mortgageDischarge: {
        included: true,
        taxable: false,
        label: 'Land Titles — Mortgage Discharge Fee',
        default: 10,
      },
      otherDisbursements: {
        included: true,
        taxable: true,
        label: 'Other Disbursements (est.)',
        default: 250,
      },
      gst: { included: true, label: 'GST (5% on legal fee & disbursements)' },
    },
    disclaimer:
      'The Land Titles discharge fee is GST-exempt. Title insurance is not included in this estimate and ' +
      'may vary by lender, bank and/or circumstance. Your lender may also charge separate payout fees.',
  },
  refinance: {
    fields: {
      mortgageRegistration: {
        included: true,
        taxable: false,
        label: 'Land Titles — New Mortgage Registration',
      },
      dischargeFee: {
        included: true,
        taxable: false,
        label: 'Land Titles — Discharge Fee(s)',
      },
      titleInsurance: {
        included: false,
        taxable: true,
        label: 'Title Insurance (est.)',
        default: 300,
      },
      otherDisbursements: {
        included: true,
        taxable: true,
        label: 'Other Disbursements (est.)',
        default: 200,
      },
      gst: { included: true, label: 'GST (5% on legal fee & disbursements)' },
    },
    disclaimer:
      'Land Titles fees use the Government of Alberta\u2019s current registration formula and are ' +
      'GST-exempt. Title insurance is not included in this estimate and may vary by lender, bank ' +
      'and/or circumstance.',
  },
  wills: {
    fields: {
      gst: { included: true, label: 'GST (5%)' },
    },
    disclaimer:
      'Estate planning fees are flat rates plus GST; disbursements typically do not apply.',
  },
  incorporation: {
    fields: {
      filingFee: {
        included: true,
        taxable: true,
        label: 'Filing Fee',
        default: 100,
      },
      disbursements: {
        included: true,
        taxable: true,
        label: 'Disbursements (est.)',
        default: 75,
      },
      govtFee: {
        included: true,
        taxable: false,
        label: 'Government Filing Fee (tax-exempt)',
        default: 275,
      },
      gst: {
        included: true,
        label: 'GST (5% on legal fee, filing fee & disbursements)',
      },
    },
    disclaimer:
      'The government filing fee is GST-exempt. Disbursements may include name/NUANS searches.',
  },
};

// ── Service ───────────────────────────────────────────────────────────────────
//
// Traffic model (changed from the direct-RTDB version):
//   • GET  /api/calc-config  — public, no auth. Used on load and by verifyNow().
//   • PATCH /api/calc-config — editor JWT required. One field per call.
//     { key: "<tab>/fields/<field>/<property>", value } or "<tab>/disclaimer".
//   • PUT  /api/calc-config  — editor JWT required. Full-tree replace, used
//     by importJson() and resetToDefaults().
//
// The JWT itself is never handled here — the app-wide `jwtInterceptor`
// attaches whichever Bearer token exists (lawyer or editor) to any request
// whose URL contains "/api/", exactly like every other authenticated
// service in this app (CalendarService, NotificationService, etc.).
//
// Load order, same "instant paint, reconcile after" shape as before:
//   1. Construct with whatever's in localStorage (or hardcoded defaults) so
//      the calculator never blocks on a network round-trip to open.
//   2. Kick off a one-time API read in the background; if it returns a
//      config, adopt it (merged onto defaults) and refresh the local cache.
//   3. Every write updates the signal + localStorage immediately (optimistic),
//      then PATCHes/PUTs the API. On success the write is marked 'confirmed'
//      in syncLog. On failure (most commonly a 401/403 because the current
//      session isn't a logged-in editor) the local state is ROLLED BACK to
//      its previous value and syncLog records the real error message from
//      the server — unlike the old direct-RTDB version, a failed write no
//      longer just quietly "sticks locally" while silently failing remotely.
//
// NOTE: unlike before, this service no longer talks to Firebase directly at
// all (no `inject(Database)`) — every read and write goes through the API,
// which is the only thing with credentials to write to Firebase. Reads stay
// public/unauthenticated on the server side (see routes/calc-config.ts).

const STORAGE_KEY = 'fl-calculator-config-v1';

@Injectable({ providedIn: 'root' })
export class CalculatorConfigService {
  private http = inject(HttpClient);
  private log  = inject(LoggerService).child('calcConfig');
  private readonly apiBase = `${env.apiURL}/api/calc-config`;

  private readonly _config = signal<CalculatorConfig>(this.loadInitial());
  readonly config = this._config.asReadonly();

  private readonly _syncLog = signal<CalculatorSyncLogEntry[]>([]);
  /** Newest-first log of the last 25 write attempts, with verified status. */
  readonly syncLog = this._syncLog.asReadonly();

  private readonly _lastSyncedAt = signal<string | null>(null);
  /** ISO timestamp of the last write the API confirmed. */
  readonly lastSyncedAt = this._lastSyncedAt.asReadonly();

  /** True while at least one write is still awaiting an API response. */
  readonly hasPendingWrites = computed(() =>
    this._syncLog().some((entry) => entry.status === 'pending'),
  );

  /** Most recent write attempt, whatever its status — handy for a status badge. */
  readonly lastSyncEntry = computed(() => this._syncLog()[0] ?? null);

  constructor() {
    this.syncFromApi();
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  isIncluded(tab: TabId, field: string): boolean {
    return this._config()[tab]?.fields?.[field]?.included ?? false;
  }

  isTaxable(tab: TabId, field: string): boolean {
    return this._config()[tab]?.fields?.[field]?.taxable ?? false;
  }

  hasTaxableFlag(tab: TabId, field: string): boolean {
    return this._config()[tab]?.fields?.[field]?.taxable !== undefined;
  }

  hasDefault(tab: TabId, field: string): boolean {
    return this._config()[tab]?.fields?.[field]?.default !== undefined;
  }

  fieldLabel(tab: TabId, field: string, fallback: string): string {
    return this._config()[tab]?.fields?.[field]?.label ?? fallback;
  }

  fieldDefault(tab: TabId, field: string, fallback: number): number {
    return this._config()[tab]?.fields?.[field]?.default ?? fallback;
  }

  disclaimer(tab: TabId): string {
    return this._config()[tab]?.disclaimer ?? '';
  }

  fieldKeys(tab: TabId): string[] {
    return Object.keys(this._config()[tab]?.fields ?? {});
  }

  exportJson(): string {
    return JSON.stringify(this._config(), null, 2);
  }

  /**
   * On-demand check: fetches /api/calc-config right now and reports whether
   * the effective (merged-onto-defaults) remote config matches local state,
   * without writing anything. Use this any time you want to confirm "is
   * what's live actually what I think it is" — e.g. after a batch of edits,
   * or to check for changes made from another browser/device.
   */
  async verifyNow(): Promise<{ matches: boolean; remote: CalculatorConfig | null }> {
    try {
      const raw = await firstValueFrom(
        this.http.get<Partial<CalculatorConfig>>(this.apiBase),
      );
      const remoteMerged = this.mergeWithDefaults(raw ?? {});
      const matches = JSON.stringify(remoteMerged) === JSON.stringify(this._config());

      if (matches) {
        this.log.info('verifyNow — remote config matches local state', {});
      } else {
        this.log.warn('verifyNow — remote config does NOT match local state', {
          remote: remoteMerged,
          local: this._config(),
        });
      }
      return { matches, remote: remoteMerged };
    } catch (e: unknown) {
      const err = e as HttpErrorResponse;
      this.log.error('verifyNow failed', { status: err?.status, message: err?.message });
      return { matches: false, remote: null };
    }
  }

  // ── Writes ───────────────────────────────────────────────────────────────
  // Each of these updates the signal + localStorage first (optimistic, so the
  // settings panel never feels laggy), then calls persistAndVerify() to PATCH
  // the API. If the API rejects the write, the optimistic change is rolled
  // back and syncLog records the real reason (e.g. "Editor access required.").

  setFieldIncluded(tab: TabId, field: string, included: boolean): void {
    this.patchField(tab, field, 'included', included);
  }

  setFieldTaxable(tab: TabId, field: string, taxable: boolean): void {
    this.patchField(tab, field, 'taxable', taxable);
  }

  setFieldLabel(tab: TabId, field: string, label: string): void {
    this.patchField(tab, field, 'label', label);
  }

  setFieldDefault(tab: TabId, field: string, value: number): void {
    this.patchField(tab, field, 'default', Math.max(0, Number(value) || 0));
  }

  setDisclaimer(tab: TabId, text: string): void {
    const previousValue = this._config()[tab]?.disclaimer;

    this._config.update((cfg) => {
      const next = structuredClone(cfg);
      next[tab].disclaimer = text;
      return next;
    });
    this.cacheLocally();

    this.persistPatch(
      { tab, property: 'disclaimer', previousValue, newValue: text },
      `${tab}/disclaimer`,
      text,
      () => {
        this._config.update((cfg) => {
          const next = structuredClone(cfg);
          next[tab].disclaimer = (previousValue as string) ?? '';
          return next;
        });
        this.cacheLocally();
      },
    );
  }

  /** Replace the entire config from a raw JSON string (validated + merged onto defaults). */
  importJson(json: string): void {
    const previousConfig = this._config();
    const parsed = JSON.parse(json) as Partial<CalculatorConfig>;
    const merged = this.mergeWithDefaults(parsed);

    this._config.set(merged);
    this.cacheLocally();

    this.persistReplace(
      {
        tab: 'all',
        property: 'importJson',
        previousValue: `${Object.keys(previousConfig).length} tab(s) — previous config`,
        newValue: `${Object.keys(merged).length} tab(s) — imported config`,
      },
      merged,
      () => {
        this._config.set(previousConfig);
        this.cacheLocally();
      },
    );
  }

  resetToDefaults(): void {
    const previousConfig = this._config();
    const defaults = structuredClone(DEFAULT_CALCULATOR_CONFIG);

    this._config.set(defaults);
    this.cacheLocally();

    this.persistReplace(
      {
        tab: 'all',
        property: 'resetToDefaults',
        previousValue: `${Object.keys(previousConfig).length} tab(s) — previous config`,
        newValue: 'DEFAULT_CALCULATOR_CONFIG',
      },
      defaults,
      () => {
        this._config.set(previousConfig);
        this.cacheLocally();
      },
    );
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private patchField(
    tab: TabId,
    field: string,
    property: 'included' | 'taxable' | 'label' | 'default',
    value: boolean | string | number,
  ): void {
    const previousValue = this._config()[tab]?.fields?.[field]?.[property];

    this._config.update((cfg) => {
      const next = structuredClone(cfg);
      if (next[tab]?.fields?.[field]) {
        next[tab].fields[field] = { ...next[tab].fields[field], [property]: value };
      }
      return next;
    });
    this.cacheLocally();

    this.persistPatch(
      { tab, field, property, previousValue, newValue: value },
      `${tab}/fields/${field}/${property}`,
      value,
      () => {
        this._config.update((cfg) => {
          const next = structuredClone(cfg);
          if (next[tab]?.fields?.[field]) {
            next[tab].fields[field] = { ...next[tab].fields[field], [property]: previousValue };
          }
          return next;
        });
        this.cacheLocally();
      },
    );
  }

  private loadInitial(): CalculatorConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_CALCULATOR_CONFIG);
      return this.mergeWithDefaults(JSON.parse(raw));
    } catch {
      return structuredClone(DEFAULT_CALCULATOR_CONFIG);
    }
  }

  /** One-time background read from the API — adopts it if present. */
  private async syncFromApi(): Promise<void> {
    try {
      const raw = await firstValueFrom(
        this.http.get<Partial<CalculatorConfig>>(this.apiBase),
      );
      if (raw && Object.keys(raw).length > 0) {
        this._config.set(this.mergeWithDefaults(raw));
        this.cacheLocally();
        this.log.info('Initial sync — loaded existing config from API', {});
      } else {
        this.log.info('Initial sync — API returned no config yet; using local/default config', {});
      }
    } catch (e: unknown) {
      const err = e as HttpErrorResponse;
      this.log.warn('Initial API sync failed — using local/default config', {
        status: err?.status,
        message: err?.message,
      });
    }
  }

  /** Shallow-merges a saved/pasted config onto the defaults so newly added
   *  fields introduced by later code changes are never silently dropped. */
  private mergeWithDefaults(
    saved: Partial<CalculatorConfig>,
  ): CalculatorConfig {
    const merged = structuredClone(DEFAULT_CALCULATOR_CONFIG);
    for (const tab of Object.keys(merged) as TabId[]) {
      const savedTab = saved?.[tab];
      if (!savedTab) continue;
      if (typeof savedTab.disclaimer === 'string')
        merged[tab].disclaimer = savedTab.disclaimer;
      for (const field of Object.keys(merged[tab].fields)) {
        const savedField = savedTab.fields?.[field];
        if (savedField) {
          merged[tab].fields[field] = {
            ...merged[tab].fields[field],
            ...savedField,
          };
        }
      }
    }
    return merged;
  }

  private cacheLocally(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._config()));
    } catch {
      // Ignore quota/availability errors — config still works in-memory for this session.
    }
  }

  /**
   * PATCHes a single field to the API, logs a pending → confirmed/error
   * entry in syncLog, and calls `rollback()` if the request fails.
   */
  private persistPatch(
    meta: Omit<CalculatorSyncLogEntry, 'id' | 'timestamp' | 'status' | 'error'>,
    key: string,
    value: unknown,
    rollback: () => void,
  ): void {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const timestamp = new Date().toISOString();
    const label = [meta.tab, meta.field, meta.property].filter(Boolean).join('.');

    this.pushLogEntry({ id, timestamp, status: 'pending', ...meta });
    this.log.debug(`→ PATCH "${label}"`, { previous: meta.previousValue, next: meta.newValue });

    firstValueFrom(this.http.patch<{ ok: boolean; at: string }>(this.apiBase, { key, value }))
      .then((res) => {
        this._lastSyncedAt.set(res?.at ?? new Date().toISOString());
        this.updateLogEntry(id, { status: 'confirmed' });
        this.log.info(`✓ Confirmed "${label}"`, { previous: meta.previousValue, new: meta.newValue });
      })
      .catch((e: unknown) => {
        const err = e as HttpErrorResponse;
        const message = (err?.error?.error as string) ?? err?.message ?? 'Request failed';
        this.updateLogEntry(id, { status: 'error', error: message });
        this.log.error(`✗ PATCH failed for "${label}" — local change rolled back`, {
          status: err?.status,
          message,
        });
        rollback();
      });
  }

  /**
   * PUTs the entire config tree to the API (importJson / resetToDefaults),
   * logs a pending → confirmed/error entry, and calls `rollback()` on failure.
   */
  private persistReplace(
    meta: Omit<CalculatorSyncLogEntry, 'id' | 'timestamp' | 'status' | 'error'>,
    body: CalculatorConfig,
    rollback: () => void,
  ): void {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const timestamp = new Date().toISOString();
    const label = meta.property ?? 'replace';

    this.pushLogEntry({ id, timestamp, status: 'pending', ...meta });
    this.log.debug(`→ PUT "${label}" (full tree)`, { previous: meta.previousValue, next: meta.newValue });

    firstValueFrom(this.http.put<{ ok: boolean; at: string }>(this.apiBase, body))
      .then((res) => {
        this._lastSyncedAt.set(res?.at ?? new Date().toISOString());
        this.updateLogEntry(id, { status: 'confirmed' });
        this.log.info(`✓ Confirmed "${label}"`, { previous: meta.previousValue, new: meta.newValue });
      })
      .catch((e: unknown) => {
        const err = e as HttpErrorResponse;
        const message = (err?.error?.error as string) ?? err?.message ?? 'Request failed';
        this.updateLogEntry(id, { status: 'error', error: message });
        this.log.error(`✗ PUT failed for "${label}" — local change rolled back`, {
          status: err?.status,
          message,
        });
        rollback();
      });
  }

  private pushLogEntry(entry: CalculatorSyncLogEntry): void {
    this._syncLog.update((log) => [entry, ...log].slice(0, SYNC_LOG_MAX_ENTRIES));
  }

  private updateLogEntry(id: string, patch: Partial<CalculatorSyncLogEntry>): void {
    this._syncLog.update((log) =>
      log.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  }
}