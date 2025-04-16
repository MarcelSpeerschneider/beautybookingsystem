import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
// uuid-Import entfernt
import { Provider } from '../../../../models/provider.model';
import { Service } from '../../../../models/service.model';
import { ServiceService } from '../../../../services/service.service';
import { LoadingService } from '../../../../services/loading.service';
import { ServiceFormComponent } from './service-form/service-form.component';

// Define the extended Provider type with providerId
type ProviderWithId = Provider & { providerId: string };

@Component({
  selector: 'app-service-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ServiceFormComponent
  ],
  templateUrl: './service-list.component.html',
  styleUrls: ['./service-list.component.css']
})
export class ServiceListComponent implements OnInit, OnDestroy {
  @Input() provider: ProviderWithId | null = null;
  
  services: Service[] = [];
  selectedService: Service | null = null;
  showAddServiceForm: boolean = false;
  isEditMode: boolean = false;
  
  private subscriptions: Subscription[] = [];
  
  private serviceService = inject(ServiceService);
  private loadingService = inject(LoadingService);
  
  ngOnInit(): void {
    if (this.provider) {
      this.loadServices();
    }
  }
  
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  loadServices(): void {
    if (!this.provider) return;
    
    this.loadingService.setLoading(true, 'Lade Dienstleistungen...');
    
    const servicesSub = this.serviceService
      .getServicesByProvider(this.provider.providerId)
      .subscribe({
        next: (services: Service[]) => {
          this.services = services;
          this.loadingService.setLoading(false);
          
          if (this.services.length === 0) {
            console.log('Keine Dienstleistungen für diesen Provider gefunden.');
          }
        },
        error: (error: any) => {
          this.loadingService.setLoading(false);
          console.error('Fehler beim Laden der Dienstleistungen:', error);
          alert('Fehler beim Laden der Dienstleistungen. Bitte versuchen Sie es später erneut.');
        }
      });
      
    this.subscriptions.push(servicesSub);
  }
  
  addNewService(): void {
    this.isEditMode = false;
    this.selectedService = this.createEmptyService();
    this.showAddServiceForm = true;
  }
  
  editService(service: Service): void {
    this.isEditMode = true;
    this.selectedService = { ...service }; // Create a copy to avoid modifying the original
    this.showAddServiceForm = true;
  }
  
  handleFormCancel(): void {
    this.showAddServiceForm = false;
    this.selectedService = null;
  }
  
  handleFormSubmit(service: Service): void {
    this.loadingService.setLoading(true, this.isEditMode ? 'Speichere Änderungen...' : 'Erstelle Dienstleistung...');
    
    const saveOperation = this.isEditMode 
      ? this.serviceService.updateService(service)
      : this.serviceService.createService(service);
      
    saveOperation
      .then(() => {
        this.loadingService.setLoading(false);
        alert(this.isEditMode 
          ? 'Dienstleistung wurde aktualisiert.' 
          : 'Dienstleistung wurde erstellt.');
        this.loadServices(); // Refresh the list
        this.handleFormCancel(); // Close the form
      })
      .catch(error => {
        this.loadingService.setLoading(false);
        console.error('Fehler beim Speichern der Dienstleistung:', error);
        alert('Fehler beim Speichern der Dienstleistung. Bitte versuchen Sie es später erneut.');
      });
  }
  
  deleteService(serviceId: string): void {
    if (confirm('Sind Sie sicher, dass Sie diese Dienstleistung löschen möchten?')) {
      this.loadingService.setLoading(true, 'Lösche Dienstleistung...');
      
      this.serviceService.deleteService(serviceId)
        .then(() => {
          this.loadingService.setLoading(false);
          alert('Dienstleistung wurde gelöscht.');
          this.loadServices(); // Refresh the list
        })
        .catch(error => {
          this.loadingService.setLoading(false);
          console.error('Fehler beim Löschen der Dienstleistung:', error);
          alert('Fehler beim Löschen der Dienstleistung. Bitte versuchen Sie es später erneut.');
        });
    }
  }
  
  // Create an empty service with default values
  private createEmptyService(): Service {
    return {
      id: '', // Leere ID, wird von Firestore beim Speichern generiert
      providerId: this.provider?.providerId || '',
      name: '',
      description: '',
      price: 0,
      duration: 0,
      image: ''
    };
  }
}