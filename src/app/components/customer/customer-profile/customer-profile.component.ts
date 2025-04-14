import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthenticationService } from '../../../services/authentication.service';
import { User } from '@angular/fire/auth';
import { Subscription } from 'rxjs';
import { Customer } from '../../../models/customer.model';
import { Router } from '@angular/router';
import { CustomerService } from '../../../services/customer.service';
import { AppointmentService } from '../../../services/appointment.service';
import { Appointment } from '../../../models/appointment.model';
import { ServiceService } from '../../../services/service.service';
import { ProviderService } from '../../../services/provider.service';
import { LoadingService } from '../../../services/loading.service';
import { collection, collectionData, query, where } from '@angular/fire/firestore';

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
    const userSub = this.auth.user.subscribe(userWithCustomer => {
      if (userWithCustomer.user) {
        this.user = userWithCustomer.user;

        if (userWithCustomer.customer) {
          this.customer = userWithCustomer.customer;
          this.editedPhone = this.customer.phone;
          
          // Load appointments
          this.loadAppointments();
        } else {
          this.isLoading = false;
          this.loadingService.setLoading(false);
        }
      } else {
        // No user logged in, redirect to login
        this.isLoading = false;
        this.loadingService.setLoading(false);
        this.router.navigate(['/customer-login']);
      }
    });
    
    this.subscriptions.push(userSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  loadAppointments(): void {
    if (!this.customer) {
      this.isLoading = false;
      this.loadingService.setLoading(false);
      return;
    }
    
    // Show EXACTLY what user ID we're trying to find appointments for
    console.log("Looking for appointments for customer with ID:", this.customer.userId);
    
    const firestore = this.appointmentService['firestore'];
    const appointmentsCollection = collection(firestore, 'appointments'); // Use literal collection name
    
    // Try a direct query with the exact customer ID that we can see in Firestore
    const directCustomerId = this.customer.userId;
    console.log("Querying appointments where customerId ==", directCustomerId);
    
    const qByExactCustomerId = query(appointmentsCollection, where('customerId', '==', directCustomerId));
    
    collectionData(qByExactCustomerId, { idField: 'appointmentId' }).subscribe({
      next: (appointments) => {
        console.log("DIRECT QUERY RESULTS:", appointments);
        
        if (appointments && appointments.length > 0) {
          console.log("SUCCESS! Found appointments:", appointments);
          this.processAppointments(appointments as Appointment[]);
        } else {
          // No appointments found with the exact ID - let's get ALL appointments to compare IDs
          console.log("No appointments found with exact customerId match");
          console.log("Getting all appointments to compare IDs...");
          
          collectionData(appointmentsCollection, { idField: 'appointmentId' }).subscribe({
            next: (allAppointments) => {
              console.log("ALL APPOINTMENTS:", allAppointments);
              
              if (allAppointments && allAppointments.length > 0) {
                // Extract all customer IDs for comparison
                const customerIds = allAppointments.map(appt => (appt as any).customerId);
                console.log("All customer IDs in appointments:", customerIds);
                console.log("We need to match:", directCustomerId);
                
                // Check if our customer ID matches any of these with case-insensitive comparison
                const matchingAppointments = allAppointments.filter(appt => 
                  (appt as any).customerId && 
                  (appt as any).customerId.toLowerCase() === directCustomerId.toLowerCase()
                );
                
                console.log("Matching appointments with case-insensitive comparison:", matchingAppointments);
                
                if (matchingAppointments.length > 0) {
                  this.processAppointments(matchingAppointments as Appointment[]);
                } else {
                  // No appointments found at all
                  this.isLoading = false;
                  this.loadingService.setLoading(false);
                }
              } else {
                // No appointments in the collection at all
                this.isLoading = false;
                this.loadingService.setLoading(false);
              }
            },
            error: (error) => {
              console.error("Error getting all appointments:", error);
              this.isLoading = false;
              this.loadingService.setLoading(false);
            }
          });
        }
      },
      error: (error) => {
        console.error('Error with direct query:', error);
        this.isLoading = false;
        this.loadingService.setLoading(false);
      }
    });
  }
  
  processAppointments(appointments: Appointment[]): void {
    try {
      console.log("Processing appointments:", appointments.length);
      const now = new Date();
      const upcomingAppts: AppointmentWithDetails[] = [];
      const pastAppts: AppointmentWithDetails[] = [];
      
      // Simple processing without async operations
      appointments.forEach(appointment => {
        // Create a simple enhanced appointment
        const enhancedAppointment: AppointmentWithDetails = { 
          ...appointment,
          providerName: "Loading...", // Will be filled in later
          servicePrice: 0 // Will be filled in later
        };
        
        // Sort into upcoming or past appointments
        const appointmentDate = new Date(appointment.startTime);
        if (appointmentDate > now && appointment.status !== 'canceled') {
          upcomingAppts.push(enhancedAppointment);
        } else {
          pastAppts.push(enhancedAppointment);
        }
      });
      
      // Sort upcoming appointments by date (soonest first)
      this.upcomingAppointments = upcomingAppts.sort((a, b) => 
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
      
      // Sort past appointments by date (most recent first)
      this.pastAppointments = pastAppts.sort((a, b) => 
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
      
      // Calculate statistics
      this.totalAppointments = appointments.length;
      this.totalSpent = 0; // Placeholder
      this.favoriteService = appointments.length > 0 ? appointments[0].serviceName : ""; // Simplified
      
      // Always ensure loading is turned off
      this.isLoading = false;
      this.loadingService.setLoading(false);
      
      console.log("Appointments processed successfully");
      console.log("Upcoming appointments:", this.upcomingAppointments.length);
      console.log("Past appointments:", this.pastAppointments.length);
      
      // Now load additional details in the background
      this.loadAdditionalAppointmentDetails(appointments);
    } catch (error) {
      console.error("Error in processAppointments:", error);
      // Always ensure loading is turned off even in case of errors
      this.isLoading = false;
      this.loadingService.setLoading(false);
    }
  }
  
  // This method will run in the background to load additional details
  loadAdditionalAppointmentDetails(appointments: Appointment[]): void {
    // This can take longer without affecting the UI
    console.log("Loading additional appointment details in background");
    
    // Create service and provider name mapping
    const serviceDetails = new Map<string, number>();
    const providerNames = new Map<string, string>();
    const serviceFrequency = new Map<string, number>();
    let totalAmount = 0;
    
    // Use Promise.all to run all these in parallel
    const promises = appointments.map(async (appointment) => {
      try {
        // Get provider name if not already cached
        if (appointment.providerId && !providerNames.has(appointment.providerId)) {
          const provider = await this.providerService.getProviderByUserId(appointment.providerId).toPromise();
          if (provider) {
            providerNames.set(appointment.providerId, provider.businessName);
          }
        }
        
        // Track service frequency for favorite service calculation
        if (appointment.serviceName) {
          const currentCount = serviceFrequency.get(appointment.serviceName) || 0;
          serviceFrequency.set(appointment.serviceName, currentCount + 1);
        }
        
        // Get service price if not already cached
        if (appointment.serviceIds && appointment.serviceIds.length > 0) {
          const serviceId = appointment.serviceIds[0];
          if (!serviceDetails.has(serviceId)) {
            try {
              const service = await this.serviceService.getService(serviceId).toPromise();
              if (service) {
                serviceDetails.set(serviceId, service.price);
              }
            } catch (serviceError) {
              console.warn(`Could not get details for service ${serviceId}:`, serviceError);
            }
          }
          
          // Add to total spent if appointment is completed
          if (appointment.status === 'completed') {
            const price = serviceDetails.get(serviceId) || 0;
            totalAmount += price;
          }
        }
      } catch (error) {
        console.warn(`Error processing appointment ${appointment.appointmentId}:`, error);
      }
    });
    
    // After all additional details are loaded
    Promise.all(promises).then(() => {
      console.log("Background processing complete");
      
      // Update the total spent
      this.totalSpent = totalAmount;
      
      // Find favorite service
      let maxFrequency = 0;
      let favoriteService = "";
      serviceFrequency.forEach((count, service) => {
        if (count > maxFrequency) {
          maxFrequency = count;
          favoriteService = service;
        }
      });
      this.favoriteService = favoriteService;
      
      // Now update all appointment objects with the details we loaded
      this.upcomingAppointments.forEach(appt => {
        if (appt.providerId) {
          appt.providerName = providerNames.get(appt.providerId) || "Unknown";
        }
        if (appt.serviceIds && appt.serviceIds.length > 0) {
          appt.servicePrice = serviceDetails.get(appt.serviceIds[0]) || 0;
        }
      });
      
      this.pastAppointments.forEach(appt => {
        if (appt.providerId) {
          appt.providerName = providerNames.get(appt.providerId) || "Unknown";
        }
        if (appt.serviceIds && appt.serviceIds.length > 0) {
          appt.servicePrice = serviceDetails.get(appt.serviceIds[0]) || 0;
        }
      });
    }).catch(error => {
      console.error("Error in background processing:", error);
    });
  }
  
  // UI Helper Methods
  getInitials(): string {
    if (!this.customer) return '';
    return (this.customer.firstName[0] + this.customer.lastName[0]).toUpperCase();
  }
  
  formatDate(date: Date | any): string {
    // Handle Firestore Timestamp objects or string dates
    try {
      // Check if it's a Firestore Timestamp
      if (date && typeof date === 'object' && date.toDate && typeof date.toDate === 'function') {
        // It's a Firestore Timestamp, convert to JS Date
        const jsDate = date.toDate();
        return jsDate.toLocaleDateString('de-DE', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });
      }
      
      // If it's already a Date object or a valid date string
      const dateObj = date instanceof Date ? date : new Date(date);
      
      // Check if date is valid
      if (isNaN(dateObj.getTime())) {
        console.warn("Invalid date:", date);
        return "Datum unbekannt";
      }
      
      return dateObj.toLocaleDateString('de-DE', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch (error) {
      console.error("Error formatting date:", error, date);
      return "Datum unbekannt";
    }
  }
  
  formatTime(date: Date | any): string {
    try {
      // Check if it's a Firestore Timestamp
      if (date && typeof date === 'object' && date.toDate && typeof date.toDate === 'function') {
        // It's a Firestore Timestamp, convert to JS Date
        const jsDate = date.toDate();
        return jsDate.toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      
      // If it's already a Date object or a valid date string
      const dateObj = date instanceof Date ? date : new Date(date);
      
      // Check if date is valid
      if (isNaN(dateObj.getTime())) {
        console.warn("Invalid time:", date);
        return "Zeit unbekannt";
      }
      
      return dateObj.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error("Error formatting time:", error, date);
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
    if (this.customer && this.editedPhone) {
      const updatedCustomer = { ...this.customer, phone: this.editedPhone };
      this.customerService.updateCustomer(updatedCustomer)
        .then(() => {
          this.customer = updatedCustomer;
          this.isEditing = false;
        })
        .catch((error) => { 
          console.error('Error updating customer:', error); 
        });
    }
  }
  
  logout(): void {
    this.auth.logout().then(() => {
      this.router.navigate(['/customer-login']);
    });
  }
  
  canCancelAppointment(appointment: Appointment): boolean {
    // Can only cancel pending or confirmed appointments
    return ['pending', 'confirmed'].includes(appointment.status);
  }
  
  canRescheduleAppointment(appointment: Appointment): boolean {
    // Can only reschedule confirmed appointments
    return appointment.status === 'confirmed';
  }
  
  canReviewAppointment(appointment: Appointment): boolean {
    // Can only review completed appointments
    return appointment.status === 'completed';
  }
  
  cancelAppointment(appointment: Appointment): void {
    if (confirm('Möchten Sie diesen Termin wirklich stornieren?')) {
      this.appointmentService.cancelAppointment(appointment.appointmentId)
        .subscribe(() => {
          this.loadAppointments(); // Reload appointments
          alert('Termin wurde storniert.');
        }, error => {
          console.error('Error canceling appointment:', error);
          alert('Fehler beim Stornieren des Termins.');
        });
    }
  }
  
  rescheduleAppointment(appointment: Appointment): void {
    // Navigate to reschedule page
    alert('Diese Funktion ist noch nicht implementiert.');
  }
  
  reviewAppointment(appointment: Appointment): void {
    // Open review dialog
    alert('Diese Funktion ist noch nicht implementiert.');
  }
  
  rebookAppointment(appointment: Appointment): void {
    // Rebook same service
    alert('Diese Funktion ist noch nicht implementiert.');
  }
  
  // Method removed as per request
}