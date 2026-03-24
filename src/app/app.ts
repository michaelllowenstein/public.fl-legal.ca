import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { RouterOutlet, Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { NgIf } from '@angular/common';
import { NavbarComponent } from '@layout/navbar';
import { SpinnerComponent } from '@ui/spinner';
import { routerSlideAnimation, ROUTE_ORDER } from '@app/animations/app';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NgIf, NavbarComponent, SpinnerComponent],
  animations: [routerSlideAnimation],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-content">
      <app-navbar></app-navbar>
      <app-spinner *ngIf="isLoading()"></app-spinner>
      <main [@routeAnimations]="prepareRoute(outlet)" style="position:relative;">
        <router-outlet #outlet="outlet"></router-outlet>
      </main>
    </div>
  `,
  styleUrl: '/app.scss'
})
export class App {
  private readonly router = inject(Router);

  readonly isLoading = signal(false);
  private direction = '100%';
  private directionInverse = '-100%';

  constructor() {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.isLoading.set(true);
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.isLoading.set(false);
      }
    });
  }

  prepareRoute(outlet: RouterOutlet): unknown {
    const fromState = outlet?.activatedRouteData?.['animation'] ?? '';
    const toState = this.router.routerState.snapshot.url ?? '';
    this.setDirection(fromState, toState);
    return {
      value: outlet?.activatedRouteData?.['animation'] ?? null,
      params: { direction: this.direction, directionInverse: this.directionInverse },
    };
  }

  private setDirection(fromState: string, toState: string): void {
    const fromIndex = ROUTE_ORDER.indexOf(fromState);
    const toIndex = ROUTE_ORDER.indexOf(toState);
    if (fromIndex < toIndex) {
      this.direction = '-100%';
      this.directionInverse = '100%';
    } else {
      this.direction = '100%';
      this.directionInverse = '-100%';
    }
  }
}
