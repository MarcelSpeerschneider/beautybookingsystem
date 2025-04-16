import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { ServiceService } from '../../../services/service.service';
import { ProviderService } from '../../../services/provider.service';
import { AppointmentService } from '../../../services/appointment.service';
import { AuthenticationService } from '../../../services/authentication.service';
import { LoadingService } from '../../../services/loading.service';
import { Service } from '../../../models/service.model';
import { Provider } from '../../../models/provider.model';
import { Appointment } from '../../../models/appointment.model';

// Erweiterter Typ für Provider mit providerId
type ProviderWithId = Provider & { providerId: string };

@Component({
  selector: 'app-customer-booking',
  templateUrl: './customer-booking.component.html',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  styleUrls: ['./customer-booking.component.css']
})
export class CustomerBookingComponent implements OnInit {
  // Form-Steuerung
  bookingForm!: FormGroup;
  currentStep = 1;
  
  // Daten für die Auswahl
  services: Service[] = [];
  providers: ProviderWithId[] = []; // Angepasster Typ mit providerId
  availableDates: Date[] = [];
  availableTimeSlots: string[] = [];
  
  // Service-Injektionen
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private serviceService = inject(ServiceService);
  private providerService = inject(ProviderService);
  private appointmentService = inject(AppointmentService);
  private authService = inject(AuthenticationService);
  private loadingService = inject(LoadingService);
  
  ngOnInit(): void {
    this.initializeForm();
    this.loadServices();
  }
  
  initializeForm(): void {
    this.bookingForm = this.fb.group({
      serviceId: ['', Validators.required],
      providerId: ['', Validators.required],
      date: ['', Validators.required],
      time: ['', Validators.required],
      notes: ['']
    });
  }
  
  loadServices(): void {
    this.loadingService.setLoading(true, 'Lade Dienstleistungen...');
    
    this.serviceService.getServices().subscribe({
      next: (services) => {
        this.services = services;
        this.loadingService.setLoading(false);
      },
      error: (error) => {
        console.error('Fehler beim Laden der Dienstleistungen:', error);
        this.loadingService.setLoading(false);
      }
    });
  }
  
  loadProviders(serviceId: string): void {
    this.loadingService.setLoading(true, 'Lade Anbieter...');
    
    this.providerService.getProvidersByService(serviceId).subscribe({
      next: (providers) => {
        // Jedes Provider-Objekt einzeln umwandeln
        const providersWithId = providers.map(p => p as ProviderWithId);
        this.providers = providersWithId;
        this.loadingService.setLoading(false);
        
        // Jetzt mit korrekter Typinformation
        if (providersWithId.length === 1) {
          this.selectProvider(providersWithId[0].providerId);
          this.nextStep();
        }
      },
      error: (error) => {
        console.error('Fehler beim Laden der Anbieter:', error);
        this.loadingService.setLoading(false);
      }
    });
  }
  
  loadAvailableDates(providerId: string): void {
    this.loadingService.setLoading(true, 'Lade verfügbare Termine...');
    
    // Einfaches Beispiel: Die nächsten 14 Tage als verfügbar anzeigen
    // In einer realen Anwendung würden Sie die tatsächliche Verfügbarkeit prüfen
    const dates: Date[] = [];
    const today = new Date();
    
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      // Sonntage ausschließen
      if (date.getDay() !== 0) {
        dates.push(date);
      }
    }
    
