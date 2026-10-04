package io.github.lomdjudd.hulkironman.entity;

import io.github.lomdjudd.hulkironman.hero.Combat;
import io.github.lomdjudd.hulkironman.hero.Scheduler;
import io.github.lomdjudd.hulkironman.network.FxPayload;
import io.github.lomdjudd.hulkironman.registry.ModEntities;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import javax.annotation.Nullable;
import net.minecraft.ChatFormatting;
import net.minecraft.core.BlockPos;
import net.minecraft.core.particles.DustParticleOptions;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.network.chat.Component;
import net.minecraft.network.syncher.EntityDataAccessor;
import net.minecraft.network.syncher.EntityDataSerializers;
import net.minecraft.network.syncher.SynchedEntityData;
import net.minecraft.server.level.ServerBossEvent;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.tags.DamageTypeTags;
import net.minecraft.util.Mth;
import net.minecraft.world.BossEvent;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.damagesource.DamageTypes;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.ExperienceOrb;
import net.minecraft.world.entity.LightningBolt;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.MobSpawnType;
import net.minecraft.world.entity.ai.attributes.AttributeSupplier;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.ai.goal.Goal;
import net.minecraft.world.entity.ai.goal.LookAtPlayerGoal;
import net.minecraft.world.entity.ai.goal.RandomLookAroundGoal;
import net.minecraft.world.entity.ai.goal.target.HurtByTargetGoal;
import net.minecraft.world.entity.ai.goal.target.NearestAttackableTargetGoal;
import net.minecraft.world.entity.animal.IronGolem;
import net.minecraft.world.entity.monster.Monster;
import net.minecraft.world.entity.monster.Vex;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.Explosion;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.phys.Vec3;
import org.joml.Vector3f;

/**
 * Galactus, le Dévoreur de Mondes : boss géant (12 blocs de haut, 1000 PV) en trois phases.
 *
 * Attaques : rayon cosmique (esquivable en se déplaçant ou derrière un mur), pluie de météores
 * (cercles rouges au sol), onde de choc tellurique (à sauter !), puits gravitationnel suivi
 * d'une dévoration, et invocation de hérauts cosmiques.
 */
public class GalactusEntity extends Monster {
    public static final int S_IDLE = 0;
    public static final int S_DESCEND = 1;
    public static final int S_BEAM_CHARGE = 2;
    public static final int S_BEAM = 3;
    public static final int S_METEOR = 4;
    public static final int S_SLAM = 5;
    public static final int S_GRAVITY = 6;
    public static final int S_SUMMON = 7;
    public static final int S_PHASE = 8;

    private static final EntityDataAccessor<Integer> DATA_STATE = SynchedEntityData.defineId(GalactusEntity.class, EntityDataSerializers.INT);
    private static final EntityDataAccessor<Integer> DATA_PHASE = SynchedEntityData.defineId(GalactusEntity.class, EntityDataSerializers.INT);
    private static final EntityDataAccessor<Vector3f> DATA_BEAM = SynchedEntityData.defineId(GalactusEntity.class, EntityDataSerializers.VECTOR3);

    private final ServerBossEvent bossEvent = new ServerBossEvent(Component.translatable("entity.hulkironman.galactus"),
            BossEvent.BossBarColor.PURPLE, BossEvent.BossBarOverlay.NOTCHED_10);

    private int stateTicks;
    private int attackCooldown = 60;
    private int stuckTicks;
    private int farTicks;
    @Nullable
    private Vec3 lastPos;
    private Vec3 beamPoint = Vec3.ZERO;
    private final Set<Integer> slamHit = new HashSet<>();
    private boolean introDone;

    // côté client, pour l'animation
    public int clientStateTicks;
    private int lastClientState = -1;

    public GalactusEntity(EntityType<? extends GalactusEntity> type, Level level) {
        super(type, level);
        this.xpReward = 500;
        this.noCulling = true;
        this.bossEvent.setDarkenScreen(true);
        this.setPersistenceRequired();
    }

