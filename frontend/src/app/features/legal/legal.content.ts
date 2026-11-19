export type LegalDocKey = 'privacy' | 'termini' | 'cookie';

export interface LegalSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: { label: string; text: string }[];
}

export interface LegalDoc {
  key: LegalDocKey;
  title: string;
  headline: string;
  lead: string;
  highlights: { label: string; text: string }[];
  sections: LegalSection[];
}

/** Versione e data dei testi legali: da aggiornare ogni volta che un testo cambia. */
export const LEGAL_VERSION = '0.1 (bozza)';
export const LEGAL_UPDATED = '19 novembre 2026';

/**
 * Segnaposto per i dati che il team deve ancora definire (titolare, contatti, tempi di conservazione).
 * Vanno sostituiti prima della pubblicazione: vedi epica #167.
 */
const TODO = (what: string) => `[${what} — da definire]`;

export const LEGAL_DOCS: Record<LegalDocKey, LegalDoc> = {
  privacy: {
    key: 'privacy',
    title: 'Informativa sulla privacy',
    headline: 'I tuoi dati, in parole semplici',
    lead: 'Ti spieghiamo quali dati raccoglie WanderBite, perché, con chi li condividiamo e come puoi esercitare i tuoi diritti.',
    highlights: [
      { label: 'Solo il necessario', text: 'usiamo i tuoi dati per pianificare viaggi di gruppo, dividere le spese e farti ritrovare i tuoi itinerari.' },
      { label: 'Tra compagni di viaggio', text: 'i contenuti di un viaggio sono visibili ai membri del gruppo a cui appartiene.' },
      { label: 'Nessuna pubblicità', text: 'non usiamo strumenti di profilazione o di analisi del comportamento.' }
    ],
    sections: [
      {
        id: 'titolare',
        title: 'Titolare del trattamento',
        paragraphs: [
          `Il titolare del trattamento è ${TODO('ragione sociale o nome del titolare')}, con sede in ${TODO('indirizzo')}.`,
          `Puoi contattarci all'indirizzo ${TODO('email di contatto per la privacy')}.`
        ]
      },
      {
        id: 'dati',
        title: 'Dati che raccogliamo',
        paragraphs: ["Raccogliamo i dati che inserisci tu, direttamente nell'app:"],
        bullets: [
          { label: 'Dati del profilo', text: 'nome, cognome, email, data di nascita, foto o avatar, password (conservata in forma cifrata).' },
          { label: 'Contenuti dei viaggi', text: 'viaggi, giornate, attività, ristoranti, alloggi e note che aggiungi o voti.' },
          { label: 'Spese condivise', text: 'importi, categorie e ripartizione tra i membri del gruppo.' },
          { label: 'Gruppi e inviti', text: 'gruppi di cui fai parte, ruolo e codici di invito.' }
        ]
      },
      {
        id: 'finalita',
        title: 'Perché usiamo i tuoi dati',
        paragraphs: [
          'Usiamo i dati per creare e gestire il tuo account, farti partecipare a gruppi e viaggi, calcolare le quote delle spese e inviarti le notifiche che hai attivato.',
          `La base giuridica è l'esecuzione del servizio che hai richiesto registrandoti. ${TODO('eventuali altre basi giuridiche')}`
        ]
      },
      {
        id: 'condivisione',
        title: 'Con chi condividiamo i dati',
        paragraphs: [
          "I contenuti di un viaggio sono visibili agli altri membri del gruppo. Il nome e la foto del profilo possono essere visibili ad altri utenti dell'app, ad esempio nei gruppi e quando vieni invitato.",
          `Per far funzionare il servizio ci affidiamo a fornitori tecnici (hosting, invio email): ${TODO('elenco fornitori e Paese in cui sono trattati i dati')}.`
        ]
      },
      {
        id: 'conservazione',
        title: 'Per quanto tempo li conserviamo',
        paragraphs: [
          `Conserviamo i dati finché il tuo account è attivo. ${TODO('tempi di conservazione dopo la cancellazione dell\'account e per i viaggi conclusi')}`
        ]
      },
      {
        id: 'diritti',
        title: 'I tuoi diritti',
        paragraphs: [
          'Ai sensi degli articoli 15-22 del Regolamento UE 2016/679 (GDPR) puoi chiedere in qualsiasi momento:'
        ],
        bullets: [
          { label: 'Accesso', text: 'ottenere una copia dei tuoi dati.' },
          { label: 'Rettifica', text: 'correggere i dati inesatti o incompleti.' },
          { label: 'Cancellazione', text: "eliminare il tuo account e i tuoi dati direttamente dal Profilo, oppure chiederlo a noi." },
          { label: 'Portabilità e opposizione', text: 'scaricare i tuoi dati dal Profilo e opporti a un trattamento.' }
        ]
      },
      {
        id: 'cookie',
        title: 'Cookie e archiviazione locale',
        paragraphs: [
          'WanderBite salva sul tuo dispositivo solo le informazioni necessarie al funzionamento (sessione, lingua, tema). Trovi il dettaglio nella pagina dedicata ai cookie.'
        ]
      },
      {
        id: 'contatti',
        title: 'Contatti e reclami',
        paragraphs: [
          `Per esercitare i tuoi diritti scrivi a ${TODO('email di contatto per la privacy')}.`,
          'Se ritieni che il trattamento violi la normativa, puoi presentare reclamo al Garante per la protezione dei dati personali (garanteprivacy.it).'
        ]
      }
    ]
  },

  termini: {
    key: 'termini',
    title: "Termini d'uso",
    headline: "Le regole per viaggiare insieme",
    lead: "Le condizioni con cui puoi usare WanderBite per organizzare viaggi con i tuoi amici.",
    highlights: [
      { label: 'Account personale', text: 'ogni persona usa il proprio account e ne custodisce le credenziali.' },
      { label: 'Rispetto del gruppo', text: 'i contenuti che inserisci devono rispettare le persone e la legge.' }
    ],
    sections: [
      {
        id: 'servizio',
        title: 'Il servizio',
        paragraphs: [
          `WanderBite permette di pianificare viaggi di gruppo, votare tappe e ristoranti e dividere le spese. ${TODO('testo completo dei termini d\'uso')}`
        ]
      },
      {
        id: 'account',
        title: 'Account e responsabilità',
        paragraphs: [
          `${TODO('regole su account, contenuti degli utenti, limiti di responsabilità, modifiche al servizio e legge applicabile')}`
        ]
      }
    ]
  },

  cookie: {
    key: 'cookie',
    title: 'Informativa sui cookie',
    headline: 'Solo ciò che serve',
    lead: "Cosa salviamo sul tuo dispositivo mentre usi WanderBite, e perché.",
    highlights: [
      { label: 'Nessun tracciamento', text: 'non usiamo cookie di profilazione, pubblicità o analisi di terze parti.' },
      { label: 'Solo funzionali', text: 'salviamo informazioni tecniche necessarie al funzionamento e alle tue preferenze.' }
    ],
    sections: [
      {
        id: 'archiviazione',
        title: 'Archiviazione locale',
        paragraphs: ['WanderBite usa lo spazio di archiviazione del browser (localStorage) per:'],
        bullets: [
          { label: 'Sessione', text: "mantenere l'accesso al tuo account (token di autenticazione)." },
          { label: 'Lingua', text: "ricordare la lingua dell'app che hai scelto." },
          { label: 'Tema', text: 'ricordare la palette colori che hai scelto.' },
          { label: 'Notifiche', text: "conservare le notifiche dell'app sul tuo dispositivo." }
        ]
      },
      {
        id: 'gestione',
        title: 'Come gestirli',
        paragraphs: [
          "Puoi cancellare questi dati in qualsiasi momento dalle impostazioni del browser. Se lo fai, dovrai accedere di nuovo e reimpostare le tue preferenze."
        ]
      }
    ]
  }
};
