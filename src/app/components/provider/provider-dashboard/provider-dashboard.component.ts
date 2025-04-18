import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthenticationService } from '../../../services/authentication.service';
import { ProviderService } from '../../../services/provider.service';
import { Provider } from '../../../models/provider.model';
import { LoadingService } from '../../../services/loading.service';
import { DashboardOverviewComponent } from './dashboard-overview/dashboard-overview.component';
import { AppointmentListComponent } from './appointments/appointment-list.component';
import { ServiceListComponent } from './services/service-list.component';
import { CustomersListComponent } from './customers/customers-list.component';
// Import the calendar component
import { CalendarComponent } from './calendar/calendar.component';

// Extended provider type with providerId
type ProviderWithId = Provider & { providerId: string };

@Component({
  selector: 'app-provider-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    DashboardOverviewComponent, 
    AppointmentListComponent, 
    ServiceListComponent, 
    CustomersListComponent,
    CalendarComponent // Add the calendar component to imports
  ],
  templateUrl: './provider-dashboard.component.html',
  styleUrls: ['./provider-dashboard.component.css']
})
export class ProviderDashboardComponent implements OnInit, OnDestroy {
  provider: ProviderWithId | null = null;
  currentTab: string = 'dashboard';
  private subscriptions: Subscription[] = [];

  private authService = inject(AuthenticationService);
  private providerService = inject(ProviderService);
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
  
      // Get provider info using Auth UID
      const providerSub = this.providerService.getProvider(userWithCustomer.user.uid)
        .subscribe(provider => {
          if (provider) {
            // Cast to the expected ProviderWithId type
            this.provider = provider as ProviderWithId;
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

  changeTab(tab: string): void {
    this.currentTab = tab;
    // In the future, this could be a router navigation:
    // this.router.navigate(['/provider-dashboard', tab]);
  }

  logout(): void {
    this.authService.logout()
      .then(() => {
        this.router.navigate(['/provider-login']);
      });
  }
}