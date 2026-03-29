/**
 * site-content.service.ts
 * Bridges Angular components to the fl-legal-api REST endpoints.
 * All Angular Material dependencies have been removed; this service
 * is identical in contract to the previous version but uses fetch()
 * directly (no HttpClient injection required in standalone components).
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, map, tap } from 'rxjs';
import { env } from '@env/environment';
import { LoggerService } from './logger';

@Injectable({ providedIn: 'root' })
export class SiteService {
  private http = inject(HttpClient);
  private log  = inject(LoggerService).child('site');

  // ── Content ──────────────────────────────────────────────────────────────

  async getSection(section: string): Promise<any> {
    const t0 = performance.now();
    this.log.debug('Fetching section', { section });

    try {
      const data = await firstValueFrom(
        this.http.get(`${env.apiURL}/api/content/${section}`).pipe(
          tap((data: any) => console.log(data)),
          map((data: any) => data)
        )
      );

      const ms = Math.round(performance.now() - t0);
      this.log.info('Section fetched', { section, ms, keys: Object.keys(data as object).length });

      if (ms > 1000) {
        this.log.warn('Slow content fetch', { section, ms, threshold: 1000 });
      }

      return data;
    } catch (e: unknown) {
      const ms  = Math.round(performance.now() - t0);
      const err = e as HttpErrorResponse;
      this.log.error('Section fetch failed — using local fallback', {
        section,
        ms,
        status:  err?.status,
        message: err?.message,
      });
      // Graceful degradation — caller will use hardcoded constants
      return null;
    }
  }

  async updateField(key: string, value: string): Promise<void> {
    const t0      = performance.now();
    const preview = value.length > 60 ? value.slice(0, 60) + '…' : value;
    this.log.info('Saving content field', { key, preview });

    try {
      await firstValueFrom(
        this.http.patch(`${env.apiURL}/api/content`, { key, value })
      );
      const ms = Math.round(performance.now() - t0);
      this.log.info('Content field saved', { key, ms });
    } catch (e: unknown) {
      const err = e as HttpErrorResponse;
      this.log.error('Content save failed', {
        key,
        status:  err?.status,
        message: err?.message,
      });
      throw e;
    }
  }

  // ── Blog ─────────────────────────────────────────────────────────────────

  async getBlogEntries(): Promise<any[]> {
    const t0 = performance.now();
    this.log.debug('Fetching blog entries');

    try {
      const entries = await firstValueFrom(
        this.http.get<any[]>(`${env.apiURL}/api/blog`)
      );
      const ms = Math.round(performance.now() - t0);
      this.log.info('Blog entries fetched', { count: entries.length, ms });
      return entries;
    } catch (e: unknown) {
      const err = e as HttpErrorResponse;
      this.log.error('Blog entries fetch failed', { status: err?.status, message: err?.message });
      return [];
    }
  }

  async getBlogEntry(id: string): Promise<any> {
    const t0 = performance.now();
    this.log.debug('Fetching blog entry', { id });

    try {
      const entry = await firstValueFrom(
        this.http.get(`${env.apiURL}/api/blog/${id}`)
      );
      const ms = Math.round(performance.now() - t0);
      this.log.info('Blog entry fetched', { id, ms, title: (entry as any)?.title });
      return entry;
    } catch (e: unknown) {
      const err = e as HttpErrorResponse;
      if (err?.status === 404) {
        this.log.warn('Blog entry not found', { id });
      } else {
        this.log.error('Blog entry fetch failed', { id, status: err?.status, message: err?.message });
      }
      return null;
    }
  }
}
