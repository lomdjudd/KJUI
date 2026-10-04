package io.github.lomdjudd.hulkironman.client;

import io.github.lomdjudd.hulkironman.HulkIronMan;
import io.github.lomdjudd.hulkironman.hero.HeroForm;
import io.github.lomdjudd.hulkironman.network.AbilityPayload;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.util.Mth;
import net.minecraft.world.phys.Vec3;
import net.neoforged.api.distmarker.Dist;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.client.event.ClientPlayerNetworkEvent;
import net.neoforged.neoforge.client.event.ClientTickEvent;
import net.neoforged.neoforge.client.event.ViewportEvent;
import net.neoforged.neoforge.network.PacketDistributor;

@EventBusSubscriber(modid = HulkIronMan.MODID, value = Dist.CLIENT)
public final class ClientGameEvents {

    @SubscribeEvent
    public static void onClientTick(ClientTickEvent.Post event) {
        Minecraft mc = Minecraft.getInstance();
        LocalPlayer player = mc.player;
        if (player == null) return;
        HeroForm form = HeroForm.of(player);
        for (int i = 0; i < Keys.ALL.size(); i++) {
            while (Keys.ALL.get(i).consumeClick()) {
                if (i == 0 || form != HeroForm.NONE) PacketDistributor.sendToServer(new AbilityPayload(i));
            }
        }
        // Turbo d'Iron Man : en vol, sprint + avancer = poussée dans la direction du regard
        if (form == HeroForm.IRONMAN && player.getAbilities().flying && mc.options.keySprint.isDown() && player.input.forwardImpulse > 0) {
            Vec3 v = player.getDeltaMovement().add(player.getLookAngle().scale(0.14));
            double max = 2.2;
            if (v.length() > max) v = v.normalize().scale(max);
            player.setDeltaMovement(v);
        }
        if (ClientHeroData.shakeTicks > 0) ClientHeroData.shakeTicks--;
    }

    @SubscribeEvent
    public static void onCamera(ViewportEvent.ComputeCameraAngles event) {
        if (ClientHeroData.shakeTicks <= 0) return;
        float k = ClientHeroData.shakeIntensity * ClientHeroData.shakeTicks / (float) ClientHeroData.shakeMax;
        float t = (float) ((Minecraft.getInstance().player != null ? Minecraft.getInstance().player.tickCount : 0) + event.getPartialTick());
        event.setPitch(event.getPitch() + Mth.sin(t * 2.7F) * k * 1.6F);
        event.setYaw(event.getYaw() + Mth.cos(t * 3.1F) * k * 1.2F);
        event.setRoll(event.getRoll() + Mth.sin(t * 2.3F) * k * 1.8F);
    }

    @SubscribeEvent
    public static void onLogout(ClientPlayerNetworkEvent.LoggingOut event) {
        ClientHeroData.reset();
    }

    private ClientGameEvents() {
    }
}
