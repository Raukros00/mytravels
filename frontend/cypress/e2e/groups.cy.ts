import i18n from '../../public/i18n/it.json';
import { uniq } from '../support/e2e';
import { DemoUser, GROUPS, TRIPS } from '../support/users';

const t = i18n.groups;

const groupCard = (name: string) => cy.contains('.group-card .group-name', name).closest('.group-card');

function openCardMenu(name: string) {
  groupCard(name).find('.card-menu-btn').click();
}

/**
 * Attende che il gruppo salvato sul backend soddisfi `assert`.
 * `as` deve essere un membro: il backend non mostra i gruppi di cui non si fa parte.
 */
function savedGroup(id: string, assert: (group: any) => void, as: DemoUser = 'admin') {
  return cy.apiUntil(as, `/api/v1/groups/${id}`, assert);
}

const memberIds = (g: any): string[] => g.members.map((m: any) => m.id);

describe('Gruppi – lista', () => {
  beforeEach(() => {
    cy.login('admin');
    cy.visit('/groups');
    cy.contains('h1', t.title).should('be.visible');
  });

  it('mostra solo i gruppi di cui l\'utente fa parte', () => {
    groupCard(GROUPS.esploratori).should('be.visible');
    groupCard(GROUPS.warriors).should('be.visible');
    cy.contains('.group-name', GROUPS.foodies).should('not.exist');
  });

  it('il codice invito è nascosto finché non lo si mostra', () => {
    cy.groupByName('admin', GROUPS.esploratori).then(group => {
      groupCard(GROUPS.esploratori).within(() => {
        cy.get('.code-val').should('contain.text', '••••');
        cy.get('.btn-copy').click();
        cy.get('.code-val').should('contain.text', group.inviteCode);
        cy.get('.btn-copy').click();
        cy.get('.code-val').should('not.contain.text', group.inviteCode);
      });
    });
  });

  it('"Entra" apre il dettaglio del gruppo', () => {
    groupCard(GROUPS.esploratori).contains('button', t.card_enter).click();
    cy.location('pathname').should('match', /^\/groups\/[\w-]+$/);
    cy.contains('.group-hero-name', GROUPS.esploratori).should('be.visible');
  });

  it('crea un nuovo gruppo', () => {
    const name = uniq('E2E Gruppo');
    cy.intercept('POST', '/api/v1/groups').as('create');
    cy.contains('button', t.new_btn).click();

    cy.dialog(t.form_create_title).within(() => {
      cy.contains('button', t.form_create).should('be.disabled');
      cy.get('#gcm-name').type('ab').blur();
      cy.contains('.form-error', t.form_name_error).should('be.visible');
      cy.get('#gcm-name').clear().type(name);
      cy.get('#gcm-desc').type('Gruppo creato da Cypress');
      cy.contains('button', t.form_create).click();
    });

    cy.wait('@create').its('response.statusCode').should('be.oneOf', [200, 201]);
    cy.toast(`Gruppo "${name}" creato con successo!`).should('be.visible');
    groupCard(name).should('contain.text', 'Gruppo creato da Cypress');

    cy.reload();
    groupCard(name).should('be.visible');
    cy.groupByName('admin', name).its('members').should('have.length', 1);
  });

  it('modifica nome e descrizione dal menu della card', () => {
    const name = uniq('E2E Da modificare');
    const renamed = `${name} (modificato)`;
    cy.createGroup('admin', name).then(group => {
      cy.reload();
      openCardMenu(name);
      cy.contains('.dropdown-item', t.card_edit).click();

      cy.dialog(t.form_edit_title).within(() => {
        cy.get('#gcm-name').should('have.value', name).clear().type(renamed);
        cy.get('#gcm-desc').clear().type('Descrizione aggiornata');
        cy.contains('button', t.form_save).click();
      });

      cy.toast('Gruppo aggiornato con successo!').should('be.visible');
      groupCard(renamed).should('contain.text', 'Descrizione aggiornata');
      savedGroup(group.id, g => expect(g).to.include({ name: renamed, description: 'Descrizione aggiornata' }));
    });
  });

  it('il codice invito porta alla richiesta di accesso; dopo l\'approvazione si entra', () => {
    const name = uniq('E2E Gruppo di Marco');
    cy.createGroup('marco', name).then(group => {
      cy.contains('button', t.join_btn).click();
      cy.dialog(t.join_modal_title).within(() => {
        cy.contains('button', t.join_now).should('be.disabled');
        cy.get('#inviteCodeInput').type(group.inviteCode.toLowerCase());
        cy.contains('button', t.join_now).click();
      });

      cy.location('pathname').should('eq', `/join/${group.inviteCode}`);
      cy.contains('h1', name).should('be.visible');
      cy.contains('button', 'Invia richiesta').click();
      cy.contains('[role="status"]', 'Richiesta inviata').should('be.visible');

      // Non è ancora membro: il gruppo non compare tra i suoi.
      cy.visit('/groups');
      cy.contains('.group-name', name).should('not.exist');

      // Marco (admin) approva.
      cy.api<any[]>('marco', 'GET', `/api/v1/groups/${group.id}/join-requests`).then(requests => {
        expect(requests).to.have.length(1);
        cy.api('marco', 'POST', `/api/v1/groups/${group.id}/join-requests/${requests[0].id}/approve`);
      });
      cy.reload();
      groupCard(name).should('be.visible');
      cy.me('admin').then(me => savedGroup(group.id, g => expect(memberIds(g)).to.include(me.id)));
    });
  });

  it('un codice invito errato mostra "Invito non valido"', () => {
    cy.contains('button', t.join_btn).click();
    cy.dialog(t.join_modal_title).within(() => {
      cy.get('#inviteCodeInput').type('CODICE-SBAGLIATO');
      cy.contains('button', t.join_now).click();
    });
    cy.location('pathname').should('eq', '/join/CODICE-SBAGLIATO');
    cy.contains('h1', 'Invito non valido').should('be.visible');
  });

  it('lascia un gruppo di cui si è membro, dopo conferma', () => {
    const name = uniq('E2E Da lasciare');
    cy.createGroup('marco', name).then(group => {
      cy.joinGroup('admin', group.inviteCode, 'marco');
      cy.reload();

      openCardMenu(name);
      cy.contains('.dropdown-item', t.card_leave).click();
      cy.dialog(t.leave_title).within(() => {
        cy.contains('strong', name);
        cy.contains('button', t.leave_btn).click();
      });

      cy.toast(`Hai lasciato il gruppo "${name}".`).should('be.visible');
      cy.contains('.group-name', name).should('not.exist');
      cy.me('admin').then(me => {
        savedGroup(group.id, g => expect(memberIds(g)).not.to.include(me.id), 'marco');
      });
    });
  });

  it('l\'unico admin non può lasciare il gruppo', () => {
    const name = uniq('E2E Solo admin');
    cy.createGroup('admin', name).then(group => {
      cy.joinGroup('luca', group.inviteCode);
      cy.reload();

      openCardMenu(name);
      cy.contains('.dropdown-item', t.card_leave).click();
      cy.toast('Nomina prima un altro amministratore: sei l\'unico admin del gruppo.').should('be.visible');
      groupCard(name).should('be.visible');
    });
  });

  it('l\'ultimo membro può lasciare il gruppo, che viene eliminato dopo conferma', () => {
    const name = uniq('E2E Ultimo membro');
    cy.createGroup('admin', name).then(group => {
      cy.reload();

      openCardMenu(name);
      cy.contains('.dropdown-item', t.card_leave).click();
      cy.dialog(t.leave_title).within(() => {
        cy.contains(t.leave_last_member_text).should('be.visible');
        cy.contains('button', t.leave_btn).click();
      });

      cy.toast(`Hai lasciato il gruppo "${name}", che è stato eliminato.`).should('be.visible');
      cy.contains('.group-name', name).should('not.exist');
      // Il gruppo non esiste più: nessun membro lo vede.
      cy.apiUntil('admin', '/api/v1/groups', (groups: any[]) =>
        expect(groups.map(g => g.id)).not.to.include(group.id));
    });
  });
});

