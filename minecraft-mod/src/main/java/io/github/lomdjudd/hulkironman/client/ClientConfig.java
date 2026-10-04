package io.github.lomdjudd.hulkironman.client;

import net.minecraft.client.Minecraft;

/** Réglages côté client dérivés des options du jeu. */
public final class ClientConfig {
    /** Les tremblements suivent l'option d'accessibilité « Distorsion de l'écran ». */
    public static boolean shakeEnabled() {
        return Minecraft.getInstance().options.screenEffectScale().get() > 0.0;
    }

    private ClientConfig() {
    }
}
