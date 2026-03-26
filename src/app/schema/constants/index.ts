import { ProfileNav, Profile, SiteContent, PricingSection, FAQSection } from '../models';

export const MEMBERS: ProfileNav[] = [
  {
    display: 'William H. Fric',
    value: 'bill',
    order: 0,
  },
  {
    display: 'Howard M. Lowenstein',
    value: 'howard',
    order: 1,
  },
  {
    display: 'Anthony J. Di Lello',
    value: 'anthony',
    order: 2,
  },
  {
    display: 'Tami Fric',
    value: 'tami',
    order: 3,
  },
  {
    display: 'York Campbell',
    value: 'york',
    order: 4,
  },
  {
    display: 'Marc Lowenstein',
    value: 'marc',
    order: 5,
  },
  {
    display: 'Bronwyn E. Cram',
    value: 'bronwyn',
    order: 7,
  },
  {
    display: 'Tracy Hildenbrand',
    value: 'tracy',
    order: 7,
  }
];

export const PROFILES: Profile[] = [
  {
    id: 'bill',
    image: "../../../../assets/site/headshots/fric/fricv2.jpg",
    name: 'William H. Fric, JD',
    education: `University of Winnipeg BA (Economics) 1972; University of Manitoba LL.B 1976`,
    calltobar:  `Alberta 1977  `,
    workexperience: `Bill Fric’s practice comprises a full range of business transactions,
            banking (including lending, foreclosures, and general bank issues), real estate,
            and wills and estates.
            Bill has been selected as external Alberta counsel for Bank of Montreal.
            He is also approved to act for all well-known Canadian banks and financial
            institutions. Bill acts as the sole legal counseller to a number of residential home builders,
            and also for real estate brokerage companies. Throughout his career, Bill has acted for businesses
            in the agricultural industry, including as sole Alberta counsel for Feed-Rite, and as sole Alberta
            counsel to the Credit Department of Viterra (formerly Alberta Wheat Pool and United Grain Growers Limited).
            Bill derives particular enjoyment from acting for small business people; in acting for
            young people starting out with their first home purchases; and in acting for several
            generations of the same families. `,
    achievements: [
      'Member of Canadian Bar Association (CBA)',
      'Past Lecturer in Real Estate Law at Bar Admission Course',
      'Legal Column Contributor for Calgary Real Estate News',
      'Member CBA Real Property Subsection'
    ],
    community: [
      'Rotary International – Paul Harris Fellowship',
      'Holy Spirit Parish – Past Board Member',
      'Inn from the Cold – Ongoing volunteer'
    ]
  },
  {
    id: 'howard',
    image: "../../../../assets/site/headshots/lowenstein/lowensteinv2.jpg",
    name: 'Howard M. Lowenstein',
    education: `University of Manitoba, B.A (Economics) (Honors).;
            University of Manitoba, LL.B. 1976.`,
    calltobar: `1977 `,
    workexperience: `Howard Lowenstein graduated from the University of Manitoba, Faculty of Law in 1976.
            Howard practised in Winnipeg, Manitoba until December 1979 and then moved to Calgary to practice with
            the law firm of Sinclair McGeough Lilburn. In 1982 he joined with Bill Fric and the present firm of
            Fric, Lowenstein & Co. has continued since that date. Howard’s primary focus is in the area of both
            residential and commercial real estate and mortgages. Howard represents a number of major new home
            builders and condominium developers in Calgary. Howard’s practice also includes foreclosures, wills
            and estates, corporate and commercial transactions, debt collection matters, personal injury and
            general civil litigation. `,
    achievements: [
      'Member Canadian Bar Association (CBA)',
      '2012 – Chairman of the CBA Alberta Law Conference Real Estate Panel',
      'Past Executive Member and current member CBA Foreclosure Subsection',
      'Past Executive member and current member CBA Real Property Subsection',
      'Current member CBA Wills and Estates Subsection'
    ],
    community: [
      'Past President Beth Tzedec Congregation',
      'Past President University of Calgary Swim Club',
      'Past President of Swim AB Southern Region',
      'Swimming Canada Referee',
      'Calgary Special Olympics Volunteer Referee',
      'Past President Crohns & Colitis Foundation'
    ],
  },
  {
    id: 'anthony',
    image: "../../../../assets/site/headshots/anthony/anthonyv2.jpg",
    name: 'Anthony J. Di Lello',
    education: `University of Calgary, B.A. (with distinction) 1992;
            University of Alberta, LL.B. 1995;.`,
    calltobar: `Alberta 1996  `,
    workexperience: `Anthony J. Di Lello joined Fric, Lowenstein & Co. LLP in 1997 and he represents
            clients with diverse legal issues. His law practice is primarily devoted to civil litigation with a
            particular emphasis in the areas of estate litigation, commercial and residential foreclosures, secured
            and unsecured realization and builders’ liens. He calls on his skills as a solicitor in the areas of wills
            and estates, commercial and residential real estate and business transactions. Anthony successfully
            represents clients in all levels of Alberta Courts. His clientele ranges from major financial institutions
            and home builders to small businesses and individuals. Anthony has been lead counsel in several
            important and leading decisions in Alberta. He uses the experiences he’s gained through decades of
            success to custom tailor a legal solution that is cost effective and efficient for each client. `,
    achievements: [
      'Member of the Canadian Bar Association (CBA)',
      'Member of the Foreclosure, Personal Injury and Litigation subsections',
      'Member of the Alberta Civil Trial Lawyers Association'
    ],
  },
  {
    id: 'tami',
    image: "../../../../assets/site/headshots/tami/tami.jpg",
    name: 'Tami Fric',
    education: `Juris Doctor, University of Victoria (2011),
            Exchange Semester, University of Sydney (2010),
            Bachelor of Commerce with Distinction, and University of Alberta (2008). `,
    calltobar: `Alberta 2012  `,
    workexperience: `Tami Fric’s practice focuses on real estate and corporate matters.
            Tami represents clients from first time home buyers to builders and developers.
            Tami assists clients with commercial transactions, particularly with business purchases
            and sales. She also acts on banking matters including lending, financing, banking and
            foreclosures. Tami also practices in the area of wills & estates. <br>
            Prior to joining Fric, Lowenstein & Co. LLP, Tami worked at a global law firm and was
            seconded to a multinational oil and gas corporation. `,
    achievements: [
      'Member Canadian Bar Association (CBA)',
      'Member of the Real Estate, Wills and Estates, Business and Foreclosure subsections',
      'Co-Chair, Commercial Real Estate subsection',
    ],
  },
  {
    id: 'york',
    image: "../../../../assets/site/headshots/york/yorkv2.jpg",
    name: 'York Campbell',
    education: `
            University of Calgary;
            BCOMM (finance) 2010 University of Calgary, BA (economics) 2010;
            University of Saskatchewan, JD (2013).`,
    calltobar: 'Alberta 2014 ',
    workexperience: `York joined Fric, Lowenstein & Co. LLP in 2014 after articling in Calgary with a global firm.
            While in law school York completed a semester exchange program and studied at Bond University in Australia.
            York also interned for the Office of the Attorney General in Washington D.C. York’s practice comprises corporate
            matters, business agreements and transactions, litigation, real estate, and wills and estates. `,
    achievements: [
      'Member Canadian Bar Association (CBA)',
      'Member of the Calgary Bar Association'
    ],
  },
  {
    id: 'marc',
    image: "../../../../assets/site/headshots/marc/marcv2.jpg",
    name: 'Marc A. Lowenstein',
    education: `University of Calgary, B.A. (Economics) 2004;
            British Columbia Institute of Technology (Construction Management Degree Program) 2011;
            Associate Certificates in Construction Operations and Supervision (with distinction);
            National Construction Safety Officer 2012;
            Bond University, JD (Second Class Honours) 2015.`,
    calltobar: `June 2017 `,
    workexperience: `Marc A. Lowenstein joined the firm in 2015 after completing his law
            degree at Bond University in Australia. Before law school Marc spent more than 10 years
            in the construction industry in various positions ranging from a labourer, foreman,
            superintendent up to a Project Engineer for a large heavy civil construction company.
            Marc has also worked as a National Construction Safety Officer and consultant where he built,
            implemented and supervised health and safety programs for companies in the construction industry.
            Marc is focusing his practice on real estate and matters relating to construction including contracts,
            litigation and dispute resolution. Marc also recently joined the ADR Institute of Alberta and is
            working towards becoming a Qualified Arbitrator (Q. Arb.). `,
  },
  {
    id: 'bronwyn',
    image: '../../../../assets/site/headshots/bronwyn/bronwyn.png',
    name: 'Bronwyn E. Cram',
    education: `Queen’s University, B.Sc (Life Sciences) (Honors) 2019;
    University of Calgary, J.D. (2023).`,
    calltobar: 'Alberta 2024',
    workexperience: `Bronwyn joined Fric, Lowenstein & Co. LLP in 2025. Prior to joining the firm,
    Bronwyn gained experience in civil litigation, wills and estates, and family law.Her practice now
    focuses on a wide range of areas including wills & estates, real estate, foreclosures, litigation,
    as well as cohabitation and prenuptial agreements.Bronwyn works closely with clients to navigate
    legal matters, with a focus on providing practical and effective solutions across diverse practice
    areas.`,
    achievements: [
      'Member of the Calgary Bar Association'
    ],
  },
  {
    id: 'tracy',
    image: "../../../../assets/site/headshots/tracy/tracyv2.jpg",
    name: 'Tracy Hildenbrand',
    role: `Office Manager`,
    workexperience: `Tracy obtained her legal assistant diploma in 1991, has been with our firm since 1998 and has
            lead the amazing team at our 16 – 20 person law firm since 2015. In the time she has been here,
            Tracy has gained experience in almost every department of our firm and prior to joining our office
            she worked as the only staff member for small general practice lawyers so was fully responsible
            for all aspects of the law firm including setup, reception, bookkeeping and legal assistance on a
            large variety of files. Her past experience also includes a position as a borrowing department
            manager for a private lender where she dealt with in depth construction mortgage loans. As well,
            Tracy has been a licensed Realtor since 1997. `,
  },
];

