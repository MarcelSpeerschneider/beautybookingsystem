// Helper-Funktionen für den Umgang mit Firebase Timestamps
// Füge diese in den AppointmentService oder in einen separaten Utilities-Service ein

/**
 * Konvertiert einen beliebigen Datumswert in ein JavaScript Date-Objekt
 * Unterstützt Firebase Timestamps, Strings, Numbers und Date-Objekte
 */
export function convertToDate(value: any): Date | null {
    if (!value) return null;
  
    try {
      // Fall 1: Es ist bereits ein Date-Objekt
      if (value instanceof Date) {
        return value;
      }
      
      // Fall 2: Es ist ein Firebase Timestamp (hat eine toDate-Methode)
      if (value && typeof value === 'object' && typeof value.toDate === 'function') {
        return value.toDate();
      }
      
      // Fall 3: Es ist ein ISO-String oder eine Timestamp-Zahl
      if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
      }
      
      // Fall 4: Es ist ein Objekt mit seconds und nanoseconds (Firestore Timestamp Format)
      if (value && typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value) {
        // Berechne Millisekunden aus Sekunden und Nanosekunden
        return new Date((value.seconds * 1000) + (value.nanoseconds / 1000000));
      }
      
      console.warn('Unbekanntes Datumsformat:', value);
      return null;
    } catch (error) {
      console.error('Fehler bei der Datumskonvertierung:', error, value);
      return null;
    }
  }
  
  /**
   * Konvertiert alle Datumswerte in einem Appointment-Objekt
   */
  export function convertAppointmentDates(appointment: any): any {
    if (!appointment) return appointment;
    
    const converted = { ...appointment };
    
    // Konvertiere die wichtigsten Datumswerte
    if ('startTime' in appointment) {
      converted.startTime = convertToDate(appointment.startTime);
    }
    
    if ('endTime' in appointment) {
      converted.endTime = convertToDate(appointment.endTime);
    }
    
    if ('createdAt' in appointment) {
      converted.createdAt = convertToDate(appointment.createdAt);
    }
    
    return converted;
  }
  
  /**
   * Sicheres Datumsformat für die Anzeige
   */
  export function safeFormatDate(date: any, format: 'date' | 'time' | 'datetime' = 'date'): string {
    const validDate = convertToDate(date);
    
    if (!validDate) {
      return format === 'time' ? '--:--' : 'Ungültiges Datum';
    }
    
    try {
      switch (format) {
        case 'time':
          return validDate.toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit'
          });
        case 'date':
          return validDate.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
        case 'datetime':
          return validDate.toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
      }
    } catch (error) {
      console.error('Fehler bei der Datumsformatierung:', error, date);
      return format === 'time' ? '--:--' : 'Ungültiges Datum';
    }
  }