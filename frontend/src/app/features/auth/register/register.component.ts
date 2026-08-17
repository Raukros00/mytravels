import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  public avatarList = ['👨‍🍳', '👩‍🎨', '🎒', '🏄‍♂️', '🧘‍♀️', '📸', '🗺️', '☕'];
  public colorList = ['#4f46e5', '#f97316', '#10b981', '#f43f5e', '#8b5cf6', '#06b6d4'];

  public registerForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['password123'],
    avatar: ['👨‍🍳'],
    color: ['#4f46e5']
  });

  onSubmit(): void {
    if (this.registerForm.invalid) return;

    const val = this.registerForm.value;
    this.authService.register({
      name: val.name!,
      email: val.email!,
      password: val.password || '',
      avatar: val.avatar || '👨‍🍳',
      color: val.color || '#4f46e5'
    });
  }
}