    public static AttributeSupplier.Builder createAttributes() {
        return Monster.createMonsterAttributes()
                .add(Attributes.MAX_HEALTH, 1000.0)
                .add(Attributes.ARMOR, 12.0)
                .add(Attributes.ARMOR_TOUGHNESS, 8.0)
                .add(Attributes.ATTACK_DAMAGE, 20.0)
                .add(Attributes.MOVEMENT_SPEED, 0.3)
                .add(Attributes.FOLLOW_RANGE, 80.0)
                .add(Attributes.KNOCKBACK_RESISTANCE, 1.0)
                .add(Attributes.STEP_HEIGHT, 3.0);
    }

    @Override
    protected void defineSynchedData(SynchedEntityData.Builder builder) {
        super.defineSynchedData(builder);
        builder.define(DATA_STATE, S_IDLE);
        builder.define(DATA_PHASE, 1);
        builder.define(DATA_BEAM, new Vector3f());
    }

    @Override
    protected void registerGoals() {
        this.goalSelector.addGoal(5, new WalkToTargetGoal());
        this.goalSelector.addGoal(8, new LookAtPlayerGoal(this, Player.class, 64.0F));
        this.goalSelector.addGoal(9, new RandomLookAroundGoal(this));
        this.targetSelector.addGoal(1, new HurtByTargetGoal(this));
        this.targetSelector.addGoal(2, new NearestAttackableTargetGoal<>(this, Player.class, false));
        this.targetSelector.addGoal(3, new NearestAttackableTargetGoal<>(this, IronGolem.class, false));
    }

    // ------------------------------------------------------------------ état

    public int getState() {
        return entityData.get(DATA_STATE);
    }

    public int getPhase() {
        return entityData.get(DATA_PHASE);
    }

    public Vector3f getBeamEnd() {
        return entityData.get(DATA_BEAM);
    }

    public void setState(int s) {
        entityData.set(DATA_STATE, s);
        stateTicks = 0;
    }

    /** Lance une attaque précise (utilisé par l'auto-test). */
    public void forceState(int s) {
        startState(s);
    }

    private void startState(int s) {
        setState(s);
        getNavigation().stop();
        Vec3 c = position();
        switch (s) {
            case S_BEAM_CHARGE -> {
                Combat.sound(level(), c, SoundEvents.WARDEN_SONIC_CHARGE, 4.0F, 0.5F);
                Combat.sound(level(), c, SoundEvents.BEACON_POWER_SELECT, 3.0F, 0.5F);
            }
            case S_METEOR -> {
                Combat.sound(level(), c, SoundEvents.ENDER_DRAGON_GROWL, 4.0F, 0.5F);
                if (random.nextInt(3) == 0) say("meteor");
            }
            case S_SLAM -> Combat.sound(level(), c, SoundEvents.RAVAGER_ROAR, 4.0F, 0.4F);
            case S_GRAVITY -> {
                Combat.sound(level(), c, SoundEvents.PORTAL_TRIGGER, 3.0F, 0.6F);
                say("gravity");
            }
            case S_SUMMON -> Combat.sound(level(), c, SoundEvents.EVOKER_PREPARE_SUMMON, 4.0F, 0.5F);
            default -> {
            }
        }
    }

    private int nextCooldown() {
        int base = switch (getPhase()) {
            case 1 -> 70;
            case 2 -> 45;
            default -> 30;
        };
        return base + random.nextInt(30);
    }

    // ------------------------------------------------------------------ IA

    @Override
    protected void customServerAiStep() {
        super.customServerAiStep();
        if (!(level() instanceof ServerLevel level)) return;
        bossEvent.setProgress(getHealth() / getMaxHealth());
        if (!introDone && tickCount > 5) {
            introDone = true;
            say("intro");
        }
        LivingEntity target = getTarget();
        if (target != null && (!target.isAlive() || (target instanceof Player p && (p.isCreative() || p.isSpectator())))) {
            setTarget(null);
            target = null;
        }
        stateTicks++;
        switch (getState()) {
            case S_DESCEND -> tickDescend(level);
            case S_IDLE -> tickIdle(target);
            case S_BEAM_CHARGE -> tickBeamCharge(level, target);
            case S_BEAM -> tickBeam(level, target);
            case S_METEOR -> tickMeteor(level, target);
            case S_SLAM -> tickSlam(level);
            case S_GRAVITY -> tickGravity(level);
            case S_SUMMON -> tickSummon(level, target);
            case S_PHASE -> {
                if (stateTicks >= 40) {
                    setState(S_IDLE);
                    attackCooldown = 20;
                }
            }
            default -> setState(S_IDLE);
        }
        checkPhase(level);
        if (getPhase() >= 3 && target != null && getState() != S_DESCEND && tickCount % 30 == 0) dropMeteorNear(level, target);
        checkStuck(level, target);
    }

