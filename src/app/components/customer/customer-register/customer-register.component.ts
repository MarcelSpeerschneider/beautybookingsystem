import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthenticationService } from '../../../services/authentication.service';

export interface UserWithData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password?: string
}

@Component({
  selector: 'app-customer-register',
  templateUrl: './customer-register.component.html',
  styleUrls: ['./customer-register.component.css'],
  standalone: true,
  imports: [ReactiveFormsModule],
})
export class CustomerRegisterComponent implements OnInit {
  registerForm!: FormGroup;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private authService: AuthenticationService
  ) {}

  ngOnInit(): void {
    this.registerForm = this.formBuilder.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      phone: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
      passwordAgain: ['', [Validators.required]],
    });
  }

  onSubmit(): void {
    if (this.registerForm.valid) {
      const { firstName, lastName, phone, email, password } = this.registerForm.value;
        
      // Log the data to see what's being sent
      console.log('Form data being sent:', { firstName, lastName, phone, email });
      
      if(password === this.registerForm.get('passwordAgain')?.value) {
        this.authService.register({ firstName, lastName, phone, email, password })
          .then(() => {
            this.router.navigate(['/customer-booking']);
          })
          .catch((error) => {
            console.error('Registration failed: ', error);   
            if(error.code === 'auth/email-already-in-use'){
              alert('The email address is already in use');
            } else {
              alert('Registration failed: ' + error.message);
            }
          });
      } else {
        alert("The passwords are not the same")
      }
    }
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }
}