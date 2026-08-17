import { User } from './user.model';

export interface AuthResponse {
  user: User;
  token: string;
}

export interface RegisterDto {
  name: string;
  email: string;
  password?: string;
  avatar?: string;
  color?: string;
}

export interface LoginDto {
  email: string;
  password?: string;
}
