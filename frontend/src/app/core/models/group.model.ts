import { User } from './user.model';

export interface GroupMember {
  id: string;
  name: string;
  avatar: string;
  role: 'admin' | 'member';
  color: string;
  /** Foto profilo dell'utente (data URL), se ne ha una. */
  profileImage?: string | null;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji, e.g. 🍕, ✈️, 🎒, 🍜
  color: string; // Hex or CSS gradient token
  creatorId: string;
  inviteCode: string;
  members: GroupMember[];
  createdAt: string;
  currency?: string; // ISO 4217, default currency for the group's trips
  archived?: boolean;
  mutedBy?: string[]; // ids of members who muted the group
  /** Ex membri che hanno eliminato l'account (#121): spese e proposte li mostrano come "Utente eliminato". */
  deletedMemberIds?: string[];
}

export interface CreateGroupDto {
  name: string;
  description: string;
  icon: string;
  color: string;
}