describe('Gruppi – dettaglio', () => {
  beforeEach(() => cy.login('admin'));

  it('mostra hero e membri del gruppo demo', () => {
    cy.groupByName('admin', GROUPS.esploratori).then(group => {
      cy.visit(`/groups/${group.id}`);
    });
    cy.contains('.group-hero-name', GROUPS.esploratori).should('be.visible');
    cy.contains('.section-title', t.members_title).should('be.visible');
    cy.contains('.member-row', 'Alessandro').find('.you-badge, .you-label').should('exist');
    cy.contains('.member-row', 'Sofia').should('be.visible');
    cy.contains('.member-row', 'Marco').should('be.visible');
  });

  it('mostra i viaggi del gruppo anche aprendo direttamente il link', () => {
    const name = uniq('E2E Viaggi del gruppo');
    cy.createGroup('admin', name).then(group => {
      cy.api('admin', 'POST', '/api/v1/trips', {
        groupId: group.id, title: 'Weekend a Matera', destination: 'Matera', country: 'Italia',
        startDate: '2027-04-10', endDate: '2027-04-12', decision: 'confirmed',
      });
      // Gruppo diverso da quello attivo, aperto da URL: i suoi viaggi vanno caricati comunque.
      cy.visit(`/groups/${group.id}`);
      cy.contains('.group-hero-name', name).should('be.visible');
      cy.contains('.section-title', t.trips_title).should('be.visible');
      cy.contains('.trip-title', 'Weekend a Matera').should('be.visible');
    });
  });

  it('"Vedi tutti" apre la modale con l\'elenco dei membri', () => {
    cy.groupByName('admin', GROUPS.esploratori).then(group => cy.visit(`/groups/${group.id}`));
    cy.contains('.section-title', t.members_title).closest('.section-card').contains('button', t.members_manage).click();
    cy.dialog(t.modal_members_title).within(() => {
      cy.contains('Sofia').should('be.visible');
      cy.contains('Marco').should('be.visible');
    });
  });

  it('la modale "Invita" mostra il codice e copia il messaggio di invito', () => {
    cy.groupByName('admin', GROUPS.esploratori).then(group => {
      cy.visit(`/groups/${group.id}`);
      cy.window().then(win => cy.stub(win.navigator.clipboard, 'writeText').as('copy').resolves());
      cy.contains('button', t.invite_btn).click();
      cy.dialog(t.share_title).within(() => {
        cy.contains(t.share_code_label).should('be.visible');
        cy.get(`button[title="${t.share_copy_message}"]`).click();
      });
      cy.get('@copy').should('have.been.calledWithMatch', group.inviteCode);
      cy.toast('Messaggio copiato negli appunti!').should('be.visible');
    });
  });

  it('"Nuovo viaggio" dal gruppo apre la creazione del viaggio', () => {
    cy.groupByName('admin', GROUPS.esploratori).then(group => cy.visit(`/groups/${group.id}`));
    cy.contains('button', t.new_trip).click();
    cy.location('pathname').should('eq', '/trips/new');
  });

  it('vota e toglie il voto a una proposta', () => {
    const name = uniq('E2E Votazioni');
    cy.createGroup('admin', name).then(group => {
      // 3 membri: servono 2 voti per confermare, quindi il voto di admin non basta.
      cy.joinGroup('sofia', group.inviteCode);
      cy.joinGroup('marco', group.inviteCode);
      cy.api('sofia', 'POST', '/api/v1/trips', {
        groupId: group.id, title: 'Proposta Sardegna', destination: 'Cagliari', country: 'Italia',
        startDate: '2027-08-01', endDate: '2027-08-05', decision: 'proposal', votes: [],
      }).then(proposal => {
        cy.visit(`/groups/${group.id}`);
        cy.contains('.proposals-title', t.proposals_title).should('be.visible');
        cy.contains('.trip-title', 'Proposta Sardegna').parents('article, .trip-card, li, div').first().as('proposal');

        cy.contains('button', t.proposal_vote).click();
        cy.contains('button', t.proposal_unvote).should('be.visible');
        cy.me('admin').then(me => {
          cy.apiUntil('admin', `/api/v1/trips/${proposal.id}`, p => expect(p.votes).to.include(me.id));
        });

        cy.contains('button', t.proposal_unvote).click();
        cy.contains('button', t.proposal_vote).should('be.visible');
        cy.apiUntil('admin', `/api/v1/trips/${proposal.id}`, p => expect(p.votes).to.have.length(0));
      });
    });
  });

  it('un id inesistente mostra "Gruppo non trovato"', () => {
    cy.visit('/groups/gruppo-inesistente');
    cy.contains(t.not_found).should('be.visible');
    cy.contains('a', t.back_to_groups).click();
    cy.location('pathname').should('eq', '/groups');
  });
});

