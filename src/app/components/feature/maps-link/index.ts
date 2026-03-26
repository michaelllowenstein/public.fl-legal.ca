import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { Icon } from 'src/app/components/ui/icon';

@Component({
  selector: 'app-maps-link',
  standalone: true,
  imports: [Icon],
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
