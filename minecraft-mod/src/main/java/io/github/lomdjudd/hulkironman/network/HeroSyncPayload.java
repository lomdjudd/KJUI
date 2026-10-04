package io.github.lomdjudd.hulkironman.network;

import io.github.lomdjudd.hulkironman.HulkIronMan;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;

/** Serveur -> client : état du héros pour l'interface (rage/énergie, recharges). */
public record HeroSyncPayload(int form, float resource, float[] cooldowns, int rageTicks) implements CustomPacketPayload {
    public static final Type<HeroSyncPayload> TYPE = new Type<>(HulkIronMan.id("hero_sync"));
    public static final StreamCodec<FriendlyByteBuf, HeroSyncPayload> STREAM_CODEC =
            CustomPacketPayload.codec(HeroSyncPayload::write, HeroSyncPayload::read);

    private void write(FriendlyByteBuf buf) {
        buf.writeVarInt(form);
        buf.writeFloat(resource);
        buf.writeVarInt(cooldowns.length);
        for (float c : cooldowns) buf.writeFloat(c);
        buf.writeVarInt(rageTicks);
    }

    private static HeroSyncPayload read(FriendlyByteBuf buf) {
        int form = buf.readVarInt();
        float resource = buf.readFloat();
        int n = Math.min(16, buf.readVarInt());
        float[] cds = new float[n];
        for (int i = 0; i < n; i++) cds[i] = buf.readFloat();
        int rage = buf.readVarInt();
        return new HeroSyncPayload(form, resource, cds, rage);
    }

    @Override
    public Type<? extends CustomPacketPayload> type() {
        return TYPE;
    }
}
