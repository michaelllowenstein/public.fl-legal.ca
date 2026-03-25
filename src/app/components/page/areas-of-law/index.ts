import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  OnInit,
  computed,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoggerService } from '@services/logger';
import { SiteService } from '@services/site';
import { AREASOFLAW } from '@app/schema/constants';
import { Icon } from '@friclowenstein/icon';
import { EditableContentDirective } from '@directives/editable-content';
import { SafeHtmlPipe } from '@pipes/safe-html';
import { pageEnter, listStagger } from '@animations/page';
import { bodyText } from '@schema/utils';
 
const AREA_ICONS: Record<string, string> = {
  'civil': 'scale', 'real': 'document-text', 'family': 'user',
  'estate': 'document-text', 'corporate': 'scale', 'employment': 'scale',
  'builder': 'scale', 'foreclosure': 'document-text', 'debt': 'document-text',
  'commercial': 'scale', 'banking': 'document-text', 'personal': 'user',
  'notari': 'document-text', 'private': 'document-text',
};
 
function iconForArea(label: string): string {
  const lower = label.toLowerCase();
  for (const [key, icon] of Object.entries(AREA_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return 'scale';
}

@Component({
  selector:    'app-areas-of-law',
  standalone:  true,
  imports:     [RouterLink, EditableContentDirective, SafeHtmlPipe, Icon],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations:  [pageEnter, listStagger],
})
export class AreasOfLawPage implements OnInit {
  private contentService = inject(SiteService);
  private log            = inject(LoggerService).child('areas-of-law');
 
  site    = signal(AREASOFLAW);
  loading = signal(true);
 
  intro = computed(() => bodyText(this.site()));
 
  readonly relatedLinks = [
    { label: 'Pricing & Fees',    path: '/pricing'    },
    { label: 'FAQ',               path: '/faq'        },
    { label: 'About Our Lawyers', path: '/about-us'   },
    { label: 'Contact Us',        path: '/contact-us' },
  ];
 
  private _initStart = performance.now();
 
  async ngOnInit() {
    this.log.debug('Areas of Law initialising');
    try {
      const content = await this.contentService.getSection('areasOfLaw');
      if (content) this.site.set({ ...AREASOFLAW, ...content });
    } finally {
      this.loading.set(false);
      this.log.info('Areas of Law ready', { areaCount: this.site().bulletpoints?.length ?? 0 });
    }
  }
 
  iconFor(text: string) { return iconForArea(text ?? ''); }
}
