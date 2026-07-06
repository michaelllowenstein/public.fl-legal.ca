import {
    Component,
    ChangeDetectionStrategy,
    signal,
    computed,
    inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { FLIcon } from '@components/ui/icon';
import { ltoFee, round2, esc } from '@schema/utils';
import { TabId, CalcResult, ResultLine } from '@schema/models';
import { TABS, WILL_LABELS, GST_RATE } from '@schema/constants';
import { injectDialogClose } from '@components/factory/dialog/tokens';
import { CalculatorConfigService } from '@core/services/calc-config';
import { AuthService } from '@core/services/auth';

// ── Component ─────────────────────────────────────────────────────────────────

type CalculatorMode = 'calculator' | 'settings';

@Component({
    selector: 'app-calculator',
    standalone: true,
    imports: [FormsModule, NgClass, FLIcon],
    templateUrl: './index.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    styles: [`
    :host .fl-label {
      @apply block font-sans text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5;
    }
    :host .fl-input {
      @apply w-full border rounded-lg px-3 py-2.5 font-sans text-sm text-brand border-gray-300
             focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-transparent
             transition-shadow;
    }
    :host .fl-hint {
      @apply mt-1.5 font-sans text-[11px] text-gray-400 leading-relaxed;
    }
  `],
})
export class Calculator {
    private router: Router = inject(Router);
    close = injectDialogClose<void>();

    readonly calcConfig: CalculatorConfigService = inject(CalculatorConfigService);
    private readonly auth: AuthService = inject(AuthService);

    tabs = TABS;
    activeTab = signal<TabId>('purchase-mortgage');

    pdfBlocked = signal(false);

    // ── View mode (calculator vs. admin settings) ──────────────────────────────
    mode = signal<CalculatorMode>('calculator');
    settingsUnlocked = signal(false);
    passwordInput = signal('');
    passwordError = signal(false);
    settingsTab = signal<TabId>('purchase-mortgage');
    showRawJson = signal(false);
    rawJsonDraft = signal('');
    rawJsonError = signal<string | null>(null);

    // Real estate (shared) ─────────────────────────────────────────────────────
    propertyValue = signal(500000);
    mortgageAmount = signal(400000);
    hasMortgage = signal(true);
    otherDisbursements = signal<Record<TabId, number>>({
        'purchase-mortgage': this.calcConfig.fieldDefault('purchase-mortgage', 'otherDisbursements', 250),
        'cash-purchase': this.calcConfig.fieldDefault('cash-purchase', 'otherDisbursements', 200),
        sale: this.calcConfig.fieldDefault('sale', 'otherDisbursements', 200),
        refinance: this.calcConfig.fieldDefault('refinance', 'otherDisbursements', 200),
        wills: 0,
        incorporation: 0,
    });
    titleInsurance = signal(this.calcConfig.fieldDefault('purchase-mortgage', 'titleInsurance', 300));

    // Sale-specific ────────────────────────────────────────────────────────────
    propertyKind = signal<'house' | 'condo'>('house');
    rprFee = signal(this.calcConfig.fieldDefault('sale', 'rpr', 850));
    condoEstoppelFee = signal(this.calcConfig.fieldDefault('sale', 'condoEstoppel', 250));

    /** Which report types the current config allows, and which one is in effect. */
    saleReportAvailability = computed(() => {
        const fields = this.calcConfig.config()['sale'].fields;
        return {
            house: fields['rpr']?.included ?? false,
            condo: fields['condoEstoppel']?.included ?? false,
        };
    });
    effectiveSaleKind = computed<'house' | 'condo' | null>(() => {
        const avail = this.saleReportAvailability();
        if (avail.house && avail.condo) return this.propertyKind();
        if (avail.house) return 'house';
        if (avail.condo) return 'condo';
        return null;
    });

    // Refinance ──────────────────────────────────────────────────────────────
    refinanceAmount = signal(400000);
    payoutCount = signal(1);

    // Wills & estate planning ──────────────────────────────────────────────────
    willParty = signal<'single' | 'couple'>('single');
    willPackage = signal<string>('package');

    // Incorporation ──────────────────────────────────────────────────────────
    corpType = signal<'standard' | 'professional'>('standard');
    incorpDisbursements = signal(this.calcConfig.fieldDefault('incorporation', 'disbursements', 75));

    result = computed<CalcResult>(() => {
        switch (this.activeTab()) {
            case 'purchase-mortgage': return this.purchaseMortgageResult();
            case 'cash-purchase': return this.cashPurchaseResult();
            case 'sale': return this.saleResult();
            case 'refinance': return this.refinanceResult();
            case 'wills': return this.willsResult();
            case 'incorporation': return this.incorporationResult();
        }
    });

    // ── Navigation ───────────────────────────────────────────────────────────

    goToContact() {
        this.close();
        this.router.navigateByUrl('/contact-us');
    }

    // ── Input handlers (clamped) ────────────────────────────────────────────

    onPropertyValue(v: unknown) { this.propertyValue.set(Math.max(0, Number(v) || 0)); }
    onMortgageAmount(v: unknown) { this.mortgageAmount.set(Math.max(0, Number(v) || 0)); }
    onOtherDisbursements(tab: TabId, v: unknown) {
        const value = Math.max(0, Number(v) || 0);
        this.otherDisbursements.update((current) => ({ ...current, [tab]: value }));
    }
    onTitleInsurance(v: unknown) { this.titleInsurance.set(Math.max(0, Number(v) || 0)); }
    onRprFee(v: unknown) { this.rprFee.set(Math.max(0, Number(v) || 0)); }
    onCondoEstoppelFee(v: unknown) { this.condoEstoppelFee.set(Math.max(0, Number(v) || 0)); }
    onRefinanceAmount(v: unknown) { this.refinanceAmount.set(Math.max(0, Number(v) || 0)); }
    onPayoutCount(v: unknown) { this.payoutCount.set(Math.max(1, Math.round(Number(v)) || 1)); }
    onIncorpDisbursements(v: unknown) { this.incorpDisbursements.set(Math.max(0, Number(v) || 0)); }

    fmt(n: number): string {
        return new Intl.NumberFormat('en-CA', {
            style: 'currency',
            currency: 'CAD',
            maximumFractionDigits: 0,
        }).format(n || 0);
    }

    otherDisbursementsFor(tab: TabId): number {
        return this.otherDisbursements()[tab] ?? this.calcConfig.fieldDefault(tab, 'otherDisbursements', 0);
    }

    activeTabLabel(): string {
        return this.tabs.find(t => t.id === this.activeTab())?.label ?? '';
    }

    // ── Admin settings panel ────────────────────────────────────────────────

    openSettings(): void {
        this.mode.set('settings');
        this.settingsTab.set(this.activeTab());
        this.passwordInput.set('');
        this.passwordError.set(false);
    }

    closeSettings(): void {
        this.mode.set('calculator');
    }

    async tryUnlock(): Promise<void> {
        try {
            await this.auth.loginForCalcConfig(this.passwordInput());
            this.settingsUnlocked.set(true);
            this.passwordError.set(false);
            this.rawJsonDraft.set(this.calcConfig.exportJson());
        } catch {
            this.passwordError.set(true);
        }
    }

    fieldKeysFor(tab: TabId): string[] {
        return this.calcConfig.fieldKeys(tab);
    }

    isFieldIncluded(tab: TabId, field: string): boolean {
        return this.calcConfig.isIncluded(tab, field);
    }
    setFieldIncluded(tab: TabId, field: string, value: boolean): void {
        this.calcConfig.setFieldIncluded(tab, field, value);
    }

    fieldHasTaxable(tab: TabId, field: string): boolean {
        return this.calcConfig.hasTaxableFlag(tab, field);
    }
    isFieldTaxable(tab: TabId, field: string): boolean {
        return this.calcConfig.isTaxable(tab, field);
    }
    setFieldTaxable(tab: TabId, field: string, value: boolean): void {
        this.calcConfig.setFieldTaxable(tab, field, value);
    }

    fieldLabelValue(tab: TabId, field: string): string {
        return this.calcConfig.fieldLabel(tab, field, field);
    }
    setFieldLabel(tab: TabId, field: string, value: string): void {
        this.calcConfig.setFieldLabel(tab, field, value);
    }

    fieldHasDefault(tab: TabId, field: string): boolean {
        return this.calcConfig.hasDefault(tab, field);
    }
    fieldDefaultValue(tab: TabId, field: string): number {
        return this.calcConfig.fieldDefault(tab, field, 0);
    }
    setFieldDefault(tab: TabId, field: string, value: unknown): void {
        this.calcConfig.setFieldDefault(tab, field, Number(value) || 0);
    }

    disclaimerValue(tab: TabId): string {
        return this.calcConfig.disclaimer(tab);
    }
    setDisclaimer(tab: TabId, value: string): void {
        this.calcConfig.setDisclaimer(tab, value);
    }

    resetConfig(): void {
        this.calcConfig.resetToDefaults();
        this.rawJsonDraft.set(this.calcConfig.exportJson());
        this.rawJsonError.set(null);
    }

    applyRawJson(): void {
        try {
            this.calcConfig.importJson(this.rawJsonDraft());
            this.rawJsonError.set(null);
        } catch (err) {
            this.rawJsonError.set('Could not parse that JSON — no changes applied.');
        }
    }

    /** Applies current config defaults to all editable inputs and returns to the calculator view. */
    relaunch(): void {
        this.activeTab.set('purchase-mortgage');
        this.propertyValue.set(500000);
        this.mortgageAmount.set(400000);
        this.hasMortgage.set(true);
        this.otherDisbursements.set({
            'purchase-mortgage': this.calcConfig.fieldDefault('purchase-mortgage', 'otherDisbursements', 250),
            'cash-purchase': this.calcConfig.fieldDefault('cash-purchase', 'otherDisbursements', 200),
            sale: this.calcConfig.fieldDefault('sale', 'otherDisbursements', 200),
            refinance: this.calcConfig.fieldDefault('refinance', 'otherDisbursements', 200),
            wills: 0,
            incorporation: 0,
        });
        this.titleInsurance.set(this.calcConfig.fieldDefault('purchase-mortgage', 'titleInsurance', 300));
        this.propertyKind.set('house');
        this.rprFee.set(this.calcConfig.fieldDefault('sale', 'rpr', 850));
        this.condoEstoppelFee.set(this.calcConfig.fieldDefault('sale', 'condoEstoppel', 250));
        this.refinanceAmount.set(400000);
        this.payoutCount.set(1);
        this.willParty.set('single');
        this.willPackage.set('package');
        this.corpType.set('standard');
        this.incorpDisbursements.set(this.calcConfig.fieldDefault('incorporation', 'disbursements', 75));
        this.mode.set('calculator');
    }

    // ── PDF export (print-to-PDF — no external dependency) ─────────────────────

    async exportPdf(): Promise<void> {
        console.log('[PDF] exportPdf called');

        const r = this.result();
        console.log('[PDF] result:', r);

        if (!r) {
            console.warn('[PDF] no result');
            return;
        }

        if (r.quoteOnly) {
            console.warn('[PDF] quoteOnly result, skipping PDF');
            return;
        }

        if (!Array.isArray(r.lines)) {
            console.warn('[PDF] result.lines is not an array:', r.lines);
            return;
        }

        this.pdfBlocked.set(false);

        try {
            const html2pdfModule = await import('html2pdf.js');
            const html2pdf = html2pdfModule.default ?? html2pdfModule;

            const esc = (value: unknown): string =>
                String(value ?? '')
                    .replaceAll('&', '&amp;')
                    .replaceAll('<', '&lt;')
                    .replaceAll('>', '&gt;')
                    .replaceAll('"', '&quot;')
                    .replaceAll("'", '&#039;');

            const today = new Date().toLocaleDateString('en-CA', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });

            const rows = r.lines
                .map(line => {
                    return `
          <tr>
            <td class="line">${esc(line.label)}</td>
            <td class="line" style="text-align:right; white-space:nowrap;">
              ${esc(this.fmt(line.value))}
            </td>
          </tr>`;
                })
                .join('');

            const element: string | HTMLElement | HTMLCanvasElement | HTMLImageElement | null = document.createElement('div');

            element.innerHTML = `
      <style>
        .pdf-estimate {
          box-sizing: border-box;
          width: 720px;
          padding: 48px 56px;
          font-family: Lato, 'Sans Serif', serif;
          color: #1a3a5c;
          background: #ffffff;
        }

        .pdf-estimate * {
          box-sizing: border-box;
        }

        .pdf-estimate .brand {
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #b8932a;
          font-weight: 600;
        }

        .pdf-estimate h1 {
          font-size: 24px;
          margin: 6px 0 2px;
          color: #1a3a5c;
        }

        .pdf-estimate .meta {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 28px;
        }

        .pdf-estimate table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .pdf-estimate td {
          padding: 9px 0;
        }

        .pdf-estimate tr + tr td {
          border-top: 1px solid #eeeeee;
        }

        .pdf-estimate .line {
          color: #6b7280;
          font-weight: 400;
        }

        .pdf-estimate .total-row td {
          border-top: 2px solid #b8932a !important;
          padding-top: 16px;
          font-size: 18px;
          font-weight: 700;
          color: #1a3a5c;
        }

        .pdf-estimate .footnote {
          font-size: 11px;
          color: #9ca3af;
          line-height: 1.6;
          margin-top: 18px;
        }

        .pdf-estimate .contact {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #eeeeee;
          font-size: 12px;
          color: #6b7280;
          line-height: 1.75;
        }
      </style>

      <div class="pdf-estimate">
        <div class="brand">Fric, Lowenstein &amp; Co. LLP</div>

        <h1>Estimated Cost — ${esc(this.activeTabLabel())}</h1>

        <div class="meta">
          Prepared ${esc(today)} &nbsp;&bull;&nbsp; Estimate only, not a firm quote
        </div>

        <table>
          ${rows}
          <tr class="total-row">
            <td>Estimated Total</td>
            <td style="text-align:right">${esc(this.fmt(r.total))}</td>
          </tr>
        </table>

        ${r.footnote ? `<p class="footnote">${esc(r.footnote)}</p>` : ''}

        <div class="contact">
          #750, 11012 Macleod Trail S.E., Calgary, Alberta&nbsp;T2J&nbsp;7E4<br />
          (403) 291-2594 &nbsp;&bull;&nbsp; friclow@gmail.com<br />
          Fees &amp; disbursements above are estimated. We cannot give a firm amount until we have
          the file opened and have all information and details.
        </div>
      </div>
    `;

            element.style.position = 'fixed';
            element.style.left = '0';
            element.style.top = '0';
            element.style.zIndex = '-1';
            element.style.background = '#ffffff';

            document.body.appendChild(element);

const pdfElement = element.querySelector<HTMLElement>('.pdf-estimate');

if (!pdfElement) {
  throw new Error('PDF estimate element was not found');
}

console.log('[PDF] element added:', pdfElement.innerText);

await html2pdf()
  .set({
    margin: 0,
    filename: `cost-estimate-${new Date().toISOString().slice(0, 10)}.pdf`,
    image: {
      type: 'jpeg',
      quality: 0.98,
    },
    html2canvas: {
      scale: 2,
      backgroundColor: '#ffffff',
    },
    jsPDF: {
      unit: 'pt',
      format: 'letter',
      orientation: 'portrait',
    },
  })
  .from(pdfElement)
  .save();

element.remove();

            console.log('[PDF] done');
        } catch (err) {
            console.error('[PDF] failed:', err);
            this.pdfBlocked.set(true);
        }
    }

    // ── Calculators (fee tiers sourced from the firm's published PRICING schedule) ──
    //
    // Every line below is gated on this.calcConfig.isIncluded(tab, field) so the
    // admin settings panel can switch fields on/off (and re-tax them) live.
    // GST is computed only from fields whose config marks them `taxable: true`,
    // plus the core legal fee (always taxable when the tab's `gst` field is on).
    // Land Titles Office fees are never taxable — that's a legal fact, not a
    // toggle — but they can still be hidden via `included` for testing.

    private purchaseMortgageResult(): CalcResult {
        const tab: TabId = 'purchase-mortgage';
        const cfg = this.calcConfig;
        const price = this.propertyValue();
        let legal: number;
        if (price < 350000) legal = 975;
        else if (price < 600000) legal = 1125;
        else if (price < 850000) legal = 1375;
        else legal = 1575;

        const titleFee = ltoFee(price);
        const mortgageFee = ltoFee(this.mortgageAmount());
        const other = this.otherDisbursementsFor(tab);
        const titleIns = this.titleInsurance();

        const includeOther = cfg.isIncluded(tab, 'otherDisbursements');
        const includeTitleIns = cfg.isIncluded(tab, 'titleInsurance');
        const includeTitleReg = cfg.isIncluded(tab, 'titleRegistration');
        const includeMortgageReg = cfg.isIncluded(tab, 'mortgageRegistration');
        const includeGst = cfg.isIncluded(tab, 'gst');

        let taxable = legal;
        if (includeOther && cfg.isTaxable(tab, 'otherDisbursements')) taxable += other;
        if (includeTitleIns && cfg.isTaxable(tab, 'titleInsurance')) taxable += titleIns;
        const gst = includeGst ? round2(taxable * GST_RATE) : 0;

        const lines: ResultLine[] = [{ label: 'Legal Fee (Purchase & Mortgage)', value: legal }];
        if (includeTitleIns) lines.push({ label: cfg.fieldLabel(tab, 'titleInsurance', 'Title Insurance (est.)'), value: titleIns, muted: true });
        if (includeOther) lines.push({ label: cfg.fieldLabel(tab, 'otherDisbursements', 'Other Disbursements (est.)'), value: other, muted: true });
        if (includeGst) lines.push({ label: cfg.fieldLabel(tab, 'gst', 'GST (5%)'), value: gst, muted: true });
        if (includeTitleReg) lines.push({ label: cfg.fieldLabel(tab, 'titleRegistration', 'Land Titles — Title Registration'), value: titleFee, muted: true });
        if (includeMortgageReg) lines.push({ label: cfg.fieldLabel(tab, 'mortgageRegistration', 'Land Titles — Mortgage Registration'), value: mortgageFee, muted: true });

        const total = legal
            + (includeTitleIns ? titleIns : 0)
            + (includeOther ? other : 0)
            + gst
            + (includeTitleReg ? titleFee : 0)
            + (includeMortgageReg ? mortgageFee : 0);

        return { lines, total, footnote: cfg.disclaimer(tab) };
    }

    private cashPurchaseResult(): CalcResult {
        const tab: TabId = 'cash-purchase';
        const cfg = this.calcConfig;
        const price = this.propertyValue();
        if (price >= 850000) {
            return {
                lines: [], total: 0, quoteOnly: true,
                quoteNote: 'Cash purchases over $850,000 are quoted individually — please contact us.',
            };
        }
        let legal: number;
        if (price < 400000) legal = 850;
        else if (price < 650000) legal = 1150;
        else legal = 1275;

        const titleFee = ltoFee(price);
        const other = this.otherDisbursementsFor(tab);
        const titleIns = this.titleInsurance();

        const includeOther = cfg.isIncluded(tab, 'otherDisbursements');
        const includeTitleIns = cfg.isIncluded(tab, 'titleInsurance');
        const includeTitleReg = cfg.isIncluded(tab, 'titleRegistration');
        const includeGst = cfg.isIncluded(tab, 'gst');

        let taxable = legal;
        if (includeOther && cfg.isTaxable(tab, 'otherDisbursements')) taxable += other;
        if (includeTitleIns && cfg.isTaxable(tab, 'titleInsurance')) taxable += titleIns;
        const gst = includeGst ? round2(taxable * GST_RATE) : 0;

        const lines: ResultLine[] = [{ label: 'Legal Fee (Cash Purchase)', value: legal }];
        if (includeTitleIns) lines.push({ label: cfg.fieldLabel(tab, 'titleInsurance', 'Title Insurance (est.)'), value: titleIns, muted: true });
        if (includeOther) lines.push({ label: cfg.fieldLabel(tab, 'otherDisbursements', 'Other Disbursements (est.)'), value: other, muted: true });
        if (includeGst) lines.push({ label: cfg.fieldLabel(tab, 'gst', 'GST (5%)'), value: gst, muted: true });
        if (includeTitleReg) lines.push({ label: cfg.fieldLabel(tab, 'titleRegistration', 'Land Titles — Title Registration'), value: titleFee, muted: true });

        const total = legal
            + (includeTitleIns ? titleIns : 0)
            + (includeOther ? other : 0)
            + gst
            + (includeTitleReg ? titleFee : 0);

        return { lines, total, footnote: cfg.disclaimer(tab) };
    }

    private saleResult(): CalcResult {
        const tab: TabId = 'sale';
        const cfg = this.calcConfig;
        const price = this.propertyValue();
        if (price >= 950000) {
            return {
                lines: [], total: 0, quoteOnly: true,
                quoteNote: 'Sales over $950,000 are quoted individually — please contact us.',
            };
        }
        let legal: number;
        if (price < 400000) legal = 895;
        else if (price < 650000) legal = 995;
        else legal = 1195;

        const kind = this.effectiveSaleKind();
        const reportIncluded = kind !== null;
        const isHouse = kind === 'house';
        const reportFee = reportIncluded ? (isHouse ? this.rprFee() : this.condoEstoppelFee()) : 0;
        const reportField = isHouse ? 'rpr' : 'condoEstoppel';
        const reportLabel = isHouse
            ? cfg.fieldLabel(tab, 'rpr', 'Real Property Report (est.)')
            : cfg.fieldLabel(tab, 'condoEstoppel', 'Condominium Estoppel Certificate (est.)');

        const includeTitleIns = cfg.isIncluded(tab, 'titleInsurance');
        const titleIns = this.titleInsurance();
        const includeOther = cfg.isIncluded(tab, 'otherDisbursements');
        const other = this.otherDisbursementsFor(tab);
        const includeDischarge = cfg.isIncluded(tab, 'mortgageDischarge') && this.hasMortgage();
        const discharge = includeDischarge ? cfg.fieldDefault(tab, 'mortgageDischarge', 10) : 0;
        const includeGst = cfg.isIncluded(tab, 'gst');

        let taxable = legal;
        if (reportIncluded && cfg.isTaxable(tab, reportField)) taxable += reportFee;
        if (includeTitleIns && cfg.isTaxable(tab, 'titleInsurance')) taxable += titleIns;
        if (includeOther && cfg.isTaxable(tab, 'otherDisbursements')) taxable += other;
        const gst = includeGst ? round2(taxable * GST_RATE) : 0;

        const lines: ResultLine[] = [{ label: 'Legal Fee (Sale)', value: legal }];
        if (reportIncluded) lines.push({ label: reportLabel, value: reportFee, muted: true });
        if (includeTitleIns) lines.push({ label: cfg.fieldLabel(tab, 'titleInsurance', 'Title Insurance (est.)'), value: titleIns, muted: true });
        if (includeOther) lines.push({ label: cfg.fieldLabel(tab, 'otherDisbursements', 'Other Disbursements (est.)'), value: other, muted: true });
        if (includeGst) lines.push({ label: cfg.fieldLabel(tab, 'gst', 'GST (5%)'), value: gst, muted: true });
        if (includeDischarge) lines.push({ label: cfg.fieldLabel(tab, 'mortgageDischarge', 'Land Titles — Mortgage Discharge Fee'), value: discharge, muted: true });

        const total = legal
            + (reportIncluded ? reportFee : 0)
            + (includeTitleIns ? titleIns : 0)
            + (includeOther ? other : 0)
            + gst
            + discharge;

        return { lines, total, footnote: cfg.disclaimer(tab) };
    }

    private refinanceResult(): CalcResult {
        const tab: TabId = 'refinance';
        const cfg = this.calcConfig;
        const amount = this.refinanceAmount();
        const payouts = Math.max(1, this.payoutCount());
        const legal = 995 + (payouts - 1) * 175;

        const mortgageFee = ltoFee(amount);
        const dischargeFee = payouts * 10;
        const titleIns = this.titleInsurance();
        const other = this.otherDisbursementsFor(tab);

        const includeMortgageReg = cfg.isIncluded(tab, 'mortgageRegistration');
        const includeDischargeFee = cfg.isIncluded(tab, 'dischargeFee');
        const includeTitleIns = cfg.isIncluded(tab, 'titleInsurance');
        const includeOther = cfg.isIncluded(tab, 'otherDisbursements');
        const includeGst = cfg.isIncluded(tab, 'gst');

        let taxable = legal;
        if (includeTitleIns && cfg.isTaxable(tab, 'titleInsurance')) taxable += titleIns;
        if (includeOther && cfg.isTaxable(tab, 'otherDisbursements')) taxable += other;
        const gst = includeGst ? round2(taxable * GST_RATE) : 0;

        const lines: ResultLine[] = [
            { label: `Legal Fee (Refinance, ${payouts} payout${payouts > 1 ? 's' : ''})`, value: legal },
        ];
        if (includeTitleIns) lines.push({ label: cfg.fieldLabel(tab, 'titleInsurance', 'Title Insurance (est.)'), value: titleIns, muted: true });
        if (includeOther) lines.push({ label: cfg.fieldLabel(tab, 'otherDisbursements', 'Other Disbursements (est.)'), value: other, muted: true });
        if (includeGst) lines.push({ label: cfg.fieldLabel(tab, 'gst', 'GST (5%)'), value: gst, muted: true });
        if (includeMortgageReg) lines.push({ label: cfg.fieldLabel(tab, 'mortgageRegistration', 'Land Titles — New Mortgage Registration'), value: mortgageFee, muted: true });
        if (includeDischargeFee) lines.push({ label: `${cfg.fieldLabel(tab, 'dischargeFee', 'Land Titles — Discharge Fee(s)')} (${payouts} \u00d7 $10)`, value: dischargeFee, muted: true });

        const total = legal
            + (includeTitleIns ? titleIns : 0)
            + (includeOther ? other : 0)
            + gst
            + (includeMortgageReg ? mortgageFee : 0)
            + (includeDischargeFee ? dischargeFee : 0);

        return { lines, total, footnote: cfg.disclaimer(tab) };
    }

    private willsResult(): CalcResult {
        const tab: TabId = 'wills';
        const cfg = this.calcConfig;
        const party = this.willParty();
        const pkg = this.willPackage();

        const table: Record<string, number> = party === 'single'
            ? { will: 595, epa: 295, pd: 275, willPlusOne: 750, package: 895, codicil: 275 }
            : { will: 975, epa: 395, pd: 350, willPlusOne: 1075, package: 1175, codicil: 400 };

        const fee = table[pkg] ?? table['package'];
        const includeGst = cfg.isIncluded(tab, 'gst');
        const gst = includeGst ? round2(fee * GST_RATE) : 0;

        const lines: ResultLine[] = [
            { label: `${WILL_LABELS[pkg] ?? WILL_LABELS['package']} — ${party === 'couple' ? 'Couple' : 'Individual'}`, value: fee },
        ];
        if (includeGst) lines.push({ label: cfg.fieldLabel(tab, 'gst', 'GST (5%)'), value: gst, muted: true });

        return { lines, total: fee + gst, footnote: cfg.disclaimer(tab) };
    }

    private incorporationResult(): CalcResult {
        const tab: TabId = 'incorporation';
        const cfg = this.calcConfig;
        const legal = this.corpType() === 'standard' ? 475 : 775;

        const includeFiling = cfg.isIncluded(tab, 'filingFee');
        const filing = includeFiling ? cfg.fieldDefault(tab, 'filingFee', 100) : 0;
        const includeGovt = cfg.isIncluded(tab, 'govtFee');
        const govt = includeGovt ? cfg.fieldDefault(tab, 'govtFee', 275) : 0;
        const includeDisb = cfg.isIncluded(tab, 'disbursements');
        const disb = this.incorpDisbursements();
        const includeGst = cfg.isIncluded(tab, 'gst');

        let taxable = legal;
        if (includeFiling && cfg.isTaxable(tab, 'filingFee')) taxable += filing;
        if (includeDisb && cfg.isTaxable(tab, 'disbursements')) taxable += disb;
        const gst = includeGst ? round2(taxable * GST_RATE) : 0;

        const lines: ResultLine[] = [
            {
                label: this.corpType() === 'standard'
                    ? 'Legal Fee (Standard Incorporation)'
                    : 'Legal Fee (Professional Corporation)', value: legal
            },
        ];
        if (includeFiling) lines.push({ label: cfg.fieldLabel(tab, 'filingFee', 'Filing Fee'), value: filing, muted: true });
        if (includeDisb) lines.push({ label: cfg.fieldLabel(tab, 'disbursements', 'Disbursements (est.)'), value: disb, muted: true });
        if (includeGst) lines.push({ label: cfg.fieldLabel(tab, 'gst', 'GST (5%)'), value: gst, muted: true });
        if (includeGovt) lines.push({ label: cfg.fieldLabel(tab, 'govtFee', 'Government Filing Fee (tax-exempt)'), value: govt, muted: true });

        const total = legal
            + filing
            + govt
            + gst
            + (includeDisb ? disb : 0);

        return { lines, total, footnote: cfg.disclaimer(tab) };
    }
}
