import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthenticationService } from '../../../services/authentication.service';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../../../services/loading.service';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-unified-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './unified-login.component.html',
  styleUrls: ['./unified-login.component.css']
})
export class UnifiedLoginComponent implements OnInit {
  loginForm!: FormGroup;
  error: string | null = null;
  
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthenticationService);
  private loadingService = inject(LoadingService);
  private firestore = inject(Firestore);

  ngOnInit(): void {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });

    // Check if user is already logged in
    this.authService.user$.subscribe(user => {
      if (user) {
        this.checkUserRoleAndRedirect(user.uid);
      }
    });
  }

  /**
   * Check user role and redirect accordingly
   */
  private async checkUserRoleAndRedirect(userId: string): Promise<void> {
    try {
      // Check if user is a provider
      const providerDoc = doc(this.firestore, 'providers', userId);
      const providerSnapshot = await getDoc(providerDoc);
      
      if (providerSnapshot.exists() && providerSnapshot.data()['role'] === 'provider') {
        console.log('User has provider role, redirecting to dashboard');
        this.router.navigate(['/provider-dashboard']);
        return;
      }
      
      // Check if user is a customer
      const customerDoc = doc(this.firestore, 'customers', userId);
      const customerSnapshot = await getDoc(customerDoc);
      
      if (customerSnapshot.exists() && customerSnapshot.data()['role'] === 'customer') {
        console.log('User has customer role, redirecting to home');
        this.router.navigate(['/']);
        return;
      }
      
      console.log('User has no defined role');
      // If no role is found, you might want to consider redirecting to a registration page
      // or showing an error message
    } catch (error) {
      console.error('Error checking user role:', error);
    }
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.error = null;
      const { email, password } = this.loginForm.value;
      
      this.loadingService.setLoading(true, 'Logging in...');
      this.authService.login({email, password})
        .then(async () => {
          // After login, check user role and redirect
          const user = this.authService.getUser();
          if (user) {
            await this.checkUserRoleAndRedirect(user.uid);
            this.loadingService.setLoading(false);
          }
        })
        .catch((error) => {
          this.error = 'Login failed: ' + error.message;
          console.error('Login failed:', error);
          this.loadingService.setLoading(false);
        });
    }
  }

  navigateToRegister(role: 'customer' | 'provider'): void {
    if (role === 'customer') {
      this.router.navigate(['/customer-register']);
    } else {
      this.router.navigate(['/provider-registration']);
    }
  }
}
