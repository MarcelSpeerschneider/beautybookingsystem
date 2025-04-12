export interface Review {
    reviewId: string;
    customerId: string;
    providerId: string;
    serviceId: string;
    appointmentId: string;
    rating: number;
    comment: string;
    createdAt: Date;
  }