    this.availableDates = dates;
    this.loadingService.setLoading(false);
  }
  
  loadAvailableTimes(date: Date): void {
    this.loadingService.setLoading(true, 'Lade verfügbare Uhrzeiten...');
    
    // Einfaches Beispiel: Feste Zeitslots anzeigen
    // In einer realen Anwendung würden Sie die tatsächliche Verfügbarkeit prüfen
    this.availableTimeSlots = [
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
      '15:00', '15:30', '16:00', '16:30', '17:00'
    ];
    
    this.loadingService.setLoading(false);
  }
  
  selectService(serviceId: string): void {
    this.bookingForm.patchValue({
      serviceId: serviceId
    });
    
    // Zurücksetzen abhängiger Werte
    this.bookingForm.patchValue({
      providerId: '',
      date: '',
      time: ''
    });
    
    // Providers für diesen Service laden
    this.loadProviders(serviceId);
  }
  
  selectProvider(providerId: string): void {
    this.bookingForm.patchValue({
      providerId: providerId
    });
    
    // Zurücksetzen abhängiger Werte
    this.bookingForm.patchValue({
      date: '',
      time: ''
    });
    
    // Verfügbare Daten für diesen Provider laden
    this.loadAvailableDates(providerId);
  }
  
  selectDate(date: Date): void {
    this.bookingForm.patchValue({
      date: date
    });
    
    // Zurücksetzen der Zeitauswahl
    this.bookingForm.patchValue({
      time: ''
    });
    
    // Verfügbare Zeiten für diesen Tag laden
    this.loadAvailableTimes(date);
  }
  
  selectTime(time: string): void {
    this.bookingForm.patchValue({
      time: time
    });
  }
  
  nextStep(): void {
    if (this.currentStep < 5) {
      this.currentStep++;
    }
  }
  
  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }
  
  getSelectedService(): Service | null {
    const serviceId = this.bookingForm.get('serviceId')?.value;
    if (!serviceId) return null;
    
    return this.services.find(service => service.id === serviceId) || null;
  }
  
  getSelectedProvider(): ProviderWithId | null {
    const providerId = this.bookingForm.get('providerId')?.value;
    if (!providerId) return null;
    
    // Suche nach providerId statt id
    return this.providers.find(provider => provider.providerId === providerId) || null;
  }
  
  formatDate(date: Date): string {
    const datePipe = new DatePipe('de-DE');
    return datePipe.transform(date, 'EEEE, dd.MM.yyyy') || '';
  }
  
  onSubmit(): void {
    if (this.bookingForm.valid) {
      this.loadingService.setLoading(true, 'Termin wird gebucht...');
      
      const userWithCustomer = this.authService.getCurrentUserWithCustomer();
      
      if (!userWithCustomer.customer) {
        alert('Bitte melden Sie sich an, um einen Termin zu buchen.');
        this.router.navigate(['/login']);
        this.loadingService.setLoading(false);
        return;
      }
      
      const selectedService = this.getSelectedService();
      const selectedProvider = this.getSelectedProvider();
      
      if (!selectedService || !selectedProvider) {
        alert('Bitte wählen Sie einen Service und einen Anbieter aus.');
        this.loadingService.setLoading(false);
        return;
      }
      
      // Datum und Zeit kombinieren
      const appointmentDate = new Date(this.bookingForm.get('date')?.value);
      const timeStr = this.bookingForm.get('time')?.value;
      const [hours, minutes] = timeStr.split(':').map(Number);
      
      appointmentDate.setHours(hours, minutes, 0, 0);
      
      // Endzeit berechnen (Startzeit + Dauer)
      const endTime = new Date(appointmentDate);
      endTime.setMinutes(endTime.getMinutes() + selectedService.duration);
      
      // Appointment-Objekt erstellen
      const appointment: Omit<Appointment, 'id'> = {
        customerId: userWithCustomer.customer.id,
        providerId: selectedProvider.providerId, // Verwende providerId statt id
        serviceIds: [selectedService.id],
        serviceName: selectedService.name,
        customerName: `${userWithCustomer.customer.firstName} ${userWithCustomer.customer.lastName}`,
        startTime: appointmentDate,
        endTime: endTime,
        status: 'pending',
        cleaningTime: 15, // Standard-Reinigungszeit
        notes: this.bookingForm.get('notes')?.value || '',
        createdAt: new Date()
      };
      
      // Termin speichern
      this.appointmentService.createAppointment(appointment)
        .then((appointmentId) => {
          this.loadingService.setLoading(false);
          
          // Zur Bestätigungsseite navigieren
          this.router.navigate(['/booking-success'], {
            queryParams: { id: appointmentId }
          });
        })
        .catch(error => {
          console.error('Fehler beim Buchen des Termins:', error);
          this.loadingService.setLoading(false);
          alert('Es ist ein Fehler beim Buchen des Termins aufgetreten. Bitte versuchen Sie es später erneut.');
        });
    } else {
      // Markiere alle Felder als berührt, um Validierungsfehler anzuzeigen
      Object.keys(this.bookingForm.controls).forEach(key => {
        this.bookingForm.get(key)?.markAsTouched();
      });
      
      alert('Bitte füllen Sie alle erforderlichen Felder aus.');
    }
  }
}