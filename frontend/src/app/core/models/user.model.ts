export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string; // Emoji or avatar image URL
  color: string;  // Background badge color
  joinedDate: string;
}

export interface UserCredentials {
  email: string;
  password?: string;
}
