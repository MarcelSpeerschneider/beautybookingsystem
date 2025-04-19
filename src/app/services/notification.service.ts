import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Appointment } from '../models/appointment.model';
import { Firestore, collection, query, where, onSnapshot } from '@angular/fire/firestore';

// Export the type so it can be imported by other components
export type AppointmentWithId = Appointment & { id: string };

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private firestore = inject(Firestore);
  
  // BehaviorSubject to track unread notifications
  private unreadNotificationsSubject = new BehaviorSubject<AppointmentWithId[]>([]);
  unreadNotifications$ = this.unreadNotificationsSubject.asObservable();
  
  // BehaviorSubject for the unread count
  private unreadCountSubject = new BehaviorSubject<number>(0);
  
  // Fix: Initialize the property with undefined
  private unsubscribeListener: (() => void) | undefined = undefined;
  
  constructor() {}
  
  // Get the unread count as an observable
  getUnreadCount(): Observable<number> {
    return this.unreadCountSubject.asObservable();
  }
  
  // Start listening for notifications for a specific provider
  startListeningForNotifications(providerId: string): void {
    if (!providerId) {
      console.error('Provider ID is required to listen for notifications');
      return;
    }
    
    console.log('Starting to listen for notifications for provider:', providerId);
    
    // Stop any existing listener
    this.stopListeningForNotifications();
    
    // Create a query for pending appointments for this provider
    const appointmentsRef = collection(this.firestore, 'appointments');
    const pendingAppointmentsQuery = query(
      appointmentsRef,
      where('providerId', '==', providerId),
      where('status', '==', 'pending')
    );
    
    // Set up real-time listener
    this.unsubscribeListener = onSnapshot(pendingAppointmentsQuery, (snapshot) => {
      const notifications: AppointmentWithId[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data() as Appointment;
        notifications.push({
          ...data,
          id: doc.id
        });
      });
      
      console.log('Received notifications:', notifications.length);
      
      // Update the BehaviorSubjects
      this.unreadNotificationsSubject.next(notifications);
      this.unreadCountSubject.next(notifications.length);
    }, (error) => {
      console.error('Error listening for notifications:', error);
    });
  }
  
  // Stop listening for notifications
  stopListeningForNotifications(): void {
    if (this.unsubscribeListener) {
      this.unsubscribeListener();
      this.unsubscribeListener = undefined;
      
      // Reset the notifications
      this.unreadNotificationsSubject.next([]);
      this.unreadCountSubject.next(0);
      
      console.log('Stopped listening for notifications');
    }
  }
}