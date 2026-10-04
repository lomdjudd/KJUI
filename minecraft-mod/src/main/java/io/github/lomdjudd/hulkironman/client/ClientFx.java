package io.github.lomdjudd.hulkironman.client;

import io.github.lomdjudd.hulkironman.network.FxPayload;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.core.BlockPos;
import net.minecraft.core.particles.BlockParticleOption;
import net.minecraft.core.particles.DustParticleOptions;
import net.minecraft.core.particles.ParticleOptions;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.util.Mth;
import net.minecraft.util.RandomSource;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.Vec3;
import org.joml.Vector3f;

/** Tous les effets visuels des pouvoirs, dessinés avec des particules à partir d'un seul paquet. */
public final class ClientFx {
    private static final DustParticleOptions CYAN = dust(0.45F, 0.9F, 1.0F, 1.3F);
    private static final DustParticleOptions CYAN_BIG = dust(0.4F, 0.85F, 1.0F, 2.6F);
    private static final DustParticleOptions WHITE = dust(1.0F, 1.0F, 1.0F, 1.1F);
    private static final DustParticleOptions LASER = dust(1.0F, 0.25F, 0.1F, 1.2F);
    private static final DustParticleOptions LASER_CORE = dust(1.0F, 0.9F, 0.75F, 0.6F);
    private static final DustParticleOptions GREEN = dust(0.35F, 1.0F, 0.3F, 2.0F);
    private static final DustParticleOptions RED = dust(1.0F, 0.15F, 0.1F, 1.6F);
    private static final DustParticleOptions GOLD = dust(1.0F, 0.8F, 0.25F, 1.4F);
    private static final DustParticleOptions PURPLE = dust(0.7F, 0.3F, 1.0F, 2.4F);
    private static final DustParticleOptions DARK = dust(0.15F, 0.0F, 0.25F, 2.4F);

    static DustParticleOptions dust(float r, float g, float b, float scale) {
        return new DustParticleOptions(new Vector3f(r, g, b), scale);
    }

