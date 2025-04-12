import { Routes, RouterModule } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { ProfileComponent } from './components/profile/profile.component';
import { CustomerBookingComponent } from './components/customer/customer-booking/customer-booking.component';

export const routes: Routes = [
    { path: '', redirectTo: '/login', pathMatch: 'full' },
    { path: 'login', component: LoginComponent }, 
    { path: 'register', component: RegisterComponent }, 
    { path: 'profile', component: ProfileComponent }, 
    { path: 'booking', component: CustomerBookingComponent }


];



