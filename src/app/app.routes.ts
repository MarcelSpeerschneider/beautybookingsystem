// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { CustomerRegisterComponent } from './components/customer/customer-register/customer-register.component';
import { CustomerProfileComponent } from './components/customer/customer-profile/customer-profile.component';
import { CustomerBookingComponent } from './components/customer/customer-booking/customer-booking.component';
import { AuthGuard } from './guards/auth.guard';
import { RoleGuard } from './guards/role.guard';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
// Provider Components
import { ProviderRegistrationComponent } from './components/provider/provider-registration/provider-registration.component';
import { ProviderDashboardComponent } from './components/provider/provider-dashboard/provider-dashboard.component';
import { ProviderProfileComponent } from './components/provider/provider-profile/provider-profile.component';

// Import the unified login component
import { UnifiedLoginComponent } from './components/auth/unified-login/unified-login.component';

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
  // Public routes
  { path: '', component: LandingPageComponent, pathMatch: 'full' },
  // Replace both login routes with unified login
  { path: 'login', component: UnifiedLoginComponent },
  // Keep these routes for backwards compatibility (redirect to unified login)
  { path: 'customer-login', redirectTo: 'login', pathMatch: 'full' },
  { path: 'provider-login', redirectTo: 'login', pathMatch: 'full' },
  { path: 'customer-register', component: CustomerRegisterComponent },
  { path: 'provider-registration', component: ProviderRegistrationComponent },



  
  // Customer routes with RoleGuard
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

  // Provider routes with RoleGuard

  { 
    path: 'provider-profile', 
    component: ProviderProfileComponent, 
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['provider'] } 
  },

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
  
  // Booking completion routes with AuthGuard and Customer role
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