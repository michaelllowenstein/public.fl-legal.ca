import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { env } from '@env/environment';
import { LoggerService } from './logger';

const TOKEN_KEY = 'fl_editor_token';

@Injectable({ providedIn: 'root' })
export class EditorService {
  private http = inject(HttpClient);
  private log  = inject(LoggerService).child('editor-auth');

  private _authenticated = signal(false);
  private _tokenIssuedAt = signal<number | null>(null);

  // Restore from sessionStorage on init — survives page refresh within same tab
  private _token = signal<string | null>(
    typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem(TOKEN_KEY)
      : null,
  );

  isAuthenticated() { return !!this._token(); }
  token()           { return this._token(); }

  async login(password: string): Promise<void> {
    const t0 = performance.now();
    this.log.info('Editor login attempt');

    // Fix: correct endpoint is /api/auth/editor
    const res = await firstValueFrom(
      this.http.post<{ token: string }>(
        `${env.apiURL}/api/auth/editor`,
        { password },
      )
    );
    this._token.set(res.token);
    sessionStorage.setItem(TOKEN_KEY, res.token);
  }

  logout() {
    this.log.info('Editor logged out');
    this._token.set(null);
    this._tokenIssuedAt.set(null);
    this._authenticated.set(false);
    sessionStorage.removeItem(TOKEN_KEY);
  }

  /** Warn if the editor session is approaching expiry (within 10 minutes) */
  checkTokenExpiryStatus(expiryMs = 4 * 60 * 60 * 1000): void {
    const issued = this._tokenIssuedAt();
    if (!issued) return;

    const elapsed   = Date.now() - issued;
    const remaining = expiryMs - elapsed;

    if (remaining < 0) {
      this.log.warn('Editor token has expired — session invalidated');
      this.logout();
    } else if (remaining < 10 * 60 * 1000) {
      this.log.warn('Editor token expiring soon', {
        remainingMinutes: Math.round(remaining / 60000),
      });
    }
  }

  checkTokenExpiry(): boolean {
    const token = this._token();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 <= Date.now()) {
        this.logout();
        return false;
      }
      return true;
    } catch { return true; }
  }
}
