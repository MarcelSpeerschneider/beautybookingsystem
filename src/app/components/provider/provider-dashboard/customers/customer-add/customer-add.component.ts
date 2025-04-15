// In customer-add.component.ts

import { Component, Input, Output, EventEmitter, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { v4 as uuidv4 } from 'uuid';
import { CustomerService } from '../../../../../services/customer.service';
import { LoadingService } from '../../../../../services/loading.service';
import { Customer } from '../../../../../models/customer.model';
import { Provider } from '../../../../../models/provider.model';
import { ProviderCustomerService } from '../../../../../services/provider-customer.service';
import { Auth } from '@angular/fire/auth';

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
  private auth = inject(Auth);
  
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
    // Validierung nach der Initialisierung hinzufügen
    if (!this.provider || !this.provider.userId) {
      console.error('Provider-Daten fehlen oder sind ungültig!');
    } else {
      console.log('Provider-ID:', this.provider.userId);
      console.log('Auth-UID:', this.auth.currentUser?.uid);
      
      // Falls keine Übereinstimmung, Warnung ausgeben
      if (this.auth.currentUser?.uid !== this.provider.userId) {
        console.warn('Die Provider-ID entspricht nicht der aktuellen Auth-ID!');
      }
    }
  }
  
  onSubmit(): void {
    if (this.validateForm()) {
      this.loadingService.setLoading(true, 'Kunde wird erstellt...');
      
      // Wichtig: Die aktuelle Auth-UID verwenden, nicht die Provider-ID!
      const authUserId = this.auth.currentUser?.uid;
      
      if (!authUserId) {
        this.loadingService.setLoading(false);
        this.formErrors['general'] = 'Fehler: Nicht authentifiziert!';
        return;
      }
      
      // Generate a placeholder userId with a prefix to identify manual customers
      const manualUserId = `manual_${uuidv4()}`;
      
      // Base customer properties - strikt nach Customer-Interface
      const customer: Customer = {
        customerId: '', // Will be set by Firestore
        userId: manualUserId,
        firstName: this.customerForm.value.firstName,
        lastName: this.customerForm.value.lastName,
        email: this.customerForm.value.email || '',
        phone: this.customerForm.value.phone || ''
      };
      
      console.log('Erstelle Kunden mit Basis-Daten:', customer);
      
      // Add a flag in the saved customer to identify manually created ones
      // Vermeidung des direkten Type-Castings, um keine Felder zu verlieren
      const customerToSave = {
        ...customer,
        isManuallyCreated: true,
        createdBy: authUserId, // Wichtig: Auth-UID verwenden!
        createdAt: new Date()
      };
      
      console.log('Erweiterte Kundendaten zum Speichern:', customerToSave);
      
      // Explizites "any" Typcasting um TypeScript-Fehler zu vermeiden
      this.customerService.createCustomer(customerToSave as any)
        .then(docRef => {
          this.loadingService.setLoading(false);
          
          // Add the customerId to the customer object
          const createdCustomer = {
            ...customer,
            customerId: docRef.id,
            isManuallyCreated: true,
            createdBy: authUserId,
            notes: this.customerForm.value.notes || ''
          };
          
          console.log('Kunde erfolgreich erstellt:', createdCustomer);
          
          // If notes provided, create a provider-customer relation with notes
          if (this.customerForm.value.notes) {
            this.providerCustomerService.updateCustomerNotes(
              authUserId, // Wichtig: Auth-UID verwenden!
              docRef.id,
              this.customerForm.value.notes
            ).catch(error => {
              console.error('Error saving customer notes:', error);
            });
          }
          
          // Emit event to parent component
          this.customerCreated.emit(createdCustomer as any);
          
          // Close the form
          this.close.emit();
        })
        .catch(error => {
          this.loadingService.setLoading(false);
          console.error('Error creating customer:', error);
          this.formErrors['general'] = 'Fehler beim Erstellen des Kunden: ' + error.message;
        });
    }
  }
  
  // Rest der Methoden bleibt gleich...
  
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