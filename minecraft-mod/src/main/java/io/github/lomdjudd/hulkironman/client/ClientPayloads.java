package io.github.lomdjudd.hulkironman.client;

import io.github.lomdjudd.hulkironman.network.FxPayload;
import io.github.lomdjudd.hulkironman.network.HeroSyncPayload;
import io.github.lomdjudd.hulkironman.network.MotionPayload;
import io.github.lomdjudd.hulkironman.network.ShakePayload;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.world.phys.Vec3;

/** Réception des paquets côté client. */
public final class ClientPayloads {
    public static void sync(HeroSyncPayload p) {
        ClientHeroData.apply(p);
    }

    public static void fx(FxPayload p) {
        ClientFx.play(p);
    }

    public static void motion(MotionPayload p) {
        LocalPlayer player = Minecraft.getInstance().player;
        if (player == null) return;
        Vec3 v = new Vec3(p.x(), p.y(), p.z());
        player.setDeltaMovement(p.add() ? player.getDeltaMovement().add(v) : v);
        if (!p.add()) player.resetFallDistance();
    }

    public static void shake(ShakePayload p) {
        if (ClientConfig.shakeEnabled()) ClientHeroData.shake(p.intensity(), p.ticks());
    }

    private ClientPayloads() {
    }
}