    public static void play(FxPayload p) {
        ClientLevel level = Minecraft.getInstance().level;
        if (level == null) return;
        RandomSource r = level.random;
        Vec3 a = p.a();
        Vec3 b = p.b();
        float size = p.size();
        switch (p.type()) {
            case FxPayload.REPULSOR -> {
                line(level, a, b, 0.3, CYAN, 0.04);
                line(level, a, b, 1.2, ParticleTypes.END_ROD, 0.0);
                burst(level, b, ParticleTypes.ELECTRIC_SPARK, 14, 0.35);
                level.addParticle(ParticleTypes.FLASH, true, b.x, b.y, b.z, 0, 0, 0);
                level.addParticle(ParticleTypes.FLASH, true, a.x, a.y, a.z, 0, 0, 0);
            }
            case FxPayload.UNIBEAM -> {
                line(level, a, b, 0.45, WHITE, 0.05);
                line(level, a, b, 0.5, CYAN_BIG, 0.3);
                line(level, a, b, 1.5, ParticleTypes.END_ROD, 0.2);
                burst(level, b, ParticleTypes.ELECTRIC_SPARK, 6, 0.5);
                if (r.nextInt(3) == 0) level.addParticle(ParticleTypes.FLASH, true, b.x, b.y, b.z, 0, 0, 0);
            }
            case FxPayload.ORBITAL -> {
                Vec3 top = a.add(0, size, 0);
                line(level, top, a, 0.5, ParticleTypes.END_ROD, 0.15);
                line(level, top, a, 0.6, CYAN_BIG, 0.5);
                line(level, top, a, 0.8, WHITE, 0.1);
                level.addParticle(ParticleTypes.EXPLOSION_EMITTER, true, a.x, a.y + 0.5, a.z, 0, 0, 0);
                level.addParticle(ParticleTypes.FLASH, true, a.x, a.y + 1, a.z, 0, 0, 0);
                burst(level, a.add(0, 0.5, 0), ParticleTypes.ELECTRIC_SPARK, 30, 1.0);
                ring(level, a.add(0, 0.2, 0), 3.0, ParticleTypes.CLOUD, 0.25);
            }
            case FxPayload.RING -> groundRing(level, a, size, b.x < 0 ? null : dust((float) b.x, (float) b.y, (float) b.z, 2.0F));
            case FxPayload.LASER_RING -> {
                int n = Math.max(24, (int) (size * 14));
                for (int i = 0; i < n; i++) {
                    double ang = Math.PI * 2 * i / n;
                    double x = a.x + Math.cos(ang) * size;
                    double z = a.z + Math.sin(ang) * size;
                    level.addParticle(LASER, true, x, a.y, z, 0, 0, 0);
                    if (i % 2 == 0) level.addParticle(LASER_CORE, true, x, a.y, z, 0, 0, 0);
                    if (i % 5 == 0) level.addParticle(ParticleTypes.ELECTRIC_SPARK, true, x, a.y, z, Math.cos(ang) * 0.2, 0.05, Math.sin(ang) * 0.2);
                }
            }
            case FxPayload.SPHERE -> {
                DustParticleOptions col = dust((float) b.x, (float) b.y, (float) b.z, 3.0F);
                int n = (int) Math.min(420, 30 + size * 22);
                double golden = Math.PI * (3 - Math.sqrt(5));
                for (int i = 0; i < n; i++) {
                    double yy = 1 - (i / (double) (n - 1)) * 2;
                    double rad = Math.sqrt(1 - yy * yy);
                    double th = golden * i;
                    double x = Math.cos(th) * rad;
                    double z = Math.sin(th) * rad;
                    level.addParticle(col, true, a.x + x * size, a.y + yy * size * 0.6, a.z + z * size, 0, 0, 0);
                    if (i % 9 == 0) level.addParticle(ParticleTypes.END_ROD, true, a.x + x * size, a.y + yy * size * 0.6, a.z + z * size, x * 0.1, 0.02, z * 0.1);
                }
            }
            case FxPayload.CLAP -> {
                Vec3 dir = b.lengthSqr() < 1.0E-6 ? new Vec3(0, 0, 1) : b.normalize();
                for (double d = 1.0; d <= size; d += 1.6) {
                    Vec3 q = a.add(dir.scale(d));
                    level.addParticle(ParticleTypes.SONIC_BOOM, true, q.x, q.y, q.z, 0, 0, 0);
                }
                for (int i = 0; i < 70; i++) {
                    Vec3 spread = new Vec3(r.nextGaussian(), r.nextGaussian() * 0.5, r.nextGaussian()).scale(0.35);
                    Vec3 v = dir.add(spread).normalize().scale(0.6 + r.nextDouble() * 0.9);
                    level.addParticle(ParticleTypes.CLOUD, true, a.x, a.y, a.z, v.x, v.y, v.z);
                }
                level.addParticle(ParticleTypes.FLASH, true, a.x, a.y, a.z, 0, 0, 0);
                level.addParticle(ParticleTypes.EXPLOSION, true, a.x, a.y, a.z, 0, 0, 0);
            }
            case FxPayload.IMPACT -> {
                boolean big = b.x > 0;
                BlockState state = p.data() != 0 ? Block.stateById(p.data()) : null;
                int boom = big ? 6 : 2;
                for (int i = 0; i < boom; i++) {
                    level.addParticle(ParticleTypes.EXPLOSION, true, a.x + (r.nextDouble() - 0.5) * size, a.y + r.nextDouble() * size * 0.4,
                            a.z + (r.nextDouble() - 0.5) * size, 0, 0, 0);
                }
                if (big) level.addParticle(ParticleTypes.EXPLOSION_EMITTER, true, a.x, a.y + 0.5, a.z, 0, 0, 0);
                if (state != null && !state.isAir()) {
                    BlockParticleOption debris = new BlockParticleOption(ParticleTypes.BLOCK, state);
                    int n = big ? 90 : 40;
                    for (int i = 0; i < n; i++) {
                        double ang = r.nextDouble() * Math.PI * 2;
                        double sp = 0.2 + r.nextDouble() * 0.5;
                        level.addParticle(debris, true, a.x, a.y + 0.3, a.z, Math.cos(ang) * sp, 0.3 + r.nextDouble() * 0.6, Math.sin(ang) * sp);
                    }
                }
                for (int i = 0; i < (big ? 14 : 6); i++) {
                    level.addParticle(ParticleTypes.LARGE_SMOKE, true, a.x + (r.nextDouble() - 0.5) * size, a.y + 0.3, a.z + (r.nextDouble() - 0.5) * size,
                            0, 0.05, 0);
                }
                if (big) {
                    for (int i = 0; i < 4; i++) {
                        level.addParticle(ParticleTypes.CAMPFIRE_COSY_SMOKE, true, a.x + (r.nextDouble() - 0.5) * size, a.y, a.z + (r.nextDouble() - 0.5) * size, 0, 0.05, 0);
                    }
                }
                level.addParticle(ParticleTypes.FLASH, true, a.x, a.y + 0.5, a.z, 0, 0, 0);
            }
            case FxPayload.TRANSFORM_HULK -> {
                Entity e = level.getEntity(p.data());
                Vec3 c = e != null ? e.position() : a;
                double h = e != null ? e.getBbHeight() : 3;
                spiral(level, c, 1.3, h + 0.5, GREEN, 60);
                level.addParticle(ParticleTypes.EXPLOSION, true, c.x, c.y + 0.5, c.z, 0, 0, 0);
                groundRing(level, c.add(0, 0.1, 0), 2.5, GREEN);
                burst(level, c.add(0, h * 0.5, 0), ParticleTypes.HAPPY_VILLAGER, 25, 1.2);
            }
            case FxPayload.TRANSFORM_IRON -> {
                Entity e = level.getEntity(p.data());
                Vec3 c = e != null ? e.position() : a;
                double h = e != null ? e.getBbHeight() : 2;
                for (int i = 0; i < 70; i++) {
                    Vec3 off = new Vec3(r.nextDouble() - 0.5, r.nextDouble() - 0.3, r.nextDouble() - 0.5).normalize().scale(2.2);
                    Vec3 q = c.add(0, h * 0.5, 0).add(off);
                    level.addParticle(i % 2 == 0 ? ParticleTypes.END_ROD : ParticleTypes.ELECTRIC_SPARK, true, q.x, q.y, q.z, -off.x * 0.09, -off.y * 0.09, -off.z * 0.09);
                }
                spiral(level, c, 0.8, h, RED, 30);
                spiral(level, c, 0.9, h, GOLD, 30);
                level.addParticle(ParticleTypes.FLASH, true, c.x, c.y + h * 0.6, c.z, 0, 0, 0);
            }
            case FxPayload.REVERT -> {
                Entity e = level.getEntity(p.data());
                Vec3 c = e != null ? e.position() : a;
                for (int i = 0; i < 30; i++) {
                    level.addParticle(ParticleTypes.POOF, true, c.x + (r.nextDouble() - 0.5) * 1.5, c.y + r.nextDouble() * 2.5, c.z + (r.nextDouble() - 0.5) * 1.5, 0, 0.05, 0);
                }
            }
            case FxPayload.WARNING -> {
                int n = Math.max(16, (int) (size * 10));
                for (int i = 0; i < n; i++) {
                    double ang = Math.PI * 2 * i / n;
                    level.addParticle(RED, true, a.x + Math.cos(ang) * size, a.y + 0.1, a.z + Math.sin(ang) * size, 0, 0.01, 0);
                }
                for (int i = 0; i < 8; i++) {
                    level.addParticle(RED, true, a.x + (r.nextDouble() - 0.5) * size, a.y + 0.1, a.z + (r.nextDouble() - 0.5) * size, 0, 0.02, 0);
                }
            }
            case FxPayload.GRAVITY -> {
                for (int i = 0; i < 80; i++) {
                    double ang = r.nextDouble() * Math.PI * 2;
                    double dist = 3 + r.nextDouble() * size;
                    double dy = (r.nextDouble() - 0.4) * 6;
                    // les particules de portail partent du décalage et reviennent vers leur point d'apparition
                    level.addParticle(ParticleTypes.PORTAL, true, a.x, a.y, a.z, Math.cos(ang) * dist, dy, Math.sin(ang) * dist);
                    if (i % 4 == 0) level.addParticle(PURPLE, true, a.x + Math.cos(ang) * dist * 0.5, a.y + dy * 0.5, a.z + Math.sin(ang) * dist * 0.5, 0, 0, 0);
                }
            }
            case FxPayload.CHARGE -> {
                DustParticleOptions col = dust((float) b.x, (float) b.y, (float) b.z, 1.4F);
                for (int i = 0; i < 18; i++) {
                    Vec3 off = new Vec3(r.nextDouble() - 0.5, r.nextDouble() - 0.5, r.nextDouble() - 0.5).normalize().scale(size);
                    Vec3 q = a.add(off);
                    level.addParticle(ParticleTypes.END_ROD, true, q.x, q.y, q.z, -off.x * 0.11, -off.y * 0.11, -off.z * 0.11);
                    if (i % 3 == 0) level.addParticle(col, true, a.x + off.x * 0.3, a.y + off.y * 0.3, a.z + off.z * 0.3, 0, 0, 0);
                }
                level.addParticle(ParticleTypes.ELECTRIC_SPARK, true, a.x, a.y, a.z, 0, 0, 0);
            }
            case FxPayload.SUMMON -> {
                burst(level, a, ParticleTypes.REVERSE_PORTAL, 40, 0.6);
                burst(level, a, ParticleTypes.WITCH, 12, 0.8);
                level.addParticle(ParticleTypes.FLASH, true, a.x, a.y, a.z, 0, 0, 0);
            }
            case FxPayload.THRUSTER -> {
                Entity e = level.getEntity(p.data());
                if (e == null) return;
                if (e == Minecraft.getInstance().player && Minecraft.getInstance().options.getCameraType().isFirstPerson() && r.nextBoolean()) return;
                Vec3 c = e.getPosition(1F);
                double s = e.getBbHeight() / 1.8;
                float yaw = e instanceof net.minecraft.world.entity.LivingEntity le ? le.yBodyRot : e.getYRot();
                Vec3 side = Vec3.directionFromRotation(0, yaw + 90F).scale(0.15 * s);
                for (int k = -1; k <= 1; k += 2) {
                    Vec3 foot = c.add(side.scale(k));
                    level.addParticle(ParticleTypes.FLAME, true, foot.x, foot.y, foot.z, 0, -0.25 - r.nextDouble() * 0.15, 0);
                    level.addParticle(ParticleTypes.SMOKE, true, foot.x, foot.y - 0.2, foot.z, 0, -0.1, 0);
                    Vec3 hand = c.add(side.scale(k * 2.4)).add(0, 0.72 * s, 0);
                    if (r.nextBoolean()) level.addParticle(ParticleTypes.SOUL_FIRE_FLAME, true, hand.x, hand.y, hand.z, 0, -0.12, 0);
                }
            }
            case FxPayload.RAGE_AURA -> {
                Entity e = level.getEntity(p.data());
                if (e == null) return;
                Vec3 c = e.getPosition(1F);
                double w = e.getBbWidth();
                double h = e.getBbHeight();
                for (int i = 0; i < 6; i++) {
                    level.addParticle(i % 2 == 0 ? GREEN : RED, c.x + (r.nextDouble() - 0.5) * w * 1.4, c.y + r.nextDouble() * h,
                            c.z + (r.nextDouble() - 0.5) * w * 1.4, 0, 0.05, 0);
                }
                if (r.nextInt(4) == 0) level.addParticle(ParticleTypes.ANGRY_VILLAGER, c.x, c.y + h + 0.3, c.z, 0, 0, 0);
            }
            case FxPayload.TRAIL -> {
                Entity e = level.getEntity(p.data());
                Vec3 c = e != null ? e.getPosition(1F) : a;
                for (int i = 0; i < 4; i++) {
                    level.addParticle(GREEN, true, c.x + (r.nextDouble() - 0.5), c.y + r.nextDouble() * 2, c.z + (r.nextDouble() - 0.5), 0, 0, 0);
                }
                level.addParticle(ParticleTypes.CLOUD, true, c.x, c.y, c.z, 0, 0, 0);
            }
            case FxPayload.PUNCH -> {
                level.addParticle(ParticleTypes.EXPLOSION, true, a.x, a.y, a.z, 0, 0, 0);
                burst(level, a, ParticleTypes.CRIT, 16, 0.8);
                burst(level, a, ParticleTypes.CLOUD, 8, 0.25);
            }
            case FxPayload.GALACTUS_PHASE -> {
                burst(level, a, ParticleTypes.REVERSE_PORTAL, 160, 1.2);
                for (int i = 0; i < 3; i++) level.addParticle(ParticleTypes.FLASH, true, a.x, a.y + i * 2, a.z, 0, 0, 0);
                level.addParticle(ParticleTypes.EXPLOSION_EMITTER, true, a.x, a.y, a.z, 0, 0, 0);
                int n = 200;
                for (int i = 0; i < n; i++) {
                    Vec3 dir = new Vec3(r.nextGaussian(), r.nextGaussian(), r.nextGaussian()).normalize();
                    Vec3 q = a.add(dir.scale(size * (0.6 + r.nextDouble() * 0.4)));
                    level.addParticle(i % 2 == 0 ? PURPLE : DARK, true, q.x, q.y, q.z, 0, 0, 0);
                }
            }
            case FxPayload.LOCK_ON -> {
                Entity e = level.getEntity(p.data());
                Vec3 c = e != null ? e.getPosition(1F) : a;
                double w = e != null ? Math.max(1.0, e.getBbWidth()) : 1.0;
                double h = e != null ? e.getBbHeight() : 2;
                for (int i = 0; i < 24; i++) {
                    double ang = Math.PI * 2 * i / 24;
                    level.addParticle(RED, true, c.x + Math.cos(ang) * w, c.y + h * 0.5, c.z + Math.sin(ang) * w, 0, 0, 0);
                    level.addParticle(RED, true, c.x + Math.cos(-ang) * w * 0.6, c.y + h * 0.5, c.z + Math.sin(-ang) * w * 0.6, 0, 0, 0);
                }
                level.addParticle(ParticleTypes.ELECTRIC_SPARK, true, c.x, c.y + h + 0.5, c.z, 0, 0, 0);
            }
            case FxPayload.DEVOUR -> {
                for (int i = 0; i < 120; i++) {
                    double ang = r.nextDouble() * Math.PI * 2;
                    double dist = r.nextDouble() * size;
                    Vec3 q = a.add(Math.cos(ang) * dist, (r.nextDouble() - 0.5) * 4, Math.sin(ang) * dist);
                    Vec3 v = a.subtract(q).scale(0.12);
                    level.addParticle(i % 3 == 0 ? ParticleTypes.SCULK_SOUL : ParticleTypes.SOUL, true, q.x, q.y, q.z, v.x, v.y, v.z);
                    if (i % 2 == 0) level.addParticle(DARK, true, q.x, q.y, q.z, 0, 0, 0);
                }
                level.addParticle(ParticleTypes.EXPLOSION_EMITTER, true, a.x, a.y, a.z, 0, 0, 0);
            }
            case FxPayload.DEFLECT -> {
                burst(level, a, ParticleTypes.POOF, 8, 0.15);
                burst(level, a, ParticleTypes.CRIT, 6, 0.4);
            }
            default -> {
            }
        }
    }

