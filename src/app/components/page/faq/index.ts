import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  OnInit,
  computed
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { pageEnter, accordion } from '@app/animations/page';
import { Icon } from 'src/app/components/ui/icon';
import { EditableContentDirective } from '@app/core/directives/editable-content';
import { SafeHtmlPipe } from '@app/core/pipes/safe-html';
import { LoggerService } from '@app/core/services/logger';
import { SiteService } from '@app/core/services/site';
import { bodyText } from '@app/schema/utils';
import { FAQ } from 'src/app/schema/constants';

@Component({
  selector:    'app-faq',
  standalone:  true,
  imports:     [RouterLink, EditableContentDirective, SafeHtmlPipe, Icon],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations:  [pageEnter, accordion],
})
export class FaqPage implements OnInit {
  private siteService    = inject(SiteService);
  private log            = inject(LoggerService).child('faq');
 
  site      = signal(FAQ);
  loading   = signal(true);
  openIndex = signal<number | null>(null);

  // ── Fix: these computed properties were missing from local copy ─────────
  intro = computed(() => bodyText(this.site()));
  faqs  = computed(() => (this.site() as any).faqs ?? []);
 
  // Track which questions have been expanded during this session
  private _openedQuestions = new Set<number>();
  private _initStart       = performance.now();
 
  async ngOnInit() {
    this.log.debug('FAQ page initialising');
 
    try {
      const content = await this.siteService.getSection('faq');
      if (content) {
        this.site.set({ ...FAQ, ...content });
        this.log.debug('FAQ content applied', { questionCount: content.faqs?.length ?? 0 });
      } else {
        this.log.debug('Using hardcoded FAQ fallback', { questionCount: FAQ.faqs?.length ?? 0 });
      }
    } finally {
      this.loading.set(false);
      this.log.info('FAQ page ready', {
        questionCount: this.site().faqs?.length ?? 0,
        tti:           Math.round(performance.now() - this._initStart),
      });
    }
  }
 
  toggle(i: number) {
    const isOpening = this.openIndex() !== i;
    this.openIndex.update((v: number | null) => v === i ? null : i);
 
    const question = (this.site().faqs ?? [])[i]?.question ?? `Question ${i}`;
    const preview  = typeof question === 'string'
      ? question.replace(/<[^>]+>/g, '').slice(0, 60)
      : String(i);
 
    if (isOpening) {
      this._openedQuestions.add(i);
      this.log.info('FAQ item expanded', {
        index:         i,
        question:      preview,
        totalExpanded: this._openedQuestions.size,
      });
    } else {
      this.log.trace('FAQ item collapsed', { index: i });
    }
  }
}
