/**
 * notification/index.ts
 *
 * Toast notification — mounts fixed top-right, auto-dismisses after `duration` ms.
 * Use DialogService with the `bare: true` option so there's no backdrop.
 *
 * Usage:
 *   this.dialog.open(NotificationComponent, {
 *     bare: true,
 *     data: { message: 'Saved.', type: 'success', duration: 3500 },
 *   });
 */
import {
  Component, ChangeDetectionStrategy, OnInit, OnDestroy,
} from '@angular/core';
import { injectDialogData, injectDialogClose } from 'src/app/components/factory/dialog/tokens';
import { FLIcon } from 'src/app/components/ui/icon';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationData {
  message:   string;
  type?:     NotificationType;
  duration?: number;  // ms, default 3500. Pass 0 to disable auto-dismiss.
}

const ICON_MAP: Record<NotificationType, string> = {
  success: 'check',
  error:   'x-mark',
  warning: 'document-text',
  info:    'document-text',
};

const STYLE_MAP: Record<NotificationType, string> = {
  success: 'bg-emerald-600',
  error:   'bg-red-600',
  warning: 'bg-amber-500',
  info:    'bg-brand',
};

@Component({
  selector:    'app-notification',
  standalone:  true,
  imports:     [FLIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styles: [`
    @keyframes shrink {
      from { transform: scaleX(1); }
      to   { transform: scaleX(0); }
    }
  `],
})
export class NotificationDialog implements OnInit, OnDestroy {
  data  = injectDialogData<NotificationData>();
  close = injectDialogClose();

  private timer?: ReturnType<typeof setTimeout>;

  readonly type       = this.data.type ?? 'info';
  readonly duration   = this.data.duration ?? 3500;
  readonly iconName   = ICON_MAP[this.type];
  readonly panelClass = STYLE_MAP[this.type];

  ngOnInit() {
    if (this.duration > 0) {
      this.timer = setTimeout(() => this.close(), this.duration);
    }
  }

  ngOnDestroy() {
    clearTimeout(this.timer);
  }
}