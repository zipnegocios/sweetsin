export interface Product {
  id: string;
  name: string;
  category: 'sin' | 'virtue';
  price: number;
  description: string;
  available: boolean;
  featured?: boolean;
  image?: string;
}

export const products: Product[] = [
  // Sins ($13)
  { id: 'p1',  name: 'Gluttony',   category: 'sin',    price: 13, description: 'More than you should. Exactly as much as you want.',          available: true,  image: '/products/p1.jpg' },
  { id: 'p2',  name: 'Lust',       category: 'sin',    price: 13, description: 'Impossible to resist. Impossible to have just one.',          available: true,  image: '/products/p2.jpg' },
  { id: 'p3',  name: 'Wrath',      category: 'sin',    price: 13, description: 'Bold, aggressive, uncompromising in every bite.',             available: true,  image: '/products/p3.jpg' },
  { id: 'p4',  name: 'Envy',       category: 'sin',    price: 13, description: 'The one everyone wishes was on their plate.',                 available: true,  image: '/products/p4.jpg' },
  { id: 'p5',  name: 'Pride',      category: 'sin',    price: 13, description: 'Our finest. No apologies necessary.',                        available: true,  image: '/products/p5.jpg' },
  { id: 'p6',  name: 'Greed',      category: 'sin',    price: 13, description: 'Because one was never going to be enough.',                  available: true,  image: '/products/p6.jpg' },
  { id: 'p7',  name: 'Sloth',      category: 'sin',    price: 13, description: 'The indulgence that demands you slow down.',                 available: true,  image: '/products/p7.jpg' },

  // Virtues ($11)
  { id: 'p8',  name: 'Patience',   category: 'virtue', price: 11, description: 'Good things come to those who wait. These are worth it.',    available: true,  image: '/products/p8.jpg' },
  { id: 'p9',  name: 'Kindness',   category: 'virtue', price: 11, description: 'Sweet, gentle, made with care.',                            available: true,  image: '/products/p9.jpg' },
  { id: 'p10', name: 'Humility',   category: 'virtue', price: 11, description: 'Simple ingredients. Extraordinary result.',                 available: true,  image: '/products/p10.jpg' },
  { id: 'p11', name: 'Charity',    category: 'virtue', price: 11, description: 'A little sweetness goes a long way.',                       available: true,  image: '/products/p11.jpg' },
  { id: 'p12', name: 'Diligence',  category: 'virtue', price: 11, description: 'Crafted with attention to every detail.',                   available: true,  image: '/products/p12.jpg' },
  { id: 'p13', name: 'Temperance', category: 'virtue', price: 11, description: 'Balance never tasted this good.',                           available: true,  image: '/products/p13.jpg' },
  { id: 'p14', name: 'Hope',       category: 'virtue', price: 11, description: 'The first bite of something wonderful.',                    available: true,  image: '/products/p14.jpg' },

  // Featured
  { id: 'p15', name: 'La Repolla', category: 'sin',    price: 13, description: "Filled with homemade arequipe, dusted with something you didn't know you were missing.", available: true, featured: true, image: '/products/p15.jpg' },
];

export interface ScheduleEntry {
  id: string;
  day: string;
  location: string;
  timeRange: string;
  isActive: boolean;
  lat: number;
  lng: number;
}

// Coordinates are approximate (city-block precision) — verify against the
// exact market stall/trailer spot before relying on them for navigation.
export const schedule: ScheduleEntry[] = [
  { id: 's1', day: 'Friday',    location: 'Central Market, Adelaide CBD', timeRange: '4–8 pm',    isActive: true,  lat: -34.9289, lng: 138.5999 },
  { id: 's2', day: 'Saturday',  location: 'Rundle Park, Adelaide',        timeRange: '10 am–3 pm', isActive: true,  lat: -34.9235, lng: 138.6087 },
  { id: 's3', day: 'Sunday',    location: 'Prospect Farmers Market',      timeRange: '9 am–1 pm',  isActive: true,  lat: -34.8814, lng: 138.5931 },
  { id: 's4', day: 'Wednesday', location: 'Gouger St Night Market',       timeRange: '5–9 pm',     isActive: false, lat: -34.9295, lng: 138.5987 },
];

export const WHATSAPP_NUMBER = '+61433508831';
export const WHATSAPP_URL = `https://wa.me/61433508831`;
