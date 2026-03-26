import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { env } from '@env/environment';
import { LoggerService } from './logger';

@Injectable({ providedIn: 'root' })
export class EditorService {
  private http = inject(HttpClient);
  private log  = inject(LoggerService).child('editor-auth');

  private _authenticated = signal(false);
  private _token         = signal<string | null>(null);
  private _tokenIssuedAt = signal<number | null>(null);

  isAuthenticated() { return this._authenticated(); }
  token() { return this._token(); }

  async login(password: string): Promise<void> {
    const t0 = performance.now();
    this.log.info('Editor login attempt');

    try {
      const res = await firstValueFrom(
        this.http.post<{ token: string }>(`${env.apiURL}/api/auth/editor`, { password })
      );
      const ms = Math.round(performance.now() - t0);

      this._token.set(res.token);
      this._authenticated.set(true);
      this._tokenIssuedAt.set(Date.now());
      this.log.info('Editor login successful', { ms });
    } catch (e: unknown) {
      const err = e as HttpErrorResponse;
      const ms  = Math.round(performance.now() - t0);

      if (err?.status === 401) {
        this.log.warn('Editor login failed — wrong password', { ms });
      } else {
        this.log.error('Editor login error', { ms, status: err?.status, message: err?.message });
      }
      throw e;
    }
  }

  logout() {
    this.log.info('Editor logged out');
    this._authenticated.set(false);
    this._tokenIssuedAt.set(null);
    this._token.set(null);
  }

  /** Warn if the editor session is approaching expiry (within 10 minutes) */
  checkTokenExpiry(expiryMs = 4 * 60 * 60 * 1000): void {
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
}
