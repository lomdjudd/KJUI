package io.github.lomdjudd.hulkironman.client;

import io.github.lomdjudd.hulkironman.HulkIronMan;
import io.github.lomdjudd.hulkironman.entity.GalactusEntity;
import io.github.lomdjudd.hulkironman.hero.HeroForm;
import io.github.lomdjudd.hulkironman.hero.HeroManager;
import io.github.lomdjudd.hulkironman.registry.ModEntities;
import java.util.UUID;
import java.util.function.Consumer;
import net.minecraft.client.CameraType;
import net.minecraft.client.Minecraft;
import net.minecraft.client.Screenshot;
import net.minecraft.client.server.IntegratedServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.level.GameType;
import net.minecraft.world.level.levelgen.Heightmap;
import net.neoforged.api.distmarker.Dist;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.client.event.ClientTickEvent;

/**
 * Test visuel lancé uniquement avec -Dhulkironman.clienttest=true (GitHub Actions, écran virtuel) :
 * transforme le joueur, déclenche des pouvoirs, fait apparaître Galactus et prend des captures d'écran.
 */
@EventBusSubscriber(modid = HulkIronMan.MODID, value = Dist.CLIENT)
public final class ClientTest {
    private static final boolean ENABLED = Boolean.getBoolean("hulkironman.clienttest");
    private static int ticks = -1;
    private static double baseX;
    private static double baseY;
    private static double baseZ;
    private static GalactusEntity boss;

