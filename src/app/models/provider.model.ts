export interface Provider {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  businessName: string;
  address?: string;
  description: string;
  logo: string;
  website?: string;
  socialMedia?: {
    instagram?: string;
    facebook?: string;
  };
  openingHours: string;
  specialties?: string[];
  acceptsOnlinePayments?: boolean; 
  subscriptionStatus?: string;
}
