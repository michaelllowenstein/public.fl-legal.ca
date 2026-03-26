import {
  Component, ChangeDetectionStrategy, inject, OnInit,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DialogService } from 'src/app/components/factory/dialog/service';
import { Icon } from '@friclowenstein/icon';
import { MapsLinkComponent } from 'src/app/components/feature/maps-link';
import { InquiryDialog } from 'src/app/components/ui/dialog/inquiry';
import { LoggerService } from 'src/app/core/services/logger';
import { env } from 'src/environments/environment';

@Component({
  selector:    'app-contact-us',
  standalone:  true,
  imports:     [MapsLinkComponent, Icon],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactUsPage implements OnInit {
  private dialog                  = inject(DialogService);
  private sanitizer: DomSanitizer = inject(DomSanitizer);
  private log                     = inject(LoggerService).child('contact-us');
 
  readonly officeName = env.maps?.pointOfInterest ?? 'Southcentre Executive Tower';
  readonly officeLat  = env.maps?.latitude  ?? 50.955083;
  readonly officeLong = env.maps?.longitude ?? -114.069988;
 
  readonly mapsEmbedUrl: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
    env.mapsEmbedApiKey
      ? `https://www.google.com/maps/embed/v1/place?key=${env.mapsEmbedApiKey}&q=${encodeURIComponent(this.officeName)}`
      : `https://www.openstreetmap.org/export/embed.html?bbox=${this.officeLong - 0.005},${this.officeLat - 0.003},${this.officeLong + 0.005},${this.officeLat + 0.003}&layer=mapnik&marker=${this.officeLat},${this.officeLong}`,
  );
 
  ngOnInit() {
    const mapProvider = env.mapsEmbedApiKey ? 'google' : 'openstreetmap';
    this.log.info('Contact Us page loaded', {
      mapProvider,
      officeName: this.officeName,
    });
 
    if (!env.mapsEmbedApiKey) {
      this.log.debug('No mapsEmbedApiKey set — using OpenStreetMap fallback');
    }
  }
 
  openInquiry() {
    this.log.info('Inquiry dialog opened from Contact Us page');
    this.dialog.open(InquiryDialog);
  }
}
