import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { GroupInvitePreview, GroupJoinRequest, PublicUser } from '../models/invite.model';

/**
 * Inviti ai gruppi: link/codice con richiesta di accesso approvata da un admin,
 * e ricerca degli utenti da invitare direttamente.
 */
@Injectable({ providedIn: 'root' })
export class GroupInviteService {
  private readonly api = inject(ApiService);

  /** Link da condividere: aprendolo si vede il gruppo e si può chiedere di entrare. */
  inviteLink(inviteCode: string): string {
    return `${window.location.origin}/join/${encodeURIComponent(inviteCode)}`;
  }

  preview(inviteCode: string): Observable<GroupInvitePreview> {
    return this.api.get<GroupInvitePreview>(`/api/v1/groups/invite/${encodeURIComponent(inviteCode)}`);
  }

  requestAccess(inviteCode: string): Observable<GroupJoinRequest> {
    return this.api.post<GroupJoinRequest>(`/api/v1/groups/invite/${encodeURIComponent(inviteCode)}/request`, {});
  }

  pendingRequests(groupId: string): Observable<GroupJoinRequest[]> {
    return this.api.get<GroupJoinRequest[]>(`/api/v1/groups/${groupId}/join-requests`);
  }

  decide(groupId: string, requestId: string, approve: boolean): Observable<GroupJoinRequest> {
    return this.api.post<GroupJoinRequest>(`/api/v1/groups/${groupId}/join-requests/${requestId}/${approve ? 'approve' : 'decline'}`, {});
  }

  /** Utenti per nome (anche parziale) o email esatta; almeno 2 caratteri. */
  searchUsers(query: string): Observable<PublicUser[]> {
    return this.api.get<PublicUser[]>('/api/v1/users/search', { q: query });
  }
}
