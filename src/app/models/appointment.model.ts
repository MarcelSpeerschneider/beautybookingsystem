export interface Appointment {
serviceName: any;
customerName: any;
    appointmentId: string;
    userId: string;
    customerId: string;
    providerId: string;
    serviceIds: string[];
    startTime: Date;
    endTime: Date;
    status: 'pending' | 'confirmed' | 'canceled' | 'completed';
    notes?: string;
    cleaningTime: number;
    createdAt: Date;
}