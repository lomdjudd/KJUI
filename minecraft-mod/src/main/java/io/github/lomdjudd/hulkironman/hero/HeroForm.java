package io.github.lomdjudd.hulkironman.hero;

import io.github.lomdjudd.hulkironman.HulkIronMan;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.core.Holder;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.entity.ai.attributes.Attribute;
import net.minecraft.world.entity.ai.attributes.AttributeInstance;
import net.minecraft.world.entity.ai.attributes.AttributeModifier;
import net.minecraft.world.entity.ai.attributes.AttributeModifier.Operation;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.player.Player;

/**
 * Les formes de héros.
 *
 * La forme d'un joueur est portée par des modificateurs d'attributs permanents
 * (taille, santé, force…). Ils sont sauvegardés avec le joueur et synchronisés
 * automatiquement par le jeu vers tous les clients : chaque client sait donc
 * qui est Hulk ou Iron Man sans paquet supplémentaire.
 */
public enum HeroForm {
    NONE,
    HULK,
    IRONMAN;

    public record Mod(Holder<Attribute> attribute, ResourceLocation id, double amount, Operation op) {
        AttributeModifier modifier() {
            return new AttributeModifier(id, amount, op);
        }
    }

    public static final ResourceLocation HULK_SCALE = HulkIronMan.id("hulk_scale");
    public static final ResourceLocation IRON_SCALE = HulkIronMan.id("ironman_scale");
    public static final ResourceLocation RAGE_SCALE = HulkIronMan.id("hulk_rage_scale");

    private static final List<Mod> HULK_MODS = List.of(
            new Mod(Attributes.SCALE, HULK_SCALE, 0.75, Operation.ADD_MULTIPLIED_BASE),
            new Mod(Attributes.MAX_HEALTH, HulkIronMan.id("hulk_health"), 40.0, Operation.ADD_VALUE),
            new Mod(Attributes.ATTACK_DAMAGE, HulkIronMan.id("hulk_damage"), 14.0, Operation.ADD_VALUE),
            new Mod(Attributes.ATTACK_KNOCKBACK, HulkIronMan.id("hulk_knockback"), 2.5, Operation.ADD_VALUE),
            new Mod(Attributes.KNOCKBACK_RESISTANCE, HulkIronMan.id("hulk_kb_resist"), 1.0, Operation.ADD_VALUE),
            new Mod(Attributes.ARMOR, HulkIronMan.id("hulk_armor"), 12.0, Operation.ADD_VALUE),
            new Mod(Attributes.ARMOR_TOUGHNESS, HulkIronMan.id("hulk_toughness"), 6.0, Operation.ADD_VALUE),
            new Mod(Attributes.MOVEMENT_SPEED, HulkIronMan.id("hulk_speed"), 0.25, Operation.ADD_MULTIPLIED_BASE),
            new Mod(Attributes.JUMP_STRENGTH, HulkIronMan.id("hulk_jump"), 0.3, Operation.ADD_VALUE),
            new Mod(Attributes.SAFE_FALL_DISTANCE, HulkIronMan.id("hulk_safe_fall"), 60.0, Operation.ADD_VALUE),
            new Mod(Attributes.STEP_HEIGHT, HulkIronMan.id("hulk_step"), 0.65, Operation.ADD_VALUE),
            new Mod(Attributes.ENTITY_INTERACTION_RANGE, HulkIronMan.id("hulk_reach"), 2.0, Operation.ADD_VALUE),
            new Mod(Attributes.BLOCK_INTERACTION_RANGE, HulkIronMan.id("hulk_block_reach"), 1.5, Operation.ADD_VALUE),
            new Mod(Attributes.BLOCK_BREAK_SPEED, HulkIronMan.id("hulk_break"), 3.0, Operation.ADD_MULTIPLIED_BASE));

