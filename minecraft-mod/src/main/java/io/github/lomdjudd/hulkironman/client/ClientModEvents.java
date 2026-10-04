package io.github.lomdjudd.hulkironman.client;

import io.github.lomdjudd.hulkironman.HulkIronMan;
import io.github.lomdjudd.hulkironman.registry.ModEntities;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.renderer.entity.EntityRenderer;
import net.minecraft.client.renderer.entity.ThrownItemRenderer;
import net.minecraft.client.renderer.entity.player.PlayerRenderer;
import net.minecraft.client.resources.PlayerSkin;
import net.minecraft.world.entity.player.Player;
import net.neoforged.api.distmarker.Dist;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.client.event.EntityRenderersEvent;
import net.neoforged.neoforge.client.event.RegisterGuiLayersEvent;
import net.neoforged.neoforge.client.event.RegisterKeyMappingsEvent;

@EventBusSubscriber(modid = HulkIronMan.MODID, bus = EventBusSubscriber.Bus.MOD, value = Dist.CLIENT)
public final class ClientModEvents {

    @SubscribeEvent
    public static void registerRenderers(EntityRenderersEvent.RegisterRenderers event) {
        event.registerEntityRenderer(ModEntities.GALACTUS.get(), GalactusRenderer::new);
        event.registerEntityRenderer(ModEntities.HURLED_BLOCK.get(), HurledBlockRenderer::new);
        event.registerEntityRenderer(ModEntities.MISSILE.get(), ctx -> new ThrownItemRenderer<>(ctx, 1.4F, true));
    }

    @SubscribeEvent
    public static void registerLayers(EntityRenderersEvent.RegisterLayerDefinitions event) {
        event.registerLayerDefinition(GalactusModel.LAYER, GalactusModel::createBodyLayer);
    }

    @SubscribeEvent
    public static void addLayers(EntityRenderersEvent.AddLayers event) {
        for (PlayerSkin.Model model : event.getSkins()) {
            EntityRenderer<? extends Player> renderer = event.getSkin(model);
            if (renderer instanceof PlayerRenderer pr) pr.addLayer(new HeroGlowLayer(pr));
        }
    }

    @SubscribeEvent
    public static void registerKeys(RegisterKeyMappingsEvent event) {
        for (KeyMapping k : Keys.ALL) event.register(k);
    }

    @SubscribeEvent
    public static void registerGui(RegisterGuiLayersEvent event) {
        event.registerAboveAll(HulkIronMan.id("hero_hud"), HeroHud::render);
    }

    private ClientModEvents() {
    }
}
