import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.css']
})
export class LandingPageComponent implements OnInit {
  searchTerm: string = '';
  location: string = '';
  isMenuOpen: boolean = false;
  mobileView: boolean = false;
  currentYear: number = new Date().getFullYear();
  
  // Service-Kategorien für die Schnellauswahl
  serviceCategories: string[] = [
    'Hair Salon', 
    'Nail Salon', 
    'Makeup Artist', 
    'Massage', 
    'Facial', 
    'Waxing'
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.checkScreenSize();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any): void {
    this.checkScreenSize();
  }

  checkScreenSize(): void {
    this.mobileView = window.innerWidth < 768;
  }

  toggleMobileMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    // Schließe das Mobile-Menü nach dem Klick
    this.isMenuOpen = false;
  }

  search(): void {
    if (this.searchTerm || this.location) {
      // Hier könntest du die Suche implementieren oder zur Suchergebnisseite navigieren
      console.log('Searching for:', this.searchTerm, 'in location:', this.location);
      // Beispiel für Navigation mit Suchparametern:
      // this.router.navigate(['/search'], { 
      //   queryParams: { 
      //     term: this.searchTerm, 
      //     location: this.location 
      //   } 
      // });
    }
  }

  selectCategory(category: string): void {
    this.searchTerm = category;
    this.search();
  }

  navigateToRegister(type: 'provider' | 'customer'): void {
    if (type === 'provider') {
      this.router.navigate(['/provider-registration']);
    } else {
      this.router.navigate(['/customer-register']);
    }
  }
}