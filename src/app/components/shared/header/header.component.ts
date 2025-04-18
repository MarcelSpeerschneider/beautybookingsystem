import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {
  isMenuOpen = false;
  isScrolled = false;

  constructor() { }

  ngOnInit(): void {
    // Check initial scroll position
    this.checkScroll();
  }

  @HostListener('window:scroll', [])
  checkScroll(): void {
    // Add a scrolled class to the header when the page is scrolled down
    this.isScrolled = window.scrollY > 50;
  }

  toggleMobileMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMobileMenu(): void {
    this.isMenuOpen = false;
  }
}