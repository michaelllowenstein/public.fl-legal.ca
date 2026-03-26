import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { pageEnter, listStagger } from '@animations/page';
import { FLIcon } from '@components/ui/icon';
import { LoggerService } from '@core/services/logger';
import { SiteService } from '@core/services/site';
import { PRICING } from '@schema/constants';
import { PricingSection } from '@schema/models';
import { sectionText } from '@schema/utils';

@Component({
  selector:    'app-pricing',
  standalone:  true,
  templateUrl: './index.html',
  imports: [RouterLink, FLIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations:  [pageEnter, listStagger],
})
export class PricingPage {
  private siteService    = inject(SiteService);
  private log            = inject(LoggerService).child('pricing');
 
  site    = signal(PRICING);
  loading = signal(true);
 
  header    = computed(() => sectionText(this.site().header));
  subheader = computed(() => sectionText(this.site().subheader));
 
  private _initStart = performance.now();
 
  /**
   * Sections from Firebase (seeded with rows[]) or parsed inline from
   * the raw PRICING constant (rows split from || delimiter).
   */
  sections = computed<PricingSection[]>(() => {
    const raw = (this.site() as any);
 
    // Firebase path — seed script produces sections[{ id, label, rows[] }]
    if (raw.sections?.length) return raw.sections;
 
    // Fallback — parse from the original constants format
    const fromBody = raw.body?.contents?.sections ?? [];
    return fromBody.map((s: any) => ({
      id:    s.id,
      label: s.label?.trim() ?? '',
      rows:  (s.content ?? '').split('||').map((r: string) => r.trim()).filter(Boolean),
    }));
  });
 
  async ngOnInit() {
    this.log.debug('Pricing page initialising');
    try {
      const content = await this.siteService.getSection('pricing');
      if (content) {
        this.site.set({ ...PRICING, ...content });
        this.log.debug('Pricing content applied', {
          sectionCount: this.sections().length,
        });
        if (this.sections().length === 0) {
          this.log.warn('Pricing returned 0 sections — check seed');
        }
      }
    } finally {
      this.loading.set(false);
      this.log.info('Pricing page ready', { sectionCount: this.sections().length });
    }
  }
}
