import { Injectable, inject, signal } from '@angular/core';
import { Database, ref, get, set } from '@angular/fire/database';
import { TabId } from '@schema/models';
import { CALCULATOR_CONFIG_ROOT } from '@schema/constants';

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

// ── Default configuration ──────────────────────────────────────────────────────
//
// This is the calculator's model state expressed as a data tree: every line
// item per tab, whether it's currently switched on, whether it's taxable,
// and the disclaimer text shown alongside it. This is the JSON that the
// admin settings panel (gear icon → password "admin") reads and writes, and
// what gets mirrored to Firebase at `public/calculatorConfig` (see below).

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
        default: 250,
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
// Firebase schema: public/calculatorConfig  →  the whole CalculatorConfig tree,
// written as a single object (small enough that per-field update() isn't worth
// the extra complexity — unlike SiteService's much larger siteContent tree).
//
// Load order, same "instant paint, reconcile after" shape as SiteService:
//   1. Construct with whatever's in localStorage (or hardcoded defaults) so
//      the calculator never blocks on a network round-trip to open.
//   2. Kick off a one-time Firebase read in the background; if it returns a
//      config, adopt it (merged onto defaults) and refresh the local cache.
//   3. Every write updates the signal + localStorage immediately (optimistic),
//      then pushes the whole tree to Firebase so other browsers/devices see
//      it on their next load.
//
// NOTE: like SiteService's updateField(), this writes directly from the
// client with no server-side validation — the same trust model already in
// use for the CMS. Firebase security rules for public/calculatorConfig
// should mirror whatever restricts public/siteContent writes today (public
// read, editor/lawyer-only write) before handing this off to the secretary.

const STORAGE_KEY = 'fl-calculator-config-v1';

@Injectable({ providedIn: 'root' })
export class CalculatorConfigService {
  private db = inject(Database);

  private readonly _config = signal<CalculatorConfig>(this.loadInitial());
  readonly config = this._config.asReadonly();

  constructor() {
    this.syncFromFirebase();
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

  // ── Writes ───────────────────────────────────────────────────────────────
  // Each of these updates the signal + localStorage first (optimistic, so the
  // settings panel never feels laggy), then fires the Firebase write in the
  // background. A failed Firebase write is logged but not rolled back — the
  // local edit still "sticks" for this browser even if the network hiccups.

  setFieldIncluded(tab: TabId, field: string, included: boolean): void {
    this.patchField(tab, field, { included });
  }

  setFieldTaxable(tab: TabId, field: string, taxable: boolean): void {
    this.patchField(tab, field, { taxable });
  }

  setFieldLabel(tab: TabId, field: string, label: string): void {
    this.patchField(tab, field, { label });
  }

  setFieldDefault(tab: TabId, field: string, value: number): void {
    this.patchField(tab, field, { default: Math.max(0, Number(value) || 0) });
  }

  setDisclaimer(tab: TabId, text: string): void {
    this._config.update((cfg) => {
      const next = structuredClone(cfg);
      next[tab].disclaimer = text;
      return next;
    });
    this.persist();
  }

  /** Replace the entire config from a raw JSON string (validated + merged onto defaults). */
  importJson(json: string): void {
    const parsed = JSON.parse(json) as Partial<CalculatorConfig>;
    this._config.set(this.mergeWithDefaults(parsed));
    this.persist();
  }

  resetToDefaults(): void {
    this._config.set(structuredClone(DEFAULT_CALCULATOR_CONFIG));
    this.persist();
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private patchField(
    tab: TabId,
    field: string,
    patch: Partial<CalculatorFieldConfig>,
  ): void {
    this._config.update((cfg) => {
      const next = structuredClone(cfg);
      if (next[tab]?.fields?.[field]) {
        next[tab].fields[field] = { ...next[tab].fields[field], ...patch };
      }
      return next;
    });
    this.persist();
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

  /** One-time background read from Firebase — adopts it if present, same
   *  "cache first, reconcile after" shape as SiteService.getSection(). */
  private async syncFromFirebase(): Promise<void> {
    try {
      const snapshot = await get(ref(this.db, CALCULATOR_CONFIG_ROOT));
      if (snapshot.exists()) {
        this._config.set(
          this.mergeWithDefaults(snapshot.val() as Partial<CalculatorConfig>),
        );
        this.cacheLocally();
      } else {
        // Nothing in Firebase yet (first run) — seed it with whatever
        // this browser currently has (localStorage or defaults).
        await set(ref(this.db, CALCULATOR_CONFIG_ROOT), this._config());
      }
    } catch (err) {
      console.error(
        '[CalculatorConfigService] Firebase sync failed — using local config:',
        err,
      );
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

  /** Persist a write everywhere: localStorage now, Firebase in the background. */
  private persist(): void {
    this.cacheLocally();
    set(ref(this.db, CALCULATOR_CONFIG_ROOT), this._config()).catch((err) => {
      console.error(
        '[CalculatorConfigService] Firebase write failed (local copy still saved):',
        err,
      );
    });
  }
}