export const HOME: SiteContent = {
  id: 'home',
  page: 'Home',
  body: {
    content: "Turn to Fric, Lowenstein & Co. LLP for highly <a class=\"text-link\" routerLink=\"../areas-of-law\">experienced legal representation.</a>       Serving clients in Calgary and throughout Alberta, Fric, Lowenstein & Co. LLP offers a wide       range of areas of expertise for individuals and businesses throughout Alberta.       Trust the <a class=\"text-link\" routerLink=\"../about-us\">dynamic team</a> from        Fric, Lowenstein & Co. LLP for comprehensive legal representation.        Personalized Legal Services in Calgary              No matter what your specific legal challenges may be, choose Fric, Lowenstein & Co.       LLP and place 3 decades of legal expertise on your side. Legal challenges can be a       stressful and difficult time for you, your family or your business, but by choosing        Fric, Lowenstein & Co. LLP, you can rely on legal services completely customized to your specific needs."
  },
  bulletpoints: [
    "Real Estate Transactions & Mortgages",
    "Wills & Estates",
    "Civil Litigation",
    "Personal Injury",
    "Business Incorporation",
    "Business Sales & Purchases",
    "Employment Law - including wrongful dismissal",
    "Builders' Liens",
    "…and helping people with general legal matters"
  ],
  footer: {
    content: "We offer <a class=\"text-link\" routerLink=\"../pricing\">discounted flat rates</a> for many routine legal services.     Now Located at <strong>Southcenter Executive Tower at 11012 Macleod Trail SE, Calgary, AB</strong>     Easy to get to and easy to park!"
  },
  header: {
    content: "Welcome"
  },
  subheader: {
    content: "FRIC, LOWENSTEIN & CO. LLP: Serving Calgary For Over 30 Years..."
  }
}

