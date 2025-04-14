import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthenticationService } from '../../../services/authentication.service';
import { User } from '@angular/fire/auth';
import { Subscription, firstValueFrom, forkJoin, of } from 'rxjs';
import { Customer } from '../../../models/customer.model';
import { Router } from '@angular/router';
import { CustomerService } from '../../../services/customer.service';
import { AppointmentService } from '../../../services/appointment.service';
import { Appointment } from '../../../models/appointment.model';
import { ServiceService } from '../../../services/service.service';
import { ProviderService } from '../../../services/provider.service';
import { LoadingService } from '../../../services/loading.service';
import { collection, collectionData, query, where } from '@angular/fire/firestore';
import { catchError, map } from 'rxjs/operators';

interface AppointmentWithDetails extends Appointment {
  providerName?: string;
  servicePrice?: number;
}

@Component({
  selector: 'app-customer-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer-profile.component.html',
  styleUrls: ['./customer-profile.component.css']
})
export class CustomerProfileComponent implements OnInit, OnDestroy {
  customer: Customer | null = null;
  user: User | null = null;
  isLoading: boolean = true;
  isEditing: boolean = false;
  editedPhone: string = '';
  
  // Appointments
  upcomingAppointments: AppointmentWithDetails[] = [];
  pastAppointments: AppointmentWithDetails[] = [];
  
  // Statistics
  totalAppointments: number = 0;
  totalSpent: number = 0;
  favoriteService: string = '';
  
  // Services
  private auth = inject(AuthenticationService);
  private customerService = inject(CustomerService);
  private appointmentService = inject(AppointmentService);
  private serviceService = inject(ServiceService);
  private providerService = inject(ProviderService);
  private loadingService = inject(LoadingService);
  private router = inject(Router);
  
  // Subscriptions
  private subscriptions: Subscription[] = [];

