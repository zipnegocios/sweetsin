export type Locale = "en" | "es";

export interface Dictionary {
  common: {
    switchToLanguage: string;
  };
  nav: {
    menu: string;
    events: string;
    findUs: string;
    orderNow: string;
    order: string;
  };
  hero: {
    headlinePrefix: string;
    headlineHighlight: string;
    headlineSuffix: string;
    subhead: string;
    ctaMenu: string;
    ctaStory: string;
    scrollHint: string;
  };
  brandStory: {
    eyebrow: string;
    headlineLine1: string;
    headlineLine2: string;
    headlineLine3Prefix: string;
    headlineLine3Highlight: string;
    headlineLine3Suffix: string;
    body: string;
    imageCaption: string;
  };
  menu: {
    eyebrow: string;
    headlinePrefix: string;
    headlineHighlight: string;
    filterAll: string;
    filterSin: string;
    filterVirtue: string;
    filterCoffee: string;
    emptyState: string;
  };
  events: {
    eyebrow: string;
    headlinePrefix: string;
    headlineHighlight: string;
    headlineSuffix: string;
    subhead: string;
    cardCorporateTitle: string;
    cardCorporateDesc: string;
    cardWeddingsTitle: string;
    cardWeddingsDesc: string;
    cardFestivalsTitle: string;
    cardFestivalsDesc: string;
    ctaGetQuote: string;
    ctaWhatsApp: string;
    formTitle: string;
    formSubtitle: string;
    formName: string;
    formCompany: string;
    formEventType: string;
    formEventTypeSelect: string;
    formEventTypeCorporate: string;
    formEventTypeWedding: string;
    formEventTypeFestival: string;
    formEventTypeOther: string;
    formDate: string;
    formGuests: string;
    formGuestsPlaceholder: string;
    formMessage: string;
    formMessagePlaceholder: string;
    formSubmit: string;
    formSubmitting: string;
    formSuccessTitle: string;
    formSuccessBody: string;
    formClose: string;
    formError: string;
  };
  findUs: {
    eyebrow: string;
    headline: string;
    subhead: string;
    newsletterPlaceholder: string;
    newsletterSuccess: string;
    mapUnavailable: string;
    noStops: string;
  };
  footer: {
    tagline: string;
    menuHeading: string;
    servicesHeading: string;
    findUsHeading: string;
    sevenSins: string;
    sevenVirtues: string;
    laRepolla: string;
    eventsLink: string;
    weddingsLink: string;
    ourStory: string;
    schedule: string;
    whatsapp: string;
    copyright: string;
  };
}