export const ABOUTUS: SiteContent = {
  id: 'about-us',
  page: 'About Us',
  body: {
    content: "After graduating together in 1976, William Fric and Howard Lowenstein committed themselves to serving the legal needs of their neighbours. Since 1982, Fric, Lowenstein & Co. LLP has offered prudent legal advice to citizens in Calgary and throughout Alberta. When you choose Fric, Lowenstein & Co. LLP, you put 5 lawyers and over 30 years of legal expertise to work for you. We offer a range of legal services for individuals as well as business owners in the province and our committed staff is ready to offer you first-rate legal representation. Call us today to speak to our team."
  },
  bulletpoints: [
    "Real Estate Transactions & Mortgages",
    "Wills & Estates",
    "Civil Litigation",
    "Personal Injury",
    "Business Incorporation",
    "Business Sales & Purchases",
    "Employment Law - including wrongful dismissal",
    "Builders' Liens",
    "…and helping people with general legal matters"
  ],
  footer: {
    content: "We offer <a class=\"text-link\" routerLink=\"../pricing\">discounted flat rates</a> for many routine legal services.     Now Located at <strong>Southcenter Executive Tower at 11012 Macleod Trail SE, Calgary, AB</strong>     Easy to get to and easy to park!"
  },
  header: {
    content: "About Us"
  },
  subheader: {
    content: "About Us: Classmates and Partners"
  }
}

