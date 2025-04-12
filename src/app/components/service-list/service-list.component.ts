import { Component, OnInit } from '@angular/core';
import { Service } from '../../models/service.model';
import { ServiceService } from '../../services/service.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-service-list',
  templateUrl: './service-list.component.html',
  styleUrls: ['./service-list.component.css'],
  imports: [CommonModule],
  standalone: true
})
export class ServiceListComponent implements OnInit {

  services: Service[] = [];

  constructor(private serviceService: ServiceService) { }

  ngOnInit(): void {
    this.loadServices();
  }

  loadServices(): void {
    this.serviceService.getServices().subscribe(services => {
      this.services = services;
    });
  }
}