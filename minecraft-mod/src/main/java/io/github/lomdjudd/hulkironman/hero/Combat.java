package io.github.lomdjudd.hulkironman.hero;

import io.github.lomdjudd.hulkironman.entity.GalactusEntity;
import io.github.lomdjudd.hulkironman.network.FxPayload;
import io.github.lomdjudd.hulkironman.network.MotionPayload;
import io.github.lomdjudd.hulkironman.network.ShakePayload;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.function.Predicate;
import javax.annotation.Nullable;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Holder;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.sounds.SoundSource;
import net.minecraft.util.Mth;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.OwnableEntity;
import net.minecraft.world.entity.decoration.ArmorStand;
import net.minecraft.world.entity.monster.Enemy;
import net.minecraft.world.entity.monster.Vex;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.ClipContext;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.HitResult;
import net.minecraft.world.phys.Vec3;
import net.neoforged.neoforge.network.PacketDistributor;

/** Outils partagés par les pouvoirs : ciblage, dégâts, poussées, sons, tremblements. */
public final class Combat {
    /** Vrai pendant qu'un pouvoir inflige des dégâts (pour ne pas les compter comme des coups de poing). */
    public static boolean abilityDamage;

    // ---------------------------------------------------------------- ciblage

    /** Les attaques de zone d'un héros ne touchent que les ennemis, jamais les animaux, villageois, joueurs ou compagnons. */
    public static boolean isEnemyOf(Player player, LivingEntity e) {
        if (e == player || !e.isAlive() || e.isSpectator()) return false;
        if (e instanceof ArmorStand || e instanceof Player) return false;
        if (isOwnedBy(player, e)) return false;
        if (e instanceof Enemy) return true;
        if (e instanceof Mob mob && mob.getTarget() == player) return true;
        return e == player.getLastHurtByMob() || e == player.getLastHurtMob();
    }

    /** Les tirs visés (répulseur, unirayon) touchent ce qu'on vise, sauf ses propres compagnons. */
    public static boolean canHitDirect(Player player, LivingEntity e) {
        return e != player && e.isAlive() && !e.isSpectator() && !isOwnedBy(player, e);
    }

    private static boolean isOwnedBy(Player player, LivingEntity e) {
        return e instanceof OwnableEntity owned && player.getUUID().equals(owned.getOwnerUUID());
    }

    /** Ce que les attaques de Galactus peuvent toucher. */
    public static boolean galactusVictim(LivingEntity e) {
        if (!e.isAlive() || e instanceof GalactusEntity || e instanceof Vex || e instanceof ArmorStand) return false;
        return !(e instanceof Player p) || (!p.isCreative() && !p.isSpectator());
    }

    public static AABB around(Vec3 c, double r) {
        return new AABB(c.x - r, c.y - r, c.z - r, c.x + r, c.y + r, c.z + r);
    }

    public static List<LivingEntity> enemiesNear(Player player, Vec3 center, double radius) {
        List<LivingEntity> list = player.level().getEntitiesOfClass(LivingEntity.class, around(center, radius),
                e -> isEnemyOf(player, e) && e.getBoundingBox().getCenter().distanceToSqr(center) <= (radius + 1) * (radius + 1));
        list.sort(Comparator.comparingDouble(e -> e.distanceToSqr(center)));
        return list;
    }

    public static double horizontalDistance(Vec3 a, Vec3 b) {
        double dx = a.x - b.x;
        double dz = a.z - b.z;
        return Math.sqrt(dx * dx + dz * dz);
    }

    public static Vec3 horizontal(Vec3 v) {
        Vec3 h = new Vec3(v.x, 0, v.z);
        return h.lengthSqr() < 1.0E-6 ? new Vec3(0, 0, 0) : h.normalize();
    }

    public static Vec3 lookFlat(Entity e) {
        Vec3 h = horizontal(e.getLookAngle());
        if (h.lengthSqr() < 1.0E-6) h = Vec3.directionFromRotation(0, e.getYRot());
        return h;
    }

    public static Vec3 rightOf(Vec3 look) {
        Vec3 r = look.cross(new Vec3(0, 1, 0));
        return r.lengthSqr() < 1.0E-6 ? new Vec3(1, 0, 0) : r.normalize();
    }

    // ---------------------------------------------------------------- rayons

    public static Vec3 clipBlocks(Level level, Vec3 from, Vec3 to, Entity source) {
        BlockHitResult r = level.clip(new ClipContext(from, to, ClipContext.Block.COLLIDER, ClipContext.Fluid.NONE, source));
        return r.getType() == HitResult.Type.MISS ? to : r.getLocation();
    }

    /** Première entité traversée par le segment [from, to]. */
    @Nullable
    public static LivingEntity firstEntity(Level level, Vec3 from, Vec3 to, double inflate, Predicate<LivingEntity> filter) {
        AABB area = new AABB(from.x, from.y, from.z, to.x, to.y, to.z).inflate(inflate + 1.0);
        LivingEntity best = null;
        double bestDist = Double.MAX_VALUE;
        for (LivingEntity e : level.getEntitiesOfClass(LivingEntity.class, area, filter)) {
            AABB box = e.getBoundingBox().inflate(inflate);
            Optional<Vec3> hit = box.clip(from, to);
            double d;
            if (box.contains(from)) d = 0;
            else if (hit.isPresent()) d = from.distanceToSqr(hit.get());
            else continue;
            if (d < bestDist) {
                bestDist = d;
                best = e;
            }
        }
        return best;
    }

