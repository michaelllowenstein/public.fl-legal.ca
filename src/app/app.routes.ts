import { Routes } from '@angular/router';

export const ROUTE_ORDER = [
  'HomePage', 'AboutUsPage', 'AreasOfLawPage', 'PricingPage',
  'BlogPage', 'FaqComponent', 'ContactUsPage',
];

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  {
    path: 'home',
    loadComponent: () => import('src/app/components/page/home').then(m => m.HomePage),
    data: { animation: 'HomePage' },
  },
  {
    path: 'about-us',
    loadComponent: () => import('src/app/components/page/about-us').then(m => m.AboutUsPage),
    data: { animation: 'AboutUsPage' },
  },
  {
    path: 'areas-of-law',
    loadComponent: () => import('src/app/components/page/areas-of-law').then(m => m.AreasOfLawPage),
    data: { animation: 'AreasOfLawPage' },
  },
  {
    path: 'pricing',
    loadComponent: () => import('src/app/components/page/pricing').then(m => m.PricingPage),
    data: { animation: 'PricingPage' },
  },
  {
    path: 'blog',
    loadComponent: () => import('src/app/components/page/blog').then(m => m.BlogPage),
    data: { animation: 'BlogPage' },
  },
  {
    path: 'blog/:id',
    loadComponent: () => import('src/app/components/page/article').then(m => m.ArticlePage),
    data: { animation: 'ArticlePage' },
  },
  {
    path: 'faq',
    loadComponent: () => import('src/app/components/page/faq').then(m => m.FaqPage),
    data: { animation: 'FaqComponent' },
  },
  {
    path: 'contact-us',
    loadComponent: () => import('src/app/components/page/contact-us').then(m => m.ContactUsPage),
    data: { animation: 'ContactUsPage' },
  }
];