    private void tickDescend(ServerLevel level) {
        setNoGravity(true);
        setDeltaMovement(0, -0.35, 0);
        if (stateTicks % 3 == 0) FxPayload.send(level, FxPayload.SUMMON, position(), 2F);
        if (onGround() || stateTicks > 400) {
            setNoGravity(false);
            setState(S_IDLE);
            attackCooldown = 50;
            Vec3 c = position();
            FxPayload.send(level, FxPayload.GALACTUS_PHASE, c.add(0, 2, 0), 8F);
            Scheduler.repeat(12, age -> FxPayload.send(level, FxPayload.RING, 0, c.add(0, 0.1, 0), new Vec3(0.6, 0.2, 0.9), 2F + age * 1.8F));
            for (LivingEntity e : level.getEntitiesOfClass(LivingEntity.class, Combat.around(c, 14), Combat::galactusVictim)) {
                Combat.damage(e, damageSources().mobAttack(this), 10F);
                Combat.push(e, Combat.horizontal(e.position().subtract(c)).scale(1.4).add(0, 0.9, 0));
            }
            Combat.sound(level, c, SoundEvents.GENERIC_EXPLODE, 5.0F, 0.4F);
            Combat.sound(level, c, SoundEvents.WITHER_SPAWN, 3.0F, 0.6F);
            Combat.shake(level, c, 80, 2.0F, 30);
            say("arrive");
        }
    }

    private void tickIdle(@Nullable LivingEntity target) {
        if (target == null) return;
        getLookControl().setLookAt(target, 10F, 10F);
        if (--attackCooldown > 0) return;
        double d = distanceTo(target);
        float r = random.nextFloat();
        int next;
        if (d < 10) next = r < 0.55F ? S_SLAM : r < 0.8F ? S_GRAVITY : S_BEAM_CHARGE;
        else if (d < 48) next = r < 0.4F ? S_BEAM_CHARGE : r < 0.7F ? S_METEOR : r < 0.85F ? S_GRAVITY : S_SUMMON;
        else return;
        if (next == S_SUMMON && countHeralds() >= 4) next = S_METEOR;
        startState(next);
    }

    public Vec3 beamOrigin() {
        Vec3 fwd = Vec3.directionFromRotation(0, getYHeadRot());
        return position().add(0, getEyeHeight() - 0.2, 0).add(fwd.scale(1.5));
    }

    private void tickBeamCharge(ServerLevel level, @Nullable LivingEntity target) {
        if (target != null) getLookControl().setLookAt(target, 20F, 20F);
        if (stateTicks % 4 == 0) FxPayload.send(level, FxPayload.CHARGE, 0, beamOrigin(), new Vec3(0.75, 0.3, 1.0), 3F);
        if (stateTicks >= 30) {
            beamPoint = target != null ? target.position().add(0, target.getBbHeight() * 0.5, 0)
                    : beamOrigin().add(Vec3.directionFromRotation(20, getYHeadRot()).scale(20));
            setState(S_BEAM);
            Combat.sound(level, position(), SoundEvents.WARDEN_SONIC_BOOM, 5.0F, 0.5F);
            Combat.sound(level, position(), SoundEvents.BEACON_ACTIVATE, 4.0F, 0.5F);
        }
    }

