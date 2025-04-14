import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ProviderService } from '../../../services/provider.service';
import { LoadingService } from '../../../services/loading.service';
import { CartService } from '../../../services/cart.service';
import { AuthenticationService } from '../../../services/authentication.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Provider } from '../../../models/provider.model';

@Component({
  selector: 'app-booking-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './booking-login.component.html',
  styleUrls: ['./booking-login.component.css']
})
export class BookingLoginComponent implements OnInit, OnDestroy {
  loginForm: FormGroup;
  errorMessage: string | null = null;
  userId: string | null = null;
  provider: Provider | null = null;
  selectedDate: Date | null = null;
  selectedTime: string | null = null;
  private subscriptions: Subscription[] = [];

  private formBuilder = inject(FormBuilder);
  private providerService = inject(ProviderService);
  private loadingService = inject(LoadingService);
  private authService = inject(AuthenticationService);
  // Changed to public so it can be accessed from the template
  public cartService = inject(CartService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  constructor() {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });

    // Get selected date and time from session storage
    const dateString = sessionStorage.getItem('selectedDate');
    if (dateString) {
      this.selectedDate = new Date(JSON.parse(dateString));
    }
    this.selectedTime = sessionStorage.getItem('selectedTime');
  }

  ngOnInit(): void {
    // Check if the user is already logged in
    const userSub = this.authService.user.subscribe(userWithCustomer => {
      if(userWithCustomer.user && userWithCustomer.customer){
        // User is already logged in, redirect to booking overview directly
        this.router.navigate(['/booking-overview']);
        return;
      }
    });
    this.subscriptions.push(userSub);
    
    this.loadingService.setLoading(true, 'Laden...');
    const routeSub = this.route.paramMap.subscribe(params => {
      this.userId = params.get('userId');
    });
    this.subscriptions.push(routeSub);
    
    // Load provider details if available
    const providerId = this.cartService.getProviderId();
    if (providerId) {
      const providerSub = this.providerService.getProviderByUserId(providerId).subscribe({
        next: (provider) => {
          this.provider = provider;
          this.loadingService.setLoading(false);
        },
        error: (error) => {
          console.error('Error loading provider:', error);
          this.loadingService.setLoading(false);
        }
      });
      
      this.subscriptions.push(providerSub);
    } else {
      this.loadingService.setLoading(false);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.errorMessage = null;
      this.loadingService.setLoading(true, 'Anmeldung läuft...');
      
      const { email, password } = this.loginForm.value;
      
      this.authService.login({ email, password })
        .then(() => {
          // Redirect to our new booking-confirmation page
          this.router.navigate(['/booking-overview']);
        })
        .catch(error => {
          console.error('Login error:', error);
          this.errorMessage = 'Anmeldung fehlgeschlagen. Bitte überprüfen Sie Ihre Eingaben.';
          this.loadingService.setLoading(false);
        });
    }
  }

  formatDate(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  goBack(): void {
    // Go back to appointment selection
    const providerId = this.cartService.getProviderId();
    this.router.navigate(['/appointment-selection', providerId]);
  }

  navigateToRegister(): void {
    // Corrected the register route
    this.router.navigate(['/customer-register']);
  }
}