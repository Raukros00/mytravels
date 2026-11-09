package com.example.tripplanner.service;

import com.example.tripplanner.model.PushCategory;
import com.example.tripplanner.model.PushPreferences;
import com.example.tripplanner.model.PushSubscription;
import com.example.tripplanner.repository.PushPreferencesRepository;
import com.example.tripplanner.repository.PushSubscriptionRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zerodeplibs.webpush.VAPIDKeyPair;
import com.zerodeplibs.webpush.VAPIDKeyPairs;
import com.zerodeplibs.webpush.httpclient.StandardHttpClientRequestPreparer;
import com.zerodeplibs.webpush.key.PrivateKeySources;
import com.zerodeplibs.webpush.key.PublicKeySources;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigInteger;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.AlgorithmParameters;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.Signature;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;

/**
 * Notifiche Web Push (RFC 8030) cifrate con aes128gcm (RFC 8291) e firmate con VAPID (RFC 8292).
 *
 * Le chiavi VAPID arrivano da PUSH_VAPID_PUBLIC_KEY / PUSH_VAPID_PRIVATE_KEY (base64url, formato di
 * `npx web-push generate-vapid-keys`) e PUSH_VAPID_SUBJECT (mailto: o https:). Se mancano o non sono
 * valide le push sono disattivate: l'app funziona come prima e gli invii vengono ignorati.
 *
 * Gli invii sono asincroni (pool dedicato) e, se chiamati dentro una transazione, partono solo
 * dopo il commit. Gli invii con una categoria (#97) rispettano le preferenze di ciascun destinatario:
 * chi ha disattivato la categoria non riceve nulla (il silenziamento dei gruppi lo applica GroupPushNotifier). Su 404/410 il push service dice che l'abbonamento non esiste più: viene cancellato.
 */
@Service
public class PushService {

    /** Contenuto di una notifica: `url` è il percorso dell'app da aprire al tocco, `tag` raggruppa le ripetizioni. */
    public record PushMessage(String title, String body, String url, String tag) {}

    private static final Logger log = LoggerFactory.getLogger(PushService.class);
    private static final String ICON = "/icons/icon-192x192.png";
    private static final String BADGE = "/icons/icon-96x96.png";
    private static final int MAX_DEVICES_PER_USER = 10;

    private final PushSubscriptionRepository repository;
    private final PushPreferencesRepository preferencesRepository;
    private final ObjectMapper objectMapper;
    private final String publicKey;
    private final String subject;
    private final VAPIDKeyPair keyPair;
    private final boolean allowInsecureEndpoints;
    private final long ttlSeconds;
    private final HttpClient http;
    private final ThreadPoolExecutor executor;

    public PushService(PushSubscriptionRepository repository,
                       PushPreferencesRepository preferencesRepository,
                       ObjectMapper objectMapper,
                       @Value("${push.vapid.public-key:}") String publicKey,
                       @Value("${push.vapid.private-key:}") String privateKey,
                       @Value("${push.vapid.subject:}") String subject,
                       @Value("${push.allow-insecure-endpoints:false}") boolean allowInsecureEndpoints,
                       @Value("${push.ttl-seconds:86400}") long ttlSeconds) {
        this.repository = repository;
        this.preferencesRepository = preferencesRepository;
        this.objectMapper = objectMapper;
        this.allowInsecureEndpoints = allowInsecureEndpoints;
        this.ttlSeconds = ttlSeconds;
        this.subject = subject == null ? "" : subject.trim();
        String pub = publicKey == null ? "" : publicKey.trim();
        String priv = privateKey == null ? "" : privateKey.trim();

        VAPIDKeyPair pair = null;
        if (pub.isEmpty() || priv.isEmpty() || this.subject.isEmpty()) {
            log.info("Notifiche push disattivate: PUSH_VAPID_PUBLIC_KEY, PUSH_VAPID_PRIVATE_KEY e PUSH_VAPID_SUBJECT non sono tutte impostate.");
        } else if (!this.subject.startsWith("mailto:") && !this.subject.startsWith("https://")) {
            log.warn("Notifiche push disattivate: PUSH_VAPID_SUBJECT deve iniziare con 'mailto:' o 'https://'.");
        } else {
            try {
                pair = loadKeyPair(pub, priv);
            } catch (Exception e) {
                log.warn("Notifiche push disattivate: chiavi VAPID non valide ({}).", e.getMessage());
            }
        }
        this.keyPair = pair;
        this.publicKey = pair == null ? null : pub;
        if (pair != null) log.info("Notifiche push attive (VAPID subject {}).", this.subject);

        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        AtomicInteger n = new AtomicInteger();
        this.executor = new ThreadPoolExecutor(2, 2, 60, TimeUnit.SECONDS, new ArrayBlockingQueue<>(1000), r -> {
            Thread t = new Thread(r, "push-" + n.incrementAndGet());
            t.setDaemon(true);
            return t;
        }, (r, ex) -> log.warn("Coda delle notifiche push piena: invio scartato."));
        this.executor.allowCoreThreadTimeOut(true);
    }

