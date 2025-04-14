import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ProviderService } from '../../../services/provider.service';
import { AppointmentService } from '../../../services/appointment.service';
import { ServiceService } from '../../../services/service.service';
import { CartService } from '../../../services/cart.service';
import { AuthenticationService } from '../../../services/authentication.service';
import { LoadingService } from '../../../services/loading.service';
import { Provider } from '../../../models/provider.model';
import { Service } from '../../../models/service.model';

@Component({
  selector: 'app-appointment-selection',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './appointment-selection.component.html',
  styleUrls: ['./appointment-selection.component.css']
})
export class AppointmentSelectionComponent implements OnInit, OnDestroy {
  userId: string | null = null;
  provider: Provider | null = null;
  cartItems: Service[] = [];
  
  // Calendar and date selection
  currentDate: Date = new Date();
  currentMonth: number = this.currentDate.getMonth();
  currentYear: number = this.currentDate.getFullYear();
  currentMonthYear: string = '';
  daysInMonth: number[] = [];
  emptyDaysAtStart: number[] = [];
  
  // Selection state
  selectedDate: Date | null = null;
  selectedTime: string | null = null;
  availableTimeSlots: string[] = [];
  
  // Random unavailable days for demo
  unavailableDays: Set<number> = new Set<number>();
  unavailableTimeSlots: Set<string> = new Set<string>();
  
  private subscriptions: Subscription[] = [];
  
  private route = inject(ActivatedRoute);
  private providerService = inject(ProviderService);
  private appointmentService = inject(AppointmentService);
  private serviceService = inject(ServiceService);
  private cartService = inject(CartService);
  private authService = inject(AuthenticationService);
  private loadingService = inject(LoadingService);

  constructor(private router: Router) {
    // Initialize calendar
    this.updateCalendar();
  }
  
  ngOnInit(): void {
    this.loadingService.setLoading(true, 'Lade Terminauswahl...');
    
    // Get cart items
    this.cartItems = this.cartService.getItems();
    
    if (this.cartItems.length === 0) {
      alert('Bitte wählen Sie zuerst Dienstleistungen aus.');
      this.router.navigate(['/services']);
      return;
    }
    
    // Get provider ID from route parameter
    const routeSub = this.route.paramMap.subscribe(params => {
      this.userId = params.get('userId');
      
      if (!this.userId) {
        // Try to get provider ID from cart
        this.userId = this.cartService.getProviderId();
      }
      
      if (this.userId) {
        // Store provider ID in cart
        this.cartService.setProviderId(this.userId);
        
        // Load provider details
        this.loadProvider(this.userId);
        
        // Generate random unavailable days and time slots for demo
        this.generateRandomUnavailableDays();
      } else {
        this.loadingService.setLoading(false);
        this.router.navigate(['/services']); // Redirect if no provider ID
      }
    });
    
    this.subscriptions.push(routeSub);
  }
  
  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  // Provider loading methods
  loadProvider(userId: string): void {
    const providerSub = this.providerService.getProviderByUserId(userId)
      .subscribe(provider => {
        this.provider = provider || null;
        this.loadingService.setLoading(false);
      });
      
    this.subscriptions.push(providerSub);
  }
  
  // Calendar methods
  updateCalendar(): void {
    // Generate days in month
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
    
    // Update month and year display
    this.currentMonthYear = this.formatMonthYear(firstDay);
    
    // Get the day of the week for the first day (0-6, 0 is Sunday in JS)
    let firstDayOfWeek = firstDay.getDay();
    // Adjust for European calendar (Monday is first day)
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    // Calculate empty days at start
    this.emptyDaysAtStart = Array(firstDayOfWeek).fill(0);
    
    // Generate days of month array
    this.daysInMonth = Array.from(
      { length: lastDay.getDate() }, 
      (_, i) => i + 1
    );
  }
  
  prevMonth(): void {
    if (this.currentMonth === 0) {
      this.currentMonth = 11;
      this.currentYear--;
    } else {
      this.currentMonth--;
    }
    this.updateCalendar();
    this.generateRandomUnavailableDays();
  }
  
  nextMonth(): void {
    if (this.currentMonth === 11) {
      this.currentMonth = 0;
      this.currentYear++;
    } else {
      this.currentMonth++;
    }
    this.updateCalendar();
    this.generateRandomUnavailableDays();
  }
  
