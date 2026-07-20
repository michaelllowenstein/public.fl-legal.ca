import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { env } from '@env/environment';
import { FormsModule } from '@angular/forms';
import { FLIcon } from '@components/ui/icon';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { injectDialogClose } from '@components/factory/dialog/tokens';
import { LoggerService } from '@app/core/services/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

interface InquiryForm {
  name:         string;
  email:        string;
  phone:        string;
  message:      string;
  practiceArea: string;
}

type FormErrors = Partial<Record<keyof InquiryForm, string>>;

const PRACTICE_AREAS = [
  'Civil Litigation',
  'Real Estate Law',
  'Personal Injury',
  'Estate Planning',
  'Corporate Law',
  'Employment Law',
  'Other',
] as const;

// --- Component ----------------------------------------------------------

@Component({
  selector:    'app-inquiry-dialog',
  standalone:  true,
  imports:     [FLIcon, FormsModule],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host .fl-label {
      @apply block font-sans text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5;
    }
    :host .fl-input {
      @apply w-full border rounded-lg px-3 py-2.5 font-sans text-sm text-brand
             focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-transparent
             transition-shadow;
    }
    :host .fl-error {
      @apply mt-1.5 font-sans text-xs text-red-500 flex items-center gap-1;
    }
  `],
})
export class InquiryDialog {
  private http: HttpClient  = inject(HttpClient);
  private log               = inject(LoggerService).child('inquiry-dialog');
  close                     = injectDialogClose<boolean>();

  // ── Form state ─────────────────────────────────────────────────────────────

  form: InquiryForm = { name: '', email: '', phone: '', message: '', practiceArea: '' };

  isPriority  = signal(false);
  errors      = signal<FormErrors>({});
  loading     = signal(false);
  submitted   = signal(false);
  serverError = signal('');

  readonly practiceAreas = PRACTICE_AREAS;

  firstName = computed(() => this.form.name.split(' ')[0] || 'there');

  // --- Priority Toggle -------------------------------------------------------
  /**
   * The practice-area field only applies to priority inquiries - the generalInquirySchema 
   * rejects it outright (additionalProperties: false). Clear it when priority is switched off so a stale
   * selection can never leak into a general inquiry payload.
   */
  setPriority(value: boolean): void {
    this.isPriority.set(value);
    if (!value) this.form.practiceArea = '';
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  private validate(): boolean {
    const e: FormErrors = {};
    if (!this.form.name.trim())    e.name    = 'Name is required.';
    if (!this.form.email.trim())   e.email   = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(this.form.email)) e.email = 'Enter a valid email address.';
    if (!this.form.message.trim()) e.message = 'Message is required.';
    this.errors.set(e);
    return Object.keys(e).length === 0;
  }

  // ── Submission ─────────────────────────────────────────────────────────────

  async submit(): Promise<void> {
    if (!this.validate()) {
      this.log.warn('Submit blocked by client-side validation', {
        errors: this.errors(),
      });
      return;
    }    

    this.loading.set(true);
    this.serverError.set('');

    const priority = this.isPriority();
    const endpoint = this.isPriority()
      ? `${env.apiURL}/api/inquiries/priority`
      : `${env.apiURL}/api/inquiries`;

    // Strip empty optional fields before sending
    const body = {
      name:    this.form.name,
      email:   this.form.email,
      message: this.form.message,
      ...(this.form.phone                            && { phone:        this.form.phone }),
      ...(priority && this.form.practiceArea && { practiceArea: this.form.practiceArea }),
    };

    try {
      await firstValueFrom(
        this.http.post(endpoint, body, { responseType: 'text' })
      );
      this.log.info('Inquiry sent', { priority });
      this.submitted.set(true);
    } catch (err) {
      this.serverError.set(this.messageFor(err));
      this.log.error('Inquiry submission failed', {
        priority,
        endpoint,
        status:  err instanceof HttpErrorResponse ? err.status     : undefined,
        message: err instanceof HttpErrorResponse ? err.message    : String(err),
      });
    } finally {
      this.loading.set(false);
    }
  }

  private messageFor(err: unknown): string {
    if (!(err instanceof HttpErrorResponse)) {
      return 'Failed to send - please try again or give us a call at (403)291-2594.';
    }
    switch (err.status) {
      case 0:
        // No HTTP status reached us at all — offline, DNS failure, or
        // blocked before it left the browser (CORS, an extension, etc.).
        return 'We couldn\u2019t reach our server. Please check your connection and try again, or call us at (403) 258-9455.';
      case 429:
        return 'Too many attempts from this connection. Please wait a few minutes and try again, or call us at (403) 258-9455.';
      case 400:
        return 'Some of the information provided couldn\u2019t be sent. Please double-check the form and try again.';
      default:
        return 'Failed to send - please try again or give us a call at (403)291-2594.'; 
    }
  }
}
