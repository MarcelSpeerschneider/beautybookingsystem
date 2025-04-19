import { Injectable, NgZone, inject } from '@angular/core';
import { Firestore, collection, query, where, onSnapshot, QuerySnapshot, DocumentData } from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';
import { AppointmentWithId } from './appointment.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private unreadCount = new BehaviorSubject<number>(0);
  private unreadNotifications = new BehaviorSubject<AppointmentWithId[]>([]);
  private notificationsListener: () => void = () => {};
  private currentProviderId: string | null = null;

  private firestore = inject(Firestore);
  private ngZone = inject(NgZone);

  // Get unread notification count as observable
  getUnreadCount(): Observable<number> {
    return this.unreadCount.asObservable();
  }

  // Get unread notifications as observable
  get unreadNotifications$(): Observable<AppointmentWithId[]> {
    return this.unreadNotifications.asObservable();
  }

  // Start listening for notifications (pending appointments) for a specific provider
  startListeningForNotifications(providerId: string): void {
    // Debugging information
    console.log('NotificationService: Starting to listen for provider:', providerId);
    
    // Don't set up duplicate listeners
    if (this.currentProviderId === providerId) {
      console.log('NotificationService: Already listening for this provider');
      return;
    }

    // Stop any existing listener
    this.stopListeningForNotifications();
    this.currentProviderId = providerId;
    
    // Run this inside NgZone to ensure proper context
    this.ngZone.run(() => {
      try {
        console.log('NotificationService: Setting up listener in NgZone');
        
        // Set up the query for pending appointments
        const appointmentsRef = collection(this.firestore, 'appointments');
        const pendingAppointmentsQuery = query(
          appointmentsRef,
          where('providerId', '==', providerId),
          where('status', '==', 'pending')
        );
        
        // Set up the real-time listener
        this.notificationsListener = onSnapshot(
          pendingAppointmentsQuery,
          (snapshot) => this.handleSnapshotUpdate(snapshot),
          (error) => this.handleSnapshotError(error)
        );
        
        console.log('NotificationService: Listener set up successfully');
      } catch (error) {
        console.error('NotificationService: Error in startListening:', error);
        this.unreadCount.next(0);
        this.unreadNotifications.next([]);
      }
    });
  }
  
  // Handle snapshot updates safely within NgZone
  private handleSnapshotUpdate(snapshot: QuerySnapshot<DocumentData>): void {
    this.ngZone.run(() => {
      try {
        const pendingAppointments: AppointmentWithId[] = [];
        
        snapshot.forEach(doc => {
          // Add document ID to the appointment data
          const appointment = {
            ...doc.data(),
            id: doc.id
          } as AppointmentWithId;
          
          // Convert timestamps to Date objects
          if (appointment.startTime) {
            appointment.startTime = this.convertTimestampToDate(appointment.startTime);
          }
          if (appointment.endTime) {
            appointment.endTime = this.convertTimestampToDate(appointment.endTime);
          }
          if (appointment.createdAt) {
            appointment.createdAt = this.convertTimestampToDate(appointment.createdAt);
          }
          
          pendingAppointments.push(appointment);
        });
        
        console.log(`NotificationService: Received ${pendingAppointments.length} pending appointments`);
        this.unreadCount.next(pendingAppointments.length);
        this.unreadNotifications.next(pendingAppointments);
      } catch (err) {
        console.error('NotificationService: Error processing snapshot:', err);
      }
    });
  }
  
  // Handle snapshot errors safely within NgZone
  private handleSnapshotError(error: Error): void {
    this.ngZone.run(() => {
      console.error('NotificationService: Error fetching notifications:', error);
      this.unreadCount.next(0);
      this.unreadNotifications.next([]);
    });
  }

  // Stop listening for notifications
  stopListeningForNotifications(): void {
    console.log('NotificationService: Stopping listener');
    
    if (this.notificationsListener) {
      this.notificationsListener();
      this.notificationsListener = () => {};
    }
    
    this.currentProviderId = null;
    this.unreadCount.next(0);
    this.unreadNotifications.next([]);
  }

  // Helper to convert Firestore timestamps to JavaScript Date objects
  private convertTimestampToDate(timestamp: any): Date {
    if (!timestamp) return new Date();
    
    // Handle Firestore Timestamp objects
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    
    // Handle timestamp objects with seconds and nanoseconds
    if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
      return new Date(timestamp.seconds * 1000);
    }
    
    // Handle Date objects or ISO strings
    return new Date(timestamp);
  }
}