import {
  Component, OnInit, signal, inject,
  ChangeDetectionStrategy, HostListener, ElementRef, computed,
} from '@angular/core';
import { EditableContentDirective } from '@core/directives/editable-content';
import { SafeHtmlPipe } from '@core/pipes/safe-html';
import { FLIcon } from '@components/ui/icon';
import { SiteService } from '@core/services/site';
import { LoggerService } from '@core/services/logger';
import { ABOUTUS, PROFILES } from '@schema/constants';
import { pageEnter, listStagger, slideInLeft, slideInRight } from '@animations/page';
import { bodyText } from '@schema/utils';
import { SeoService } from '@core/services/seo';

@Component({
  selector:    'app-about-us',
  standalone:  true,
  imports:     [FLIcon, EditableContentDirective, SafeHtmlPipe],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations:  [pageEnter, listStagger, slideInLeft, slideInRight],
})
export class AboutUsPage implements OnInit {
  private seo: SeoService =    inject(SeoService);
  private siteService: SiteService = inject(SiteService);
  private el: ElementRef<HTMLElement>             = inject(ElementRef<HTMLElement>);
  private log          = (inject(LoggerService) as LoggerService).child('about-us');
 
  @HostListener('window:scroll')
  checkCards() {
    const cards = this.el.nativeElement.querySelectorAll('[data-profile-card]');
    const next  = new Set(this.visibleCards());
    cards.forEach((card: Element, i: number) => {
      if (!next.has(i) && card.getBoundingClientRect().top < window.innerHeight * 0.9) {
        next.add(i);
        this.log.trace('Profile card revealed', { index: i });
      }
    });
    if (next.size !== this.visibleCards().size) this.visibleCards.set(next);
  }
 
  site          = signal(ABOUTUS);
  loading       = signal(true);
  activeProfile = signal<string | null>(null);
  sidenavOpen   = signal(false);
  visibleCards  = signal<Set<number>>(new Set());
 
  // ── Computed string properties ──────────────────────────────────────────
  firmIntro = computed(() => bodyText(this.site()));
 
  // Profiles live in the PROFILES constant (separate from SiteContent)
  // — merge them in from the constant directly
  readonly profiles = PROFILES;
 
  private _initStart = performance.now();
 
  async ngOnInit() {
    this.log.debug('About Us page initialising');
    this.seo.set({
      title: 'About Our Firm',
      description: 'Meet the lawyers at Fric, Lowenstein & Co. LLP. Our Calgary legal team brings decades of experience in family law, litigation, and real estate.',
    });
    try {
      const content = await this.siteService.getSection('aboutUs');
      if (content) {
        this.site.set({ ...ABOUTUS, ...content });
        this.log.debug('About Us content applied');
      }
      const first = this.profiles[0];
      if (first) this.activeProfile.set(first.id);
    } catch (ex: any) {
      this.loading.set(false);
      if (ex) {
        this.site.set({ ...ABOUTUS });
        this.log.warn('About Us content not found - fallback to hard-coded content.', ex.message);
      }
    } finally {
      this.loading.set(false);
      this.log.info('About Us page ready', {
        tti: Math.round(performance.now() - this._initStart),
        profileCount: this.profiles.length,
      });
      setTimeout(() => this.checkCards(), 150);
    }
  }

  toggleNav(): void {
    this.sidenavOpen.update((v: boolean) => !v);
  }
 
  isCardVisible(i: number) { return this.visibleCards().has(i); }
 
  selectProfile(id: string) {
    this.activeProfile.set(id);
    this.sidenavOpen.set(false);

    setTimeout(() => {
      const target = this.el.nativeElement.querySelector(`[data-profile="${id}"]`);
      if (!target) return;

      const NAVBAR_HEIGHT = 166; // 64px header + 16px breathing room
      const top = target.getBoundingClientRect().top + window.scrollY - NAVBAR_HEIGHT;
      window.scrollTo({ top, behavior: 'smooth' });
    }, 50);
  }
 
  activeProfileData = computed(() =>
    this.profiles.find(p => p.id === this.activeProfile()) ?? null
  );
}
