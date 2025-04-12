import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthenticationService } from '../../services/authentication.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
  standalone: true,
  imports: [CommonModule],
})
export class ProfileComponent implements OnInit{
  user: any;
  auth: AuthenticationService = inject(AuthenticationService)
  constructor() {
  }

  ngOnInit() {
    this.user = this.auth.getUser()
  }

  editProfile(){
  }
}