    private static final List<Mod> IRON_MODS = List.of(
            new Mod(Attributes.SCALE, IRON_SCALE, 0.1, Operation.ADD_MULTIPLIED_BASE),
            new Mod(Attributes.MAX_HEALTH, HulkIronMan.id("ironman_health"), 20.0, Operation.ADD_VALUE),
            new Mod(Attributes.ATTACK_DAMAGE, HulkIronMan.id("ironman_damage"), 6.0, Operation.ADD_VALUE),
            new Mod(Attributes.KNOCKBACK_RESISTANCE, HulkIronMan.id("ironman_kb_resist"), 0.6, Operation.ADD_VALUE),
            new Mod(Attributes.ARMOR, HulkIronMan.id("ironman_armor"), 16.0, Operation.ADD_VALUE),
            new Mod(Attributes.ARMOR_TOUGHNESS, HulkIronMan.id("ironman_toughness"), 8.0, Operation.ADD_VALUE),
            new Mod(Attributes.MOVEMENT_SPEED, HulkIronMan.id("ironman_speed"), 0.15, Operation.ADD_MULTIPLIED_BASE),
            new Mod(Attributes.SAFE_FALL_DISTANCE, HulkIronMan.id("ironman_safe_fall"), 40.0, Operation.ADD_VALUE),
            new Mod(Attributes.BLOCK_BREAK_SPEED, HulkIronMan.id("ironman_break"), 1.0, Operation.ADD_MULTIPLIED_BASE));

    /** Bonus temporaires de la Colère Gamma (non sauvegardés). */
    private static final List<Mod> RAGE_MODS = List.of(
            new Mod(Attributes.SCALE, RAGE_SCALE, 0.25, Operation.ADD_MULTIPLIED_BASE),
            new Mod(Attributes.ATTACK_DAMAGE, HulkIronMan.id("hulk_rage_damage"), 10.0, Operation.ADD_VALUE),
            new Mod(Attributes.MOVEMENT_SPEED, HulkIronMan.id("hulk_rage_speed"), 0.25, Operation.ADD_MULTIPLIED_BASE));

    public List<Mod> mods() {
        return switch (this) {
            case HULK -> HULK_MODS;
            case IRONMAN -> IRON_MODS;
            default -> List.of();
        };
    }

    public static HeroForm of(Player player) {
        AttributeInstance scale = player.getAttribute(Attributes.SCALE);
        if (scale == null) return NONE;
        if (scale.hasModifier(HULK_SCALE)) return HULK;
        if (scale.hasModifier(IRON_SCALE)) return IRONMAN;
        return NONE;
    }

    public static boolean isRaging(Player player) {
        AttributeInstance scale = player.getAttribute(Attributes.SCALE);
        return scale != null && scale.hasModifier(RAGE_SCALE);
    }

    public static HeroForm byId(int id) {
        HeroForm[] v = values();
        return id >= 0 && id < v.length ? v[id] : NONE;
    }

    /** Retire toutes les formes puis applique celle-ci. */
    public static void apply(Player player, HeroForm form) {
        removeAll(player);
        for (Mod m : form.mods()) {
            AttributeInstance inst = player.getAttribute(m.attribute());
            if (inst != null && !inst.hasModifier(m.id())) inst.addPermanentModifier(m.modifier());
        }
    }

    public static void removeAll(Player player) {
        List<Mod> all = new ArrayList<>(HULK_MODS);
        all.addAll(IRON_MODS);
        all.addAll(RAGE_MODS);
        for (Mod m : all) {
            AttributeInstance inst = player.getAttribute(m.attribute());
            if (inst != null) inst.removeModifier(m.id());
        }
        if (player.getHealth() > player.getMaxHealth()) player.setHealth(player.getMaxHealth());
    }

    public static void setRage(Player player, boolean on) {
        for (Mod m : RAGE_MODS) {
            AttributeInstance inst = player.getAttribute(m.attribute());
            if (inst == null) continue;
            inst.removeModifier(m.id());
            if (on) inst.addTransientModifier(m.modifier());
        }
    }
}