    private void tickBeam(ServerLevel level, @Nullable LivingEntity target) {
        if (target != null) {
            Vec3 want = target.position().add(0, target.getBbHeight() * 0.5, 0);
            Vec3 diff = want.subtract(beamPoint);
            double max = getPhase() >= 2 ? 0.9 : 0.6;
            beamPoint = diff.length() <= max ? want : beamPoint.add(diff.normalize().scale(max));
        }
        Vec3 eye = beamOrigin();
        Vec3 dir = beamPoint.subtract(eye);
        if (dir.lengthSqr() < 1.0E-4) dir = Vec3.directionFromRotation(20, getYHeadRot());
        Vec3 end = Combat.clipBlocks(level, eye, eye.add(dir.normalize().scale(80)), this);
        entityData.set(DATA_BEAM, new Vector3f((float) end.x, (float) end.y, (float) end.z));
        getLookControl().setLookAt(end.x, end.y, end.z);
        if (stateTicks % 4 == 0) {
            float dmg = getPhase() >= 2 ? 9F : 7F;
            for (LivingEntity e : Combat.alongBeam(level, eye, end, 1.6, Combat::galactusVictim)) {
                Combat.damage(e, damageSources().indirectMagic(this, this), dmg);
                e.igniteForSeconds(3);
            }
        }
        if (stateTicks % 3 == 0) FxPayload.send(level, FxPayload.IMPACT, 0, end, Vec3.ZERO, 2F);
        if (stateTicks % 6 == 0) {
            level.explode(this, end.x, end.y, end.z, 2.0F, Level.ExplosionInteraction.NONE);
        }
        if (stateTicks >= 50) {
            setState(S_IDLE);
            attackCooldown = nextCooldown();
        }
    }

    private void tickMeteor(ServerLevel level, @Nullable LivingEntity target) {
        int every = getPhase() >= 2 ? 3 : 5;
        if (stateTicks > 20 && stateTicks % every == 0) {
            LivingEntity aim = target != null ? target : this;
            dropMeteorNear(level, aim);
        }
        if (stateTicks >= 80) {
            setState(S_IDLE);
            attackCooldown = nextCooldown();
        }
    }

    private void dropMeteorNear(ServerLevel level, LivingEntity aim) {
        double ang = random.nextDouble() * Math.PI * 2;
        double dist = aim == this ? 8 + random.nextDouble() * 16 : random.nextDouble() * 8;
        double x = aim.getX() + Math.cos(ang) * dist;
        double z = aim.getZ() + Math.sin(ang) * dist;
        int ground = level.getHeight(Heightmap.Types.MOTION_BLOCKING, Mth.floor(x), Mth.floor(z));
        double y = Math.max(ground, aim.getY()) + 38;
        HurledBlockEntity m = HurledBlockEntity.meteor(level, this, x, y, z, getPhase() >= 2 ? 16F : 13F);
        m.setDeltaMovement((random.nextDouble() - 0.5) * 0.2, -1.6, (random.nextDouble() - 0.5) * 0.2);
        level.addFreshEntity(m);
        FxPayload.send(level, FxPayload.WARNING, new Vec3(x, ground + 0.1, z), 4F);
        if (random.nextInt(3) == 0) Combat.sound(level, new Vec3(x, ground, z), SoundEvents.BLAZE_SHOOT, 2.0F, 0.5F);
    }

    private void tickSlam(ServerLevel level) {
        Vec3 c = position();
        if (stateTicks == 25) {
            slamHit.clear();
            FxPayload.send(level, FxPayload.IMPACT, 0, c, new Vec3(1, 0, 0), 5F);
            Combat.sound(level, c, SoundEvents.GENERIC_EXPLODE, 5.0F, 0.4F);
            Combat.sound(level, c, SoundEvents.MACE_SMASH_GROUND_HEAVY, 4.0F, 0.5F);
            Combat.shake(level, c, 50, 1.8F, 20);
        }
        if (stateTicks >= 25 && stateTicks < 47) {
            double r = 3.0 + (stateTicks - 25);
            FxPayload.send(level, FxPayload.RING, 0, c.add(0, 0.1, 0), new Vec3(0.7, 0.3, 1.0), (float) r);
            for (LivingEntity e : level.getEntitiesOfClass(LivingEntity.class, Combat.around(c, r + 2), Combat::galactusVictim)) {
                double d = Combat.horizontalDistance(e.position(), c);
                if (d < r - 1.5 || d > r + 1.5) continue;
                if (e.getY() > c.y + 1.6 && !e.onGround()) continue; // sauté par-dessus !
                if (!slamHit.add(e.getId())) continue;
                Combat.damage(e, damageSources().mobAttack(this), getPhase() >= 2 ? 16F : 13F);
                Combat.push(e, Combat.horizontal(e.position().subtract(c)).scale(1.2).add(0, 1.0, 0));
            }
        }
        if (stateTicks >= 52) {
            setState(S_IDLE);
            attackCooldown = nextCooldown();
        }
    }

