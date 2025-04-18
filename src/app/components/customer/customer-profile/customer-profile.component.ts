import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { AuthenticationService } from '../../../services/authentication.service';
import { CustomerService } from '../../../services/customer.service';
import { AppointmentService, AppointmentWithId } from '../../../services/appointment.service';
import { LoadingService } from '../../../services/loading.service';
import { Subscription } from 'rxjs';
import { User } from '@angular/fire/auth';
import { convertToDate, safeFormatDate } from '../../../utils/date-utils';

@Component({
  selector: 'app-customer-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule],
  templateUrl: './customer-profile.component.html',
  styleUrls: ['./customer-profile.component.css']
})
export class CustomerProfileComponent implements OnInit, OnDestroy {
  // UI state
  activeTab = 'profile';
  isEditing = false;
  appointmentFilter = 'upcoming';
  showDeleteConfirmation = false;
  deleteConfirmationEmail = '';
  
  // User data
  currentUser: User | null = null;
  customerData: any = null;
  
  // Forms
  profileForm: FormGroup;
  passwordForm: FormGroup;
  
  // Data
  appointments: AppointmentWithId[] = [];
  favorites: any[] = [];
  
  // Settings
  notificationSettings = {
    email: true,
    sms: false,
    marketing: false
  };
  
  // Subscriptions for cleanup
  private subscriptions: Subscription[] = [];
  
  // Services
  private authService = inject(AuthenticationService);
  private customerService = inject(CustomerService);
  private appointmentService = inject(AppointmentService);
  private loadingService = inject(LoadingService);
  private formBuilder = inject(FormBuilder);
  