    // ------------------------------------------------------------------ outils

    private static void line(ClientLevel level, Vec3 from, Vec3 to, double step, ParticleOptions opt, double jitter) {
        Vec3 d = to.subtract(from);
        double len = d.length();
        if (len < 1.0E-4) return;
        Vec3 u = d.scale(1.0 / len);
        RandomSource r = level.random;
        for (double t = 0; t <= len; t += step) {
            double x = from.x + u.x * t + (jitter > 0 ? (r.nextDouble() - 0.5) * jitter * 2 : 0);
            double y = from.y + u.y * t + (jitter > 0 ? (r.nextDouble() - 0.5) * jitter * 2 : 0);
            double z = from.z + u.z * t + (jitter > 0 ? (r.nextDouble() - 0.5) * jitter * 2 : 0);
            level.addParticle(opt, true, x, y, z, 0, 0, 0);
        }
    }

    private static void burst(ClientLevel level, Vec3 c, ParticleOptions opt, int n, double speed) {
        RandomSource r = level.random;
        for (int i = 0; i < n; i++) {
            level.addParticle(opt, true, c.x, c.y, c.z, (r.nextDouble() - 0.5) * speed, (r.nextDouble() - 0.5) * speed, (r.nextDouble() - 0.5) * speed);
        }
    }