    private void tickGravity(ServerLevel level) {
        Vec3 center = position().add(0, 3, 0);
        if (stateTicks < 60) {
            for (LivingEntity e : level.getEntitiesOfClass(LivingEntity.class, Combat.around(center, 30), Combat::galactusVictim)) {
                Vec3 pull = center.subtract(e.position());
                if (pull.length() < 4) continue;
                Combat.push(e, pull.normalize().scale(0.08));
            }
            if (stateTicks % 5 == 0) FxPayload.send(level, FxPayload.GRAVITY, center, 30F);
        }
        if (stateTicks == 60) {
            float healed = 0;
            for (LivingEntity e : level.getEntitiesOfClass(LivingEntity.class, Combat.around(center, 9), Combat::galactusVictim)) {
                if (Combat.damage(e, damageSources().indirectMagic(this, this), getPhase() >= 2 ? 24F : 20F)) healed += 25F;
                Combat.push(e, new Vec3(0, 0.8, 0));
            }
            if (healed > 0) heal(Math.min(healed, 75F));
            FxPayload.send(level, FxPayload.DEVOUR, center, 9F);
            Combat.sound(level, center, SoundEvents.WARDEN_ROAR, 4.0F, 0.6F);
            Combat.sound(level, center, SoundEvents.GENERIC_EXPLODE, 3.0F, 0.5F);
            Combat.shake(level, center, 40, 1.4F, 16);
        }
        if (stateTicks >= 70) {
            setState(S_IDLE);
            attackCooldown = nextCooldown();
        }
    }

    private void tickSummon(ServerLevel level, @Nullable LivingEntity target) {
        if (stateTicks == 12) {
            for (int i = 0; i < 3; i++) {
                Vex vex = EntityType.VEX.create(level);
                if (vex == null) continue;
                double a = (Math.PI * 2 / 3) * i;
                BlockPos pos = BlockPos.containing(getX() + Math.cos(a) * 4, getY() + 6, getZ() + Math.sin(a) * 4);
                vex.moveTo(pos, 0F, 0F);
                vex.finalizeSpawn(level, level.getCurrentDifficultyAt(pos), MobSpawnType.MOB_SUMMONED, null);
                vex.setOwner(this);
                vex.setBoundOrigin(pos);
                vex.setLimitedLife(20 * 40);
                vex.setCustomName(Component.translatable("entity.hulkironman.herald").withStyle(ChatFormatting.LIGHT_PURPLE));
                vex.addEffect(new MobEffectInstance(MobEffects.GLOWING, 20 * 40, 0, false, false));
                if (target != null) vex.setTarget(target);
                level.addFreshEntity(vex);
                FxPayload.send(level, FxPayload.SUMMON, Vec3.atCenterOf(pos), 2F);
            }
            Combat.sound(level, position(), SoundEvents.EVOKER_CAST_SPELL, 4.0F, 0.5F);
        }
        if (stateTicks >= 30) {
            setState(S_IDLE);
            attackCooldown = nextCooldown();
        }
    }

    private int countHeralds() {
        List<Vex> list = level().getEntitiesOfClass(Vex.class, getBoundingBox().inflate(64), v -> v.getOwner() == this);
        return list.size();
    }

    private void checkPhase(ServerLevel level) {
        float hp = getHealth() / getMaxHealth();
        int phase = getPhase();
        if ((phase == 1 && hp <= 0.5F) || (phase == 2 && hp <= 0.25F)) {
            int next = phase + 1;
            entityData.set(DATA_PHASE, next);
            setState(S_PHASE);
            entityData.set(DATA_BEAM, new Vector3f());
            say("phase" + next);
            Vec3 c = position();
            FxPayload.send(level, FxPayload.GALACTUS_PHASE, c.add(0, 5, 0), 10F);
            Combat.sound(level, c, SoundEvents.WITHER_SPAWN, 4.0F, 0.5F);
            Combat.sound(level, c, SoundEvents.WARDEN_ROAR, 4.0F, 0.5F);
            Combat.shake(level, c, 80, 2.0F, 30);
            for (int i = 0; i < 6; i++) {
                double a = Math.PI * 2 * i / 6;
                visualLightning(level, c.add(Math.cos(a) * 9, 0, Math.sin(a) * 9));
            }
        }
    }

