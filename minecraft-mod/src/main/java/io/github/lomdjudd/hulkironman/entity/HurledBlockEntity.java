package io.github.lomdjudd.hulkironman.entity;

import io.github.lomdjudd.hulkironman.hero.Combat;
import io.github.lomdjudd.hulkironman.registry.ModEntities;
import java.util.function.Predicate;
import javax.annotation.Nullable;
import net.minecraft.core.particles.BlockParticleOption;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.network.syncher.EntityDataAccessor;
import net.minecraft.network.syncher.EntityDataSerializers;
import net.minecraft.network.syncher.SynchedEntityData;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.monster.Vex;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.entity.projectile.ThrowableProjectile;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.EntityHitResult;
import net.minecraft.world.phys.HitResult;
import net.minecraft.world.phys.Vec3;

/** Bloc projeté : rocher lancé par Hulk, ou météore de Galactus. Il explose sans casser le décor. */
public class HurledBlockEntity extends ThrowableProjectile {
    private static final EntityDataAccessor<BlockState> DATA_BLOCK = SynchedEntityData.defineId(HurledBlockEntity.class, EntityDataSerializers.BLOCK_STATE);
    private static final EntityDataAccessor<Float> DATA_SIZE = SynchedEntityData.defineId(HurledBlockEntity.class, EntityDataSerializers.FLOAT);
    private static final EntityDataAccessor<Boolean> DATA_METEOR = SynchedEntityData.defineId(HurledBlockEntity.class, EntityDataSerializers.BOOLEAN);

    private float damage = 16F;
    private float radius = 3.5F;

    public HurledBlockEntity(EntityType<? extends HurledBlockEntity> type, Level level) {
        super(type, level);
    }

    public static HurledBlockEntity boulder(Level level, LivingEntity owner, BlockState state, float size, float damage, float radius) {
        HurledBlockEntity e = new HurledBlockEntity(ModEntities.HURLED_BLOCK.get(), level);
        e.setOwner(owner);
        e.entityData.set(DATA_BLOCK, state);
        e.entityData.set(DATA_SIZE, size);
        e.damage = damage;
        e.radius = radius;
        return e;
    }

    public static HurledBlockEntity meteor(Level level, LivingEntity owner, double x, double y, double z, float damage) {
        HurledBlockEntity e = new HurledBlockEntity(ModEntities.HURLED_BLOCK.get(), level);
        e.setOwner(owner);
        e.setPos(x, y, z);
        e.entityData.set(DATA_BLOCK, Blocks.MAGMA_BLOCK.defaultBlockState());
        e.entityData.set(DATA_SIZE, 2.2F);
        e.entityData.set(DATA_METEOR, true);
        e.damage = damage;
        e.radius = 4.0F;
        return e;
    }

    @Override
    protected void defineSynchedData(SynchedEntityData.Builder builder) {
        builder.define(DATA_BLOCK, Blocks.COBBLESTONE.defaultBlockState());
        builder.define(DATA_SIZE, 1.5F);
        builder.define(DATA_METEOR, false);
    }

    public BlockState getBlockState() {
        return entityData.get(DATA_BLOCK);
    }

    public float getSize() {
        return entityData.get(DATA_SIZE);
    }

    public boolean isMeteor() {
        return entityData.get(DATA_METEOR);
    }

    @Override
    protected double getDefaultGravity() {
        return isMeteor() ? 0.04 : 0.035;
    }

    @Override
    public void tick() {
        super.tick();
        Level level = level();
        if (level.isClientSide) {
            Vec3 p = position();
            if (isMeteor()) {
                for (int i = 0; i < 3; i++) {
                    level.addParticle(ParticleTypes.FLAME, true, p.x + (random.nextDouble() - 0.5) * 1.6, p.y + random.nextDouble() * 1.6,
                            p.z + (random.nextDouble() - 0.5) * 1.6, 0, 0.05, 0);
                }
                level.addParticle(ParticleTypes.LARGE_SMOKE, true, p.x, p.y + 1, p.z, 0, 0.1, 0);
                if (random.nextInt(3) == 0) level.addParticle(ParticleTypes.LAVA, p.x, p.y + 1, p.z, 0, 0, 0);
            } else {
                level.addParticle(ParticleTypes.CLOUD, p.x, p.y + 0.5, p.z, 0, 0, 0);
                if (random.nextInt(2) == 0) {
                    level.addParticle(new BlockParticleOption(ParticleTypes.BLOCK, getBlockState()), p.x, p.y + 0.5, p.z, 0, 0, 0);
                }
            }
        } else if (tickCount > 200) {
            discard();
        }
    }

    @Override
    protected boolean canHitEntity(Entity e) {
        if (!super.canHitEntity(e) || e == getOwner() || e instanceof HurledBlockEntity) return false;
        if (isMeteor()) return !(e instanceof GalactusEntity) && !(e instanceof Vex);
        return true;
    }

    @Override
    protected void onHit(HitResult result) {
        super.onHit(result);
        if (level() instanceof ServerLevel sl && !isRemoved()) {
            Entity direct = result instanceof EntityHitResult er ? er.getEntity() : null;
            impact(sl, result.getLocation(), direct);
            discard();
        }
    }

    private void impact(ServerLevel level, Vec3 pos, @Nullable Entity direct) {
        Entity owner = getOwner();
        Predicate<LivingEntity> filter;
        if (isMeteor()) filter = Combat::galactusVictim;
        else if (owner instanceof Player p) filter = e -> e == direct ? Combat.canHitDirect(p, e) : Combat.isEnemyOf(p, e);
        else filter = e -> e != owner;
        Combat.blast(level, pos, radius, damage, owner, this, filter, getBlockState(), isMeteor());
    }

    @Override
    public boolean shouldBeSaved() {
        return false;
    }
}
