import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { FricLowensteinIcon } from '@app/components/feature/friclowenstein/icon';

@Component({
  selector: 'app-maps-link',
  standalone: true,
  imports: [FricLowensteinIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html'
})
export class MapsLinkComponent {
  latitude        = input.required<number>();
  longitude       = input.required<number>();
  pointOfInterest = input<string>('');
  label           = input<string>('');

  mapsUrl() {
    const q = this.pointOfInterest()
      ? encodeURIComponent(this.pointOfInterest())
      : `${this.latitude()},${this.longitude()}`;
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }
}
