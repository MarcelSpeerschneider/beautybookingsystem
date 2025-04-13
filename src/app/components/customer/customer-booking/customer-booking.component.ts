import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ServiceService } from '../../../services/service.service';
import { AppointmentService } from '../../../services/appointment.service';
import { AuthenticationService } from '../../../services/authentication.service';
import { ProviderService } from '../../../services/provider.service';
import { Service } from '../../../models/service.model';
import { Provider } from '../../../models/provider.model';
import { User, updateProfile } from '@angular/fire/auth';
import { Customer } from '../../../models/customer.model';
import { Appointment } from '../../../models/appointment.model'; 
import { Observable, of, Subscription } from 'rxjs';

@Component({
  selector: 'app-customer-booking',
  templateUrl: './customer-booking.component.html',
  styleUrls: ['./customer-booking.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
})
export class CustomerBookingComponent implements OnInit, OnDestroy{
  currentStep = 1;
  bookingForm: FormGroup;  // ACHTUNG: Kein ! mehr, da wir es im Konstruktor initialisieren
  services: Service[] = [];
  providers: Provider[] = [];
  availableDates: Date[] = [];
  availableTimeSlots: string[] = [];
  
  // Inject services
  private formBuilder = inject(FormBuilder);
  private serviceService = inject(ServiceService);
  private appointmentService = inject(AppointmentService);
  private authService = inject(AuthenticationService);
  private providerService = inject(ProviderService);
  private router = inject(Router);

  private userSubscription: Subscription | undefined;
  private _customer: Customer | null = null;
  private _user: User | null = null;

  constructor() {
    // Formular bereits im Konstruktor initialisieren - VOR dem Template-Rendering
    this.bookingForm = this.formBuilder.group({
      serviceId: ['', Validators.required],
      providerId: ['', Validators.required],
      date: ['', Validators.required],
      time: ['', Validators.required],
      notes: ['']
    });
  }

  ngOnInit(): void {
    
      this.userSubscription = this.authService.user.subscribe((userWithCustomer) => {
      if (!userWithCustomer.user || !userWithCustomer.customer) {
        this._user = null;
        this._customer = null;
        console.log("User not logged in. Redirecting to login.");
        this.router.navigate(["/login"]); 
        return;
      } else {
        console.log("User logged in.");
        this._user = userWithCustomer.user;
        this._customer = userWithCustomer.customer
        console.log('customer found: ', this._customer);

      }
      this.loadServices();


    });
    
  }

  ngOnDestroy(): void {
    this.userSubscription?.unsubscribe();
  }

  loadServices(): void {
    this.serviceService.getServices().subscribe(services => {
      this.services = services;
    });
  }

  loadProviders(serviceId: string): void {
    // Hier könnten wir Provider nach Service filtern, falls diese Funktion implementiert ist
    this.providerService.getProviders().subscribe(providers => {
      this.providers = providers;
    });
  }

  generateAvailableDates(providerId: string): void {
    // In einer realen Anwendung würden hier die verfügbaren Tage basierend auf
    // Provider-Arbeitszeiten und bestehenden Buchungen geladen werden
    const dates: Date[] = [];
    const today = new Date();
    
    // Beispiel: Zeige die nächsten 14 Tage als verfügbar an
    for (let i = 1; i <= 14; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    
    this.availableDates = dates;
  }

  generateAvailableTimeSlots(providerId: string, date: Date, serviceId: string): void {
    // In einer realen Anwendung würden hier die verfügbaren Zeiten basierend auf
    // Provider-Arbeitszeiten, Dienstleistungsdauer und bestehenden Buchungen geladen werden
    
    // Beispiel: Zeige feste Zeitslots an
    this.availableTimeSlots = [
      '09:00', '10:00', '11:00', '12:00', 
      '14:00', '15:00', '16:00', '17:00'
    ];
  }

  nextStep(): void {
    if (this.currentStep === 1 && this.bookingForm.get('serviceId')?.valid) {
      this.loadProviders(this.bookingForm.get('serviceId')?.value);
      this.currentStep++;
    } else if (this.currentStep === 2 && this.bookingForm.get('providerId')?.valid) {
      this.generateAvailableDates(this.bookingForm.get('providerId')?.value);
      this.currentStep++;
    } else if (this.currentStep === 3 && this.bookingForm.get('date')?.valid) {
      this.generateAvailableTimeSlots(
        this.bookingForm.get('providerId')?.value,
        this.bookingForm.get('date')?.value,
        this.bookingForm.get('serviceId')?.value
      );
      this.currentStep++;
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('de-DE');
  }

  selectService(serviceId: string): void {
    this.bookingForm.patchValue({ serviceId });
  }

  selectProvider(providerId: string): void {
    this.bookingForm.patchValue({ providerId });
  }

  selectDate(date: Date): void {
    this.bookingForm.patchValue({ date });
  }

  selectTime(time: string): void {
    this.bookingForm.patchValue({ time });
  }

  getSelectedService(): Service | undefined {
    const serviceId = this.bookingForm.get('serviceId')?.value;
    return this.services.find(service => service.serviceId === serviceId);
  }

  getSelectedProvider(): Provider | undefined {
    const providerId = this.bookingForm.get('providerId')?.value;
    return this.providers.find(provider => provider.providerId === providerId);
  }

  onSubmit(): void {
    if (this.bookingForm.valid) {
      if (!this._user?.uid) {
        console.error('Kein Benutzer angemeldet');
        return;
      }

      const selectedService = this.getSelectedService();
      if (!selectedService) {
        console.error('Kein Service ausgewählt');
        return;
      }

      // Termine erstellen
      const formValues = this.bookingForm.value;
      const timeString = formValues.time;
      const dateObj = new Date(formValues.date);
      
      // Zeit zum Datum hinzufügen
      const [hours, minutes] = timeString.split(':').map(Number);
      dateObj.setHours(hours, minutes, 0, 0);
      
      // Endzeit basierend auf Service-Dauer berechnen
      const endTime = new Date(dateObj);
      endTime.setMinutes(endTime.getMinutes() + selectedService.duration);
      
      // 15 Minuten Reinigungszeit hinzufügen
      const cleaningTime = 15;
      
      const appointment: Partial<Appointment> = {
        customerId: this._user.uid,
        providerId: formValues.providerId,
        serviceId: formValues.serviceId,
        startTime: dateObj,
        endTime: endTime,
        status: 'pending',
        notes: formValues.notes,
        cleaningTime: cleaningTime,
        createdAt: new Date()
      };

      // Termin speichern
      this.appointmentService.createAppointment(appointment as Appointment)
        .then(() => {
          alert('Buchung erfolgreich aufgenommen! Die Buchung wird vom Anbieter bestätigt.');
          this.router.navigate(['/profile']);
        })
        .catch(error => {
          console.error('Fehler beim Erstellen der Buchung:', error);
          alert('Es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.');
        });
    }
  }
}