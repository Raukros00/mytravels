/** Profilo pubblico restituito dalla ricerca utenti (niente email). */
export interface PublicUser {
  id: string;
  name: string;
  avatar?: string;
  color?: string;
  profileImage?: string | null;
}

export type JoinRequestStatus = 'pending' | 'approved' | 'declined';

/** Anteprima di un gruppo per chi ha il link/codice invito. */
export interface GroupInvitePreview {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  memberCount: number;
  isMember: boolean;
  /** Stato dell'ultima richiesta dell'utente per questo gruppo, se c'è. */
  requestStatus: JoinRequestStatus | null;
}

/** Richiesta di accesso a un gruppo, da approvare da parte di un admin. */
export interface GroupJoinRequest {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  avatar?: string;
  color?: string;
  profileImage?: string | null;
  status: JoinRequestStatus;
  createdAt: string;
}
