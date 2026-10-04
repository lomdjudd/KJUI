package io.github.lomdjudd.hulkironman.hero;

import io.github.lomdjudd.hulkironman.entity.HurledBlockEntity;
import io.github.lomdjudd.hulkironman.network.FxPayload;
import java.util.HashSet;
import java.util.Set;
import net.minecraft.ChatFormatting;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.projectile.Projectile;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.Vec3;

/**
 * Pouvoirs de Hulk.
 * 1 Clap de tonnerre · 2 Hulk Smash · 3 Saut gamma · 4 Lancer de rocher · 5 Colère gamma (ultime)
 */
public final class HulkPowers {

    static boolean use(ServerPlayer p, HeroState st, int slot) {
        switch (slot) {
            case 1 -> thunderClap(p, st);
            case 2 -> smash(p, st);
            case 3 -> leap(p, st);
            case 4 -> boulder(p, st);
            case 5 -> gammaRage(p, st);
            default -> {
                return false;
            }
        }
        return true;
    }

    static float rageMul(HeroState st) {
        return st.rageTicks > 0 ? 1.5F : 1F;
    }

    static double scaleOf(ServerPlayer p) {
        return p.getScale();
    }

    // ------------------------------------------------------------------ 1
    /** Frappe des mains : une onde de choc en cône balaie et étourdit les ennemis, et détruit les projectiles. */
    static void thunderClap(ServerPlayer p, HeroState st) {
        ServerLevel level = p.serverLevel();
        Vec3 look = p.getLookAngle();
        Vec3 origin = p.getEyePosition().add(look.scale(0.9)).subtract(0, 0.35 * scaleOf(p), 0);
        double range = 16.0;
        double cos = Math.cos(Math.toRadians(42));
        float dmg = 14F * rageMul(st);
        for (LivingEntity e : Combat.enemiesNear(p, origin, range)) {
            Vec3 to = e.getBoundingBox().getCenter().subtract(origin);
            double d = to.length();
            if (d < 0.01) continue;
            if (to.normalize().dot(look) < cos && d > 3.0) continue;
            float f = (float) (1.0 - d / range * 0.5);
            Combat.damage(p, e, dmg * f);
            Combat.push(e, to.normalize().scale(2.6 * (1.0 - d / range) + 0.8).add(0, 0.55, 0));
            e.addEffect(new MobEffectInstance(MobEffects.MOVEMENT_SLOWDOWN, 50, 3));
        }
        for (Projectile proj : level.getEntitiesOfClass(Projectile.class, Combat.around(origin, range), x -> x.getOwner() != p)) {
            Vec3 to = proj.position().subtract(origin);
            if (to.length() < range && to.normalize().dot(look) > cos) {
                FxPayload.send(level, FxPayload.DEFLECT, proj.position(), 1F);
                proj.discard();
            }
        }
        FxPayload.send(level, FxPayload.CLAP, 0, origin, look, (float) range);
        Combat.sound(level, origin, SoundEvents.WARDEN_SONIC_BOOM, 3.0F, 0.8F);
        Combat.sound(level, origin, SoundEvents.GENERIC_EXPLODE, 2.0F, 0.6F);
        Combat.sound(level, origin, SoundEvents.LIGHTNING_BOLT_THUNDER, 0.8F, 1.6F);
        Combat.shake(level, origin, 24, 0.8F, 10);
    }

    // ------------------------------------------------------------------ 2
    /** Au sol : bond puis écrasement. En l'air : plongeon météore (plus on tombe de haut, plus c'est fort). */
    static void smash(ServerPlayer p, HeroState st) {
        boolean ground = p.onGround();
        if (ground) {
            Combat.setMotion(p, Combat.lookFlat(p).scale(0.5).add(0, 1.15, 0));
        } else {
            Combat.setMotion(p, Combat.lookFlat(p).scale(0.25).add(0, -3.2, 0));
        }
        st.smashing = true;
        st.leaping = false;
        st.actionTicks = 0;
        st.airTicks = ground ? 0 : 3;
        st.peakY = p.getY();
        Combat.sound(p.level(), p.position(), SoundEvents.RAVAGER_ROAR, 1.6F, 1.1F);
    }

