package io.github.lomdjudd.hulkironman.hero;

import io.github.lomdjudd.hulkironman.HulkIronMan;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.function.IntConsumer;

/** Petit planificateur de tâches côté serveur (ondes qui s'étendent, salves, cinématiques). */
public final class Scheduler {
    private static final List<Entry> TASKS = new ArrayList<>();
    private static final List<Entry> PENDING = new ArrayList<>();
    public static int errors;

    private static final class Entry {
        final int delay;
        final int duration;
        final IntConsumer step;
        int age;

        Entry(int delay, int duration, IntConsumer step) {
            this.delay = delay;
            this.duration = duration;
            this.step = step;
        }
    }

    /** Appelle {@code step(i)} à chaque tick pendant {@code ticks} ticks (i = 0, 1, 2…). */
    public static void repeat(int ticks, IntConsumer step) {
        PENDING.add(new Entry(0, ticks, step));
    }

    /** Exécute {@code action} dans {@code delay} ticks. */
    public static void later(int delay, Runnable action) {
        PENDING.add(new Entry(delay, 1, i -> action.run()));
    }

    public static void tick() {
        if (!PENDING.isEmpty()) {
            TASKS.addAll(PENDING);
            PENDING.clear();
        }
        Iterator<Entry> it = TASKS.iterator();
        while (it.hasNext()) {
            Entry e = it.next();
            int i = e.age++ - e.delay;
            if (i < 0) continue;
            try {
                e.step.accept(i);
            } catch (Exception ex) {
                errors++;
                HulkIronMan.LOGGER.error("Erreur dans une tâche planifiée", ex);
                it.remove();
                continue;
            }
            if (i + 1 >= e.duration) it.remove();
        }
    }

    public static void clear() {
        TASKS.clear();
        PENDING.clear();
    }

    private Scheduler() {
    }
}
