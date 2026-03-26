import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { injectDialogData, injectDialogClose } from 'src/app/components/factory/dialog/tokens';
import { FLIcon } from 'src/app/components/ui/icon';

export interface InlineEditData {
  fieldKey:      string;
  currentValue:  string;
  label?:        string;
  maxLength?:    number;
  /** Show a plain-text hint instead of the HTML hint. */
  plainText?:    boolean;
}
 
export interface InlineEditResult {
  key:   string;
  value: string;
}

@Component({
  selector:    'app-inline-edit-dialog',
  standalone:  true,
  imports:     [FormsModule, FLIcon],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InlineEditDialog {
  data  = injectDialogData<InlineEditData>();
  close = injectDialogClose<InlineEditResult | null>();
 
  draft  = signal(this.data.currentValue);
  error  = signal('');
 
  remainingChars = computed(() =>
    this.data.maxLength
      ? this.data.maxLength - this.draft().length
      : Infinity
  );
 
  save() {
    if (!this.draft().trim()) {
      this.error.set('Content cannot be empty.');
      return;
    }
    this.close({ key: this.data.fieldKey, value: this.draft() });
  }
 
  cancel() { this.close(null); }
}
