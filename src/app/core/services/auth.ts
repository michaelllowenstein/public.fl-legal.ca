import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { env } from '@env/environment';
import { LoggerService } from './logger';

const TOKEN_KEY = 'friclowenstein_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private log  = inject(LoggerService).child('lawyer-auth');
 
  private _token = signal<string | null>(
    typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null,
  );
 
  constructor() {
    const stored = this._token();
    if (stored) {
      this.log.debug('Restored lawyer session from localStorage');
    }
  }
 
  isAuthenticated() { return !!this._token(); }
  token()           { return this._token(); }
 
  async login(username: string, password: string): Promise<void> {
    const t0 = performance.now();
    this.log.info('Lawyer login attempt', { username });
 
    try {
      const res = await firstValueFrom(
        this.http.post<{ token: string }>(
          `${env.apiURL}/api/auth/lawyer/password`,
          { username, password },
        )
      );
      const ms = Math.round(performance.now() - t0);
 
      this._token.set(res.token);
      localStorage.setItem(TOKEN_KEY, res.token);
      this.log.info('Lawyer login successful', { username, ms });
    } catch (e: unknown) {
      const err = e as HttpErrorResponse;
      const ms  = Math.round(performance.now() - t0);
 
      if (err?.status === 401) {
        this.log.warn('Lawyer login failed — invalid credentials', { username, ms });
      } else {
        this.log.error('Lawyer login error', { username, ms, status: err?.status, message: err?.message });
      }
      throw e;
    }
  }
 
  logout() {
    this.log.info('Lawyer logged out');
    this._token.set(null);
    localStorage.removeItem(TOKEN_KEY);
  }
}
