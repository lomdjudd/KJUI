package io.github.lomdjudd.hulkironman.event;

import com.mojang.authlib.GameProfile;
import io.github.lomdjudd.hulkironman.HulkIronMan;
import io.github.lomdjudd.hulkironman.entity.GalactusEntity;
import io.github.lomdjudd.hulkironman.hero.HeroForm;
import io.github.lomdjudd.hulkironman.hero.HeroManager;
import io.github.lomdjudd.hulkironman.hero.Scheduler;
import io.github.lomdjudd.hulkironman.registry.ModEntities;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import net.minecraft.core.BlockPos;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.level.storage.loot.LootTable;
import net.minecraft.world.phys.Vec3;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.common.util.FakePlayer;
import net.neoforged.neoforge.common.util.FakePlayerFactory;
import net.neoforged.neoforge.event.server.ServerStartedEvent;

/**
 * Auto-test lancé uniquement avec -Dhulkironman.selftest=true (tâche Gradle runSelfTest) :
 * un joueur factice se transforme, utilise tous les pouvoirs, puis on invoque Galactus,
 * on force chacune de ses attaques et on le tue. Le serveur s'arrête ensuite tout seul.
 */
@EventBusSubscriber(modid = HulkIronMan.MODID)
public final class SelfTest {
    private static int failures;
    private static int checks;

