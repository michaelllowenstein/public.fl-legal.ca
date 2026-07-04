import {
    Component,
    ChangeDetectionStrategy,
    signal,
    computed,
    inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FLIcon } from '@components/ui/icon';
import { ltoFee, round2, esc } from '@schema/utils';
import { TabId, CalcResult, ResultLine } from '@schema/models';
import { TABS, WILL_LABELS, GST_RATE } from '@schema/constants';
import { injectDialogClose } from '@components/factory/dialog/tokens';

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
    selector: 'app-calculator',
    standalone: true,
    imports: [FormsModule, FLIcon],
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
    private router = inject(Router);
    close = injectDialogClose<void>();

    tabs = TABS;
    activeTab = signal<TabId>('purchase-mortgage');

    pdfBlocked = signal(false);

    // Real estate (shared) ─────────────────────────────────────────────────────
    propertyValue = signal(500000);
    mortgageAmount = signal(400000);
    hasMortgage = signal(true);
    otherDisbursements = signal(250);

    // Refinance ──────────────────────────────────────────────────────────────
    refinanceAmount = signal(400000);
    payoutCount = signal(1);

    // Wills & estate planning ──────────────────────────────────────────────────
    willParty = signal<'single' | 'couple'>('single');
    willPackage = signal<string>('package');

    // Incorporation ──────────────────────────────────────────────────────────
    corpType = signal<'standard' | 'professional'>('standard');
    incorpDisbursements = signal(75);

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
    onOtherDisbursements(v: unknown) { this.otherDisbursements.set(Math.max(0, Number(v) || 0)); }
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

    activeTabLabel(): string {
        return this.tabs.find(t => t.id === this.activeTab())?.label ?? '';
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
                    const cls = line.muted ? 'muted' : 'main';

                    return `
          <tr>
            <td class="${cls}">${esc(line.label)}</td>
            <td class="${cls}" style="text-align:right; white-space:nowrap;">
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

        .pdf-estimate .main {
          color: #1a3a5c;
          font-weight: 600;
        }

        .pdf-estimate .muted {
          color: #6b7280;
          font-weight: 400;
        }

        .pdf-estimate .total-row td {
          border-top: 2px solid #b8932a !important;
          padding-top: 16px;
          font-size: 18px;
          font-weight: 700;
        }

        .pdf-estimate .footnote {
          font-size: 11px;
          color: #9ca3af;
          margin-top: 22px;
          line-height: 1.6;
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

    private purchaseMortgageResult(): CalcResult {
        const price = this.propertyValue();
        let legal: number;
        if (price < 350000) legal = 975;
        else if (price < 600000) legal = 1125;
        else if (price < 850000) legal = 1375;
        else legal = 1575;

        const titleFee = ltoFee(price);
        const mortgageFee = ltoFee(this.mortgageAmount());
        const other = this.otherDisbursements();

        return {
            lines: [
                { label: 'Legal Fee (Purchase & Mortgage)', value: legal },
                { label: 'Land Titles — Title Registration', value: titleFee, muted: true },
                { label: 'Land Titles — Mortgage Registration', value: mortgageFee, muted: true },
                { label: 'Other Disbursements (est.)', value: other, muted: true },
            ],
            total: legal + titleFee + mortgageFee + other,
            footnote: 'Land Titles fees use the Government of Alberta\u2019s current registration formula '
                + '($50 + $5 per $5,000 of value, effective Oct. 2024). GST is not included.',
        };
    }

    private cashPurchaseResult(): CalcResult {
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
        const other = this.otherDisbursements();

        return {
            lines: [
                { label: 'Legal Fee (Cash Purchase)', value: legal },
                { label: 'Land Titles — Title Registration', value: titleFee, muted: true },
                { label: 'Other Disbursements (est.)', value: other, muted: true },
            ],
            total: legal + titleFee + other,
            footnote: 'Land Titles fees use the Government of Alberta\u2019s current registration formula. '
                + 'GST is not included.',
        };
    }

    private saleResult(): CalcResult {
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

        const discharge = this.hasMortgage() ? 10 : 0;
        const other = this.otherDisbursements();

        const lines: ResultLine[] = [{ label: 'Legal Fee (Sale)', value: legal }];
        if (this.hasMortgage()) {
            lines.push({ label: 'Land Titles — Mortgage Discharge Fee', value: discharge, muted: true });
        }
        lines.push({ label: 'Other Disbursements (est.)', value: other, muted: true });

        return {
            lines,
            total: legal + discharge + other,
            footnote: 'GST is not included. Your lender may charge separate payout or discharge fees.',
        };
    }

    private refinanceResult(): CalcResult {
        const amount = this.refinanceAmount();
        const payouts = Math.max(1, this.payoutCount());
        const legal = 995 + (payouts - 1) * 175;

        const mortgageFee = ltoFee(amount);
        const dischargeFee = payouts * 10;
        const other = this.otherDisbursements();

        return {
            lines: [
                { label: `Legal Fee (Refinance, ${payouts} payout${payouts > 1 ? 's' : ''})`, value: legal },
                { label: 'Land Titles — New Mortgage Registration', value: mortgageFee, muted: true },
                { label: `Land Titles — Discharge Fee${payouts > 1 ? 's' : ''} (${payouts} \u00d7 $10)`, value: dischargeFee, muted: true },
                { label: 'Other Disbursements (est.)', value: other, muted: true },
            ],
            total: legal + mortgageFee + dischargeFee + other,
            footnote: 'Land Titles fees use the Government of Alberta\u2019s current registration formula. '
                + 'GST is not included.',
        };
    }

    private willsResult(): CalcResult {
        const party = this.willParty();
        const pkg = this.willPackage();

        const table: Record<string, number> = party === 'single'
            ? { will: 595, epa: 295, pd: 275, willPlusOne: 750, package: 895, codicil: 275 }
            : { will: 975, epa: 395, pd: 350, willPlusOne: 1075, package: 1175, codicil: 400 };

        const fee = table[pkg] ?? table['package'];
        const gst = round2(fee * GST_RATE);

        return {
            lines: [
                { label: `${WILL_LABELS[pkg] ?? WILL_LABELS['package']} — ${party === 'couple' ? 'Couple' : 'Individual'}`, value: fee },
                { label: 'GST (5%)', value: gst, muted: true },
            ],
            total: fee + gst,
            footnote: 'Estate planning fees are flat rates plus GST; disbursements typically do not apply.',
        };
    }

    private incorporationResult(): CalcResult {
        const legal = this.corpType() === 'standard' ? 475 : 775;
        const filing = 100;
        const govt = 275; // tax-exempt government filing fee
        const disb = this.incorpDisbursements();
        const gst = round2((legal + filing) * GST_RATE);

        return {
            lines: [
                {
                    label: this.corpType() === 'standard'
                        ? 'Legal Fee (Standard Incorporation)'
                        : 'Legal Fee (Professional Corporation)', value: legal
                },
                { label: 'Filing Fee', value: filing, muted: true },
                { label: 'Government Filing Fee (tax-exempt)', value: govt, muted: true },
                { label: 'GST (5% on legal + filing fee)', value: gst, muted: true },
                { label: 'Disbursements (est.)', value: disb, muted: true },
            ],
            total: legal + filing + govt + gst + disb,
            footnote: 'The government filing fee is GST-exempt. Disbursements may include name/NUANS searches.',
        };
    }
}