    /** Si Galactus est coincé (forêt, falaise) ou trop loin, il fait un « pas cosmique » près de sa cible. */
    private void checkStuck(ServerLevel level, @Nullable LivingEntity target) {
        if (target == null || getState() != S_IDLE) {
            stuckTicks = 0;
            farTicks = 0;
            lastPos = position();
            return;
        }
        double d = distanceTo(target);
        if (d > 20 && lastPos != null && position().distanceToSqr(lastPos) < 0.0025) stuckTicks++;
        else stuckTicks = 0;
        if (d > 64) farTicks++;
        else farTicks = 0;
        lastPos = position();
        if (stuckTicks > 60 || farTicks > 100) {
            stuckTicks = 0;
            farTicks = 0;
            cosmicStep(level, target);
        }
    }

    private void cosmicStep(ServerLevel level, LivingEntity target) {
        double ang = random.nextDouble() * Math.PI * 2;
        double x = target.getX() + Math.cos(ang) * 16;
        double z = target.getZ() + Math.sin(ang) * 16;
        int y = level.getHeight(Heightmap.Types.MOTION_BLOCKING_NO_LEAVES, Mth.floor(x), Mth.floor(z));
        FxPayload.send(level, FxPayload.SUMMON, position().add(0, 5, 0), 4F);
        teleportTo(x, y, z);
        FxPayload.send(level, FxPayload.SUMMON, position().add(0, 5, 0), 4F);
        Combat.sound(level, position(), SoundEvents.ENDERMAN_TELEPORT, 4.0F, 0.4F);
    }

    private void say(String key) {
        if (!(level() instanceof ServerLevel level)) return;
        Component msg = Component.literal("<Galactus> ").withStyle(ChatFormatting.DARK_PURPLE, ChatFormatting.BOLD)
                .append(Component.translatable("message.hulkironman.galactus." + key).withStyle(ChatFormatting.LIGHT_PURPLE));
        for (ServerPlayer p : level.players()) {
            if (p.distanceToSqr(this) < 160 * 160) p.sendSystemMessage(msg);
        }
    }

    private static void visualLightning(ServerLevel level, Vec3 pos) {
        LightningBolt bolt = EntityType.LIGHTNING_BOLT.create(level);
        if (bolt == null) return;
        bolt.moveTo(pos);
        bolt.setVisualOnly(true);
        level.addFreshEntity(bolt);
    }

    // ------------------------------------------------------------------ invocation

    /** Invocation dramatique avec l'Orbe Cosmique : le ciel s'assombrit, puis Galactus descend. */
    public static void summonFromSky(ServerLevel level, BlockPos pos) {
        Vec3 c = Vec3.atBottomCenterOf(pos);
        Component warn = Component.translatable("message.hulkironman.galactus.coming").withStyle(ChatFormatting.DARK_PURPLE, ChatFormatting.ITALIC);
        for (ServerPlayer p : level.players()) {
            if (p.distanceToSqr(c) < 160 * 160) {
                p.sendSystemMessage(warn);
                p.addEffect(new MobEffectInstance(MobEffects.DARKNESS, 80, 0, false, false));
            }
        }
        Combat.sound(level, c, SoundEvents.END_PORTAL_SPAWN, 5.0F, 0.5F);
        for (int i = 0; i < 4; i++) {
            final int k = i;
            Scheduler.later(i * 15, () -> {
                double a = level.random.nextDouble() * Math.PI * 2;
                visualLightning(level, c.add(Math.cos(a) * (6 + k * 2), 0, Math.sin(a) * (6 + k * 2)));
            });
        }
        Scheduler.later(60, () -> {
            GalactusEntity g = ModEntities.GALACTUS.get().create(level);
            if (g == null) return;
            boolean sky = level.canSeeSky(pos);
            double y = sky ? Math.min(pos.getY() + 40, level.getMaxBuildHeight() - 14) : pos.getY();
            g.moveTo(c.x, y, c.z, level.random.nextFloat() * 360F, 0F);
            g.setState(sky ? S_DESCEND : S_IDLE);
            level.addFreshEntity(g);
            FxPayload.send(level, FxPayload.GALACTUS_PHASE, new Vec3(c.x, y + 5, c.z), 8F);
        });
    }

