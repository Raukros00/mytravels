package com.example.tripplanner.ratelimit;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Limite di tentativi in memoria, per chiave (email, IP...), a finestra fissa: la finestra parte dal primo
 * tentativo registrato e, raggiunti {@code maxAttempts}, la chiave resta bloccata fino al suo scadere.
 * Basta una mappa in memoria perché il backend gira in una sola istanza (#65).
 */
public class AttemptLimiter {

    private record Window(Instant start, int count) {}

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final AtomicInteger writes = new AtomicInteger();
    private final Clock clock;
    private volatile int maxAttempts;
    private volatile Duration window;

    public AttemptLimiter(int maxAttempts, Duration window, Clock clock) {
        this.clock = clock;
        configure(maxAttempts, window);
    }

    public final void configure(int maxAttempts, Duration window) {
        if (maxAttempts < 1) throw new IllegalArgumentException("maxAttempts deve essere almeno 1");
        if (window == null || window.isNegative() || window.isZero()) throw new IllegalArgumentException("finestra non valida");
        this.maxAttempts = maxAttempts;
        this.window = window;
    }

    /** Secondi di attesa se la chiave è bloccata, altrimenti 0. */
    public long retryAfterSeconds(String key) {
        if (key == null) return 0;
        Window w = windows.get(key);
        if (w == null || w.count() < maxAttempts) return 0;
        Duration left = Duration.between(clock.instant(), w.start().plus(window));
        if (left.isNegative() || left.isZero()) return 0;
        return Math.max(1, (left.toMillis() + 999) / 1000);
    }

    /** Registra un tentativo (fallito, o comunque da contare) per la chiave. */
    public void record(String key) {
        if (key == null) return;
        Instant now = clock.instant();
        windows.compute(key, (k, w) ->
                w == null || expired(w, now) ? new Window(now, 1) : new Window(w.start(), w.count() + 1));
        if (writes.incrementAndGet() % 256 == 0) purgeExpired();
    }

    /** Azzera il conteggio della chiave (es. dopo un login riuscito). */
    public void reset(String key) {
        if (key != null) windows.remove(key);
    }

    public void resetAll() {
        windows.clear();
    }

    private boolean expired(Window w, Instant now) {
        return !now.isBefore(w.start().plus(window));
    }

    /** Toglie le finestre scadute, così la mappa non cresce senza limite. */
    private void purgeExpired() {
        Instant now = clock.instant();
        windows.entrySet().removeIf(e -> expired(e.getValue(), now));
    }
}
