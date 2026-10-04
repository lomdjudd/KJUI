package io.github.lomdjudd.hulkironman.hero;

import io.github.lomdjudd.hulkironman.entity.MissileEntity;
import io.github.lomdjudd.hulkironman.network.FxPayload;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import javax.annotation.Nullable;
import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LightningBolt;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.phys.Vec3;

/**
 * Pouvoirs d'Iron Man.
 * 1 Répulseur · 2 Unirayon · 3 Micro-missiles · 4 Laser circulaire · 5 Frappe orbitale (ultime)
 * Vol : double saut (comme en créatif), MAJ/sprint pour le turbo.
 */
public final class IronManPowers {

    static boolean use(ServerPlayer p, HeroState st, int slot) {
        switch (slot) {
            case 1 -> repulsor(p, st);
            case 2 -> unibeam(p, st);
            case 3 -> missiles(p, st);
            case 4 -> laserRing(p, st);
            case 5 -> orbitalStrike(p, st);
            default -> {
                return false;
            }
        }
        return true;
    }

    // ------------------------------------------------------------------ 1
    /** Tir de répulseur instantané, une main puis l'autre. */
    static void repulsor(ServerPlayer p, HeroState st) {
        ServerLevel level = p.serverLevel();
        Vec3 eye = p.getEyePosition();
        Vec3 look = p.getLookAngle();
        Vec3 right = Combat.rightOf(look);
        st.rightHand = !st.rightHand;
        Vec3 start = eye.add(look.scale(0.7)).add(right.scale(st.rightHand ? 0.38 : -0.38)).add(0, -0.35, 0);
        Vec3 end = Combat.clipBlocks(level, eye, eye.add(look.scale(48)), p);
        LivingEntity hit = Combat.firstEntity(level, eye, end, 0.4, e -> Combat.canHitDirect(p, e));
        if (hit != null) {
            end = hit.getBoundingBox().getCenter();
            Combat.damage(p, hit, 9F);
            Combat.push(hit, look.scale(0.9).add(0, 0.25, 0));
        }
        FxPayload.send(level, FxPayload.REPULSOR, 0, start, end, 0F);
        Combat.sound(level, start, SoundEvents.FIREWORK_ROCKET_BLAST, 0.8F, 1.8F);
        Combat.sound(level, end, SoundEvents.FIREWORK_ROCKET_TWINKLE, 0.5F, 1.6F);
    }

    // ------------------------------------------------------------------ 2
    /** Le réacteur de la poitrine se charge puis tire un rayon massif pendant une seconde. */
    static void unibeam(ServerPlayer p, HeroState st) {
        st.unibeamTicks = 1;
        st.busyTicks = 36;
        p.addEffect(new MobEffectInstance(MobEffects.MOVEMENT_SLOWDOWN, 36, 2, false, false, false));
        Combat.sound(p.level(), p.position(), SoundEvents.BEACON_POWER_SELECT, 1.5F, 1.5F);
    }

    static void tickUnibeam(ServerPlayer p, HeroState st) {
        ServerLevel level = p.serverLevel();
        int t = st.unibeamTicks++;
        Vec3 look = p.getLookAngle();
        Vec3 chest = p.position().add(0, p.getBbHeight() * 0.68, 0).add(look.scale(0.5 * p.getScale()));
        if (t < 16) {
            if (t % 2 == 0) FxPayload.send(level, FxPayload.CHARGE, 0, chest, new Vec3(0.55, 0.95, 1.0), 1.6F);
            if (t == 8) Combat.sound(level, chest, SoundEvents.BEACON_ACTIVATE, 1.5F, 1.8F);
        } else if (t < 36) {
            if (t == 16) {
                Combat.sound(level, chest, SoundEvents.WARDEN_SONIC_BOOM, 1.2F, 1.6F);
                Combat.sound(level, chest, SoundEvents.BEACON_DEACTIVATE, 1.5F, 0.6F);
            }
            Vec3 end = Combat.clipBlocks(level, chest, chest.add(look.scale(64)), p);
            for (LivingEntity e : Combat.alongBeam(level, chest, end, 1.3, e -> Combat.canHitDirect(p, e))) {
                Combat.damage(p, e, 5F);
                e.igniteForSeconds(2);
                Combat.push(e, look.scale(0.25));
            }
            FxPayload.send(level, FxPayload.UNIBEAM, 0, chest, end, 0F);
            if (t % 4 == 0) {
                FxPayload.send(level, FxPayload.IMPACT, 0, end, Vec3.ZERO, 1.5F);
                Combat.sound(level, end, SoundEvents.GENERIC_EXPLODE, 0.7F, 1.4F);
            }
        } else {
            st.unibeamTicks = 0;
        }
    }

