import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent implements OnInit {
  currentYear: number = new Date().getFullYear();
  emailSubscription: string = '';

  constructor() { }

  ngOnInit(): void {
  }

  subscribeToNewsletter(): void {
    // Here you would typically handle the newsletter subscription
    // by sending the email to your API
    if (this.validateEmail(this.emailSubscription)) {
      console.log('Subscribing email:', this.emailSubscription);
      // Call your subscription service here
      
      // Reset the field after successful subscription
      this.emailSubscription = '';
      
      // Show a success message to the user
      alert('Thank you for subscribing to our newsletter!');
    } else {
      alert('Please enter a valid email address.');
    }
  }

  private validateEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }
}