describe('Gruppi – gestione membri', () => {
  beforeEach(() => cy.login('admin'));

  it('l\'admin promuove un membro e poi lo rimuove dal gruppo', () => {
    const name = uniq('E2E Membri');
    cy.createGroup('admin', name).then(group => {
      cy.joinGroup('luca', group.inviteCode);
      cy.visit(`/groups/${group.id}`);

      cy.contains('.member-row', 'Luca').find('.icon-btn-ghost').click();
      cy.contains('.member-menu-item', t.member_add_admin).click();
      cy.toast('Membro promosso ad admin.').should('be.visible');
      cy.contains('.member-row', 'Luca').find('.role-badge').should('exist');
      cy.me('luca').then(luca => {
        savedGroup(group.id, g => expect(g.members.find((m: any) => m.id === luca.id).role).to.eq('admin'));
      });

      cy.contains('.member-row', 'Luca').find('.icon-btn-ghost').click();
      cy.contains('.member-menu-item', t.member_remove).click();
      cy.toast('Membro rimosso dal gruppo.').should('be.visible');
      cy.contains('.member-row', 'Luca').should('not.exist');
      savedGroup(group.id, g => expect(g.members).to.have.length(1));
    });
  });
});

describe('Gruppi – impostazioni', () => {
  let groupId: string;
  let groupName: string;

  beforeEach(() => {
    cy.login('admin');
    groupName = uniq('E2E Impostazioni');
    cy.createGroup('admin', groupName).then(group => {
      groupId = group.id;
      cy.visit(`/groups/${groupId}`);
      cy.get(`a[aria-label="${t.settings_title}"]`).click();
      cy.location('pathname').should('eq', `/groups/${groupId}/settings`);
      cy.contains('h1', t.settings_title).should('be.visible');
    });
  });

  it('cambia la valuta del gruppo', () => {
    cy.get('.settings-select').select('USD');
    cy.toast('Valuta aggiornata.').should('be.visible');
    cy.then(() => savedGroup(groupId, g => expect(g.currency).to.eq('USD')));
  });

  it('silenzia e riattiva le notifiche del gruppo', () => {
    cy.get(`button[role="switch"][aria-label="${t.settings_mute_label}"]`).as('mute');
    cy.get('@mute').should('have.attr', 'aria-checked', 'false').click();
    cy.toast('Gruppo silenziato.').should('be.visible');
    cy.get('@mute').should('have.attr', 'aria-checked', 'true');
    cy.me('admin').then(me => {
      savedGroup(groupId, g => expect(g.mutedBy).to.include(me.id));
    });

    cy.get('@mute').click();
    cy.toast('Notifiche del gruppo riattivate.').should('be.visible');
    cy.then(() => savedGroup(groupId, g => expect(g.mutedBy).to.have.length(0)));
  });

  it('archivia e ripristina il gruppo', () => {
    cy.contains('button', t.settings_archive_btn).click();
    cy.toast('Gruppo archiviato.').should('be.visible');
    cy.contains(t.settings_archived_banner).should('be.visible');
    cy.then(() => savedGroup(groupId, g => expect(g.archived).to.eq(true)));

    cy.visit('/groups');
    cy.contains('.archived-title', t.archived_section).should('be.visible');
    cy.contains('.archived-row .archived-name', groupName).should('be.visible');
    cy.contains('.groups-grid .group-name', groupName).should('not.exist');

    cy.visit(`/groups/${groupId}/settings`);
    cy.contains('button', t.settings_unarchive_btn).click();
    cy.toast('Gruppo ripristinato.').should('be.visible');
    cy.then(() => savedGroup(groupId, g => expect(g.archived).to.eq(false)));
  });

  it('elimina il gruppo solo dopo aver scritto la parola di conferma', () => {
    cy.contains('button', t.danger_delete_btn).click();
    cy.dialog(t.delete_title).within(() => {
      cy.contains('button', t.delete_btn).should('be.disabled');
      cy.get('#delete-confirm-input').type('sbagliato');
      cy.contains('button', t.delete_btn).should('be.disabled');
      cy.get('#delete-confirm-input').clear().type(t.delete_confirm_word);
      cy.contains('button', t.delete_btn).should('be.enabled').click();
    });

    cy.toast(`Gruppo "${groupName}" eliminato.`).should('be.visible');
    cy.location('pathname').should('eq', '/groups');
    cy.contains('.group-name', groupName).should('not.exist');
    cy.then(() =>
      cy.apiToken('admin').then(token =>
        cy.request({ url: `/api/v1/groups/${groupId}`, headers: { Authorization: `Bearer ${token}` }, failOnStatusCode: false })
          .its('status').should('eq', 404),
      ),
    );
  });
});

