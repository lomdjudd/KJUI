package io.github.lomdjudd.hulkironman.client;

import java.util.List;
import net.minecraft.client.KeyMapping;
import org.lwjgl.glfw.GLFW;

/** Touches (modifiables dans Options > Commandes > Hulk & Iron Man). Mêmes positions en AZERTY et QWERTY. */
public final class Keys {
    public static final String CATEGORY = "key.categories.hulkironman";

    public static final KeyMapping TRANSFORM = new KeyMapping("key.hulkironman.transform", GLFW.GLFW_KEY_H, CATEGORY);
    public static final KeyMapping POWER1 = new KeyMapping("key.hulkironman.power1", GLFW.GLFW_KEY_R, CATEGORY);
    public static final KeyMapping POWER2 = new KeyMapping("key.hulkironman.power2", GLFW.GLFW_KEY_G, CATEGORY);
    public static final KeyMapping POWER3 = new KeyMapping("key.hulkironman.power3", GLFW.GLFW_KEY_V, CATEGORY);
    public static final KeyMapping POWER4 = new KeyMapping("key.hulkironman.power4", GLFW.GLFW_KEY_B, CATEGORY);
    public static final KeyMapping ULTIMATE = new KeyMapping("key.hulkironman.ultimate", GLFW.GLFW_KEY_N, CATEGORY);

    /** Index = numéro envoyé au serveur (0 = transformation, 1-4 = pouvoirs, 5 = ultime). */
    public static final List<KeyMapping> ALL = List.of(TRANSFORM, POWER1, POWER2, POWER3, POWER4, ULTIMATE);

    private Keys() {
    }
}
