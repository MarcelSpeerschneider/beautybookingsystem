export {}

export interface Appointment {
serviceName: any;
customerName: any;
    appointmentId: string;
    customerId: string;
    providerId: string;
    serviceId: string;
    startTime: Date;
    endTime: Date;
    status: 'pending' | 'confirmed' | 'canceled' | 'completed';
    notes?: string;
    cleaningTime: number;
    createdAt: Date;
}