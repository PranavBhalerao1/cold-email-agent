export interface Startup {
  name: string;
  url: string;
  email?: string;
  contactFirstName?: string;
}

export const startups: Startup[] = [
  { name: 'Citeleaf', url: 'https://citeleaf.vercel.app', email: 'citeleaf@gmail.com', contactFirstName: 'Citeleaf' },
];
