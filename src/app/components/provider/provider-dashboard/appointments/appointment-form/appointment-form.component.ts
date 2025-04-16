import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Appointment } from '../../../../../models/appointment.model';
import { Service } from '../../../../../models/service.model';
import { ServiceService } from '../../../../../services/service.service';
import { Provider } from '../../../../../models/provider.model';

// Definiere den exakten Typ für den Status
type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'canceled';

interface FormViewModel {
  serviceId: string;
  customerName: string;
  notes: string;
  cleaningTime: number;
  status: AppointmentStatus; // Korrigierter Typ
}

@Component({
  selector: 'app-appointment-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './appointment-form.component.html',
  styleUrls: ['./appointment-form.component.css']
})
export class AppointmentFormComponent implements OnInit, OnDestroy {
  @Input() isEditMode: boolean = false;
  @Input() provider!: Provider;
  @Input() appointment: Appointment | null = null;
  
  @Output() formSubmit = new EventEmitter<Appointment>();
  @Output() formCancel = new EventEmitter<void>();
  
  // View model instead of direct binding to appointment
  viewModel: FormViewModel = {
    serviceId: '',
    customerName: '',
    notes: '',
    cleaningTime: 15,
    status: 'pending'
  };
  
  availableServices: Service[] = [];
  formErrors: { [key: string]: string } = {};
  
  // Time selection helpers
  availableTimes: string[] = [];
  selectedDate: string = '';
  selectedTime: string = '';
  
  // Additional customer fields that might not be in the Appointment model directly
  customerEmail: string = '';
  customerPhone: string = '';
  
  // Status options für die Typensicherheit
  statusOptions: AppointmentStatus[] = ['pending', 'confirmed', 'completed', 'canceled'];
  
  private subscriptions: Subscription[] = [];
  private serviceService = inject(ServiceService);
  
  ngOnInit(): void {
    this.loadServices();
    this.generateAvailableTimes();
    
    if (this.isEditMode && this.appointment) {
      // Copy appointment data to view model
      this.viewModel = {
        serviceId: this.appointment.serviceIds && this.appointment.serviceIds.length > 0 ? 
                  this.appointment.serviceIds[0] : '',
        customerName: this.appointment.customerName || '',
        notes: this.appointment.notes || '',
        cleaningTime: this.appointment.cleaningTime || 15,
        status: (this.appointment.status as AppointmentStatus) || 'pending'
      };
      
      // Set date and time for the form controls
      const appointmentDate = new Date(this.appointment.startTime);
      this.selectedDate = this.formatDateForInput(appointmentDate);
      this.selectedTime = this.formatTimeForInput(appointmentDate);
    } else {
      // Initialize with default values for new appointment
      this.selectedDate = this.formatDateForInput(new Date());
      this.selectedTime = '09:00'; // Default start time
    }
  }
  
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  loadServices(): void {
    if (!this.provider) {
      console.error('Provider ist nicht verfügbar');
      return;
    }
    
    const servicesSub = this.serviceService
      .getServicesByProvider(this.provider.id)
      .subscribe({
        next: (services) => {
          this.availableServices = services;
        },
        error: (error) => {
          console.error('Fehler beim Laden der Dienstleistungen:', error);
        }
      });
      
    this.subscriptions.push(servicesSub);
  }
  
  generateAvailableTimes(): void {
    // Generate times from 8:00 to 20:00 in 15-minute intervals
    const times: string[] = [];
    const start = 8; // 8:00 AM
    const end = 20; // 8:00 PM
    
    for (let hour = start; hour <= end; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const hourStr = hour.toString().padStart(2, '0');
        const minuteStr = minute.toString().padStart(2, '0');
        times.push(`${hourStr}:${minuteStr}`);
      }
    }
    
    this.availableTimes = times;
  }
  
  onServiceChange(serviceId: string): void {
    // Find the selected service to auto-fill duration
    const selectedService = this.availableServices.find(s => s.id === serviceId);
    if (selectedService) {
      // We don't update the end time directly here, 
      // it will be calculated in the submit method
    }
  }
  
  onSubmit(): void {
    if (this.validateForm()) {
      // Create or update appointment from the view model
      const appointmentToSave: Appointment = this.isEditMode && this.appointment ? 
        { ...this.appointment } : this.createEmptyAppointment();
      
      // Set basic properties from the view model
      appointmentToSave.customerName = this.viewModel.customerName;
      appointmentToSave.notes = this.viewModel.notes;
      appointmentToSave.cleaningTime = this.viewModel.cleaningTime;
      
      // Hier verwenden wir den explizit typisierten Status
      appointmentToSave.status = this.viewModel.status;
      
      // Set service information
      appointmentToSave.serviceIds = [this.viewModel.serviceId];
      
      // Find the service for the name and duration calculation
      const selectedService = this.availableServices.find(s => s.id === this.viewModel.serviceId);
      if (selectedService) {
        appointmentToSave.serviceName = selectedService.name;
        
        // Set start and end times
        appointmentToSave.startTime = this.combineDateAndTime(this.selectedDate, this.selectedTime);
        
        const endDateTime = new Date(appointmentToSave.startTime);
        endDateTime.setMinutes(endDateTime.getMinutes() + selectedService.duration);
        appointmentToSave.endTime = endDateTime;
      }
      
      // Emit the appointment data
      this.formSubmit.emit(appointmentToSave);
    }
  }
  
  onCancel(): void {
    this.formCancel.emit();
  }
  
  validateForm(): boolean {
    this.formErrors = {};
    let isValid = true;
    
    // Check if a service is selected
    if (!this.viewModel.serviceId) {
      this.formErrors['service'] = 'Bitte wählen Sie eine Dienstleistung aus';
      isValid = false;
    }
    
    // Check if customer name is provided
    if (!this.viewModel.customerName || this.viewModel.customerName.trim() === '') {
      this.formErrors['customerName'] = 'Kundenname ist erforderlich';
      isValid = false;
    }
    
    // Check if date and time are selected
    if (!this.selectedDate) {
      this.formErrors['date'] = 'Bitte wählen Sie ein Datum aus';
      isValid = false;
    }
    
    if (!this.selectedTime) {
      this.formErrors['time'] = 'Bitte wählen Sie eine Uhrzeit aus';
      isValid = false;
    }
    
    return isValid;
  }
  
  hasError(fieldName: string): boolean {
    return this.formErrors[fieldName] !== undefined;
  }
  
  getErrorMessage(fieldName: string): string {
    return this.formErrors[fieldName] || '';
  }
  
  // Helper methods for date/time formatting
  formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  formatTimeForInput(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  
  combineDateAndTime(dateStr: string, timeStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    return new Date(year, month - 1, day, hours, minutes);
  }
  
  createEmptyAppointment(): Appointment {
    return {
      id: '',
      customerId: '',
      customerName: '',
      providerId: this.provider ? this.provider.id : '',
      serviceIds: [],
      serviceName: '',
      startTime: new Date(),
      endTime: new Date(),
      status: 'pending',
      notes: '',
      cleaningTime: 15,
      createdAt: new Date()
    };
  }
}