import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TabId } from '@schema/models';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CalculatorFieldConfig {
  included: boolean;
  taxable?: boolean;
  label?: string;
  default?: number;
}

export interface CalculatorTabConfig {
  fields: Record<string, CalculatorFieldConfig>;
  disclaimer: string;
}

export type CalculatorConfig = Record<TabId, CalculatorTabConfig>;

// ── Default configuration ──────────────────────────────────────────────────────

export const DEFAULT_CALCULATOR_CONFIG: CalculatorConfig = {
  'purchase-mortgage': {
    fields: {
      otherDisbursements:   { included: true,  taxable: true,  label: 'Other Disbursements (est.)',              default: 250 },
      titleInsurance:       { included: false, taxable: true,  label: 'Title Insurance (est.)',                  default: 300 },
      titleRegistration:    { included: true,  taxable: false, label: 'Land Titles \u2014 Title Registration'                 },
      mortgageRegistration: { included: true,  taxable: false, label: 'Land Titles \u2014 Mortgage Registration'              },
      gst:                  { included: true,                  label: 'GST (5% on legal fee & disbursements)'                },
    },
    disclaimer:
      'Land Titles fees use the Government of Alberta\u2019s current registration formula ($50 + $5 per ' +
      '$5,000 of value, effective Oct. 2024) and are GST-exempt. Title insurance is not included in this ' +
      'estimate and may vary by lender, bank and/or circumstance.',
  },
  'cash-purchase': {
    fields: {
      otherDisbursements: { included: true,  taxable: true,  label: 'Other Disbursements (est.)',              default: 250 },
      titleInsurance:     { included: false, taxable: true,  label: 'Title Insurance (est.)',                  default: 300 },
      titleRegistration:  { included: true,  taxable: false, label: 'Land Titles \u2014 Title Registration'                 },
      gst:                { included: true,                  label: 'GST (5% on legal fee & disbursements)'                },
    },
    disclaimer:
      'Land Titles fees use the Government of Alberta\u2019s current registration formula and are GST-exempt.',
  },
  sale: {
    fields: {
      rpr:                { included: true,  taxable: true,  label: 'Real Property Report (est.)',                   default: 850 },
      condoEstoppel:      { included: true,  taxable: true,  label: 'Condominium Estoppel Certificate (est.)',       default: 250 },
      titleInsurance:     { included: false, taxable: true,  label: 'Title Insurance (est.)',                        default: 300 },
      mortgageDischarge:  { included: true,  taxable: false, label: 'Land Titles \u2014 Mortgage Discharge Fee',     default: 10  },
      otherDisbursements: { included: true,  taxable: true,  label: 'Other Disbursements (est.)',                    default: 250 },
      gst:                { included: true,                  label: 'GST (5% on legal fee & disbursements)'                     },
    },
    disclaimer:
      'The Land Titles discharge fee is GST-exempt. Title insurance is not included in this estimate and ' +
      'may vary by lender, bank and/or circumstance. Your lender may also charge separate payout fees.',
  },
  refinance: {
    fields: {
      mortgageRegistration: { included: true,  taxable: false, label: 'Land Titles \u2014 New Mortgage Registration' },
      dischargeFee:         { included: true,  taxable: false, label: 'Land Titles \u2014 Discharge Fee(s)'          },
      titleInsurance:       { included: false, taxable: true,  label: 'Title Insurance (est.)',                  default: 300 },
      otherDisbursements:   { included: true,  taxable: true,  label: 'Other Disbursements (est.)',              default: 250 },
      gst:                  { included: true,                  label: 'GST (5% on legal fee & disbursements)'                },
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
    disclaimer: 'Estate planning fees are flat rates plus GST; disbursements typically do not apply.',
  },
  incorporation: {
    fields: {
      filingFee:     { included: true, taxable: true,  label: 'Filing Fee',                              default: 100 },
      disbursements: { included: true, taxable: true,  label: 'Disbursements (est.)',                    default: 75  },
      govtFee:       { included: true, taxable: false, label: 'Government Filing Fee (tax-exempt)',      default: 275 },
      gst:           { included: true,                 label: 'GST (5% on legal fee, filing fee & disbursements)'    },
    },
    disclaimer: 'The government filing fee is GST-exempt. Disbursements may include name/NUANS searches.',
  },
};

// ── Service ───────────────────────────────────────────────────────────────────
//
// Persistence strategy:
//
//   1. localStorage is the optimistic store — every edit updates the signal
//      and writes to localStorage immediately so the UI never waits.
//   2. After each localStorage write, the full config is PUT to the Fastify
//      API (`/api/calc-config`) which writes to Firebase via the Admin SDK
//      with an audit trail. This call is fire-and-forget — failures are
//      logged but don't roll back the local edit.
//   3. On construction, localStorage is the authority. No Firebase read at
//      startup — eliminates the sync-stomping race condition entirely.
//
// Because apiURL is '' in all environments and the proxy handles local dev,
// the PUT call hits the same relative path everywhere:
//   Local  →  proxy → https://localhost:8228/api/calc-config
//   Staging → same-origin Vercel serverless function
//   Prod    → same-origin Vercel serverless function

const STORAGE_KEY = 'fl-calculator-config-v1';

@Injectable({ providedIn: 'root' })
export class CalculatorConfigService {
  private http = inject(HttpClient);

  private readonly _config = signal<CalculatorConfig>(this.loadInitial());
  readonly config = this._config.asReadonly();
  readonly lastSyncEntry = signal<string | null>(null);

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
    this._config.update(cfg => {
      const next = structuredClone(cfg);
      next[tab].disclaimer = text;
      return next;
    });
    this.persist();
  }

  importJson(json: string): void {
    const parsed = JSON.parse(json) as Partial<CalculatorConfig>;
    this._config.set(this.mergeWithDefaults(parsed));
    this.persist();
  }

  resetToDefaults(): void {
    this._config.set(structuredClone(DEFAULT_CALCULATOR_CONFIG));
    this.persist();
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private patchField(tab: TabId, field: string, patch: Partial<CalculatorFieldConfig>): void {
    this._config.update(cfg => {
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

  private mergeWithDefaults(saved: Partial<CalculatorConfig>): CalculatorConfig {
    const merged = structuredClone(DEFAULT_CALCULATOR_CONFIG);
    for (const tab of Object.keys(merged) as TabId[]) {
      const savedTab = saved?.[tab];
      if (!savedTab) continue;
      if (typeof savedTab.disclaimer === 'string') merged[tab].disclaimer = savedTab.disclaimer;
      for (const field of Object.keys(merged[tab].fields)) {
        const savedField = savedTab.fields?.[field];
        if (savedField) {
          merged[tab].fields[field] = { ...merged[tab].fields[field], ...savedField };
        }
      }
    }
    return merged;
  }

  private persist(): void {
    // 1. localStorage — immediate, optimistic
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._config()));
      this.lastSyncEntry.set(new Date().toISOString());
    } catch {
      // Ignore quota/availability errors — config still works in-memory.
    }

    // 2. API write-through — fire-and-forget to Firebase via Fastify
    this.http.put('/api/calc-config', this._config()).subscribe({
      error: (err) => console.warn('[CalcConfig] API write failed (local copy saved):', err?.status ?? err),
    });
  }
}