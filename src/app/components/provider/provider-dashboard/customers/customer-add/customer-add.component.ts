import { Component, Input, Output, EventEmitter, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CustomerService } from '../../../../../services/customer.service';
import { LoadingService } from '../../../../../services/loading.service';
import { Customer } from '../../../../../models/customer.model';
import { Provider } from '../../../../../models/provider.model';
import { ProviderCustomerService } from '../../../../../services/provider-customer.service';

@Component({
  selector: 'app-customer-add',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './customer-add.component.html',
  styleUrls: ['./customer-add.component.css']
})
export class CustomerAddComponent implements OnInit {
  @Input() provider!: Provider;
  @Output() close = new EventEmitter<void>();
  @Output() customerCreated = new EventEmitter<Customer>();
  
  customerForm: FormGroup;
  formErrors: { [key: string]: string } = {};
  
  private fb = inject(FormBuilder);
  private customerService = inject(CustomerService);
  private loadingService = inject(LoadingService);
  private providerCustomerService = inject(ProviderCustomerService);
  
  constructor() {
    this.customerForm = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.email]],
      phone: [''],
      notes: ['']
    });
  }
  
  ngOnInit(): void {
    if (!this.provider || !this.provider.id) {
      console.error('Provider-Daten fehlen oder sind ungültig!');
    }
  }
  
  onSubmit(): void {
    if (this.validateForm()) {
      this.loadingService.setLoading(true, 'Kunde wird erstellt...');
      
      const customerData: Omit<Customer, 'id'> = {
        firstName: this.customerForm.value.firstName,
        lastName: this.customerForm.value.lastName,
        email: this.customerForm.value.email || '',
        phone: this.customerForm.value.phone || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      console.log('Erstelle Kunden mit Daten:', customerData);
      
      // Schritt 1: Erstelle den Kunden und erhalte seine ID
      this.customerService.createCustomer(customerData)
        .then(customerId => {
          console.log('Kunde erstellt mit ID:', customerId);
          
          // Schritt 2: Erstelle die Relation mit Notizen (falls vorhanden)
          const notes = this.customerForm.value.notes || '';
          
          return this.providerCustomerService.updateCustomerNotes(
            this.provider.id,
            customerId,
            notes
          ).then(() => {
            // Vollständiges Kundenobjekt erstellen und zurückgeben
            const createdCustomer: Customer = {
              id: customerId,
              ...customerData
            };
            
            return createdCustomer;
          });
        })
        .then(createdCustomer => {
          this.loadingService.setLoading(false);
          console.log('Kunde erfolgreich erstellt:', createdCustomer);
          
          // Event nach oben an die Parent-Komponente emittieren
          this.customerCreated.emit(createdCustomer);
          
          // Formular schließen
          this.close.emit();
        })
        .catch(error => {
          this.loadingService.setLoading(false);
          console.error('Fehler beim Erstellen des Kunden:', error);
          this.formErrors['general'] = 'Fehler beim Erstellen des Kunden: ' + error.message;
        });
    }
  }
  
  validateForm(): boolean {
    this.formErrors = {};
    let isValid = true;
    
    if (!this.customerForm.get('firstName')?.valid) {
      this.formErrors['firstName'] = 'Vorname ist erforderlich';
      isValid = false;
    }
    
    if (!this.customerForm.get('lastName')?.valid) {
      this.formErrors['lastName'] = 'Nachname ist erforderlich';
      isValid = false;
    }
    
    if (this.customerForm.get('email')?.value && !this.customerForm.get('email')?.valid) {
      this.formErrors['email'] = 'Bitte geben Sie eine gültige E-Mail-Adresse ein';
      isValid = false;
    }
    
    return isValid;
  }
  
  hasError(fieldName: string): boolean {
    return this.formErrors[fieldName] !== undefined;
  }
  
  getErrorMessage(fieldName: string): string {
    return this.formErrors[fieldName] || '';
  }
  
  onCancel(): void {
    this.close.emit();
  }
}