describe('Gruppi – inviti tramite notifica', () => {
  it('l\'invitato accetta dalla campanella ed entra nel gruppo', () => {
    const name = uniq('E2E Invito');
    cy.createGroup('marco', name).then(group => {
      cy.me('admin').then(admin => {
        cy.api('marco', 'POST', '/api/v1/notifications', {
          type: 'group_invite', recipientId: admin.id, senderName: 'Marco',
          groupId: group.id, groupName: group.name, groupIcon: group.icon, groupColor: group.color,
          createdAt: new Date().toISOString(), read: false, status: 'pending',
        });

        cy.login('admin');
        cy.visit('/groups');
        cy.contains('.group-name', name).should('not.exist');
        cy.get('button[title="Notifiche"]').click();
        cy.contains('header p', name).should('contain.text', 'Marco');
        cy.contains('header button', 'Accetta').click();

        cy.toast(`Ti sei unito al gruppo "${name}"!`).should('be.visible');
        cy.contains('header', '✓ Accettato').should('be.visible');
        cy.contains('.group-name', name).should('be.visible');
        savedGroup(group.id, g => expect(memberIds(g)).to.include(admin.id), 'marco');
      });
    });
  });

  it('l\'invitato può rifiutare', () => {
    const name = uniq('E2E Invito rifiutato');
    cy.createGroup('marco', name).then(group => {
      cy.me('admin').then(admin => {
        cy.api('marco', 'POST', '/api/v1/notifications', {
          type: 'group_invite', recipientId: admin.id, senderName: 'Marco',
          groupId: group.id, groupName: group.name, groupIcon: group.icon, groupColor: group.color,
          createdAt: new Date().toISOString(), read: false, status: 'pending',
        });

        cy.login('admin');
        cy.visit('/groups');
        cy.get('button[title="Notifiche"]').click();
        cy.contains('header p', name).closest('.flex-1').contains('button', 'Rifiuta').click();
        cy.contains('header', '✕ Rifiutato').should('be.visible');
        cy.contains('.group-name', name).should('not.exist');
        savedGroup(group.id, g => expect(g.members).to.have.length(1), 'marco');
      });
    });
  });
});