    // ------------------------------------------------------------------ 3
    /** Bond gigantesque dans la direction du regard ; l'atterrissage crée une onde de choc. */
    static void leap(ServerPlayer p, HeroState st) {
        ServerLevel level = p.serverLevel();
        Vec3 look = p.getLookAngle();
        Vec3 v = Combat.lookFlat(p).scale(2.3).add(0, 1.3 + Math.max(0, look.y) * 0.9, 0);
        boolean ground = p.onGround();
        Combat.setMotion(p, v);
        st.leaping = true;
        st.smashing = false;
        st.actionTicks = 0;
        st.airTicks = ground ? 0 : 3;
        st.peakY = p.getY();
        Vec3 pos = p.position();
        BlockState under = Combat.groundBlock(level, pos);
        FxPayload.send(level, FxPayload.IMPACT, under.isAir() ? 0 : Block.getId(under), pos, Vec3.ZERO, 2.0F);
        FxPayload.send(level, FxPayload.RING, 0, pos.add(0, 0.1, 0), new Vec3(-1, 0, 0), 2.5F);
        Combat.sound(level, pos, SoundEvents.GENERIC_EXPLODE, 0.8F, 1.4F);
        Combat.sound(level, pos, SoundEvents.IRON_GOLEM_ATTACK, 1.0F, 0.6F);
    }

    // ------------------------------------------------------------------ 4
    /** Arrache un rocher du sol et le lance ; il explose à l'impact (sans abîmer le décor). */
    static void boulder(ServerPlayer p, HeroState st) {
        ServerLevel level = p.serverLevel();
        BlockPos below = p.blockPosition().below();
        BlockState s = level.getBlockState(below);
        if (s.isAir() || s.hasBlockEntity() || s.getDestroySpeed(level, below) < 0 || !s.isCollisionShapeFullBlock(level, below)) {
            s = Blocks.COBBLESTONE.defaultBlockState();
        }
        Vec3 look = p.getLookAngle();
        Vec3 start = p.getEyePosition().add(look.scale(1.3 * scaleOf(p))).add(0, 0.5, 0);
        HurledBlockEntity rock = HurledBlockEntity.boulder(level, p, s, 1.7F, 18F * rageMul(st), 3.8F);
        rock.setPos(start.x, start.y, start.z);
        rock.shoot(look.x, look.y + 0.1, look.z, 2.1F, 0.3F);
        level.addFreshEntity(rock);
        Vec3 pos = p.position();
        FxPayload.send(level, FxPayload.IMPACT, Block.getId(s), pos, Vec3.ZERO, 1.6F);
        Combat.sound(level, pos, SoundEvents.ZOMBIE_BREAK_WOODEN_DOOR, 1.0F, 0.6F);
        Combat.sound(level, pos, SoundEvents.STONE_BREAK, 1.5F, 0.6F);
        Combat.sound(level, pos, SoundEvents.PLAYER_ATTACK_SWEEP, 1.0F, 0.5F);
    }

    // ------------------------------------------------------------------ 5
    /** Ultime : rugissement, explosion gamma géante puis 20 secondes de rage (plus grand, plus fort, recharges x2). */
    static void gammaRage(ServerPlayer p, HeroState st) {
        ServerLevel level = p.serverLevel();
        st.rageTicks = 20 * 20;
        HeroForm.setRage(p, true);
        p.addEffect(new MobEffectInstance(MobEffects.DAMAGE_RESISTANCE, 400, 1, false, false, true));
        p.addEffect(new MobEffectInstance(MobEffects.REGENERATION, 200, 1, false, false, true));
        Vec3 c = p.position().add(0, 1, 0);
        Set<Integer> hit = new HashSet<>();
        Scheduler.repeat(14, age -> {
            if (p.hasDisconnected() || !p.isAlive()) return;
            double r = 2.0 + age * 1.4;
            if (age % 2 == 0 || age == 13) FxPayload.send(level, FxPayload.SPHERE, 0, c, new Vec3(0.35, 1.0, 0.3), (float) r);
            for (LivingEntity e : Combat.enemiesNear(p, c, r)) {
                if (!hit.add(e.getId())) continue;
                Combat.damage(p, e, 30F);
                Combat.push(e, Combat.horizontal(e.position().subtract(c)).scale(2.0).add(0, 1.0, 0));
            }
        });
        FxPayload.send(level, FxPayload.RING, 0, p.position().add(0, 0.1, 0), new Vec3(0.3, 1.0, 0.3), 6F);
        Combat.sound(level, c, SoundEvents.RAVAGER_ROAR, 3.0F, 0.6F);
        Combat.sound(level, c, SoundEvents.WARDEN_ROAR, 3.0F, 0.7F);
        Combat.sound(level, c, SoundEvents.ENDER_DRAGON_GROWL, 2.0F, 1.0F);
        Combat.sound(level, c, SoundEvents.GENERIC_EXPLODE, 4.0F, 0.5F);
        Combat.shake(level, c, 48, 2.2F, 30);
        p.displayClientMessage(Component.translatable("message.hulkironman.hulk.rage").withStyle(ChatFormatting.DARK_GREEN, ChatFormatting.BOLD), true);
    }