    @PreDestroy
    void shutdown() {
        executor.shutdown();
    }

    public boolean isEnabled() {
        return keyPair != null;
    }

    /** Chiave pubblica VAPID (base64url) da passare a PushManager.subscribe; null se disattivate. */
    public String publicKey() {
        return publicKey;
    }

    // ---------------------------------------------------------------- abbonamenti

    public List<PushSubscription> subscriptionsOf(String userId) {
        return repository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    /**
     * Salva o aggiorna l'abbonamento del dispositivo. Se l'endpoint era di un altro utente (stesso
     * dispositivo, account diverso), passa all'utente corrente. Al massimo 10 dispositivi per utente.
     */
    public synchronized PushSubscription subscribe(String userId, String endpoint, String p256dh, String auth,
                                                   String userAgent, String lang) {
        PushSubscription sub = repository.findByEndpoint(endpoint).orElseGet(() -> PushSubscription.builder()
                .endpoint(endpoint)
                .createdAt(Instant.now())
                .build());
        sub.setUserId(userId);
        sub.setP256dh(p256dh);
        sub.setAuth(auth);
        sub.setUserAgent(userAgent == null ? null : userAgent.substring(0, Math.min(userAgent.length(), 512)));
        sub.setLang(lang);
        PushSubscription saved = repository.save(sub);

        List<PushSubscription> all = repository.findByUserIdOrderByCreatedAtDesc(userId);
        for (int i = MAX_DEVICES_PER_USER; i < all.size(); i++) repository.deleteId(all.get(i).getId());
        return saved;
    }

    /** Rimuove l'abbonamento, solo se appartiene all'utente. */
    public boolean unsubscribe(String userId, String endpoint) {
        return repository.deleteOwn(endpoint, userId) > 0;
    }

    /** null se valido, altrimenti il motivo (per la risposta 400). */
    public String validate(String endpoint, String p256dh, String auth) {
        if (endpoint == null || endpoint.isBlank() || endpoint.length() > 2048) return "Endpoint non valido.";
        try {
            URI uri = URI.create(endpoint);
            String scheme = uri.getScheme();
            boolean ok = "https".equals(scheme) || (allowInsecureEndpoints && "http".equals(scheme));
            if (!ok || uri.getHost() == null) return "Endpoint non valido.";
        } catch (IllegalArgumentException e) {
            return "Endpoint non valido.";
        }
        byte[] key = decode(p256dh);
        if (key == null || key.length != 65 || key[0] != 0x04) return "Chiave p256dh non valida.";
        byte[] secret = decode(auth);
        if (secret == null || secret.length != 16) return "Segreto auth non valido.";
        return null;
    }

    // ---------------------------------------------------------------- preferenze (#97)

    /** Preferenze dell'utente (i valori predefiniti se non le ha mai cambiate). */
    public PushPreferences preferencesOf(String userId) {
        return preferencesRepository.findById(userId).orElseGet(() -> PushPreferences.defaults(userId));
    }

    /** Aggiorna solo le categorie presenti (null = invariata). */
    public PushPreferences updatePreferences(String userId, Boolean invites, Boolean proposals, Boolean newMembers, Boolean reminders,
                                             Boolean liveGuide) {
        PushPreferences prefs = preferencesOf(userId);
        if (invites != null) prefs.setInvites(invites);
        if (proposals != null) prefs.setProposals(proposals);
        if (newMembers != null) prefs.setNewMembers(newMembers);
        if (reminders != null) prefs.setReminders(reminders);
        if (liveGuide != null) prefs.setLiveGuide(liveGuide);
        prefs.setUpdatedAt(Instant.now());
        return preferencesRepository.save(prefs);
    }

    /** Gli utenti, tra quelli indicati, che vogliono le push della categoria. */
    public List<String> acceptingUsers(Collection<String> userIds, PushCategory category) {
        if (userIds.isEmpty()) return List.of();
        Map<String, PushPreferences> saved = preferencesRepository.findByUserIdIn(Set.copyOf(userIds)).stream()
                .collect(Collectors.toMap(PushPreferences::getUserId, p -> p));
        return userIds.stream()
                .filter(id -> saved.getOrDefault(id, PushPreferences.defaults(id)).allows(category))
                .toList();
    }

    // ---------------------------------------------------------------- invio

    /** Invia la notifica a tutti i dispositivi dell'utente (asincrono, dopo il commit se in transazione). */
    public void sendToUser(String userId, PushMessage message) {
        sendToUser(userId, lang -> message);
    }

    /** Come sopra, con il testo nella lingua di ciascun dispositivo ('it', 'en' o null). */
    public void sendToUser(String userId, Function<String, PushMessage> messageForLang) {
        sendToUsers(userId == null ? List.of() : List.of(userId), messageForLang);
    }

    public void sendToUsers(Collection<String> userIds, Function<String, PushMessage> messageForLang) {
        sendToUsers(userIds, null, messageForLang);
    }

    /**
     * Invio di una notifica di una categoria: solo agli utenti che non l'hanno disattivata nelle
     * preferenze (lette al momento dell'invio). Categoria null = sempre (es. notifica di prova).
     */
    public void sendToUsers(Collection<String> userIds, PushCategory category, Function<String, PushMessage> messageForLang) {
        if (!isEnabled() || userIds == null || userIds.isEmpty()) return;
        List<String> ids = List.copyOf(userIds);
        Runnable task = () -> executor.execute(() -> {
            List<String> targets;
            try {
                targets = category == null ? ids : acceptingUsers(ids, category);
            } catch (Exception e) {
                log.warn("Notifiche push: lettura preferenze non riuscita: {}", e.getMessage());
                return;
            }
            targets.forEach(id -> deliver(id, messageForLang));
        });
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    task.run();
                }
            });
        } else {
            task.run();
        }
    }

    private void deliver(String userId, Function<String, PushMessage> messageForLang) {
        List<PushSubscription> subs;
        try {
            subs = repository.findByUserIdOrderByCreatedAtDesc(userId);
        } catch (Exception e) {
            log.warn("Notifiche push: lettura abbonamenti non riuscita: {}", e.getMessage());
            return;
        }
        for (PushSubscription sub : subs) {
            PushMessage message = messageForLang.apply(sub.getLang());
            if (message == null) continue;
            try {
                HttpResponse<String> res = http.send(buildRequest(sub, message), HttpResponse.BodyHandlers.ofString());
                int status = res.statusCode();
                if (status == 404 || status == 410) {
                    repository.deleteId(sub.getId());
                    log.info("Abbonamento push scaduto rimosso (HTTP {}).", status);
                } else if (status >= 200 && status < 300) {
                    repository.touch(sub.getId(), Instant.now());
                } else {
                    String body = res.body() == null ? "" : res.body();
                    log.warn("Invio push non riuscito (HTTP {}): {}", status, body.substring(0, Math.min(body.length(), 200)));
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            } catch (Exception e) {
                log.warn("Invio push non riuscito: {}", e.getMessage());
            }
        }
    }

    private HttpRequest buildRequest(PushSubscription sub, PushMessage message) throws JsonProcessingException {
        com.zerodeplibs.webpush.PushSubscription target = new com.zerodeplibs.webpush.PushSubscription();
        target.setEndpoint(sub.getEndpoint());
        com.zerodeplibs.webpush.PushSubscription.Keys keys = new com.zerodeplibs.webpush.PushSubscription.Keys();
        keys.setP256dh(sub.getP256dh());
        keys.setAuth(sub.getAuth());
        target.setKeys(keys);

        var builder = StandardHttpClientRequestPreparer.getBuilder()
                .pushSubscription(target)
                .vapidJWTSubject(subject)
                .vapidJWTExpiresAfter(12, TimeUnit.HOURS)
                .pushMessage(objectMapper.writeValueAsString(payload(message)))
                .ttl(ttlSeconds, TimeUnit.SECONDS)
                .urgencyNormal();
        if (message.tag() != null && !message.tag().isBlank()) builder.topic(topic(message.tag()));
        return builder.build(keyPair).toRequestBuilder().timeout(Duration.ofSeconds(10)).build();
    }

    /**
     * Formato letto dal service worker di Angular (ngsw): `notification` viene mostrata così com'è e
     * `data.onActionClick.default` apre (o porta in primo piano) l'app sulla pagina indicata.
     */
    Map<String, Object> payload(PushMessage message) {
        String url = message.url() == null || message.url().isBlank() ? "/" : message.url();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("url", url);
        data.put("onActionClick", Map.of("default", Map.of("operation", "navigateLastFocusedOrOpen", "url", url)));
        Map<String, Object> notification = new LinkedHashMap<>();
        notification.put("title", message.title());
        notification.put("body", message.body());
        notification.put("icon", ICON);
        notification.put("badge", BADGE);
        if (message.tag() != null && !message.tag().isBlank()) {
            notification.put("tag", message.tag());
            notification.put("renotify", true);
        }
        notification.put("data", data);
        return Map.of("notification", notification);
    }

    /** Header Topic: al massimo 32 caratteri base64url; un nuovo messaggio con lo stesso topic sostituisce quello in coda. */
    private static String topic(String tag) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(tag.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(Arrays.copyOf(hash, 24));
        } catch (Exception e) {
            return "wanderbite";
        }
    }

    // ---------------------------------------------------------------- chiavi

    private static VAPIDKeyPair loadKeyPair(String pub, String priv) throws Exception {
        byte[] pubBytes = decode(pub);
        byte[] privBytes = decode(priv);
        if (pubBytes == null || pubBytes.length != 65 || pubBytes[0] != 0x04) {
            throw new IllegalArgumentException("la chiave pubblica deve essere un punto P-256 non compresso in base64url");
        }
        if (privBytes == null || privBytes.length != 32) {
            throw new IllegalArgumentException("la chiave privata deve essere di 32 byte in base64url");
        }
        AlgorithmParameters params = AlgorithmParameters.getInstance("EC");
        params.init(new ECGenParameterSpec("secp256r1"));
        ECParameterSpec spec = params.getParameterSpec(ECParameterSpec.class);
        KeyFactory kf = KeyFactory.getInstance("EC");
        ECPrivateKey privateKey = (ECPrivateKey) kf.generatePrivate(new ECPrivateKeySpec(new BigInteger(1, privBytes), spec));
        ECPublicKey publicKey = (ECPublicKey) kf.generatePublic(new ECPublicKeySpec(new ECPoint(
                new BigInteger(1, Arrays.copyOfRange(pubBytes, 1, 33)),
                new BigInteger(1, Arrays.copyOfRange(pubBytes, 33, 65))), spec));

        // Le due chiavi devono essere della stessa coppia: altrimenti i push service rifiuterebbero ogni invio.
        byte[] probe = "wanderbite".getBytes(StandardCharsets.UTF_8);
        Signature signer = Signature.getInstance("SHA256withECDSA");
        signer.initSign(privateKey);
        signer.update(probe);
        byte[] signature = signer.sign();
        Signature verifier = Signature.getInstance("SHA256withECDSA");
        verifier.initVerify(publicKey);
        verifier.update(probe);
        if (!verifier.verify(signature)) throw new IllegalArgumentException("chiave pubblica e privata non corrispondono");

        return VAPIDKeyPairs.of(PrivateKeySources.ofECPrivateKey(privateKey), PublicKeySources.ofUncompressedBytes(pubBytes));
    }

    private static byte[] decode(String base64url) {
        if (base64url == null || base64url.isBlank()) return null;
        try {
            String clean = base64url.trim().replace('+', '-').replace('/', '_').replace("=", "");
            return Base64.getUrlDecoder().decode(clean);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
