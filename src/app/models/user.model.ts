export interface User {
  userId: string;
  role: 'customer' | 'provider';
  subscriptionStatus: string;
  subscriptionStart: Date;
  subscriptionEnd: Date;
  subscriptionPaymentId: string;
}