    static void endRage(ServerPlayer p) {
        HeroForm.setRage(p, false);
        p.displayClientMessage(Component.translatable("message.hulkironman.hulk.calm").withStyle(ChatFormatting.GREEN), true);
    }

    // ------------------------------------------------------------------ tick

    static void tick(ServerPlayer p, HeroState st) {
        ServerLevel level = p.serverLevel();
        if (st.leaping || st.smashing) {
            st.actionTicks++;
            if (!p.onGround()) {
                st.airTicks++;
                st.peakY = Math.max(st.peakY, p.getY());
                if (st.actionTicks % 2 == 0) FxPayload.send(level, FxPayload.TRAIL, p.getId(), p.position());
            }
            boolean landed = p.onGround() && st.airTicks > 2;
            boolean neverLeft = st.airTicks == 0 && st.actionTicks > 12;
            boolean abort = (p.isInWater() && st.actionTicks > 10) || st.actionTicks > 300;
            if (landed || neverLeft || abort) {
                double drop = Math.max(0, st.peakY - p.getY());
                if (st.smashing) {
                    groundImpact(p, st, 7.0 + Math.min(drop / 3.0, 9.0), 16F + (float) Math.min(drop, 40.0) * 0.6F, true);
                } else {
                    groundImpact(p, st, 4.5 + Math.min(drop / 5.0, 5.0), 10F + (float) Math.min(drop, 30.0) * 0.4F, false);
                }
                st.leaping = false;
                st.smashing = false;
            }
        }
        if (st.rageTicks > 0) {
            st.rageTicks--;
            if (st.rageTicks % 4 == 0) FxPayload.send(level, FxPayload.RAGE_AURA, p.getId(), p.position());
            if (st.rageTicks == 0) endRage(p);
        } else if (st.combatTicks > 160 && st.resource > 0) {
            st.resource = Math.max(0, st.resource - 0.1F);
        }
    }

    static void groundImpact(ServerPlayer p, HeroState st, double radius, float damage, boolean big) {
        ServerLevel level = p.serverLevel();
        Vec3 c = p.position();
        for (LivingEntity e : Combat.enemiesNear(p, c, radius)) {
            double d = Combat.horizontalDistance(e.position(), c);
            if (d > radius || Math.abs(e.getY() - c.y) > 5) continue;
            float f = (float) (1.0 - d / (radius + 1.0));
            Combat.damage(p, e, damage * (0.5F + 0.5F * f) * rageMul(st));
            Combat.push(e, Combat.horizontal(e.position().subtract(c)).scale(0.6 + 1.2 * f).add(0, 0.7 + 0.7 * f, 0));
        }
        BlockState under = Combat.groundBlock(level, c);
        FxPayload.send(level, FxPayload.IMPACT, under.isAir() ? 0 : Block.getId(under), c, new Vec3(big ? 1 : 0, 0, 0), (float) radius);
        final double r = radius;
        Scheduler.repeat(6, age -> FxPayload.send(level, FxPayload.RING, 0, c.add(0, 0.1, 0), new Vec3(-1, 0, 0), (float) (r * (age + 1) / 6.0)));
        Combat.sound(level, c, SoundEvents.GENERIC_EXPLODE, big ? 3.0F : 1.8F, 0.5F);
        Combat.sound(level, c, SoundEvents.ANVIL_LAND, big ? 1.5F : 0.8F, 0.5F);
        Combat.sound(level, c, SoundEvents.MACE_SMASH_GROUND_HEAVY, big ? 2.0F : 1.0F, 0.8F);
        Combat.shake(level, c, radius * 3, big ? 1.5F : 0.9F, big ? 16 : 10);
    }

    private HulkPowers() {
    }
}
