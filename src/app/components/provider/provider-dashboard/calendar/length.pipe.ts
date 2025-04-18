// src/app/pipes/length.pipe.ts

import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'length',
  standalone: true
})
export class LengthPipe implements PipeTransform {
  /**
   * Gibt die Länge eines Arrays zurück
   * @param value Das Array, dessen Länge bestimmt werden soll
   * @returns Die Anzahl der Elemente im Array oder 0, wenn das Array nicht existiert
   */
  transform(value: any[]): number {
    return value ? value.length : 0;
  }
}