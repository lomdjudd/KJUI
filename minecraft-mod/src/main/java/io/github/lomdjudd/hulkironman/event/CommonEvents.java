package io.github.lomdjudd.hulkironman.event;

import io.github.lomdjudd.hulkironman.HulkIronMan;
import io.github.lomdjudd.hulkironman.hero.Combat;
import io.github.lomdjudd.hulkironman.hero.HeroForm;
import io.github.lomdjudd.hulkironman.hero.HeroManager;
import io.github.lomdjudd.hulkironman.hero.Scheduler;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.damagesource.DamageTypes;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.event.entity.living.LivingDamageEvent;
import net.neoforged.neoforge.event.entity.living.LivingFallEvent;
import net.neoforged.neoforge.event.entity.player.PlayerEvent;
import net.neoforged.neoforge.event.server.ServerStoppedEvent;
import net.neoforged.neoforge.event.tick.PlayerTickEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;

@EventBusSubscriber(modid = HulkIronMan.MODID)
public final class CommonEvents {

    @SubscribeEvent
    public static void onPlayerTick(PlayerTickEvent.Post event) {
        if (event.getEntity() instanceof ServerPlayer sp) HeroManager.tick(sp);
    }

    @SubscribeEvent
    public static void onServerTick(ServerTickEvent.Post event) {
        Scheduler.tick();
    }

    @SubscribeEvent
    public static void onServerStopped(ServerStoppedEvent event) {
        Scheduler.clear();
        HeroManager.clearAll();
    }

    /** Hulk et Iron Man ne prennent jamais de dégâts de chute. */
    @SubscribeEvent
    public static void onFall(LivingFallEvent event) {
        if (event.getEntity() instanceof Player p && HeroForm.of(p) != HeroForm.NONE) event.setCanceled(true);
    }

    @SubscribeEvent
    public static void onDamage(LivingDamageEvent.Post event) {
        LivingEntity victim = event.getEntity();
        if (victim.level().isClientSide) return;
        DamageSource src = event.getSource();
        if (!Combat.abilityDamage && src.getEntity() instanceof ServerPlayer p && src.getDirectEntity() == p
                && src.is(DamageTypes.PLAYER_ATTACK) && victim != p && HeroForm.of(p) == HeroForm.HULK) {
            HeroManager.onHulkPunch(p, victim);
        }
        if (victim instanceof ServerPlayer vp && HeroForm.of(vp) == HeroForm.HULK) {
            HeroManager.onHulkHurt(vp, event.getNewDamage());
        }
    }

    @SubscribeEvent
    public static void onLogin(PlayerEvent.PlayerLoggedInEvent event) {
        if (event.getEntity() instanceof ServerPlayer sp) HeroManager.onLogin(sp);
    }

    @SubscribeEvent
    public static void onLogout(PlayerEvent.PlayerLoggedOutEvent event) {
        HeroManager.forget(event.getEntity());
    }

    @SubscribeEvent
    public static void onClone(PlayerEvent.Clone event) {
        if (event.isWasDeath() && event.getEntity() instanceof ServerPlayer sp) HeroManager.afterDeath(sp);
    }

    @SubscribeEvent
    public static void onRespawn(PlayerEvent.PlayerRespawnEvent event) {
        if (event.getEntity() instanceof ServerPlayer sp) HeroManager.sync(sp);
    }

    @SubscribeEvent
    public static void onChangeDimension(PlayerEvent.PlayerChangedDimensionEvent event) {
        if (event.getEntity() instanceof ServerPlayer sp) HeroManager.sync(sp);
    }

    private CommonEvents() {
    }
}
