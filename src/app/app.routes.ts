import { Routes } from '@angular/router';
import { authGuard } from '@guards/auth';
// 
export const ROUTE_ORDER = [
  'HomePage', 'AboutUsPage', 'AreasOfLawPage', 'PricingPage',
  'BlogPage', 'FaqComponent', 'ContactUsPage',
];

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  {
    path: 'home',
    loadComponent: () => import('@page/home').then(m => m.HomeComponent),
    data: { animation: 'HomePage' },
  },
  {
    path: 'about-us',
    loadComponent: () => import('@page/about-us').then(m => m.AboutUsComponent),
    data: { animation: 'AboutUsPage' },
  },
  {
    path: 'areas-of-law',
    loadComponent: () => import('@page/areas-of-law').then(m => m.AreasOfLawComponent),
    data: { animation: 'AreasOfLawPage' },
  },
  {
    path: 'pricing',
    loadComponent: () => import('@page/pricing').then(m => m.PricingComponent),
    data: { animation: 'PricingPage' },
  },
  {
    path: 'blog',
    loadComponent: () => import('@page/blog').then(m => m.BlogComponent),
    data: { animation: 'BlogPage' },
  },
  {
    path: 'blog/:id',
    loadComponent: () => import('@page/article').then(m => m.ArticleComponent),
    data: { animation: 'ArticlePage' },
  },
  {
    path: 'faq',
    loadComponent: () => import('@page/faq').then(m => m.FaqComponent),
    data: { animation: 'FaqComponent' },
  },
  {
    path: 'contact-us',
    loadComponent: () => import('@page/contact-us').then(m => m.ContactUsComponent),
    data: { animation: 'ContactUsPage' },
  },
  // {
  //   path: 'friclowenstein/login',
  //   loadComponent: () => import('@friclowenstein/login').then(m => m.FricLowensteinLogin),
  // },
  // {
  //   path: 'friclowenstein/calendar',
  //   loadComponent: () => import('@friclowenstein//calendar').then(m => m.FricLowensteinCalendar),
  //   canActivate: [authGuard],
  // },
];
