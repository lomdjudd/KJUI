package io.github.lomdjudd.hulkironman.hero;

import io.github.lomdjudd.hulkironman.network.FxPayload;
import io.github.lomdjudd.hulkironman.network.HeroSyncPayload;
import io.github.lomdjudd.hulkironman.registry.ModItems;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import net.minecraft.ChatFormatting;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Abilities;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.phys.Vec3;
import net.neoforged.neoforge.network.PacketDistributor;

/** Logique serveur des transformations et des pouvoirs. */
public final class HeroManager {
    private static final Map<UUID, HeroState> STATES = new HashMap<>();

    /** Recharges en ticks (20 ticks = 1 seconde), index 1 à 4. */
    public static final int[] HULK_COOLDOWN = {0, 100, 140, 80, 70, 0};
    public static final int[] IRON_COOLDOWN = {0, 8, 160, 120, 200, 0};
    public static final float[] IRON_COST = {0, 5, 25, 20, 30, 100};

    public static final float IRON_FLY_SPEED = 0.09F;

    public static HeroState state(Player p) {
        return STATES.computeIfAbsent(p.getUUID(), k -> new HeroState());
    }

    public static void forget(Player p) {
        STATES.remove(p.getUUID());
    }

    public static void clearAll() {
        STATES.clear();
    }

    // ------------------------------------------------------------ transformations

    public static void transform(ServerPlayer p, HeroForm form) {
        if (form == HeroForm.NONE) {
            revert(p, true);
            return;
        }
        HeroForm current = HeroForm.of(p);
        if (current == form) return;
        if (current == HeroForm.IRONMAN) setFlight(p, false);
        HeroForm.apply(p, form);
        p.setHealth(p.getMaxHealth());
        p.fallDistance = 0;
        HeroState st = state(p);
        st.reset(form);
        ServerLevel level = p.serverLevel();
        Vec3 pos = p.position();
        if (form == HeroForm.HULK) {
            FxPayload.send(level, FxPayload.TRANSFORM_HULK, p.getId(), pos);
            Combat.sound(level, pos, SoundEvents.RAVAGER_ROAR, 2.0F, 0.6F);
            Combat.sound(level, pos, SoundEvents.GENERIC_EXPLODE, 1.2F, 0.6F);
            Combat.shake(level, pos, 20, 1.0F, 14);
            p.displayClientMessage(Component.translatable("message.hulkironman.hulk.transform").withStyle(ChatFormatting.GREEN, ChatFormatting.BOLD), true);
        } else {
            setFlight(p, true);
            FxPayload.send(level, FxPayload.TRANSFORM_IRON, p.getId(), pos);
            Combat.sound(level, pos, SoundEvents.ARMOR_EQUIP_NETHERITE, 1.5F, 0.8F);
            Combat.sound(level, pos, SoundEvents.BEACON_ACTIVATE, 1.0F, 1.6F);
            Combat.sound(level, pos, SoundEvents.PISTON_EXTEND, 0.8F, 1.6F);
            p.displayClientMessage(Component.translatable("message.hulkironman.ironman.transform").withStyle(ChatFormatting.GOLD, ChatFormatting.BOLD), true);
        }
        showHintOnce(p, form);
        sync(p);
    }

    public static void revert(ServerPlayer p, boolean effects) {
        HeroForm current = HeroForm.of(p);
        HeroForm.removeAll(p);
        if (current == HeroForm.IRONMAN) setFlight(p, false);
        HeroState st = state(p);
        st.reset(HeroForm.NONE);
        if (effects && current != HeroForm.NONE) {
            ServerLevel level = p.serverLevel();
            FxPayload.send(level, FxPayload.REVERT, p.getId(), p.position());
            if (current == HeroForm.HULK) Combat.sound(level, p.position(), SoundEvents.FIRE_EXTINGUISH, 1.0F, 0.7F);
            else Combat.sound(level, p.position(), SoundEvents.ARMOR_EQUIP_IRON, 1.0F, 0.8F);
            p.displayClientMessage(Component.translatable("message.hulkironman.revert"), true);
        }
        sync(p);
    }

