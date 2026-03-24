// reusable initerfaces & dataabase mapping
export interface BlogArticle {
  addDate: string;
  articleId: string;
  authorsByLine: string;
  categories: {name: string}[];
  claim: string;
  clusterId: string;
  companies: {name: string}[];
  content: string;
  country: string;
  description: string;
  entities: {data: string, type: string, mentions: number}[];
  imageUrl: string;
  keywords: {name: string, weight: number}[];
  labels: {name: string}[];
  language: string;
  links: string[];
  locations: {country: string}[];
  matchedAuthors: {id: string, name: string}[];
  medium: string;
  people: {name: string}[];
  places: string[];
  pubDate: string;
  refreshDate: string;
  reprint: boolean;
  reprintGroupId: string;
  score: number;
  sentiment: {positive: number, negative: number, neutral: number};
  source: {domain: string, locations: {country: string, state: string, city: string, coordinates: {lat: number, long: number}}};
  summary: string;
  title: string;
  topics: {name: string}[];
  translatedDescription?: string;
  translatedSummary?: string;
  translatedTitle?: string;
  translation?: string;
  url: string;
  verdict?: string;
}

export interface PricingSection {
  id?:    string;
  label?: string;
  rows:   string[];    // parsed from || delimiter by seed script
  content?: string;    // raw fallback when rows not yet seeded
}

export interface BlogEntry {
  id: string;
  title: string;
  author: string;
  date: Date;
  content: string;
  image: string;
  topics: string[];
}

export interface Article {
  title: string;
  description: string;
  url: string;
  image: string;
  publishedAt: string;
  content: string;
  source: { name: string };
}

export interface Feed {
  entries?: BlogEntry[];
  articles: BlogArticle[];
  numResults: number;
  status: number;
}

export interface News {
  articles: Article[];
  date?: Date;
}

export interface SiteSection {
  contents?: { sections: SiteSection[] };
  content?: string | string[];
  label?: string;
  options?: any;
  id?: any;
}

export interface SiteContent {
  id: string;
  page: string;
  section?: string;
  position?: string;
  bulletpoints?: string[];
  tag?: string;
  title?: SiteSection | string;
  subtitle?: SiteSection | string;
  body: SiteSection;
  footer?: SiteSection;
  images?: string[];
  links?: SiteSection | string[];
  lastupdated?: string;
  approved?: boolean;
  header?: SiteSection;
  subheader?: SiteSection;
  faqs?: FAQSection[];
}

export interface FAQSection {
  question: string;
  answer: string;
}

export interface TeamMember {
  id: string;
  name: string;
  title: string;
  education: string;
  practiceProfile: string;
  professionalAssociations: string[];
  communityInvolvement: string[];
  imageUrl: string;
}

export interface Profile {
  id: string;
  image: any;
  name: string;
  role?: string;
  education?: string;
  calltobar?:  string;
  workexperience?: string;
  achievements?: string[];
  community?: string[];
}

export interface ProfileNav {
  display: string;
  value: string;
  order: number;
}

export interface DialogResult<T = any> {
  action: 'confirm' | 'cancel';
  message?: string;
  data?: T;
}

export interface AboutUsSchema {
  header: string
  subheader: string
  body: {
    content: string
    [k: string]: unknown
  }
  bulletpoints: string[]
  footer: {
    content: string
    [k: string]: unknown
  }
  [k: string]: unknown
}

export interface AreasOfLawSchema {
  header: string
  subheader: string
  body: {
    content: string
    [k: string]: unknown
  }
  bulletpoints: string[]
  [k: string]: unknown
}

export interface HomePageSchema {
  header: string
  subheader: string
  body: {
    content: string
    [k: string]: unknown
  }
  bulletpoints: string[]
  footer: {
    content: string
    [k: string]: unknown
  }
  [k: string]: unknown
}

export interface PricingPageSchema {
  header: string
  subheader: string
  sections: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^.*$".
     */
    [k: string]: {
      label: string
      content: string
      [k: string]: unknown
    }
  }
  [k: string]: unknown
}

export interface TeamProfileSchema {
  /**
   * This interface was referenced by `undefined`'s JSON-Schema definition
   * via the `patternProperty` "^.*$".
   */
  [k: string]: {
    id: string
    name: string
    image: string
    education: string
    calltobar: string
    workexperience: string
    achievements?: string[]
    community?: string[]
    role?: string
    [k: string]: unknown
  }
}

export interface SiteMetadata {
  metadata: {
    aboutPage: AboutUsSchema;
    areasOfLawPage: AreasOfLawSchema;
    homePage: HomePageSchema;
    pricingPage: PricingPageSchema;
    teamProfiles: TeamProfileSchema;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
