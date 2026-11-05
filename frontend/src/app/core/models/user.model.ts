export interface User {
  id: string;
  /** Nome completo ("Nome Cognome"). */
  name: string;
  firstName?: string;
  lastName?: string;
  /** Data di nascita ISO (yyyy-mm-dd). */
  birthDate?: string;
  /** Foto profilo opzionale (data URL dell'immagine ritagliata). */
  profileImage?: string | null;
  email: string;
  avatar: string; // Emoji or avatar image URL
  color: string;  // Background badge color
  joinedDate: string;
}

export interface UserCredentials {
  email: string;
  password?: string;
}