  // Calendar helper methods
  isPastDay(day: number): boolean {
    const date = new Date(this.currentYear, this.currentMonth, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }
  
  isToday(day: number): boolean {
    const today = new Date();
    return (
      day === today.getDate() &&
      this.currentMonth === today.getMonth() &&
      this.currentYear === today.getFullYear()
    );
  }
  
  isUnavailableDay(day: number): boolean {
    return this.unavailableDays.has(day);
  }
  
  isSelectedDay(day: number): boolean {
    if (!this.selectedDate) return false;
    
    return (
      day === this.selectedDate.getDate() &&
      this.currentMonth === this.selectedDate.getMonth() &&
      this.currentYear === this.selectedDate.getFullYear()
    );
  }
  
  isUnavailableTime(time: string): boolean {
    return this.unavailableTimeSlots.has(time);
  }
  
  // Selection methods
  selectCalendarDay(day: number): void {
    if (this.isPastDay(day) || this.isUnavailableDay(day)) return;
    
    this.selectedDate = new Date(this.currentYear, this.currentMonth, day);
    this.selectedTime = null;
    this.generateTimeSlots();
  }
  
  selectTimeSlot(time: string): void {
    if (this.isUnavailableTime(time)) return;
    this.selectedTime = time;
  }
  
  generateTimeSlots(): void {
    // In a real implementation, you'd check the provider's business hours
    // and existing appointments to determine available slots
    
    // Generate time slots from 9 AM to 6 PM every 15 minutes
    const slots: string[] = [];
    const startHour = 9;
    const endHour = 18;
    const intervalMinutes = 15;
    
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute = 0; minute < 60; minute += intervalMinutes) {
        // Skip lunch hour (13:00-13:30)
        if (hour === 13 && minute < 30) continue;
        
        // Don't add slots past end time
        if (hour === endHour && minute > 0) continue;
        
        const formattedHour = hour.toString().padStart(2, '0');
        const formattedMinute = minute.toString().padStart(2, '0');
        slots.push(`${formattedHour}:${formattedMinute}`);
      }
    }
    
    this.availableTimeSlots = slots;
    this.generateRandomUnavailableTimeSlots();
  }
  
  // Demo data generation
  generateRandomUnavailableDays(): void {
    // Reset unavailable days
    this.unavailableDays = new Set<number>();
    
    // Get the number of days in current month
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    
    // Make some random days unavailable
    for (let i = 1; i <= daysInMonth; i++) {
      // Make weekends unavailable
      const date = new Date(this.currentYear, this.currentMonth, i);
      const day = date.getDay(); // 0 = Sunday, 6 = Saturday
      
      if (day === 0 || day === 6) {
        this.unavailableDays.add(i);
      } else if (i % 7 === 0 || i % 11 === 0) {
        // Make some random days unavailable
        this.unavailableDays.add(i);
      }
    }
  }
  
  generateRandomUnavailableTimeSlots(): void {
    this.unavailableTimeSlots = new Set<string>();
    
    // Make some random time slots unavailable
    this.availableTimeSlots.forEach(slot => {
      // 25% chance to be unavailable
      if (Math.random() < 0.25) {
        this.unavailableTimeSlots.add(slot);
      }
    });
  }
  
  // Navigation methods
  goBack(): void {
    if (this.userId) {
      this.router.navigate([`/services/${this.userId}`]);
    }
  }
  
  navigateToBookingLogin(): void {
    if (!this.selectedDate || !this.selectedTime) {
      alert('Bitte wählen Sie ein Datum und eine Uhrzeit aus');
      return;
    }
    
    // Save the selected date and time to sessionStorage
    sessionStorage.setItem('selectedDate', JSON.stringify(this.selectedDate));
    sessionStorage.setItem('selectedTime', this.selectedTime);
    
    // Check if user is already logged in
    this.authService.isLoggedIn().subscribe(isLoggedIn => {
      if (isLoggedIn) {
        // If logged in, go directly to booking overview
        this.router.navigate(['/booking-overview']);
      } else {
        // If not logged in, go to login page
        this.router.navigate(['/booking-login', this.userId]);
      }
    });
  }
  
  // Formatting methods
  formatDate(date: Date): string {
    return date.getDate().toString().padStart(2, '0');
  }
  
  formatFullDate(date: Date): string {
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
  
  formatMonthYear(date: Date): string {
    return date.toLocaleDateString('de-DE', {
      month: 'long',
      year: 'numeric'
    });
  }
  
  formatTime(time: string): string {
    return `${time} Uhr`;
  }
  
  formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours} Std. ${remainingMinutes > 0 ? remainingMinutes + ' Min.' : ''}`;
    } else {
      return `${minutes} Min.`;
    }
  }
  
  formatPrice(price: number): string {
    return price.toFixed(2).replace('.', ',') + ' €';
  }
  
  getTotalPrice(): number {
    return this.cartItems.reduce((total, item) => total + item.price, 0);
  }
  
  getTotalDuration(): number {
    return this.cartItems.reduce((total, item) => total + item.duration, 0);
  }
}