import i18n from '../../public/i18n/it.json';
import { uniq } from '../support/e2e';
import { GROUPS, TRIPS } from '../support/users';

const t = i18n.groups;

const groupCard = (name: string) => cy.contains('.group-card .group-name', name).closest('.group-card');

function openCardMenu(name: string) {
  groupCard(name).find('.card-menu-btn').click();
}

/** Attende che il gruppo salvato sul backend soddisfi `assert`. */
function savedGroup(id: string, assert: (group: any) => void) {
  return cy.apiUntil('admin', `/api/v1/groups/${id}`, assert);
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

  it('entra in un gruppo con il codice invito', () => {
    const name = uniq('E2E Gruppo di Marco');
    cy.createGroup('marco', name).then(group => {
      cy.contains('button', t.join_btn).click();
      cy.dialog(t.join_modal_title).within(() => {
        cy.contains('button', t.join_now).should('be.disabled');
        cy.get('#inviteCodeInput').type(group.inviteCode);
        cy.contains('button', t.join_now).click();
      });

      cy.toast(`Ti sei unito al gruppo "${name}"!`).should('be.visible');
      groupCard(name).should('be.visible');
      cy.me('admin').then(me => {
        savedGroup(group.id, g => expect(memberIds(g)).to.include(me.id));
      });
    });
  });

  it('un codice invito errato mostra un errore', () => {
    cy.contains('button', t.join_btn).click();
    cy.dialog(t.join_modal_title).within(() => {
      cy.get('#inviteCodeInput').type('CODICE-SBAGLIATO');
      cy.contains('button', t.join_now).click();
    });
    cy.get('.toast-item.toast-error').should('be.visible');
  });

  it('lascia un gruppo di cui si è membro, dopo conferma', () => {
    const name = uniq('E2E Da lasciare');
    cy.createGroup('marco', name).then(group => {
      cy.joinGroup('admin', group.inviteCode);
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
        savedGroup(group.id, g => expect(memberIds(g)).not.to.include(me.id));
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
      cy.toast('Non puoi uscire dal gruppo finché non assegni un altro admin.').should('be.visible');
      groupCard(name).should('be.visible');
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
        savedGroup(group.id, g => expect(memberIds(g)).to.include(admin.id));
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
        savedGroup(group.id, g => expect(g.members).to.have.length(1));
      });
    });
  });
});