describe('Gruppi – dettaglio: card Viaggi e Membri allineate (#61)', () => {
  /** Il bordo superiore delle card Viaggi e Membri è alla stessa altezza (tolleranza di 1 px). */
  function expectCardsAligned() {
    cy.get('.group-trips-card').should('be.visible').then($trips => {
      cy.get('.group-members-card').should('be.visible').then($members => {
        const trips = $trips[0].getBoundingClientRect();
        const members = $members[0].getBoundingClientRect();
        expect(members.left, 'Membri a destra di Viaggi').to.be.greaterThan(trips.right);
        expect(Math.abs(members.top - trips.top), 'differenza tra i bordi superiori').to.be.at.most(1);
      });
    });
  }

  it('senza richieste di accesso in attesa le due card partono alla stessa altezza', () => {
    const name = uniq('E2E Allineate');
    cy.createGroup('marco', name).then(group => {
      cy.login('marco');
      cy.visit(`/groups/${group.id}`);
      cy.contains('.group-hero-name', name).should('be.visible');
      cy.contains('.section-title', t.join_requests_title).should('not.exist');
      expectCardsAligned();
    });
  });

  it('con richieste in attesa le richieste stanno sopra la griglia e le card restano allineate', () => {
    const name = uniq('E2E Allineate richieste');
    cy.createGroup('marco', name).then(group => {
      cy.api('luca', 'POST', `/api/v1/groups/invite/${group.inviteCode}/request`);
      cy.api('sofia', 'POST', `/api/v1/groups/invite/${group.inviteCode}/request`);
      cy.login('marco');
      cy.visit(`/groups/${group.id}`);
      cy.contains('.section-title', t.join_requests_title).closest('.section-card').as('requests');
      cy.get('@requests').find('.jr-name').should('have.length', 2);
      expectCardsAligned();

      // Richieste a tutta larghezza, sopra entrambe le card.
      cy.get('@requests').then($req => {
        cy.get('.main-grid').then($grid => {
          const req = $req[0].getBoundingClientRect();
          const grid = $grid[0].getBoundingClientRect();
          expect(req.bottom, 'richieste sopra la griglia').to.be.at.most(grid.top);
          expect(Math.abs(req.width - grid.width), 'richieste larghe quanto la griglia').to.be.at.most(1);
        });
      });

      // Gestita una richiesta (resta l'altra), l'allineamento non cambia.
      cy.get('@requests').contains('.jr-row', 'Luca').contains('button', t.join_requests_approve).click();
      cy.toast('Luca è entrato nel gruppo.').should('be.visible');
      cy.get('.jr-name').should('have.length', 1);
      expectCardsAligned();
    });
  });

  it('su mobile l\'ordine è: richieste di accesso, Viaggi, Membri', () => {
    const name = uniq('E2E Ordine mobile');
    cy.viewport('iphone-x');
    cy.createGroup('marco', name).then(group => {
      cy.api('luca', 'POST', `/api/v1/groups/invite/${group.inviteCode}/request`);
      cy.login('marco');
      cy.visit(`/groups/${group.id}`);
      cy.contains('.section-title', t.join_requests_title).closest('.section-card').then($req => {
        cy.get('.group-trips-card').then($trips => {
          cy.get('.group-members-card').then($members => {
            const req = $req[0].getBoundingClientRect();
            const trips = $trips[0].getBoundingClientRect();
            const members = $members[0].getBoundingClientRect();
            expect(trips.top, 'Viaggi sotto le richieste').to.be.greaterThan(req.bottom);
            expect(members.top, 'Membri sotto Viaggi').to.be.greaterThan(trips.bottom);
          });
        });
      });
    });
  });
});

