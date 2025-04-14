export interface Appointment {
serviceName: any;
customerName: any;
    appointmentId: string;
    customerId: string;
    providerId: string;
    serviceIds: string[];
    startTime: Date;
    endTime: Date;
    status: 'pending' | 'confirmed' | 'canceled' | 'completed';
    cleaningTime: number;
    notes?: string;
    createdAt: Date;
}