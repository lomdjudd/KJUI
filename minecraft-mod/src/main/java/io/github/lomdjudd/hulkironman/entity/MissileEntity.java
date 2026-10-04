package io.github.lomdjudd.hulkironman.entity;

import io.github.lomdjudd.hulkironman.hero.Combat;
import io.github.lomdjudd.hulkironman.registry.ModEntities;
import io.github.lomdjudd.hulkironman.registry.ModItems;
import javax.annotation.Nullable;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.entity.projectile.ThrowableItemProjectile;
import net.minecraft.world.item.Item;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.EntityHitResult;
import net.minecraft.world.phys.HitResult;
import net.minecraft.world.phys.Vec3;

/** Micro-missile d'Iron Man à tête chercheuse. */
public class MissileEntity extends ThrowableItemProjectile {
    private int targetId = -1;

    public MissileEntity(EntityType<? extends MissileEntity> type, Level level) {
        super(type, level);
    }

    public MissileEntity(Level level, LivingEntity owner) {
        super(ModEntities.MISSILE.get(), owner, level);
    }

    public void setHomingTarget(@Nullable Entity target) {
        targetId = target == null ? -1 : target.getId();
    }

    @Override
    protected Item getDefaultItem() {
        return ModItems.MISSILE.get();
    }

    @Override
    protected double getDefaultGravity() {
        return 0.0;
    }

    @Override
    public void tick() {
        super.tick();
        Level level = level();
        Vec3 v = getDeltaMovement();
        if (level.isClientSide) {
            Vec3 back = position().subtract(v.scale(0.6));
            level.addParticle(ParticleTypes.FLAME, true, back.x, back.y + 0.15, back.z, 0, 0, 0);
            level.addParticle(ParticleTypes.SMOKE, true, back.x, back.y + 0.15, back.z, 0, 0.02, 0);
            if (random.nextInt(3) == 0) level.addParticle(ParticleTypes.FIREWORK, back.x, back.y + 0.15, back.z, 0, 0, 0);
            return;
        }
        if (isRemoved()) return;
        if (tickCount > 5) {
            Entity target = targetId >= 0 ? level.getEntity(targetId) : null;
            if (target != null && target.isAlive()) {
                Vec3 want = target.getBoundingBox().getCenter().subtract(position()).normalize().scale(1.4);
                setDeltaMovement(v.lerp(want, 0.22));
            } else {
                double speed = Math.min(1.4, v.length() + 0.1);
                if (v.lengthSqr() > 1.0E-4) setDeltaMovement(v.normalize().scale(speed));
            }
        }
        if (tickCount > 120) explode(position());
    }

    @Override
    protected boolean canHitEntity(Entity e) {
        if (!super.canHitEntity(e) || e == getOwner() || e instanceof MissileEntity) return false;
        if (getOwner() instanceof Player p) return e instanceof LivingEntity le && Combat.canHitDirect(p, le) && Combat.isEnemyOf(p, le);
        return true;
    }

    @Override
    protected void onHit(HitResult result) {
        super.onHit(result);
        if (!level().isClientSide && !isRemoved()) {
            explode(result instanceof EntityHitResult er ? er.getEntity().getBoundingBox().getCenter() : result.getLocation());
        }
    }

    private void explode(Vec3 pos) {
        if (!(level() instanceof ServerLevel sl)) return;
        Entity owner = getOwner();
        if (owner instanceof Player p) {
            Combat.blast(sl, pos, 3.0, 10F, owner, this, e -> Combat.isEnemyOf(p, e), null, false);
        } else {
            Combat.blast(sl, pos, 3.0, 10F, owner, this, e -> e != owner, null, false);
        }
        Combat.sound(sl, pos, SoundEvents.FIREWORK_ROCKET_LARGE_BLAST, 1.2F, 1.0F);
        discard();
    }

    @Override
    public boolean shouldBeSaved() {
        return false;
    }
}