describe('Gruppi – dettaglio: immagine del gruppo come copertina (#62)', () => {
  /** JPEG quadrato generato nel browser, come le foto salvate prima della copertina (ritaglio 1:1). */
  function squarePhoto(): Cypress.Chainable<string> {
    return cy.window().then(win => {
      const canvas = win.document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 320;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(0, 0, 320, 320);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(110, 110, 100, 100);
      return canvas.toDataURL('image/jpeg', 0.8);
    });
  }

  /** La copertina occupa la parte alta della card, a tutta larghezza; testo e pulsanti stanno sotto. */
  function expectCoverLayout(minHeight: number, maxHeight: number) {
    cy.get('.group-hero').then($card => {
      const card = $card[0].getBoundingClientRect();
      cy.get('.group-hero-cover').should('be.visible').then($cover => {
        const cover = $cover[0].getBoundingClientRect();
        expect(cover.width, 'larghezza copertina').to.be.closeTo(card.width, 3);
        expect(cover.top, 'copertina in cima').to.be.closeTo(card.top, 2);
        expect(cover.height, 'altezza copertina').to.be.within(minHeight, maxHeight);
        cy.get('.group-hero-name').then($name => {
          expect($name[0].getBoundingClientRect().top, 'nome sotto la copertina').to.be.gte(cover.bottom);
        });
        cy.get('.hero-actions').then($actions => {
          expect($actions[0].getBoundingClientRect().top, 'pulsanti sotto la copertina').to.be.gte(cover.bottom);
        });
      });
    });
  }

  it('con la foto: copertina larga con ritaglio centrale anche per le foto quadrate già salvate', () => {
    const name = uniq('E2E Copertina foto');
    squarePhoto().then(photo => {
      cy.createGroup('marco', name, { icon: photo }).then(group => {
        cy.login('marco');
        cy.visit(`/groups/${group.id}`);
        cy.get('.group-hero-cover').should('have.class', 'group-hero-cover--image');
        cy.get('.group-hero-cover img.group-hero-img')
          .should('have.attr', 'src', photo)
          .and('have.css', 'object-fit', 'cover')
          .and($img => expect(($img[0] as HTMLImageElement).naturalWidth).to.eq(320));
        expectCoverLayout(200, 260);
        cy.contains('.group-hero-name', name).should('be.visible');
        cy.contains('.hero-actions button', t.edit_btn).should('be.visible');
        cy.contains('.hero-actions button', t.invite_btn).should('be.visible');
        cy.get('.group-hero-emoji').should('not.exist');
      });
    });
  });

  it('senza foto: copertina nel colore del gruppo con l\'emoji grande al centro', () => {
    const name = uniq('E2E Copertina emoji');
    cy.createGroup('marco', name, { icon: '🏖️', color: '#10b981' }).then(group => {
      cy.login('marco');
      cy.visit(`/groups/${group.id}`);
      cy.get('.group-hero-cover').should('not.have.class', 'group-hero-cover--image')
        .and('have.css', 'background-image').and('contain', 'linear-gradient').and('contain', 'rgb(16, 185, 129)');
      cy.get('.group-hero-img').should('not.exist');
      cy.contains('.group-hero-emoji', '🏖️').should('be.visible').then($emoji => {
        cy.get('.group-hero-cover').then($cover => {
          const e = $emoji[0].getBoundingClientRect();
          const c = $cover[0].getBoundingClientRect();
          expect(parseFloat(getComputedStyle($emoji[0]).fontSize), 'emoji grande').to.be.at.least(64);
          expect(e.left + e.width / 2, 'emoji centrata').to.be.closeTo(c.left + c.width / 2, 4);
          expect(e.top + e.height / 2, 'emoji centrata').to.be.closeTo(c.top + c.height / 2, 4);
        });
      });
      expectCoverLayout(200, 260);
    });
  });

  it('su mobile la copertina è più bassa e i pulsanti stanno su una riga sotto il testo', () => {
    const name = uniq('E2E Copertina mobile');
    cy.viewport('iphone-x');
    squarePhoto().then(photo => {
      cy.createGroup('marco', name, { icon: photo, description: 'Una descrizione abbastanza lunga da andare a capo su telefono' })
        .then(group => {
          cy.login('marco');
          cy.visit(`/groups/${group.id}`);
          expectCoverLayout(160, 180);
          cy.get('.group-hero-info').then($info => {
            cy.get('.hero-actions').then($actions => {
              expect($actions[0].getBoundingClientRect().top).to.be.gte($info[0].getBoundingClientRect().bottom);
            });
          });
          // Niente scorrimento orizzontale della pagina.
          cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth));
        });
    });
  });
});
