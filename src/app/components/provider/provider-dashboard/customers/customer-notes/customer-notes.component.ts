import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-customer-notes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer-notes.component.html',
  styleUrls: ['./customer-notes.component.css']
})
export class CustomerNotesComponent implements OnInit {
  @Input() customer: any;
  @Output() save = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<void>();
  
  notes: string = '';
  
  ngOnInit(): void {
    this.notes = this.customer?.notes || '';
  }
  
  saveNotes(): void {
    this.save.emit(this.notes);
  }
  
  cancelEdit(): void {
    this.cancel.emit();
  }
}