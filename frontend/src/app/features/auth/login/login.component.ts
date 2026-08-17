import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  public loginForm = this.fb.group({
    email: ['alessandro@example.com', [Validators.required, Validators.email]],
    password: ['password123']
  });

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    const val = this.loginForm.value;
    this.authService.login({
      email: val.email!,
      password: val.password || ''
    });
  }

  onDemoLogin(): void {
    this.authService.quickDemoLogin();
  }
}
