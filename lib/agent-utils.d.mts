export function trackingReference(text?: string): string;
export function nicheVoice(niche?: string): string;
export function cleanMessage(text?: string): string;
export function basicIntake(text?: string): {
  email: string;
  phone: string;
  socialLinks: string[];
  brand: string;
  budget: string;
  romanUrdu: boolean;
};