    /** Touche de transformation : redevient humain, ou se transforme selon l'objet possédé. */
    public static void toggleFromKey(ServerPlayer p) {
        if (HeroForm.of(p) != HeroForm.NONE) {
            revert(p, true);
            return;
        }
        boolean serum = hasItem(p, ModItems.GAMMA_SERUM.get());
        boolean reactor = hasItem(p, ModItems.ARC_REACTOR.get());
        HeroState st = state(p);
        if (serum && reactor) {
            ItemStack hand = p.getMainHandItem();
            if (hand.is(ModItems.ARC_REACTOR.get())) transform(p, HeroForm.IRONMAN);
            else if (hand.is(ModItems.GAMMA_SERUM.get())) transform(p, HeroForm.HULK);
            else transform(p, st.lastForm == HeroForm.IRONMAN ? HeroForm.IRONMAN : HeroForm.HULK);
        } else if (serum) {
            transform(p, HeroForm.HULK);
        } else if (reactor) {
            transform(p, HeroForm.IRONMAN);
        } else {
            p.displayClientMessage(Component.translatable("message.hulkironman.need_item").withStyle(ChatFormatting.RED), true);
        }
    }

    public static void setFlight(ServerPlayer p, boolean enable) {
        Abilities ab = p.getAbilities();
        if (enable) {
            ab.mayfly = true;
            ab.setFlyingSpeed(IRON_FLY_SPEED);
        } else {
            if (!p.isCreative() && !p.isSpectator()) {
                ab.mayfly = false;
                ab.flying = false;
            }
            ab.setFlyingSpeed(0.05F);
        }
        p.onUpdateAbilities();
    }

    private static void showHintOnce(ServerPlayer p, HeroForm form) {
        CompoundTag data = p.getPersistentData();
        String key = "hulkironman_hint_" + form.name().toLowerCase();
        if (data.getBoolean(key)) return;
        data.putBoolean(key, true);
        String f = form == HeroForm.HULK ? "hulk" : "ironman";
        ChatFormatting color = form == HeroForm.HULK ? ChatFormatting.GREEN : ChatFormatting.GOLD;
        p.sendSystemMessage(Component.translatable("message.hulkironman.hint." + f + ".title").withStyle(color, ChatFormatting.BOLD));
        for (int i = 1; i <= 5; i++) {
            p.sendSystemMessage(Component.literal(" [").withStyle(ChatFormatting.GRAY)
                    .append(Component.keybind(i == 5 ? "key.hulkironman.ultimate" : "key.hulkironman.power" + i).withStyle(ChatFormatting.YELLOW))
                    .append(Component.literal("] ").withStyle(ChatFormatting.GRAY))
                    .append(Component.translatable("ability.hulkironman." + f + "." + i).withStyle(color))
                    .append(Component.literal(" — ").withStyle(ChatFormatting.DARK_GRAY))
                    .append(Component.translatable("ability.hulkironman." + f + "." + i + ".desc").withStyle(ChatFormatting.GRAY)));
        }
        p.sendSystemMessage(Component.translatable("message.hulkironman.hint." + f + ".extra",
                Component.keybind("key.hulkironman.transform").withStyle(ChatFormatting.YELLOW)).withStyle(ChatFormatting.GRAY));
    }

    // ------------------------------------------------------------ pouvoirs

    public static void useAbility(ServerPlayer p, int slot) {
        if (!p.isAlive() || p.isSpectator()) return;
        if (slot == 0) {
            toggleFromKey(p);
            return;
        }
        HeroForm form = HeroForm.of(p);
        if (form == HeroForm.NONE || slot < 1 || slot > 5) return;
        HeroState st = state(p);
        if (st.form != form) st.reset(form);
        if (st.busyTicks > 0) return;
        if (slot == 5) {
            if (st.resource < 100F) {
                String key = form == HeroForm.HULK ? "message.hulkironman.hulk.rage_low" : "message.hulkironman.ironman.energy_low";
                p.displayClientMessage(Component.translatable(key, (int) st.resource).withStyle(ChatFormatting.RED), true);
                return;
            }
        } else {
            if (st.cooldown[slot] > 0) return;
            if (form == HeroForm.IRONMAN && st.resource < IRON_COST[slot]) {
                p.displayClientMessage(Component.translatable("message.hulkironman.ironman.energy_low", (int) st.resource).withStyle(ChatFormatting.RED), true);
                return;
            }
        }
        boolean done = form == HeroForm.HULK ? HulkPowers.use(p, st, slot) : IronManPowers.use(p, st, slot);
        if (!done) return;
        if (slot == 5) {
            st.resource = 0;
        } else {
            int cd = (form == HeroForm.HULK ? HULK_COOLDOWN : IRON_COOLDOWN)[slot];
            st.cooldown[slot] = cd;
            st.cooldownMax[slot] = Math.max(1, cd);
            if (form == HeroForm.IRONMAN) st.resource = Math.max(0, st.resource - IRON_COST[slot]);
        }
        st.combatTicks = 0;
        st.dirty = true;
    }