    private static void ring(ClientLevel level, Vec3 c, double radius, ParticleOptions opt, double outward) {
        int n = Math.max(12, (int) (radius * 8));
        for (int i = 0; i < n; i++) {
            double ang = Math.PI * 2 * i / n;
            double cx = Math.cos(ang);
            double cz = Math.sin(ang);
            level.addParticle(opt, true, c.x + cx * radius, c.y, c.z + cz * radius, cx * outward, 0.02, cz * outward);
        }
    }

    /** Onde de choc au sol : débris du bloc sous l'anneau, nuages et couleur optionnelle. */
    private static void groundRing(ClientLevel level, Vec3 c, double radius, DustParticleOptions color) {
        RandomSource r = level.random;
        int n = Math.max(14, (int) (radius * 7));
        for (int i = 0; i < n; i++) {
            double ang = Math.PI * 2 * i / n + r.nextDouble() * 0.2;
            double cx = Math.cos(ang);
            double cz = Math.sin(ang);
            double x = c.x + cx * radius;
            double z = c.z + cz * radius;
            BlockPos bp = BlockPos.containing(x, c.y - 0.3, z);
            BlockState s = level.getBlockState(bp);
            if (s.isAir()) s = level.getBlockState(bp.below());
            if (!s.isAir()) {
                BlockParticleOption debris = new BlockParticleOption(ParticleTypes.BLOCK, s);
                for (int k = 0; k < 2; k++) {
                    level.addParticle(debris, true, x, c.y + 0.1, z, cx * 0.12, 0.25 + r.nextDouble() * 0.35, cz * 0.12);
                }
            }
            if (i % 2 == 0) level.addParticle(ParticleTypes.POOF, true, x, c.y + 0.2, z, cx * 0.15, 0.02, cz * 0.15);
            if (color != null) level.addParticle(color, true, x, c.y + 0.3, z, 0, 0, 0);
        }
    }

    private static void spiral(ClientLevel level, Vec3 base, double radius, double height, ParticleOptions opt, int n) {
        for (int i = 0; i < n; i++) {
            double t = i / (double) n;
            double ang = t * Math.PI * 4;
            double rr = radius * (1 - t * 0.3);
            level.addParticle(opt, true, base.x + Math.cos(ang) * rr, base.y + t * height, base.z + Math.sin(ang) * rr, 0, 0.03, 0);
        }
    }

    static float lerp(float a, float b, float t) {
        return Mth.lerp(t, a, b);
    }

    private ClientFx() {
    }
}
