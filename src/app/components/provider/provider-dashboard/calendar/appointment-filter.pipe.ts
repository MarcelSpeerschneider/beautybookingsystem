import { Pipe, PipeTransform } from '@angular/core';
import { Appointment } from '../../../../models/appointment.model';

// Definiere den Typ mit ID
type AppointmentWithId = Appointment & { id: string };

@Pipe({
  name: 'appointmentFilter',
  standalone: true
})
export class AppointmentFilterPipe implements PipeTransform {
  
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

// Hilfspipe für die Länge einer Liste
@Pipe({
  name: 'length',
  standalone: true
})
export class LengthPipe implements PipeTransform {
  transform(value: any[]): number {
    return value ? value.length : 0;
  }
}