import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticationService } from '../../../services/authentication.service';
import { ProviderService } from '../../../services/provider.service';
import { AppointmentService } from '../../../services/appointment.service';
import { ServiceService } from '../../../services/service.service';
import { Provider } from '../../../models/provider.model';
import { Appointment } from '../../../models/appointment.model';
import { Service } from '../../../models/service.model';
import { LoadingService } from '../../../services/loading.service';

@Component({
  selector: 'app-provider-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './provider-dashboard.component.html',
  styleUrls: ['./provider-dashboard.component.css']
})
export class ProviderDashboardComponent implements OnInit, OnDestroy {
  provider: Provider | null = null;
  today: Date = new Date();
  todayAppointments: Appointment[] = [];
  services: Service[] = [];
  pendingAppointments: number = 0;
  todayRevenue: number = 0;
  
  currentTab: string = 'dashboard';
  showAddServiceForm: boolean = false;
  newService: Service = {
    serviceId: '',
    userId: '',
    name: '', price: 0, duration: 0, image: ''};
  
  private subscriptions: Subscription[] = [];
  
  private authService = inject(AuthenticationService);
  private providerService = inject(ProviderService);
  private appointmentService = inject(AppointmentService);
  private serviceService = inject(ServiceService);
  private router = inject(Router);
  private loadingService = inject(LoadingService);

  
  ngOnInit(): void {
    this.loadingService.setLoading(true, 'Lade Dashboard...');
    
    // Check if user is authenticated and is a provider
    const userSub = this.authService.user.subscribe(userWithCustomer => {
      if (!userWithCustomer.user) {
        this.router.navigate(['/provider-login']);
        return;
      }
      
      // Get provider info
      const providerSub = this.providerService.getProviderByUserId(userWithCustomer.user.uid)
        .subscribe(provider => {
          if (provider) {
            this.provider = provider;
            this.newService.userId = userWithCustomer.user!.uid;
            
            // Load today's appointments
            this.loadTodayAppointments();
            
            // Load services
            this.loadServices();
          } else {
            // User is not a provider, redirect to provider registration
            this.router.navigate(['/provider-registration']);
          }
          
          this.loadingService.setLoading(false);
        });
      
      this.subscriptions.push(providerSub);
    });
    
    this.subscriptions.push(userSub);
  }
  
  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  loadTodayAppointments(): void {
    if (!this.provider) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const appointmentsSub = this.appointmentService
      .getAppointmentsByUserAndDate(this.provider.userId, today)
      .subscribe(appointments => {
        this.todayAppointments = appointments;

        // Count pending appointments
        this.pendingAppointments = appointments.filter(a => a.status === 'pending').length;

        // Calculate today's revenue
        this.calculateTodayRevenue();
      },
      error => {
        console.error('Error fetching appointments:', error);
      });

    this.subscriptions.push(appointmentsSub);
  }
  
  loadServices(): void {
    if (!this.provider) return;
    
    const servicesSub = this.serviceService
      .getServicesByUser(this.provider.userId)
      .subscribe((services) => {
        this.services = services;
      });
      
    this.subscriptions.push(servicesSub);
  }
  
  calculateTodayRevenue(): void {
    this.todayRevenue = 0;
    
    // Calculate revenue from completed appointments
    this.todayAppointments
      .filter(appointment => appointment.status === 'completed')
      .forEach(appointment => {
        // Find the service for this appointment
        const service = this.services.find(s => s.serviceId === appointment.serviceId);
        if (service) {
          this.todayRevenue += service.price;
        }
      });
  }
  
  changeTab(tab: string): void {
    this.currentTab = tab;
    if (this.currentTab === 'services'){
      this.loadServices();
    }
  }
  
  formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }
  
  getAppointmentDuration(appointment: Appointment): number {
    const startTime = new Date(appointment.startTime).getTime();
    const endTime = new Date(appointment.endTime).getTime();
    return Math.round((endTime - startTime) / (1000 * 60)); // minutes
  }
  
  createAppointment(): void {
    alert('Funktion zum Erstellen eines neuen Termins wird implementiert.');
  }
  
  createBreak(): void {
    alert('Funktion zum Eintragen einer Pause wird implementiert.');
  }
  
  confirmAppointment(appointmentId: string): void {
    this.loadingService.setLoading(true, 'Bestätige Termin...');
    this.appointmentService.confirmAppointment(appointmentId)
      .subscribe({
        next: () => {
          this.loadingService.setLoading(false);
          alert('Termin wurde bestätigt.');
          this.loadTodayAppointments();
        },
        error: (error) => {
          this.loadingService.setLoading(false);
          console.error('Error confirming appointment:', error);
          alert('Fehler bei der Bestätigung des Termins.');
        }
      });
  }
  
  addNewService() {
    this.showAddServiceForm = true;
  }
  
  cancelAddService() {
    this.showAddServiceForm = false;
    this.newService = {
      serviceId: '',
      userId: this.newService.userId,
      name: '', price: 0, duration: 0, image: ''};
  }
  
  submitService() {
    if (!this.newService) {return;}
    if (!this.newService.name || !this.newService.description || !this.newService.price || this.newService.price === 0) {
      alert('Bitte füllen Sie alle Felder aus.');
      return;
    }
  
    
    
    this.loadingService.setLoading(true, 'Speichere Dienstleistung...');
    
    this.newService.serviceId = uuidv4();

    this.serviceService.createService(this.newService)
      .then(() => {        
          this.loadingService.setLoading(false);
          alert('Dienstleistung wurde hinzugefügt.');
          this.loadServices();
          this.cancelAddService();
       })
       .catch((error) => {
          this.loadingService.setLoading(false);
          console.error('Error creating service:', error);
          alert('Fehler beim Hinzufügen der Dienstleistung.');
       })
       .finally(() => {
          this.loadingService.setLoading(false);
       });
       
      
  }

  logout(): void {
    this.authService.logout()
      .then(() => {
        this.router.navigate(['/provider-login']);
      });
  }

}