    @SubscribeEvent
    public static void onStarted(ServerStartedEvent event) {
        if (!Boolean.getBoolean("hulkironman.selftest")) return;
        MinecraftServer server = event.getServer();
        ServerLevel level = server.overworld();
        BlockPos spawn = level.getSharedSpawnPos();
        int y = level.getHeight(Heightmap.Types.MOTION_BLOCKING, spawn.getX(), spawn.getZ());
        Vec3 base = new Vec3(spawn.getX() + 0.5, y, spawn.getZ() + 0.5);
        FakePlayer fp = FakePlayerFactory.get(level, new GameProfile(UUID.fromString("41c82c87-7afb-4024-ba57-13d2c99cae77"), "HulkTest"));
        fp.moveTo(base.x, base.y, base.z, 0F, 0F);
        fp.setOnGround(true);
        HulkIronMan.LOGGER.info("[SELFTEST] Démarrage à {}", base);
        // Sans joueur connecté, le serveur cesse de faire vivre les entités après 15 s :
        // on force le chargement de la zone de test pour que Galactus agisse normalement.
        int cx = spawn.getX() >> 4;
        int cz = spawn.getZ() >> 4;
        for (int x = -4; x <= 4; x++) {
            for (int z = -4; z <= 4; z++) level.setChunkForced(cx + x, cz + z, true);
        }

        List<Mob> dummies = new ArrayList<>();
        Scheduler.repeat(1000, age -> HeroManager.tick(fp));
        Scheduler.later(1, () -> {
            for (int i = 0; i < 6; i++) {
                double a = Math.PI * 2 * i / 6;
                Mob husk = EntityType.HUSK.create(level);
                if (husk == null) continue;
                husk.moveTo(base.x + Math.cos(a) * 5, base.y, base.z + Math.sin(a) * 5, 0F, 0F);
                husk.getAttribute(Attributes.MAX_HEALTH).setBaseValue(500);
                husk.setHealth(500);
                husk.setNoAi(true);
                husk.setPersistenceRequired();
                level.addFreshEntity(husk);
                dummies.add(husk);
            }
            check(dummies.size() == 6, "cibles d'entraînement");
        });

        // --- Hulk ---
        Scheduler.later(5, () -> {
            HeroManager.transform(fp, HeroForm.HULK);
            check(HeroForm.of(fp) == HeroForm.HULK, "transformation en Hulk");
            check(fp.getMaxHealth() >= 59, "santé de Hulk (" + fp.getMaxHealth() + ")");
            check(fp.getScale() > 1.5F, "taille de Hulk (" + fp.getScale() + ")");
        });
        for (int s = 1; s <= 4; s++) {
            final int slot = s;
            Scheduler.later(10 + s * 12, () -> {
                HeroManager.useAbility(fp, slot);
                check(HeroManager.state(fp).cooldown[slot] > 0, "pouvoir de Hulk " + slot);
            });
        }
        Scheduler.later(70, () -> {
            HeroManager.state(fp).resource = 100F;
            HeroManager.useAbility(fp, 5);
            check(HeroManager.state(fp).rageTicks > 0 && HeroForm.isRaging(fp), "Colère gamma (ultime de Hulk)");
        });
        Scheduler.later(108, () -> check(dummies.stream().anyMatch(m -> m.getHealth() < 500), "les pouvoirs touchent les ennemis"));
        Scheduler.later(110, () -> {
            HeroManager.revert(fp, true);
            check(HeroForm.of(fp) == HeroForm.NONE, "retour à la forme humaine");
            check(Math.abs(fp.getMaxHealth() - 20F) < 0.01F, "santé normale après Hulk");
            check(!HeroForm.isRaging(fp), "rage retirée");
        });

        // --- Iron Man ---
        Scheduler.later(115, () -> {
            HeroManager.transform(fp, HeroForm.IRONMAN);
            check(HeroForm.of(fp) == HeroForm.IRONMAN, "armure d'Iron Man");
            check(fp.getAbilities().mayfly, "vol d'Iron Man activé");
        });
        int[] ironTimes = {0, 125, 140, 190, 205};
        for (int s = 1; s <= 4; s++) {
            final int slot = s;
            Scheduler.later(ironTimes[s], () -> {
                HeroManager.useAbility(fp, slot);
                check(HeroManager.state(fp).cooldown[slot] > 0, "pouvoir d'Iron Man " + slot);
            });
        }
        Scheduler.later(235, () -> {
            HeroManager.state(fp).resource = 100F;
            HeroManager.useAbility(fp, 5);
            check(HeroManager.state(fp).resource < 1F, "Frappe orbitale (ultime d'Iron Man)");
        });
        Scheduler.later(285, () -> {
            HeroManager.revert(fp, true);
            check(HeroForm.of(fp) == HeroForm.NONE, "armure retirée");
            check(!fp.getAbilities().mayfly, "vol désactivé");
        });

        // --- Galactus ---
        GalactusEntity[] boss = new GalactusEntity[1];
        Scheduler.later(290, () -> {
            GalactusEntity.summonFromSky(level, BlockPos.containing(base.add(40, 0, 0)));
            for (int i = 0; i < 2; i++) {
                Mob golem = EntityType.IRON_GOLEM.create(level);
                if (golem == null) continue;
                golem.moveTo(base.x + i * 3, base.y, base.z - 34, 0F, 0F);
                golem.getAttribute(Attributes.MAX_HEALTH).setBaseValue(1000);
                golem.setHealth(1000);
                golem.setNoAi(true);
                level.addFreshEntity(golem);
            }
            GalactusEntity g = ModEntities.GALACTUS.get().create(level);
            check(g != null, "création de Galactus");
            if (g == null) return;
            g.moveTo(base.x, base.y, base.z - 20, 0F, 0F);
            level.addFreshEntity(g);
            boss[0] = g;
        });
        int[][] attacks = {
                {300, GalactusEntity.S_BEAM_CHARGE}, {400, GalactusEntity.S_METEOR}, {500, GalactusEntity.S_SLAM},
                {570, GalactusEntity.S_GRAVITY}, {660, GalactusEntity.S_SUMMON}};
        for (int[] at : attacks) {
            Scheduler.later(at[0], () -> {
                if (boss[0] != null && boss[0].isAlive()) {
                    boss[0].forceState(at[1]);
                    HulkIronMan.LOGGER.info("[SELFTEST] Galactus : attaque {}", at[1]);
                }
            });
        }
        Scheduler.later(380, () -> check(boss[0] != null && boss[0].getState() != GalactusEntity.S_BEAM_CHARGE, "rayon cosmique lancé"));
        Scheduler.later(700, () -> {
            if (boss[0] != null) boss[0].setHealth(490F);
        });
        Scheduler.later(705, () -> check(boss[0] != null && boss[0].getPhase() == 2, "phase 2 de Galactus"));
        Scheduler.later(760, () -> {
            if (boss[0] != null) boss[0].setHealth(240F);
        });
        Scheduler.later(765, () -> check(boss[0] != null && boss[0].getPhase() == 3, "phase 3 de Galactus"));
        Scheduler.later(840, () -> {
            if (boss[0] != null) boss[0].kill();
        });
        Scheduler.later(950, () -> {
            check(boss[0] != null && boss[0].isRemoved(), "mort de Galactus");
            check(!level.getEntitiesOfClass(GalactusEntity.class, io.github.lomdjudd.hulkironman.hero.Combat.around(base, 200)).isEmpty(),
                    "Galactus invoqué par l'Orbe Cosmique");

            // --- données (recettes, butin, succès) ---
            for (String r : new String[]{"gamma_serum", "arc_reactor", "cosmic_orb"}) {
                check(server.getRecipeManager().byKey(HulkIronMan.id(r)).isPresent(), "recette " + r);
            }
            check(server.reloadableRegistries().getLootTable(ModEntities.GALACTUS.get().getDefaultLootTable()) != LootTable.EMPTY, "butin de Galactus");
            for (String a : new String[]{"root", "hulk", "ironman", "summon_galactus", "defeat_galactus"}) {
                check(server.getAdvancements().get(HulkIronMan.id(a)) != null, "succès " + a);
            }
            check(Scheduler.errors == 0, "aucune erreur dans les tâches planifiées");
            // monde propre pour le test visuel qui le réutilise
            level.getEntitiesOfClass(GalactusEntity.class, io.github.lomdjudd.hulkironman.hero.Combat.around(base, 300)).forEach(g -> g.discard());
            level.getEntitiesOfClass(net.minecraft.world.entity.monster.Vex.class, io.github.lomdjudd.hulkironman.hero.Combat.around(base, 300)).forEach(v -> v.discard());
            level.getEntitiesOfClass(net.minecraft.world.entity.projectile.Projectile.class, io.github.lomdjudd.hulkironman.hero.Combat.around(base, 300)).forEach(e -> e.discard());
            finish(server);
        });
    }

    private static void check(boolean ok, String what) {
        checks++;
        if (ok) {
            HulkIronMan.LOGGER.info("[SELFTEST] ok : {}", what);
        } else {
            failures++;
            HulkIronMan.LOGGER.error("[SELFTEST] ÉCHEC : {}", what);
        }
    }

    private static void finish(MinecraftServer server) {
        if (failures == 0) HulkIronMan.LOGGER.info("[SELFTEST] OK ({} vérifications)", checks);
        else HulkIronMan.LOGGER.error("[SELFTEST] FAILED : {} échec(s) sur {} vérifications", failures, checks);
        final int code = failures == 0 ? 0 : 1;
        Thread killer = new Thread(() -> {
            try {
                Thread.sleep(30_000);
            } catch (InterruptedException ignored) {
            }
            Runtime.getRuntime().halt(code);
        }, "selftest-stop");
        killer.setDaemon(true);
        killer.start();
        server.halt(false);
    }

    private SelfTest() {
    }
}
