import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Firestore, collection, query, where, onSnapshot, DocumentData } from '@angular/fire/firestore';

// Define type for appointments with ID
export interface AppointmentWithId {
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

// Interface for Firestore document data
interface FirestoreAppointment extends DocumentData {
  customerId: string;
  providerId: string;
  serviceIds: string[];
  serviceName: string;
  customerName: string;
  startTime: any; // Kann ein Timestamp oder ein anderer Wert sein
  endTime: any;
  status: 'pending' | 'confirmed' | 'canceled' | 'completed';
  cleaningTime: number;
  notes?: string;
  createdAt: any;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private firestore = inject(Firestore);
  
  private unreadNotificationsSubject = new BehaviorSubject<AppointmentWithId[]>([]);
  unreadNotifications$: Observable<AppointmentWithId[]> = this.unreadNotificationsSubject.asObservable();
  
  private notificationsListener: (() => void) | undefined;
  
  constructor() {}
  
  startListeningForNotifications(providerId: string): void {
    if (this.notificationsListener) {
      this.stopListeningForNotifications();
    }
    
    console.log('Starting to listen for notifications for provider:', providerId);
    
    const appointmentsRef = collection(this.firestore, 'appointments');
    const q = query(
      appointmentsRef,
      where('providerId', '==', providerId),
      where('status', '==', 'pending')
    );
    
    this.notificationsListener = onSnapshot(q, (snapshot) => {
      const notifications: AppointmentWithId[] = [];
      
      snapshot.forEach(doc => {
        // Expliziter Cast zu unserem Interface-Typ
        const data = doc.data() as FirestoreAppointment;
        
        // Sicheres Konvertieren der Datumswerte
        const appointmentWithId: AppointmentWithId = {
          id: doc.id,
          customerId: data.customerId,
          providerId: data.providerId,
          serviceIds: data.serviceIds || [],
          serviceName: data.serviceName || '',
          customerName: data.customerName || '',
          cleaningTime: data.cleaningTime || 0,
          status: data.status,
          notes: data.notes,
          // Sicheres Konvertieren von Firestore Timestamps
          startTime: this.convertToDate(data.startTime),
          endTime: this.convertToDate(data.endTime),
          createdAt: this.convertToDate(data.createdAt)
        };
        
        notifications.push(appointmentWithId);
      });
      
      console.log('Received notifications:', notifications.length);
      this.unreadNotificationsSubject.next(notifications);
    }, (error) => {
      console.error('Error fetching notifications:', error);
    });
  }
  
  // Hilfsfunktion zur sicheren Konvertierung von Firestore-Timestamps
  private convertToDate(value: any): Date {
    if (!value) return new Date();
    
    try {
      // Fall 1: Es ist ein Firestore Timestamp mit toDate-Methode
      if (value && typeof value.toDate === 'function') {
        return value.toDate();
      }
      
      // Fall 2: Es ist bereits ein Date-Objekt
      if (value instanceof Date) {
        return value;
      }
      
      // Fall 3: Es ist ein ISO-String oder eine Timestamp-Zahl
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date;
      }
      
      // Falls nichts funktioniert, aktuelles Datum zurückgeben
      return new Date();
    } catch (error) {
      console.error('Fehler bei der Datumskonvertierung:', error);
      return new Date();
    }
  }
  
  stopListeningForNotifications(): void {
    if (this.notificationsListener) {
      console.log('Stopping notifications listener');
      this.notificationsListener();
      this.notificationsListener = undefined;
      this.unreadNotificationsSubject.next([]);
    }
  }
  
  getUnreadCount(): Observable<number> {
    return new Observable<number>(observer => {
      const subscription = this.unreadNotifications$.subscribe(notifications => {
        observer.next(notifications.length);
      });
      
      return () => {
        subscription.unsubscribe();
      };
    });
  }
}