    // ------------------------------------------------------------------ dégâts et immunités

    @Override
    public boolean hurt(DamageSource source, float amount) {
        int s = getState();
        if ((s == S_DESCEND || s == S_PHASE) && !source.is(DamageTypeTags.BYPASSES_INVULNERABILITY)) return false;
        return super.hurt(source, amount);
    }

    @Override
    public boolean isInvulnerableTo(DamageSource source) {
        return source.is(DamageTypes.IN_WALL) || source.is(DamageTypes.DROWN) || source.is(DamageTypes.CRAMMING)
                || source.is(DamageTypeTags.IS_FALL) || super.isInvulnerableTo(source);
    }

    @Override
    public boolean ignoreExplosion(Explosion explosion) {
        return true;
    }

    @Override
    public boolean causeFallDamage(float distance, float multiplier, DamageSource source) {
        return false;
    }

    @Override
    public boolean canBreatheUnderwater() {
        return true;
    }

    @Override
    public boolean isPushable() {
        return false;
    }

    @Override
    public boolean removeWhenFarAway(double distance) {
        return false;
    }

    // ------------------------------------------------------------------ mort spectaculaire

    @Override
    protected void tickDeath() {
        ++this.deathTime;
        if (level() instanceof ServerLevel level) {
            if (deathTime == 1) {
                say("death");
                bossEvent.setProgress(0F);
                Combat.sound(level, position(), SoundEvents.ENDER_DRAGON_DEATH, 5.0F, 0.6F);
            }
            if (deathTime % 4 == 0) {
                Vec3 p = position().add((random.nextDouble() - 0.5) * 6, random.nextDouble() * 10, (random.nextDouble() - 0.5) * 6);
                FxPayload.send(level, FxPayload.IMPACT, 0, p, new Vec3(1, 0, 0), 3F);
                Combat.sound(level, p, SoundEvents.GENERIC_EXPLODE, 3.0F, 0.6F + random.nextFloat() * 0.4F);
            }
            if (deathTime == 60) {
                FxPayload.send(level, FxPayload.GALACTUS_PHASE, position().add(0, 5, 0), 14F);
                for (int i = 0; i < 4; i++) visualLightning(level, position().add((random.nextDouble() - 0.5) * 10, 0, (random.nextDouble() - 0.5) * 10));
            }
            if (deathTime >= 80 && !isRemoved()) {
                FxPayload.send(level, FxPayload.SPHERE, 0, position().add(0, 4, 0), new Vec3(0.8, 0.4, 1.0), 12F);
                ExperienceOrb.award(level, position().add(0, 2, 0), 300);
                level.broadcastEntityEvent(this, (byte) 60);
                remove(Entity.RemovalReason.KILLED);
            }
        }
    }

    // ------------------------------------------------------------------ client : particules et animation

    @Override
    public void aiStep() {
        super.aiStep();
        if (level().isClientSide) clientParticles();
    }