  constructor() {
    // Initialize forms
    this.profileForm = this.formBuilder.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: [{value: '', disabled: true}],
      phone: ['', Validators.required]
    });
    
    this.passwordForm = this.formBuilder.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }
  
  ngOnInit(): void {
    // Subscribe to auth state
    this.subscriptions.push(
      this.authService.user$.subscribe(user => {
        this.currentUser = user;
        if (user) {
          this.loadCustomerData(user.uid);
          this.loadAppointments();
          this.loadFavorites();
        }
      })
    );
  }
  
  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  // Auth and data loading
  loadCustomerData(userId: string): void {
    this.loadingService.setLoading(true, 'Lade Profildaten...');
    
    this.subscriptions.push(
      this.customerService.getCustomer(userId).subscribe(
        customer => {
          this.loadingService.setLoading(false);
          if (customer) {
            this.customerData = customer;
            
            // Fill form with customer data
            this.profileForm.patchValue({
              firstName: customer.firstName || '',
              lastName: customer.lastName || '',
              email: this.currentUser?.email || '',
              phone: customer.phone || ''
            });
          }
        },
        error => {
          console.error('Error loading customer data:', error);
          this.loadingService.setLoading(false);
        }
      )
    );
  }
  
  loadAppointments(): void {
    if (!this.currentUser) return;
    
    this.loadingService.setLoading(true, 'Lade Termine...');
    
    this.subscriptions.push(
      this.appointmentService.getAppointmentsByCustomer(this.currentUser.uid).subscribe(
        appointments => {
          this.loadingService.setLoading(false);
          this.appointments = appointments;
        },
        error => {
          console.error('Error loading appointments:', error);
          this.loadingService.setLoading(false);
        }
      )
    );
  }
  
  loadFavorites(): void {
    // This is a placeholder - in a real application, you would load the user's favorite providers
    this.favorites = [
      {
        id: 'provider1',
        businessName: 'Beauty Salon Elegance',
        description: 'Unser Schönheitssalon bietet eine umfassende Palette an Dienstleistungen für Damen und Herren. Professionelle Behandlungen in einer entspannten Atmosphäre.',
        logo: 'assets/salon1.jpg'
      },
      {
        id: 'provider2',
        businessName: 'Nagel Studio Glamour',
        description: 'Spezialisiert auf Maniküre, Pediküre und Nageldesign mit den neuesten Trends und Techniken. Qualitätsarbeit mit erstklassigen Produkten.',
        logo: 'assets/salon2.jpg'
      }
    ];
  }
  
  // Form handlers
  toggleEditMode(): void {
    this.isEditing = !this.isEditing;
    
    // Reset form if canceling edit
    if (!this.isEditing && this.customerData) {
      this.profileForm.patchValue({
        firstName: this.customerData.firstName || '',
        lastName: this.customerData.lastName || '',
        email: this.currentUser?.email || '',
        phone: this.customerData.phone || ''
      });
    }
  }
  
  saveChanges(): void {
    if (this.profileForm.valid && this.customerData) {
      this.loadingService.setLoading(true, 'Speichere Änderungen...');
      
      const updatedCustomer = {
        ...this.customerData,
        firstName: this.profileForm.value.firstName,
        lastName: this.profileForm.value.lastName,
        phone: this.profileForm.value.phone
      };
      
      this.customerService.updateCustomer(updatedCustomer)
        .then(() => {
          this.loadingService.setLoading(false);
          this.customerData = updatedCustomer;
          this.isEditing = false;
        })
        .catch(error => {
          console.error('Error updating customer data:', error);
          this.loadingService.setLoading(false);
        });
    }
  }
  
  cancelEdit(): void {
    this.isEditing = false;
    
    // Reset form
    if (this.customerData) {
      this.profileForm.patchValue({
        firstName: this.customerData.firstName || '',
        lastName: this.customerData.lastName || '',
        email: this.currentUser?.email || '',
        phone: this.customerData.phone || ''
      });
    }
  }
  
  passwordMatchValidator(form: FormGroup) {
    const password = form.get('newPassword')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    
    return password === confirmPassword ? null : { passwordMismatch: true };
  }
  
  changePassword(): void {
    if (this.passwordForm.valid) {
      // In a real application, you would call a service to change the password
      alert('Password change functionality would be implemented here');
      this.passwordForm.reset();
    }
  }
  
  saveNotificationSettings(): void {
    // In a real application, you would save these settings to the database
    alert('Benachrichtigungseinstellungen gespeichert');
  }
  
  // Appointment methods
  get filteredAppointments(): AppointmentWithId[] {
    if (!this.appointments.length) return [];
    
    const now = new Date();
    
    switch (this.appointmentFilter) {
      case 'upcoming':
        return this.appointments.filter(app => new Date(app.startTime) >= now);
      case 'past':
        return this.appointments.filter(app => new Date(app.startTime) < now);
      case 'all':
      default:
        return this.appointments;
    }
  }
  
  getMonthShort(date: Date | string): string {
    const validDate = convertToDate(date);
    if (!validDate) return '';
    
    // Verwende den deutschen Monatsnamen (kurz)
    const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    return months[validDate.getMonth()];
  }
  
  getDay(date: Date | string): string {
    const validDate = convertToDate(date);
    if (!validDate) return '';
    
    return validDate.getDate().toString();
  }
  
  formatTime(date: Date | string): string {
    return safeFormatDate(date, 'time');
  }
  
  getStatusText(status: string): string {
    switch (status) {
      case 'pending': return 'Ausstehend';
      case 'confirmed': return 'Bestätigt';
      case 'canceled': return 'Storniert';
      case 'completed': return 'Abgeschlossen';
      default: return status;
    }
  }
  
  getStatusClass(status: string): string {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'confirmed': return 'status-confirmed';
      case 'canceled': return 'status-canceled';
      case 'completed': return 'status-completed';
      default: return '';
    }
  }
  
  canCancel(appointment: AppointmentWithId): boolean {
    const now = new Date();
    const appointmentDate = new Date(appointment.startTime);
    const oneDay = 24 * 60 * 60 * 1000; // milliseconds in a day
    
    // Can cancel if appointment is in the future and not already canceled
    return appointmentDate > now && 
           appointment.status !== 'canceled' &&
           appointmentDate.getTime() - now.getTime() > oneDay; // More than 24 hours before
  }
  
  cancelAppointment(appointmentId: string): void {
    if (confirm('Möchten Sie diesen Termin wirklich stornieren?')) {
      this.loadingService.setLoading(true, 'Storniere Termin...');
      
      this.appointmentService.cancelAppointment(appointmentId)
        .then(success => {
          this.loadingService.setLoading(false);
          if (success) {
            this.loadAppointments(); // Reload appointments
          } else {
            alert('Der Termin konnte nicht storniert werden.');
          }
        })
        .catch(error => {
          console.error('Error canceling appointment:', error);
          this.loadingService.setLoading(false);
        });
    }
  }
  
  viewAppointmentDetails(appointmentId: string): void {
    // In a real application, you would show appointment details
    // This could be a modal, a new page, etc.
    alert(`Details für Termin ${appointmentId} würden hier angezeigt werden`);
  }
  
  // Favorites methods
  bookAppointment(providerId: string): void {
    // Navigate to booking flow
    window.location.href = `/services/${providerId}`;
  }
  
  removeFavorite(favoriteId: string): void {
    if (confirm('Möchten Sie diesen Anbieter wirklich aus Ihren Favoriten entfernen?')) {
      // Remove from local array for demo purposes
      this.favorites = this.favorites.filter(fav => fav.id !== favoriteId);
      
      // In a real application, you would update the database
    }
  }
  
  // Account management
  showDeleteAccountConfirmation(): void {
    this.showDeleteConfirmation = true;
    this.deleteConfirmationEmail = '';
  }
  
  hideDeleteAccountConfirmation(): void {
    this.showDeleteConfirmation = false;
  }
  
  deleteAccount(): void {
    if (this.deleteConfirmationEmail === this.currentUser?.email) {
      this.loadingService.setLoading(true, 'Lösche Konto...');
      
      // In a real application, you would call a service to delete the account
      setTimeout(() => {
        this.loadingService.setLoading(false);
        this.authService.logout();
        window.location.href = '/';
      }, 2000);
    }
  }
}