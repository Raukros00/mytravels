import { User } from './user.model';

export interface AuthResponse {
  user: User;
  token: string;
}

export interface RegisterDto {
  firstName: string;
  lastName: string;
  /** ISO yyyy-mm-dd; almeno MIN_REGISTRATION_AGE anni. */
  birthDate: string;
  email: string;
  password: string;
  avatar?: string;
  color?: string;
  /** Data URL JPEG della foto ritagliata (opzionale). */
  profileImage?: string | null;
}

/** Modifica dei dati personali dal Profilo (#120): sostituzione completa, `profileImage` null = nessuna foto. */
export interface UpdateProfileDto {
  firstName: string;
  lastName: string;
  /** ISO yyyy-mm-dd; almeno MIN_REGISTRATION_AGE anni. */
  birthDate: string;
  avatar?: string;
  color?: string;
  profileImage: string | null;
}

/** Età minima per registrarsi (in Italia, a 14 anni si presta da soli il consenso al trattamento dei dati). */
export const MIN_REGISTRATION_AGE = 14;

export interface LoginDto {
  email: string;
  password?: string;
}
