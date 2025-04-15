import { Routes } from '@angular/router';
import { CustomerLoginComponent } from './components/customer/customer-login/customer-login.component';
import { CustomerRegisterComponent } from './components/customer/customer-register/customer-register.component';
import { CustomerProfileComponent } from './components/customer/customer-profile/customer-profile.component';
import { CustomerBookingComponent } from './components/customer/customer-booking/customer-booking.component';
import { AuthGuard } from './guards/auth.guard';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
// Provider Components
import { ProviderRegistrationComponent } from './components/provider/provider-registration/provider-registration.component';
import { ProviderDashboardComponent } from './components/provider/provider-dashboard/provider-dashboard.component';
import { ProviderLoginComponent } from './components/provider/provider-login/provider-login.component';

// Public Booking Flow
import { BookingLoginComponent } from './components/public/booking-login/booking-login.component';
import { PublicServiceListComponent } from './components/public/public-service-list/public-service-list.component';
import { AppointmentSelectionComponent } from './components/public/appointment-selection/appointment-selection.component';
import { PublicProviderComponent } from './components/public/public-provider/public-provider.component';
import { BookingOverviewComponent } from './components/public/booking-overview/booking-overview.component';
import { BookingConfirmationComponent } from './components/public/booking-confirmation/booking-confirmation.component';

export const routes: Routes = [
  { path: '', redirectTo: '/customer-login', pathMatch: 'full' },
  
  // Customer routes
  { path: 'customer-login', component: CustomerLoginComponent },
  { path: 'customer-register', component: CustomerRegisterComponent },
  { path: 'customer-profile', component: CustomerProfileComponent, canActivate: [AuthGuard] },
  { path: 'customer-booking', component: CustomerBookingComponent, canActivate: [AuthGuard] },

  // Provider routes
  { path: 'provider-registration', component: ProviderRegistrationComponent },
  { path: 'provider-login', component: ProviderLoginComponent },
  { path: 'provider-dashboard', component: ProviderDashboardComponent, canActivate: [AuthGuard] },
  
  // Public booking flow - these should not have AuthGuard or should be marked public
  { path: 'services/:userId', component: PublicServiceListComponent, data: { isPublic: true } },
  { path: 'appointment-selection/:userId', component: AppointmentSelectionComponent, data: { isPublic: true } },
  { path: 'booking-login/:userId', component: BookingLoginComponent, data: { isPublic: true } },
  { path: 'booking-overview', component: BookingOverviewComponent, canActivate: [AuthGuard] },
  { path: 'booking-confirmation', component: BookingConfirmationComponent, canActivate: [AuthGuard] },

  // Provider public page - mark this as public
  { path: ':businessName', component: PublicProviderComponent, data: { isPublic: true } }
];