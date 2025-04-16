export interface Appointment {
    id: string;         
    customerId: string;
    providerId: string;
    serviceIds: string[];
    serviceName: string;
    customerName: string;
    startTime: Date;
    endTime: Date;
    status: 'pending' | 'confirmed' | 'canceled' | 'completed';
    cleaningTime: number;
    notes?: string;
    createdAt: Date;
  }