    // ------------------------------------------------------------------ 3
    /** Salve de 8 micro-missiles à tête chercheuse, chacun vers un ennemi différent. */
    static void missiles(ServerPlayer p, HeroState st) {
        ServerLevel level = p.serverLevel();
        List<LivingEntity> targets = Combat.enemiesNear(p, p.position(), 36);
        Vec3 eye = p.getEyePosition();
        LivingEntity aimed = Combat.firstEntity(level, eye, Combat.clipBlocks(level, eye, eye.add(p.getLookAngle().scale(48)), p), 0.6,
                e -> Combat.canHitDirect(p, e));
        if (aimed != null) {
            targets.remove(aimed);
            targets.add(0, aimed);
        }
        for (int i = 0; i < 8; i++) {
            final int k = i;
            @Nullable final LivingEntity target = targets.isEmpty() ? null : targets.get(k % targets.size());
            Scheduler.later(k * 2, () -> {
                if (p.hasDisconnected() || !p.isAlive()) return;
                Vec3 look = p.getLookAngle();
                Vec3 right = Combat.rightOf(look);
                double side = (k % 2 == 0 ? 1 : -1) * (0.4 + (k / 2) * 0.15);
                Vec3 pos = p.getEyePosition().add(right.scale(side * 0.6)).add(0, 0.2, 0);
                MissileEntity m = new MissileEntity(level, p);
                m.setPos(pos.x, pos.y, pos.z);
                m.setDeltaMovement(look.scale(0.5).add(right.scale(side * 0.35)).add(0, 0.35, 0));
                m.setHomingTarget(target);
                level.addFreshEntity(m);
                Combat.sound(level, pos, SoundEvents.FIREWORK_ROCKET_LAUNCH, 0.8F, 1.3F + k * 0.05F);
            });
        }
    }

    // ------------------------------------------------------------------ 4
    /** Un anneau laser jaillit des poignets et s'étend autour d'Iron Man en tranchant tout. */
    static void laserRing(ServerPlayer p, HeroState st) {
        ServerLevel level = p.serverLevel();
        Set<Integer> hit = new HashSet<>();
        Combat.sound(level, p.position(), SoundEvents.BEACON_ACTIVATE, 1.5F, 2.0F);
        Combat.sound(level, p.position(), SoundEvents.FIRECHARGE_USE, 1.0F, 1.4F);
        Scheduler.repeat(9, age -> {
            if (p.hasDisconnected() || !p.isAlive()) return;
            Vec3 c = p.position().add(0, p.getBbHeight() * 0.6, 0);
            double r = 1.5 + age * 1.6;
            FxPayload.send(level, FxPayload.LASER_RING, c, (float) r);
            for (LivingEntity e : Combat.enemiesNear(p, c, r + 1)) {
                double dh = Combat.horizontalDistance(e.position(), c);
                double dy = Math.abs(e.getY() + e.getBbHeight() * 0.5 - c.y);
                if (dh > r + 0.8 || dy > 3.0 || !hit.add(e.getId())) continue;
                Combat.damage(p, e, 16F);
                e.igniteForSeconds(4);
                Combat.push(e, Combat.horizontal(e.position().subtract(c)).scale(0.7).add(0, 0.3, 0));
            }
            if (age % 3 == 0) Combat.sound(level, c, SoundEvents.BLAZE_SHOOT, 0.6F, 1.8F);
        });
    }

    // ------------------------------------------------------------------ 5
    /** Ultime : J.A.R.V.I.S. verrouille tous les ennemis proches et un satellite les frappe depuis le ciel. */
    static void orbitalStrike(ServerPlayer p, HeroState st) {
        ServerLevel level = p.serverLevel();
        List<LivingEntity> targets = Combat.enemiesNear(p, p.position(), 40);
        if (targets.size() > 16) targets = targets.subList(0, 16);
        Combat.sound(level, p.position(), SoundEvents.BEACON_POWER_SELECT, 2.0F, 0.8F);
        p.displayClientMessage(Component.translatable("message.hulkironman.ironman.orbital").withStyle(ChatFormatting.AQUA, ChatFormatting.BOLD), true);
        if (targets.isEmpty()) {
            Vec3 eye = p.getEyePosition();
            Vec3 spot = Combat.clipBlocks(level, eye, eye.add(p.getLookAngle().scale(80)), p);
            FxPayload.send(level, FxPayload.WARNING, spot.add(0, 0.1, 0), 3F);
            Scheduler.later(25, () -> strike(p, level, spot, null));
            return;
        }
        for (int i = 0; i < targets.size(); i++) {
            LivingEntity t = targets.get(i);
            t.addEffect(new MobEffectInstance(MobEffects.GLOWING, 60, 0, false, false));
            FxPayload.send(level, FxPayload.LOCK_ON, t.getId(), t.position());
            Scheduler.later(25 + i * 3, () -> {
                if (t.isAlive() && !p.hasDisconnected()) strike(p, level, t.position(), t);
            });
        }
    }

    static void strike(ServerPlayer p, ServerLevel level, Vec3 pos, @Nullable LivingEntity target) {
        FxPayload.send(level, FxPayload.ORBITAL, pos, 40F);
        LightningBolt bolt = EntityType.LIGHTNING_BOLT.create(level);
        if (bolt != null) {
            bolt.moveTo(pos);
            bolt.setVisualOnly(true);
            level.addFreshEntity(bolt);
        }
        if (target != null) Combat.damage(p, target, 40F);
        for (LivingEntity e : Combat.enemiesNear(p, pos, 3.5)) {
            if (e == target) continue;
            Combat.damage(p, e, 14F);
            Combat.push(e, Combat.horizontal(e.position().subtract(pos)).scale(0.8).add(0, 0.6, 0));
        }
        Combat.sound(level, pos, SoundEvents.GENERIC_EXPLODE, 2.5F, 0.7F);
        Combat.shake(level, pos, 24, 0.8F, 8);
    }

    // ------------------------------------------------------------------ tick

    static void tick(ServerPlayer p, HeroState st) {
        st.resource = Math.min(100F, st.resource + 0.32F * (st.hasHeart ? 2F : 1F));
        if (st.unibeamTicks > 0) tickUnibeam(p, st);
        if (p.getAbilities().flying && p.tickCount % 2 == 0) {
            FxPayload.send(p.serverLevel(), FxPayload.THRUSTER, p.getId(), p.position());
        }
    }

    private IronManPowers() {
    }
}