    /** Toutes les entités proches du segment [from, to]. */
    public static List<LivingEntity> alongBeam(Level level, Vec3 from, Vec3 to, double radius, Predicate<LivingEntity> filter) {
        AABB area = new AABB(from.x, from.y, from.z, to.x, to.y, to.z).inflate(radius + 2.0);
        Vec3 d = to.subtract(from);
        double len2 = d.lengthSqr();
        List<LivingEntity> out = new ArrayList<>();
        for (LivingEntity e : level.getEntitiesOfClass(LivingEntity.class, area, filter)) {
            Vec3 c = e.getBoundingBox().getCenter();
            double t = len2 < 1.0E-6 ? 0 : Mth.clamp(c.subtract(from).dot(d) / len2, 0.0, 1.0);
            Vec3 closest = from.add(d.scale(t));
            if (closest.distanceTo(c) <= radius + e.getBbWidth() * 0.5 + e.getBbHeight() * 0.3) out.add(e);
        }
        return out;
    }

    // ---------------------------------------------------------------- dégâts

    /** Dégâts d'un pouvoir de héros (crédités au joueur). */
    public static boolean damage(ServerPlayer player, LivingEntity target, float amount) {
        target.invulnerableTime = 0;
        boolean ok;
        abilityDamage = true;
        try {
            ok = target.hurt(player.damageSources().playerAttack(player), amount);
        } finally {
            abilityDamage = false;
        }
        if (ok) {
            player.setLastHurtMob(target);
            HeroManager.onAbilityHit(player, target);
        }
        return ok;
    }

    public static boolean damage(LivingEntity target, DamageSource source, float amount) {
        target.invulnerableTime = 0;
        return target.hurt(source, amount);
    }

    /**
     * Explosion « propre » : dégâts et projection des entités choisies, effets visuels,
     * mais aucun bloc détruit.
     */
    public static void blast(ServerLevel level, Vec3 pos, double radius, float damage, @Nullable Entity attacker,
                             @Nullable Entity direct, Predicate<LivingEntity> filter, @Nullable BlockState debris, boolean big) {
        for (LivingEntity e : level.getEntitiesOfClass(LivingEntity.class, around(pos, radius + 1), filter)) {
            double d = e.getBoundingBox().getCenter().distanceTo(pos) - e.getBbWidth() * 0.5;
            if (d > radius) continue;
            float f = (float) Math.max(0.3, 1.0 - d / (radius + 1.0));
            if (attacker instanceof ServerPlayer sp) {
                damage(sp, e, damage * f);
            } else {
                damage(e, level.damageSources().explosion(direct, attacker), damage * f);
            }
            Vec3 out = horizontal(e.position().subtract(pos));
            push(e, out.scale(0.5 + 1.0 * f).add(0, 0.45 + 0.4 * f, 0));
        }
        int blockId = debris == null ? 0 : Block.getId(debris);
        FxPayload.send(level, FxPayload.IMPACT, blockId, pos, new Vec3(big ? 1 : 0, 0, 0), (float) radius);
        sound(level, pos, net.minecraft.sounds.SoundEvents.GENERIC_EXPLODE, big ? 3.0F : 1.6F, big ? 0.6F : 0.9F);
        shake(level, pos, radius * 4, big ? 0.9F : 0.45F, 10);
    }

    // ---------------------------------------------------------------- mouvement

    /** Pousse une entité (pour un joueur, la poussée est envoyée à son client). */
    public static void push(Entity e, Vec3 v) {
        if (e instanceof ServerPlayer sp) {
            PacketDistributor.sendToPlayer(sp, new MotionPayload(v.x, v.y, v.z, true));
            sp.setDeltaMovement(sp.getDeltaMovement().add(v));
        } else {
            e.push(v.x, v.y, v.z);
            e.hurtMarked = true;
        }
    }

    /** Fixe la vitesse d'un joueur (sauts de Hulk). */
    public static void setMotion(ServerPlayer player, Vec3 v) {
        player.setDeltaMovement(v);
        player.fallDistance = 0;
        PacketDistributor.sendToPlayer(player, new MotionPayload(v.x, v.y, v.z, false));
    }

    // ---------------------------------------------------------------- ambiance

    public static void shake(ServerLevel level, Vec3 c, double radius, float intensity, int ticks) {
        for (ServerPlayer p : level.players()) {
            double d = p.position().distanceTo(c);
            if (d > radius) continue;
            float k = (float) (1.0 - d / radius * 0.7);
            PacketDistributor.sendToPlayer(p, new ShakePayload(intensity * k, ticks));
        }
    }

    public static void sound(Level level, Vec3 pos, SoundEvent sound, float volume, float pitch) {
        level.playSound(null, pos.x, pos.y, pos.z, sound, SoundSource.PLAYERS, volume, pitch);
    }

    public static void sound(Level level, Vec3 pos, Holder<SoundEvent> sound, float volume, float pitch) {
        sound(level, pos, sound.value(), volume, pitch);
    }

    public static BlockState groundBlock(Level level, Vec3 pos) {
        BlockPos bp = BlockPos.containing(pos.x, pos.y - 0.2, pos.z);
        BlockState s = level.getBlockState(bp);
        if (s.isAir()) s = level.getBlockState(bp.below());
        return s;
    }

    private Combat() {
    }
}
