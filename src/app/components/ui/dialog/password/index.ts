import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EditorService } from '@services/editor';
import { injectDialogClose } from '@factory/dialog/tokens';
import { AppIcon } from '@ui/icon';

@Component({
  selector:    'app-password-dialog',
  standalone:  true,
  templateUrl: './index.html',
  imports:     [FormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordDialog {
  private auth: EditorService  = inject(EditorService);
  private close = injectDialogClose<boolean>();
 
  password = '';
  loading  = signal(false);
  error    = signal('');
 
  async submit() {
    if (!this.password.trim()) {
      this.error.set('Password is required.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.password);
      this.close(true);
    } catch {
      this.error.set('Incorrect password. Please try again.');
      this.loading.set(false);
    }
  }
 
  cancel() { this.close(false); }
}
