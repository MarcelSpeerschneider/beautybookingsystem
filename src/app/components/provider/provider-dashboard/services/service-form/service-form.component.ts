import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Service } from '../../../../../models/service.model';

@Component({
  selector: 'app-service-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './service-form.component.html',
  styleUrls: ['./service-form.component.css']
})
export class ServiceFormComponent implements OnInit {
  @Input() service!: Service;
  @Input() isEditMode: boolean = false;
  
  @Output() formSubmit = new EventEmitter<Service>();
  @Output() formCancel = new EventEmitter<void>();
  
  formModel: Service = {
    id: '',
    userId: '',
    name: '',
    description: '',
    price: 0,
    duration: 0,
    image: ''
  };
  
  formErrors: { [key: string]: string } = {};
  
  ngOnInit(): void {
    // Create a copy to avoid modifying the original input
    this.formModel = { ...this.service };
  }
  
  onSubmit(): void {
    if (this.validateForm()) {
      this.formSubmit.emit(this.formModel);
    }
  }
  
  onCancel(): void {
    this.formCancel.emit();
  }
  
  validateForm(): boolean {
    this.formErrors = {};
    let isValid = true;
    
    // Name validation
    if (!this.formModel.name || this.formModel.name.trim() === '') {
      this.formErrors['name'] = 'Name ist erforderlich';
      isValid = false;
    }
    
    // Description validation
    if (!this.formModel.description || this.formModel.description.trim() === '') {
      this.formErrors['description'] = 'Beschreibung ist erforderlich';
      isValid = false;
    }
    
    // Price validation
    if (this.formModel.price <= 0) {
      this.formErrors['price'] = 'Preis muss größer als 0 sein';
      isValid = false;
    }
    
    // Duration validation
    if (this.formModel.duration <= 0) {
      this.formErrors['duration'] = 'Dauer muss größer als 0 sein';
      isValid = false;
    }
    
    return isValid;
  }
  
  // Optional: Image upload functionality could be added here
  onImageUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      // For now, we'll just use a placeholder for the image
      // In a real implementation, you would upload this to storage
      alert('Bildupload-Funktionalität wird noch implementiert. Bitte fügen Sie vorerst einen Bild-URL ein.');
    }
  }
  
  // Helper to check if a field has an error
  hasError(fieldName: string): boolean {
    return this.formErrors[fieldName] !== undefined;
  }
  
  // Helper to get the error message for a field
  getErrorMessage(fieldName: string): string {
    return this.formErrors[fieldName] || '';
  }
}