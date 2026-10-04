package io.github.lomdjudd.hulkironman.hero;

import java.util.Arrays;

/** État temporaire d'un héros côté serveur (non sauvegardé). */
public final class HeroState {
    public HeroForm form = HeroForm.NONE;
    /** Rage (Hulk) ou énergie du réacteur (Iron Man), de 0 à 100. */
    public float resource;
    /** Recharges en ticks, index 1 à 4 = pouvoirs. */
    public final float[] cooldown = new float[6];
    public final int[] cooldownMax = new int[6];
    public int rageTicks;
    public int combatTicks;

    // Hulk : saut / écrasement en cours
    public boolean leaping;
    public boolean smashing;
    public int actionTicks;
    public int airTicks;
    public double peakY;

    // Iron Man
    public int unibeamTicks;
    public boolean rightHand;

    /** Pendant une action longue (unirayon), les autres pouvoirs sont bloqués. */
    public int busyTicks;
    public boolean hasHeart;
    public int syncTimer;
    public boolean dirty;
    public HeroForm lastForm = HeroForm.NONE;

    public void reset(HeroForm newForm) {
        form = newForm;
        resource = newForm == HeroForm.IRONMAN ? 100F : 25F;
        Arrays.fill(cooldown, 0F);
        Arrays.fill(cooldownMax, 1);
        rageTicks = 0;
        combatTicks = 0;
        leaping = false;
        smashing = false;
        unibeamTicks = 0;
        busyTicks = 0;
        dirty = true;
        if (newForm != HeroForm.NONE) lastForm = newForm;
    }
}
