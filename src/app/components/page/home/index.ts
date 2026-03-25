import {
  Component, OnInit, signal, inject,
  ChangeDetectionStrategy, HostListener, ElementRef, QueryList, ViewChildren,
  computed,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CarouselComponent, CarouselSlide } from '@feature/carousel';
import { FricLowensteinIcon } from '@app/components/feature/friclowenstein/icon';
import { EditableContentDirective } from '@directives/editable-content';
import { SafeHtmlPipe } from '@pipes/safe-html';
import { HOME } from '@schema/constants';
import {
  pageEnter, listStagger, fadeIn,
} from '@animations/page';
import { LoggerService } from '@services/logger';
import { SiteService } from '@services/site';
import { sectionText, bodyText } from '@schema/utils/section-text';

@Component({
  selector:    'app-home',
  standalone:  true,
  imports:     [RouterLink, CarouselComponent, FricLowensteinIcon, EditableContentDirective, SafeHtmlPipe],
  animations:  [pageEnter, listStagger, fadeIn],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export class HomePage implements OnInit {
  private siteService = inject(SiteService);
  private el          = inject(ElementRef<HTMLElement>);
  private log         = inject(LoggerService).child('home');
 
  site                = signal(HOME);
  loading             = signal(true);
  visible             = signal<Set<string>>(new Set()); 
  intro               = computed(() => bodyText(this.site()));
  heading             = computed(() => sectionText(this.site().header));
  subheader           = computed(() => sectionText(this.site().subheader));
 
  // Track time-to-interactive
  private _initStart = performance.now();
 
  readonly slides: CarouselSlide[] = [
    { imageUrl: '../../../../assets/site/images/oxfordpropsv1.jpg', heading: 'Experienced Legal Counsel',  subheading: 'Since 1982 — Calgary, Alberta'                        },
    { imageUrl: '../../../../assets/site/images/oxfordpropslobbyv1.jpg', heading: 'Protecting Your Rights',     subheading: 'Trusted by individuals and businesses across Alberta' },
    { imageUrl: '../../../../assets/site/images/oxfordpropslobbyv2.jpg', heading: 'Dedicated to Your Success',  subheading: 'Personal attention. Professional results.'            },
  ];
 
  readonly practiceAreas = [
    { icon: 'scale',         label: 'Civil Litigation'  },
    { icon: 'document-text', label: 'Real Estate Law'   },
    { icon: 'user',          label: 'Family Law'        },
    { icon: 'scale',         label: 'Estate Planning'   },
    { icon: 'document-text', label: 'Corporate Law'     },
    { icon: 'scale',         label: 'Employment Law'    },
  ];

  async ngOnInit() {
    try {
      const content = await this.siteService.getSection('home');
      if (content) this.site.set({ ...HOME, ...content });
    } finally {
      this.loading.set(false);
    }
  }
 
  @HostListener('window:scroll')
  checkVisibility() {
    const sections = this.el.nativeElement.querySelectorAll('[data-reveal]');
    const next = new Set(this.visible());
    sections.forEach((s: Element) => {
      const el  = s as HTMLElement;
      const id  = el.dataset['reveal']!;
      if (!next.has(id) && el.getBoundingClientRect().top < window.innerHeight * 0.88) {
        next.add(id);
        this.log.trace('Section revealed', { section: id });
      }
    });
    if (next.size !== this.visible().size) this.visible.set(next);
  }
 
  isVisible(id: string) { return this.visible().has(id); }
}