export const AREASOFLAW: SiteContent = {
  id: 'areas-of-law',
  page: 'Areas of Law',
  body: {
    content: "For more than 30 years, clients in Calgary and throughout Alberta have trusted Fric, Lowenstein & Co. LLP for prudent, customer-focused legal representation. No matter what your specific legal needs may be, our analytical team will work tirelessly to defend your rights. Contact our team to discuss your specific situation. We help people with services related to:",
  },
  bulletpoints: [
    "Real Estate Transactions & Mortages",
    "Wills & Estates",
    "Civil Litigation",
    "Personal Injury",
    "Business Incorporation",
    "Business Sales & Purchases",
    "Employment Law - including wrongful dismissal",
    "Builders' Liens",
    "Foreclosures",
    "Debt Collection",
    "Commercial Transactions",
    "Notarization",
    "Banking",
    "Private Lending"
  ],
  footer: {
    content: ""
  },
  header: {
    content: "Areas of Law"
  },
  subheader: {
    content: "Our Mission: To Provide Excellent Legal Service at a Reasonable Cost."
  }
};

export const PRICING: SiteContent = {
  id: 'pricing',
  page: 'Pricing',
  body: {
    options: {
      multipart: true
    },
    contents: {
      sections: [
        {
          id: 'purcahse&mortgagefees',
          label: "Purchase & Mortgage Fees",
          content: `Under $350,000.00 P&M $650.00 + 325.00 = $975.00 + Disbursements ||
$350,000.00 – $600,000.00 P&M $775.00 + $350.00 = $1,125.00 + Disbursements ||
$600,000.00 – $850,000.00 P&M $950.00 + $425.00 = $1,375.00 +Disbursements ||
OVER $850,000.00 P&M $1,025.00 + $550.00 = $1,575.00 + Disbursements`
        },
        {
          id: "cashpurchasefees",
          label: "Cash Purchase Fees",
          content: `Under $400,000.00 = $850.00 + Disbursements ||
$400,000.00 to $650,000.00 = $1,150.00 + Disbursements ||
$650,000.00 to $850,000.00 = $1,275.00 + Disbursements ||
Over $850,000.00 = $1,375.00 and up + Disbursements – Please call for a quote`
        },
        {
          id: "sales",
          label: "Sales",
          content: `Under $400,000.00 = $895.00 + Disbursements ||
$400,000.00 – $650,000.00 = $995.00 + Disbursements ||
$650,000.00 – $950,000 = $1,195.00 ||
$950,000.00 and above = Call for quote`
        },
        {
          id: "refinances",
          label: "Refinances",
          content: `$995.00 + Disbursements (includes 1 payout) ||
+$175.00 for each additional payout required`
        },
        {
          id: "interimfinancing",
          label: "Interim Financing",
          content: `$250.00 = Disbursements`
        },
        {
          id: "transferofland",
          label: "Transfer of Land",
          content: `$375.00 + Land Titles Disbursements ||
ASSIGN RENTS: $225.00 + Land Titles Disbursements ||
POA: $225.00 ||
ENCROACHMENT AGREE $250.00 + Disbursements ||
RELAXATION $150.00 + Disbursements`
        },
        {
          id: 'corporatefees',
          label: "Corporate Fees",
          content: `Incorporation of Company ||
Standard structure: ||
Legal Fees – $475.00 ||
Filing Fee – $100.00 ||
Government Filing Fee – $275.00 – tax exempt ||
Plus Disbursements and GST ||
Professional Corporation: ||
Legal Fees – $775.00 ||
All other charges remain the same as above. ||
Annual Returns/Registered Office: $220.00 ||
Filing Fee – $15.00 ||
Amalgamations: Base Fee of $1250.00 Plus time and value fee ||
Extra provincial registration: $250.00 ||
Registration of Trade Name: $120.00`
        },
        {
          id: 'wills&powerofattorney&repdocs',
          label: `WILLS, ENDURING POWER OF ATTORNEY, AND PERSONAL REPRESENTATIVE DOCUMENTS ||
SINGLE PERSON`,
          content: `Will – $595.00 plus GST ||
Enduring Power of Attorney (EPA) – $295.00 plus GST ||
Personal Directive (PD) – $275.00 plus GST ||
Will and PD or EPA – $750.00 plus GST ||
Will, EPA and PD package – $895.00 plus GST ||
Codicil – $275.00 plus GST`
        },
        {
          label: "Married Couple",
          content: `Will – $975.00 plus GST ||
EPA – $395.00 plus GST ||
PD – $350.00 plus GST ||
Will and PD or EPA – $1075.00 plus GST ||
Will, EPA and PD package – $1175.00 plus GST ||
Codicil – $400.00 plus GST`
        },
        {
          label: "Estate Probate and Administration Fees",
          content: `This fee is for core services generally required. ||
Fee: Estates up to $150,000.00: $2,250.00 plus ½% of the value of the estate; plus disbursements ||
Estates over $150,000.00: $2,250.00 plus 1% of the value of the estate plus disbursements ||
For estates over $1,000,000.00, fees will vary with complexity and size. Please contact us for a quote.`
        },
        {
          label: "Personal Injury Cases",
          content: `Usually we charge a contingency fee of 25% to 35% for personal injury cases. ||
That is, our fee is a percentage of the amount recovered, and we receive no fee until you are paid.`
        },
        {
          label: "Notary Fees/Commissioning Fees",
          content: `One (1) document notarized: $60.00 ||
Each additional: $5.00 – $20.00 ||
One (1) certified copy: $35.00 ||
Each additional: $20.00 ||
Travel letter in standard form from Government of Canada website: $65.00 ||
Specific Power of Attorney drafted by our office: $250.00 ||
One (1) document commissioned: $40.00 ||
Each additional: $5.00 – $20.00`
        },
        {
          content: `Other Potential Fees for Extra Services: ||
RUSH FEE: $200.00 – $500.00 ||
EXTRA SIGNING APPOINTMENT FEE: $200.00 / extra appointment ||
DIRECT DEPOSIT of Proceeds(Per deposit) $20.00 – $40 ||
ORDER RPR WITH COMPL $150.00 ORDER COMPLIANCE Only $50.00 ||
WIRE FEES: Outgoing wire fee: $150.00 Incoming bank wire fee: $35.00 ||
Mortgages that are FCT or FNF are an extra $250.00`
        },
        {
          content: `Fees & Disbursements above are estimated. We cannot give a firm amount until we have the file opened and have all information and details`
        },
      ]
    }
  },
  bulletpoints: [
    "Real Estate Transactions & Mortages",
    "Wills & Estates",
    "Civil Litigation",
    "Personal Injury",
    "Business Incorporation",
    "Business Sales & Purchases",
    "Employment Law - including wrongful dismissal",
    "Builders' Liens",
    "Foreclosures",
    "Debt Collection",
    "Commercial Transactions",
    "Notarization",
    "Banking",
    "Private Lending"
  ],
  footer: {
    content: ""
  },
  header: {
    content: "Pricing"
  },
  subheader: {
    content: "REAL ESTATE FEES JULY 1, 2024"
  }
}

