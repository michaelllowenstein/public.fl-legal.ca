import {
  Component, OnInit, signal, inject,
  ChangeDetectionStrategy, HostListener,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { DialogService } from '@factory/dialog/service';
import { InquiryDialog } from '@ui/dialog/inquiry';
import { FricLowensteinIcon } from '@app/components/feature/friclowenstein/icon';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, FricLowensteinIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html'
})
export class NavbarComponent {
  private dialog = inject(DialogService);

  menuOpen = signal(false);
  scrolled = signal(false);

  navLinks = [
    { label: 'Home',         path: '/'              },
    { label: 'About Us',     path: '/about-us'      },
    { label: 'Areas of Law', path: '/areas-of-law'  },
    { label: 'Pricing',      path: '/pricing'       },
    { label: 'Blog',         path: '/blog'          },
    { label: 'FAQ',          path: '/faq'           },
  ];

  @HostListener('window:scroll')
  onScroll() { this.scrolled.set(window.scrollY > 10); }

  toggleMenu() { this.menuOpen.update((v: boolean) => !v); }

  openInquiry() {
    this.dialog.open(InquiryDialog);
  }
}
