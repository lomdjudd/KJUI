package io.github.lomdjudd.hulkironman.network;

import io.github.lomdjudd.hulkironman.HulkIronMan;
import io.github.lomdjudd.hulkironman.client.ClientPayloads;
import io.github.lomdjudd.hulkironman.hero.HeroManager;
import net.minecraft.server.level.ServerPlayer;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.network.event.RegisterPayloadHandlersEvent;
import net.neoforged.neoforge.network.registration.PayloadRegistrar;

@EventBusSubscriber(modid = HulkIronMan.MODID, bus = EventBusSubscriber.Bus.MOD)
public final class ModNetwork {

    @SubscribeEvent
    public static void register(RegisterPayloadHandlersEvent event) {
        PayloadRegistrar r = event.registrar("1");
        r.playToServer(AbilityPayload.TYPE, AbilityPayload.STREAM_CODEC, (payload, ctx) -> ctx.enqueueWork(() -> {
            if (ctx.player() instanceof ServerPlayer sp) HeroManager.useAbility(sp, payload.slot());
        }));
        // Les gestionnaires côté client ne sont appelés que sur le client :
        // la classe ClientPayloads n'est jamais chargée sur un serveur dédié.
        r.playToClient(HeroSyncPayload.TYPE, HeroSyncPayload.STREAM_CODEC, (payload, ctx) -> ctx.enqueueWork(() -> ClientPayloads.sync(payload)));
        r.playToClient(FxPayload.TYPE, FxPayload.STREAM_CODEC, (payload, ctx) -> ctx.enqueueWork(() -> ClientPayloads.fx(payload)));
        r.playToClient(MotionPayload.TYPE, MotionPayload.STREAM_CODEC, (payload, ctx) -> ctx.enqueueWork(() -> ClientPayloads.motion(payload)));
        r.playToClient(ShakePayload.TYPE, ShakePayload.STREAM_CODEC, (payload, ctx) -> ctx.enqueueWork(() -> ClientPayloads.shake(payload)));
    }

    private ModNetwork() {
    }
}
