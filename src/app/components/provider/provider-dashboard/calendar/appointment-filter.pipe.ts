// src/app/pipes/appointment-filter.pipe.ts

import { Pipe, PipeTransform } from '@angular/core';
import { Appointment } from '../../../../models/appointment.model';

// Definiere den Typ mit ID
type AppointmentWithId = Appointment & { id: string };

@Pipe({
  name: 'appointmentFilter',
  standalone: true
})
export class AppointmentFilterPipe implements PipeTransform {
  /**
   * Filtert Termine für einen bestimmten Tag
   * @param appointments Die Liste der Termine
   * @param date Das Datum, für das die Termine gefiltert werden sollen
   * @returns Eine gefilterte Liste der Termine für diesen Tag
   */
  transform(appointments: AppointmentWithId[], date: Date): AppointmentWithId[] {
    if (!appointments || !date) {
      return [];
    }
    
    // Filtere Termine für diesen Tag
    return appointments.filter(appointment => {
      const appointmentDate = new Date(appointment.startTime);
      return appointmentDate.getDate() === date.getDate() && 
             appointmentDate.getMonth() === date.getMonth() && 
             appointmentDate.getFullYear() === date.getFullYear();
    });
  }
}