    public static void tick(ServerPlayer p) {
        HeroForm form = HeroForm.of(p);
        HeroState st = STATES.get(p.getUUID());
        if (form == HeroForm.NONE) {
            if (st != null && st.form != HeroForm.NONE) {
                st.reset(HeroForm.NONE);
                sync(p);
            }
            return;
        }
        if (st == null || st.form != form) {
            // forme rechargée depuis la sauvegarde (connexion)
            st = state(p);
            st.reset(form);
            if (form == HeroForm.IRONMAN) setFlight(p, true);
        }
        if (!p.isAlive()) return;
        if (p.tickCount % 20 == 0) st.hasHeart = hasItem(p, ModItems.COSMIC_HEART.get());
        float speed = (st.rageTicks > 0 ? 2F : 1F) * (st.hasHeart ? 1.5F : 1F);
        for (int i = 1; i <= 4; i++) {
            if (st.cooldown[i] > 0) st.cooldown[i] = Math.max(0, st.cooldown[i] - speed);
        }
        if (st.busyTicks > 0) st.busyTicks--;
        st.combatTicks++;
        if (form == HeroForm.HULK) HulkPowers.tick(p, st);
        else IronManPowers.tick(p, st);
        if (++st.syncTimer >= 2 || st.dirty) sync(p);
    }

    public static void sync(ServerPlayer p) {
        HeroState st = state(p);
        st.syncTimer = 0;
        st.dirty = false;
        float[] cds = new float[5];
        for (int i = 1; i <= 4; i++) cds[i - 1] = st.cooldown[i] / Math.max(1, st.cooldownMax[i]);
        cds[4] = st.resource >= 100F ? 0F : 1F;
        PacketDistributor.sendToPlayer(p, new HeroSyncPayload(HeroForm.of(p).ordinal(), st.resource, cds, st.rageTicks));
    }

    // ------------------------------------------------------------ événements

    public static void onAbilityHit(ServerPlayer p, LivingEntity target) {
        HeroState st = state(p);
        st.combatTicks = 0;
        if (HeroForm.of(p) == HeroForm.HULK && st.rageTicks <= 0) st.resource = Math.min(100F, st.resource + 2.5F);
    }

    /** Coup de poing de Hulk : gain de rage, impact visuel et projection. */
    public static void onHulkPunch(ServerPlayer p, LivingEntity victim) {
        HeroState st = state(p);
        st.combatTicks = 0;
        if (st.rageTicks <= 0) st.resource = Math.min(100F, st.resource + 7F);
        ServerLevel level = p.serverLevel();
        Vec3 c = victim.getBoundingBox().getCenter();
        FxPayload.send(level, FxPayload.PUNCH, c, 1F);
        Combat.sound(level, c, SoundEvents.IRON_GOLEM_ATTACK, 1.0F, 0.7F);
        Combat.sound(level, c, SoundEvents.GENERIC_EXPLODE, 0.35F, 1.7F);
        Combat.push(victim, Combat.lookFlat(p).scale(0.9).add(0, 0.35, 0));
        Combat.shake(level, p.position(), 3, 0.35F, 5);
    }

    public static void onHulkHurt(ServerPlayer p, float amount) {
        HeroState st = state(p);
        st.combatTicks = 0;
        if (st.rageTicks <= 0) st.resource = Math.min(100F, st.resource + amount * 2.5F);
    }

    public static void onLogin(ServerPlayer p) {
        HeroForm form = HeroForm.of(p);
        HeroState st = state(p);
        st.reset(form);
        if (form == HeroForm.IRONMAN) setFlight(p, true);
        sync(p);
    }

    /** Après une mort, on redevient humain. */
    public static void afterDeath(ServerPlayer p) {
        HeroForm.removeAll(p);
        Abilities ab = p.getAbilities();
        if (!p.isCreative() && !p.isSpectator()) {
            ab.mayfly = false;
            ab.flying = false;
        }
        ab.setFlyingSpeed(0.05F);
        forget(p);
    }

    public static boolean hasItem(Player p, Item item) {
        var inv = p.getInventory();
        for (int i = 0; i < inv.getContainerSize(); i++) {
            if (inv.getItem(i).is(item)) return true;
        }
        return false;
    }

    private HeroManager() {
    }
}