    @SubscribeEvent
    public static void onTick(ClientTickEvent.Post event) {
        if (!ENABLED) return;
        Minecraft mc = Minecraft.getInstance();
        IntegratedServer server = mc.getSingleplayerServer();
        if (mc.player == null || mc.level == null || server == null) return;
        ticks++;
        if (mc.player.isDeadOrDying() && ticks % 10 == 0) mc.player.respawn();
        UUID id = mc.player.getUUID();
        switch (ticks) {
            case 2 -> onServer(server, id, sp -> {
                // le monde vient de l'auto-test serveur : on retire le Galactus qui y rôde encore
                sp.setGameMode(GameType.CREATIVE);
                sp.serverLevel().getEntitiesOfClass(GalactusEntity.class, sp.getBoundingBox().inflate(256)).forEach(g -> g.discard());
            });
            case 60 -> onServer(server, id, sp -> {
                ServerLevel level = sp.serverLevel();
                level.setDayTime(6000);
                level.setWeatherParameters(6000, 0, false, false);
                sp.setGameMode(GameType.CREATIVE);
                baseX = Math.floor(sp.getX()) + 0.5;
                baseZ = Math.floor(sp.getZ()) + 0.5;
                baseY = level.getHeight(Heightmap.Types.MOTION_BLOCKING, (int) Math.floor(baseX), (int) Math.floor(baseZ));
                sp.teleportTo(level, baseX, baseY, baseZ, 0F, 5F);
                for (int i = 0; i < 5; i++) {
                    Mob husk = EntityType.HUSK.create(level);
                    if (husk == null) continue;
                    husk.moveTo(baseX - 9 + i * 4.5, baseY, baseZ + 13, 180F, 0F);
                    husk.setNoAi(true);
                    level.addFreshEntity(husk);
                }
            });
            case 100 -> {
                mc.options.setCameraType(CameraType.THIRD_PERSON_FRONT);
                onServer(server, id, sp -> HeroManager.transform(sp, HeroForm.HULK));
            }
            case 150 -> shot(mc, "01_hulk.png");
            case 160 -> onServer(server, id, sp -> {
                HeroManager.state(sp).resource = 100F;
                HeroManager.useAbility(sp, 5);
            });
            case 166 -> shot(mc, "02_hulk_colere_gamma.png");
            case 190 -> {
                mc.options.setCameraType(CameraType.THIRD_PERSON_BACK);
                onServer(server, id, sp -> HeroManager.useAbility(sp, 1));
            }
            case 193 -> shot(mc, "03_hulk_clap.png");
            case 215 -> onServer(server, id, sp -> HeroManager.useAbility(sp, 4));
            case 219 -> shot(mc, "04_hulk_rocher.png");
            case 240 -> {
                mc.options.setCameraType(CameraType.THIRD_PERSON_FRONT);
                onServer(server, id, sp -> HeroManager.transform(sp, HeroForm.IRONMAN));
            }
            case 285 -> shot(mc, "05_ironman.png");
            case 295 -> {
                mc.options.setCameraType(CameraType.THIRD_PERSON_BACK);
                onServer(server, id, sp -> HeroManager.useAbility(sp, 4));
            }
            case 300 -> shot(mc, "06_ironman_laser.png");
            case 320 -> onServer(server, id, sp -> HeroManager.useAbility(sp, 2));
            case 344 -> shot(mc, "07_ironman_unirayon.png");
            case 360 -> {
                mc.options.setCameraType(CameraType.THIRD_PERSON_FRONT);
                onServer(server, id, sp -> sp.teleportTo(sp.serverLevel(), baseX, baseY + 4, baseZ, 0F, 10F));
            }
            case 364 -> {
                mc.player.getAbilities().flying = true;
                mc.player.onUpdateAbilities();
            }
            case 385 -> shot(mc, "08_ironman_vol.png");
            case 390 -> {
                mc.options.setCameraType(CameraType.FIRST_PERSON);
                onServer(server, id, sp -> HeroManager.useAbility(sp, 3));
            }
            case 420 -> onServer(server, id, sp -> HeroManager.useAbility(sp, 1));
            case 422 -> shot(mc, "09_ironman_hud_repulseur.png");
            case 450 -> {
                mc.player.getAbilities().flying = false;
                mc.player.onUpdateAbilities();
                mc.options.setCameraType(CameraType.THIRD_PERSON_FRONT);
                onServer(server, id, sp -> {
                    ServerLevel level = sp.serverLevel();
                    level.getEntitiesOfClass(Mob.class, sp.getBoundingBox().inflate(64)).forEach(m -> m.discard());
                    sp.teleportTo(level, baseX, baseY, baseZ - 4, 180F, -4F);
                    GalactusEntity g = ModEntities.GALACTUS.get().create(level);
                    if (g == null) return;
                    g.moveTo(baseX + 9, baseY, baseZ + 22, 160F, 0F);
                    g.setYHeadRot(160F);
                    g.setYBodyRot(160F);
                    level.addFreshEntity(g);
                    boss = g;
                });
            }
            case 500 -> shot(mc, "10_galactus.png");
            case 505 -> onServer(server, id, sp -> {
                if (boss != null) boss.forceState(GalactusEntity.S_BEAM_CHARGE);
            });
            case 552 -> shot(mc, "11_galactus_rayon.png");
            case 590 -> onServer(server, id, sp -> {
                if (boss != null) boss.forceState(GalactusEntity.S_METEOR);
            });
            case 632 -> shot(mc, "12_galactus_meteores.png");
            case 650 -> onServer(server, id, sp -> {
                if (boss != null) boss.forceState(GalactusEntity.S_SLAM);
            });
            case 680 -> shot(mc, "13_galactus_onde.png");
            case 700 -> onServer(server, id, sp -> {
                if (boss != null) boss.forceState(GalactusEntity.S_GRAVITY);
            });
            case 730 -> shot(mc, "14_galactus_gravite.png");
            case 770 -> {
                HulkIronMan.LOGGER.info("[CLIENTTEST] OK");
                mc.stop();
            }
            default -> {
            }
        }
    }

    private static void onServer(IntegratedServer server, UUID id, Consumer<ServerPlayer> action) {
        server.execute(() -> {
            ServerPlayer sp = server.getPlayerList().getPlayer(id);
            if (sp != null) action.accept(sp);
        });
    }

    private static void shot(Minecraft mc, String name) {
        Screenshot.grab(mc.gameDirectory, name, mc.getMainRenderTarget(), msg -> HulkIronMan.LOGGER.info("[CLIENTTEST] {}", msg.getString()));
    }

    private ClientTest() {
    }
}
