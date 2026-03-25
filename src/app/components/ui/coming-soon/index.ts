import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FricLowensteinIcon } from '@friclowenstein/icon';

@Component({
  selector: 'app-coming-soon',
  standalone: true,
  imports: [RouterLink, FricLowensteinIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html'
})
export class ComingSoonComponent {}