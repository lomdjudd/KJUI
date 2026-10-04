package io.github.lomdjudd.hulkironman.client;

import io.github.lomdjudd.hulkironman.hero.HeroForm;
import io.github.lomdjudd.hulkironman.network.HeroSyncPayload;

/** Ce que le client sait de son propre héros (reçu du serveur). */
public final class ClientHeroData {
    public static HeroForm form = HeroForm.NONE;
    public static float resource;
    public static float[] cooldowns = new float[5];
    public static int rageTicks;

    public static float shakeIntensity;
    public static int shakeTicks;
    public static int shakeMax = 1;

    public static void apply(HeroSyncPayload p) {
        form = HeroForm.byId(p.form());
        resource = p.resource();
        cooldowns = p.cooldowns().length >= 5 ? p.cooldowns() : new float[5];
        rageTicks = p.rageTicks();
    }

    public static void shake(float intensity, int ticks) {
        if (intensity * ticks >= shakeIntensity * shakeTicks) {
            shakeIntensity = Math.min(3F, intensity);
            shakeTicks = ticks;
            shakeMax = Math.max(1, ticks);
        }
    }

    public static void reset() {
        form = HeroForm.NONE;
        resource = 0;
        cooldowns = new float[5];
        rageTicks = 0;
        shakeTicks = 0;
    }

    private ClientHeroData() {
    }
}
