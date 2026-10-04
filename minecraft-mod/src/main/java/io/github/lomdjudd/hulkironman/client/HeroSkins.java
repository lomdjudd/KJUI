package io.github.lomdjudd.hulkironman.client;

import io.github.lomdjudd.hulkironman.HulkIronMan;
import io.github.lomdjudd.hulkironman.hero.HeroForm;
import javax.annotation.Nullable;
import net.minecraft.client.resources.PlayerSkin;
import net.minecraft.resources.ResourceLocation;

/** Skins des héros, utilisés à la place du skin du joueur quand il est transformé. */
public final class HeroSkins {
    public static final ResourceLocation HULK = HulkIronMan.id("textures/entity/hero/hulk.png");
    public static final ResourceLocation IRONMAN = HulkIronMan.id("textures/entity/hero/ironman.png");
    public static final ResourceLocation HULK_GLOW = HulkIronMan.id("textures/entity/hero/hulk_glow.png");
    public static final ResourceLocation HULK_RAGE_GLOW = HulkIronMan.id("textures/entity/hero/hulk_rage_glow.png");
    public static final ResourceLocation IRONMAN_GLOW = HulkIronMan.id("textures/entity/hero/ironman_glow.png");

    private static final PlayerSkin HULK_SKIN = new PlayerSkin(HULK, null, null, null, PlayerSkin.Model.WIDE, true);
    private static final PlayerSkin IRONMAN_SKIN = new PlayerSkin(IRONMAN, null, null, null, PlayerSkin.Model.WIDE, true);

    @Nullable
    public static PlayerSkin forForm(HeroForm form) {
        return switch (form) {
            case HULK -> HULK_SKIN;
            case IRONMAN -> IRONMAN_SKIN;
            default -> null;
        };
    }

    private HeroSkins() {
    }
}
