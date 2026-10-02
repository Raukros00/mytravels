import { User } from './user.model';

export interface GroupMember {
  id: string;
  name: string;
  avatar: string;
  role: 'admin' | 'member';
  color: string;
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
}

export interface CreateGroupDto {
  name: string;
  description: string;
  icon: string;
  color: string;
}