export const PRICINGSECTIONS: PricingSection[] = [
  // TODO
];

export const PRICESECTION: ProfileNav[] = [
  {
    display: 'PURCHASE & MORTGAGE FEES',
    value: 'purcahse&mortgagefees',
    order: 0,
  },
  {
    display: 'CASH PURCHASE FEES',
    value: 'cachpurchasefees',
    order: 1,
  },
  {
    display: 'SALES',
    value: 'sales',
    order: 2,
  },
  {
    display: 'REFINANCES',
    value: 'refinances',
    order: 3,
  },
  {
    display: 'INTERIM FINANCING',
    value: 'interimfinancing',
    order: 4,
  },
  {
    display: 'TRANSFER OF LAND',
    value: 'transferofland',
    order: 5,
  },
  {
    display: 'CORPORATE FEES',
    value: 'corporatefees',
    order: 6,
  },
  {
    display: 'WILLS, ENDURING POWER OF ATTORNEY, AND PERSONAL REPRESENTATIVE DOCUMENTS',
    value: 'wills&powerofattorney&repdocs',
    order: 7,
  },
];

export const FAQSECTIONS: FAQSection[] = [
    {
      question: 'How long has Fric, Lowenstein & Co. LLP been in practice?',
      answer:   'Fric, Lowenstein & Co. LLP has more than 40 years of experience serving '
              + 'the legal needs of citizens in Calgary and throughout Alberta. '
              + 'Founded in 1982, our firm has built lasting relationships with individuals, '
              + 'families, and businesses across the province.',
    },
    {
      question: 'Do I have a case?',
      answer:   '<p>Every situation is unique. <a class="text-link" href="/contact-us">Contact us today</a> '
              + 'to discuss your specific circumstances — we are committed to defending the rights of our clients.</p>'
              + '<p class="mt-3 font-medium text-brand">We regularly help people who are:</p>'
              + '<ul>'
              + '<li>Buying or selling a residential or commercial property</li>'
              + '<li>Starting or operating a small business</li>'
              + '<li>Concerned about will and estate planning</li>'
              + '<li>Dealing with a foreclosure or mortgage issue</li>'
              + '<li>Seeking debt collection or creditor remedies</li>'
              + '<li>Recovering from a personal injury</li>'
              + '<li>In need of general legal guidance</li>'
              + '</ul>',
    },
    {
      question: 'What areas of law does the firm practice?',
      answer:   '<p>Our firm offers a broad range of legal services. '
              + 'See our full <a class="text-link" href="/areas-of-law">Areas of Law</a> page for details.</p>'
              + '<ul>'
              + '<li>Real estate — sales, purchases and mortgages</li>'
              + '<li>Wills and estates</li>'
              + '<li>Corporate and small business law</li>'
              + '<li>Civil and commercial litigation</li>'
              + '<li>Foreclosures</li>'
              + '<li>Debt collection</li>'
              + '<li>Commercial transactions</li>'
              + '<li>Personal injury (contingency fee available)</li>'
              + '<li>Banking and private lending</li>'
              + '<li>Notarization and commissioning</li>'
              + '</ul>',
    },
    {
      question: 'Can I call for a free initial telephone discussion?',
      answer:   'Yes. We will take your initial call at no charge and let you know whether '
              + 'we can assist with your matter. For areas outside our practice — such as '
              + 'criminal or family law — we work closely with other trusted lawyers and '
              + 'can provide a direct referral. If it is a matter we can handle ourselves, '
              + 'we will give you a clear estimate of anticipated costs before any work begins.',
    },
    {
      question: 'Do you offer flat-rate or fixed-fee services?',
      answer:   'Yes. We offer discounted flat rates for many routine legal services including '
              + 'real estate transactions, incorporations, wills, and notarizations. '
              + 'See our <a class="text-link" href="/pricing">Pricing page</a> for the current '
              + 'fee schedule, or call us for a quote on more complex matters.',
    },
    {
      question: 'Where is your office located?',
      answer:   'We are conveniently located at <strong>#750, 11012 Macleod Trail S.E., Calgary, Alberta T2J 7E4</strong> '
              + '— Southcentre Executive Tower. Easy to get to and easy to park. '
              + 'Office hours are Monday to Friday, 8:30 AM to 5:00 PM.',
    },
];

export const FAQ: SiteContent = {
  id:   'faq',
  page: 'FAQ',
  header: {
    content: 'Frequently Asked Questions',
  },
  subheader: {
    content: 'Professional Legal Services in Calgary',
  },
  body: {
    content: 'Learn more about Fric, Lowenstein & Co. LLP\'s Calgary-based legal practice. '
           + 'We have been serving individuals and businesses throughout Alberta since 1982.',
  },
  // Each entry maps directly to one accordion card in FaqComponent
  faqs: FAQSECTIONS,
  footer: {
    content: '',
  },
};

export const INQUIRY_SUB_PREFIX = 'INQUIRY FROM WEBSITE:';
