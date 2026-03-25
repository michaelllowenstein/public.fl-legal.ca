import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { FricLowensteinIcon } from '@friclowenstein/icon';
import { injectDialogClose } from '@factory/dialog/tokens';
import { env } from '@env/environment';

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
  'Family Law',
  'Estate Planning',
  'Corporate Law',
  'Employment Law',
  'Other',
] as const;

// --- Component ----------------------------------------------------------

@Component({
  selector:    'app-inquiry-dialog',
  standalone:  true,
  imports:     [FricLowensteinIcon, FormsModule],
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
  private http  = inject(HttpClient);
  close         = injectDialogClose<boolean>();
 
  // ── Form state ─────────────────────────────────────────────────────────────
 
  form: InquiryForm = { name: '', email: '', phone: '', message: '', practiceArea: '' };
 
  isPriority  = signal(false);
  errors      = signal<FormErrors>({});
  loading     = signal(false);
  submitted   = signal(false);
  serverError = signal('');
 
  readonly practiceAreas = PRACTICE_AREAS;
 
  firstName = computed(() => this.form.name.split(' ')[0] || 'there');
 
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
 
  async submit() {
    if (!this.validate()) return;
 
    this.loading.set(true);
    this.serverError.set('');
 
    const endpoint = this.isPriority()
      ? `${env.apiURL}/api/inquiries/priority`
      : `${env.apiURL}/api/inquiries`;
 
    // Strip empty optional fields before sending
    const body = {
      name:    this.form.name,
      email:   this.form.email,
      message: this.form.message,
      ...(this.form.phone                            && { phone:        this.form.phone }),
      ...(this.isPriority() && this.form.practiceArea && { practiceArea: this.form.practiceArea }),
    };
 
    try {
      await firstValueFrom(
        this.http.post(endpoint, body, { responseType: 'text' })
      );
      this.submitted.set(true);
    } catch {
      this.serverError.set(
        'Failed to send. Please try again or call us at (403) 258-9455.'
      );
    } finally {
      this.loading.set(false);
    }
  }
}
