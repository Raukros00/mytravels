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
}

export interface CreateGroupDto {
  name: string;
  description: string;
  icon: string;
  color: string;
}
