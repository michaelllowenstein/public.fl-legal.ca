import {
  Component, OnInit, signal, inject,
  ChangeDetectionStrategy, HostListener, ElementRef, computed,
} from '@angular/core';
import { EditableContentDirective } from '@directives/editable-content';
import { SafeHtmlPipe } from '@pipes/safe-html';
import { FricLowensteinIcon } from '@friclowenstein/icon';
import { SiteService } from '@services/site';
import { LoggerService } from '@services/logger';
import { ABOUTUS, PROFILES } from '@schema/constants';
import { pageEnter, listStagger, slideInLeft, slideInRight } from '@animations/page';
import { Profile } from '@schema/models';
import { bodyText } from '@schema/utils';

@Component({
  selector:    'app-about-us',
  standalone:  true,
  imports:     [FricLowensteinIcon, EditableContentDirective, SafeHtmlPipe],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations:  [pageEnter, listStagger, slideInLeft, slideInRight],
})
export class AboutUsComponent implements OnInit {
  private siteService = inject(SiteService);
  private el             = inject(ElementRef<HTMLElement>);
  private log            = inject(LoggerService).child('about-us');
 
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