    private void clientParticles() {
        int s = getState();
        if (s != lastClientState) {
            lastClientState = s;
            clientStateTicks = 0;
        }
        clientStateTicks++;
        Level level = level();
        if (s == S_BEAM_CHARGE || s == S_BEAM) {
            Vec3 eye = beamOrigin();
            for (int i = 0; i < 3; i++) {
                Vec3 off = new Vec3(random.nextDouble() - 0.5, random.nextDouble() - 0.5, random.nextDouble() - 0.5).normalize().scale(2.5);
                level.addParticle(ParticleTypes.END_ROD, true, eye.x + off.x, eye.y + off.y, eye.z + off.z, -off.x * 0.12, -off.y * 0.12, -off.z * 0.12);
            }
        }
        if (s == S_BEAM) {
            Vector3f e = getBeamEnd();
            Vec3 a = beamOrigin();
            Vec3 b = new Vec3(e.x(), e.y(), e.z());
            for (int i = 0; i < 6; i++) {
                Vec3 p = a.lerp(b, random.nextDouble());
                level.addParticle(new DustParticleOptions(new Vector3f(0.75F, 0.35F, 1.0F), 2.5F), true,
                        p.x + (random.nextDouble() - 0.5), p.y + (random.nextDouble() - 0.5), p.z + (random.nextDouble() - 0.5), 0, 0, 0);
            }
        }
        if (s == S_DESCEND) {
            for (int i = 0; i < 4; i++) {
                level.addParticle(ParticleTypes.CLOUD, true, getX() + (random.nextDouble() - 0.5) * 6, getY() - 0.5, getZ() + (random.nextDouble() - 0.5) * 6, 0, -0.1, 0);
            }
        }
        if (getPhase() >= 2 && tickCount % 2 == 0) {
            level.addParticle(new DustParticleOptions(new Vector3f(0.65F, 0.2F, 0.95F), 2.0F), getX() + (random.nextDouble() - 0.5) * 5,
                    getY() + random.nextDouble() * 11, getZ() + (random.nextDouble() - 0.5) * 5, 0, 0.05, 0);
        }
        if (tickCount % 3 == 0) {
            level.addParticle(ParticleTypes.REVERSE_PORTAL, getX() + (random.nextDouble() - 0.5) * 7, getY() + 3 + random.nextDouble() * 3,
                    getZ() + (random.nextDouble() - 0.5) * 7, 0, 0.02, 0);
        }
    }

    // ------------------------------------------------------------------ barre de boss, sons, sauvegarde

    @Override
    public void startSeenByPlayer(ServerPlayer player) {
        super.startSeenByPlayer(player);
        bossEvent.addPlayer(player);
    }

    @Override
    public void stopSeenByPlayer(ServerPlayer player) {
        super.stopSeenByPlayer(player);
        bossEvent.removePlayer(player);
    }

    @Override
    public void setCustomName(@Nullable Component name) {
        super.setCustomName(name);
        bossEvent.setName(getDisplayName());
    }

    @Override
    protected SoundEvent getAmbientSound() {
        return SoundEvents.WARDEN_AMBIENT;
    }

    @Override
    protected SoundEvent getHurtSound(DamageSource source) {
        return SoundEvents.IRON_GOLEM_HURT;
    }

    @Override
    protected SoundEvent getDeathSound() {
        return SoundEvents.WITHER_DEATH;
    }

    @Override
    protected float getSoundVolume() {
        return 4.0F;
    }

    @Override
    public float getVoicePitch() {
        return 0.45F;
    }

    @Override
    public int getAmbientSoundInterval() {
        return 240;
    }

    @Override
    public void addAdditionalSaveData(CompoundTag tag) {
        super.addAdditionalSaveData(tag);
        tag.putInt("GalactusPhase", getPhase());
        tag.putBoolean("GalactusIntro", introDone);
        tag.putBoolean("GalactusDescending", getState() == S_DESCEND);
    }

    @Override
    public void readAdditionalSaveData(CompoundTag tag) {
        super.readAdditionalSaveData(tag);
        entityData.set(DATA_PHASE, Math.max(1, tag.getInt("GalactusPhase")));
        introDone = tag.getBoolean("GalactusIntro");
        if (tag.getBoolean("GalactusDescending")) setState(S_DESCEND);
        if (hasCustomName()) bossEvent.setName(getDisplayName());
    }

    // ------------------------------------------------------------------ déplacement

    /** Marche vers la cible quand elle est loin et qu'aucune attaque n'est en cours. */
    private class WalkToTargetGoal extends Goal {
        private int repath;

        WalkToTargetGoal() {
            setFlags(EnumSet.of(Goal.Flag.MOVE));
        }

        @Override
        public boolean canUse() {
            LivingEntity t = getTarget();
            return t != null && getState() == S_IDLE && distanceTo(t) > 14;
        }

        @Override
        public boolean canContinueToUse() {
            LivingEntity t = getTarget();
            return t != null && t.isAlive() && getState() == S_IDLE && distanceTo(t) > 10;
        }

        @Override
        public void start() {
            repath = 0;
        }

        @Override
        public void tick() {
            LivingEntity t = getTarget();
            if (t != null && --repath <= 0) {
                repath = 10;
                getNavigation().moveTo(t, 1.0);
            }
        }

        @Override
        public void stop() {
            getNavigation().stop();
        }
    }
}
