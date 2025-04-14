import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthenticationService } from '../../../services/authentication.service';
import { LoadingService } from '../../../services/loading.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-provider-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './provider-login.component.html',
  styleUrls: ['./provider-login.component.css']
})
export class ProviderLoginComponent {
  
  email = '';
  password = '';
  errorMessage = '';

  auth = inject(AuthenticationService);
  loading = inject(LoadingService);
  router = inject(Router);



  async onSubmit() {
    this.loading.setLoading(true);
    try {
      await this.auth.login({email: this.email, password: this.password});
      this.router.navigate(['/provider-dashboard']);
    } catch (error) {
      console.error(error);
      this.errorMessage = 'Invalid email or password.';
    } finally {
      this.loading.setLoading(false);
    }
  }
}