  ngOnInit() {
    this.loadingService.setLoading(true, 'Lade Profildaten...');
    
    // Get user and customer data
    const userSub = this.auth.user.subscribe({
      next: (userWithCustomer) => {
        if (userWithCustomer.user) {
          this.user = userWithCustomer.user;
          if (userWithCustomer.customer) {
            this.customer = userWithCustomer.customer;
            this.editedPhone = this.customer.phone || '';
            this.loadAppointments();
          } else {
            this.loadingService.setLoading(false);
            this.isLoading = false;
          }
        } else {
          // No user logged in, redirect to login
          this.loadingService.setLoading(false);
          this.router.navigate(['/customer-login']);
        }
      },
      error: (error) => {
        console.error('Error loading user data:', error);
        this.loadingService.setLoading(false);
        this.isLoading = false;
      }
    });
    
    this.subscriptions.push(userSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  loadAppointments(): void {
    if (!this.customer?.userId) {
      this.isLoading = false;
      this.loadingService.setLoading(false);
      return;
    }

    const userId = this.customer.userId;
    
    const appointmentSub = this.appointmentService.getAppointmentsByUser(userId)
      .pipe(
        catchError(error => {
          console.error(`Error fetching appointments for user ${userId}:`, error);
          return of([]);
        })
      )
      .subscribe({
        next: (appointments) => {
          if (appointments && appointments.length > 0) {
            this.processAppointments(appointments);
          } else {
            // Try with alternative method if no appointments found
            this.tryAlternativeAppointmentFetch();
          }
        },
        error: (error) => {
          console.error('Error fetching appointments:', error);
          this.loadingService.setLoading(false);
          this.isLoading = false;
        }
      });
    
    this.subscriptions.push(appointmentSub);
  }

  tryAlternativeAppointmentFetch(): void {
    if (!this.customer?.userId) {
      this.isLoading = false;
      this.loadingService.setLoading(false);
      return;
    }

    const userId = this.customer.userId;
    const firestore = this.appointmentService['firestore'];
    const appointmentsCollection = collection(firestore, 'appointments');
    
    // This is a fallback method to query all appointments and filter manually
    const appointmentSub = collectionData(appointmentsCollection, { idField: 'appointmentId' })
      .pipe(
        map(appointments => {
          // Case-insensitive filtering
          return appointments.filter(appt => 
            (appt as any).customerId && 
            typeof (appt as any).customerId === 'string' &&
            (appt as any).customerId.toLowerCase() === userId.toLowerCase()
          ) as Appointment[];
        }),
        catchError(error => {
          console.error('Error in alternative appointment fetch:', error);
          return of([]);
        })
      )
      .subscribe({
        next: (filteredAppointments) => {
          if (filteredAppointments && filteredAppointments.length > 0) {
            this.processAppointments(filteredAppointments);
          } else {
            // No appointments found with either method
            this.isLoading = false;
            this.loadingService.setLoading(false);
          }
        },
        error: (error) => {
          console.error('Error in alternative appointment fetch:', error);
          this.isLoading = false;
          this.loadingService.setLoading(false);
        }
      });
    
    this.subscriptions.push(appointmentSub);
  }
  
  processAppointments(appointments: Appointment[]): void {
    try {
      const now = new Date();
      const upcomingAppts: AppointmentWithDetails[] = [];
      const pastAppts: AppointmentWithDetails[] = [];
      
      appointments.forEach(appointment => {
        const enhancedAppointment: AppointmentWithDetails = { 
          ...appointment,
          providerName: "Loading...",
          servicePrice: 0
        };
        
        // Sort into upcoming or past
        const appointmentDate = new Date(appointment.startTime);
        if (appointment.status === 'completed' || 
            appointment.status === 'canceled' || 
            appointmentDate < now) {
          pastAppts.push(enhancedAppointment);
        } else {
          upcomingAppts.push(enhancedAppointment);
        }
      });
      
      // Sort appointments
      this.upcomingAppointments = upcomingAppts.sort((a, b) => 
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
      
      this.pastAppointments = pastAppts.sort((a, b) => 
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
      
      // Set basic statistics
      this.totalAppointments = appointments.length;
      this.totalSpent = 0;
      this.favoriteService = appointments.length > 0 ? 
        (appointments[0].serviceName || 'Unbekannt') : "";
      
      // Load is complete for the main UI
      this.isLoading = false;
      this.loadingService.setLoading(false);
      
      // Load additional details in the background
      this.loadAdditionalAppointmentDetails(appointments);
    } catch (error) {
      console.error("Error processing appointments:", error);
      this.isLoading = false;
      this.loadingService.setLoading(false);
    }
  }
  
  async loadAdditionalAppointmentDetails(appointments: Appointment[]): Promise<void> {
    try {
      // Maps for caching data we fetch
      const serviceDetails = new Map<string, number>();
      const providerNames = new Map<string, string>();
      const serviceFrequency = new Map<string, number>();
      let totalAmount = 0;
      
      // Process each appointment
      for (const appointment of appointments) {
        // Track service frequency for favorite service calculation
        if (appointment.serviceName) {
          const currentCount = serviceFrequency.get(appointment.serviceName) || 0;
          serviceFrequency.set(appointment.serviceName, currentCount + 1);
        }
        
        // Get provider name if needed
        if (appointment.providerId && !providerNames.has(appointment.providerId)) {
          try {
            const provider = await firstValueFrom(
              this.providerService.getProviderByUserId(appointment.providerId)
                .pipe(catchError(() => of(null)))
            );
            
            if (provider) {
              providerNames.set(appointment.providerId, provider.businessName);
            }
          } catch (error) {
            console.warn(`Could not fetch provider details for ${appointment.providerId}`);
          }
        }
        
        // Get service price if needed
        if (appointment.serviceIds && appointment.serviceIds.length > 0) {
          for (const serviceId of appointment.serviceIds) {
            if (!serviceDetails.has(serviceId)) {
              try {
                const service = await firstValueFrom(
                  this.serviceService.getService(serviceId)
                    .pipe(catchError(() => of(null)))
                );
                
                if (service) {
                  serviceDetails.set(serviceId, service.price);
                  
                  // Add to total spent if appointment is completed
                  if (appointment.status === 'completed') {
                    totalAmount += service.price;
                  }
                }
              } catch (error) {
                console.warn(`Could not fetch service details for ${serviceId}`);
              }
            } else if (appointment.status === 'completed') {
              // We already have the price cached
              totalAmount += serviceDetails.get(serviceId) || 0;
            }
          }
        }
      }
      
      // Update the total spent
      this.totalSpent = totalAmount;
      
      // Find favorite service based on frequency
      let maxFrequency = 0;
      let favoriteServiceName = "";
      serviceFrequency.forEach((count, service) => {
        if (count > maxFrequency) {
          maxFrequency = count;
          favoriteServiceName = service;
        }
      });
      
      if (favoriteServiceName) {
        this.favoriteService = favoriteServiceName;
      }
      
      // Update appointment objects with details
      this.updateAppointmentDetails(this.upcomingAppointments, providerNames, serviceDetails);
      this.updateAppointmentDetails(this.pastAppointments, providerNames, serviceDetails);
      
    } catch (error) {
      console.error("Error loading additional appointment details:", error);
    }
  }
  
  private updateAppointmentDetails(
    appointments: AppointmentWithDetails[],
    providerNames: Map<string, string>,
    serviceDetails: Map<string, number>
  ): void {
    appointments.forEach(appointment => {
      if (appointment.providerId) {
        appointment.providerName = providerNames.get(appointment.providerId) || "Unbekannt";
      }
      
      if (appointment.serviceIds && appointment.serviceIds.length > 0) {
        const primaryServiceId = appointment.serviceIds[0];
        appointment.servicePrice = serviceDetails.get(primaryServiceId) || 0;
      }
    });
  }
  
  // UI Helper Methods
  getInitials(): string {
    if (!this.customer || !this.customer.firstName || !this.customer.lastName) return '';
    return (this.customer.firstName[0] + this.customer.lastName[0]).toUpperCase();
  }
  
  formatDate(date: Date | any): string {
    if (!date) return 'Datum unbekannt';
    
    try {
      // Handle Firestore Timestamp
      if (date && typeof date === 'object' && date.toDate && typeof date.toDate === 'function') {
        const jsDate = date.toDate();
        return jsDate.toLocaleDateString('de-DE', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });
      }
      
      // Handle Date object or string
      const dateObj = date instanceof Date ? date : new Date(date);
      
      if (isNaN(dateObj.getTime())) {
        return "Datum unbekannt";
      }
      
      return dateObj.toLocaleDateString('de-DE', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch (error) {
      return "Datum unbekannt";
    }
  }
  
  formatTime(date: Date | any): string {
    if (!date) return 'Zeit unbekannt';
    
    try {
      // Handle Firestore Timestamp
      if (date && typeof date === 'object' && date.toDate && typeof date.toDate === 'function') {
        const jsDate = date.toDate();
        return jsDate.toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      
      // Handle Date object or string
      const dateObj = date instanceof Date ? date : new Date(date);
      
      if (isNaN(dateObj.getTime())) {
        return "Zeit unbekannt";
      }
      
      return dateObj.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return "Zeit unbekannt";
    }
  }
  
  formatCurrency(amount: number): string {
    return amount.toFixed(2).replace('.', ',') + ' €';
  }
  
  calculatePrice(appointment: AppointmentWithDetails): string {
    return appointment.servicePrice ? appointment.servicePrice.toFixed(2).replace('.', ',') : '0,00';
  }
  
  getStatusIcon(status: string): string {
    switch (status) {
      case 'pending': return '⏳';
      case 'confirmed': return '✅';
      case 'completed': return '✓';
      case 'canceled': return '✗';
      default: return '?';
    }
  }
  
  getStatusText(status: string): string {
    switch (status) {
      case 'pending': return 'Anfrage';
      case 'confirmed': return 'Bestätigt';
      case 'completed': return 'Abgeschlossen';
      case 'canceled': return 'Storniert';
      default: return 'Unbekannt';
    }
  }
  
  // Action Methods
  editProfile(): void {
    this.isEditing = true;
  }
  
  saveChanges(): void {
    if (!this.customer || !this.editedPhone) {
      return;
    }

    this.loadingService.setLoading(true, 'Speichere Änderungen...');
    
    const updatedCustomer = { 
      ...this.customer, 
      phone: this.editedPhone 
    };
    
    this.customerService.updateCustomer(updatedCustomer)
      .then(() => {
        this.customer = updatedCustomer;
        this.isEditing = false;
        this.loadingService.setLoading(false);
      })
      .catch((error) => { 
        console.error('Error updating customer:', error);
        this.loadingService.setLoading(false);
        alert('Fehler beim Speichern der Änderungen. Bitte versuchen Sie es später erneut.');
      });
  }
  
  logout(): void {
    this.loadingService.setLoading(true, 'Abmelden...');
    this.auth.logout()
      .then(() => {
        this.router.navigate(['/customer-login']);
      })
      .catch(error => {
        console.error('Error during logout:', error);
        this.loadingService.setLoading(false);
      });
  }
  
  canRescheduleAppointment(appointment: Appointment): boolean {
    return appointment.status === 'confirmed';
  }
  
  canReviewAppointment(appointment: Appointment): boolean {
    return appointment.status === 'completed';
  }
  
  rescheduleAppointment(appointment: Appointment): void {
    alert('Diese Funktion ist noch nicht implementiert.');
  }
  
  reviewAppointment(appointment: Appointment): void {
    alert('Diese Funktion ist noch nicht implementiert.');
  }
  
  rebookAppointment(appointment: Appointment): void {
    alert('Diese Funktion ist noch nicht implementiert.');
  }
}