// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { CustomerLoginComponent } from './components/customer/customer-login/customer-login.component';
import { CustomerRegisterComponent } from './components/customer/customer-register/customer-register.component';
import { CustomerProfileComponent } from './components/customer/customer-profile/customer-profile.component';
import { CustomerBookingComponent } from './components/customer/customer-booking/customer-booking.component';
import { AuthGuard } from './guards/auth.guard';
import { RoleGuard } from './guards/role.guard';
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

// Import the landing page component
import { LandingPageComponent } from './components/public/landing-page/landing-page.component';

export const routes: Routes = [
  // Öffentliche Routen
  { path: '', component: LandingPageComponent, pathMatch: 'full' },
  { path: 'customer-login', component: CustomerLoginComponent },
  { path: 'customer-register', component: CustomerRegisterComponent },
  { path: 'provider-login', component: ProviderLoginComponent },
  { path: 'provider-registration', component: ProviderRegistrationComponent },
  
  // Kunden-Routen mit RoleGuard
  { 
    path: 'customer-profile', 
    component: CustomerProfileComponent, 
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['customer'] } 
  },
  { 
    path: 'customer-booking', 
    component: CustomerBookingComponent, 
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['customer'] } 
  },

  // Provider-Routen mit RoleGuard
  { 
    path: 'provider-dashboard', 
    component: ProviderDashboardComponent, 
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['provider'] } 
  },
  
  // Public booking flow - these should not have AuthGuard or should be marked public
  { path: 'services/:userId', component: PublicServiceListComponent, data: { isPublic: true } },
  { path: 'appointment-selection/:userId', component: AppointmentSelectionComponent, data: { isPublic: true } },
  { path: 'booking-login/:userId', component: BookingLoginComponent, data: { isPublic: true } },
  
  // Buchungsabschluss-Routen mit AuthGuard und Customer-Rolle
  { 
    path: 'booking-overview', 
    component: BookingOverviewComponent, 
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['customer'] }
  },
  { 
    path: 'booking-confirmation', 
    component: BookingConfirmationComponent, 
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['customer'] }
  },

  // Provider public page - mark this as public
  { path: ':businessName', component: PublicProviderComponent, data: { isPublic: true } }
];