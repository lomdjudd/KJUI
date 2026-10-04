package io.github.lomdjudd.hulkironman.network;

import io.github.lomdjudd.hulkironman.HulkIronMan;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;

/** Serveur -> client : tremblement de caméra. */
public record ShakePayload(float intensity, int ticks) implements CustomPacketPayload {
    public static final Type<ShakePayload> TYPE = new Type<>(HulkIronMan.id("shake"));
    public static final StreamCodec<FriendlyByteBuf, ShakePayload> STREAM_CODEC =
            CustomPacketPayload.codec(ShakePayload::write, ShakePayload::read);

    private void write(FriendlyByteBuf buf) {
        buf.writeFloat(intensity);
        buf.writeVarInt(ticks);
    }

    private static ShakePayload read(FriendlyByteBuf buf) {
        return new ShakePayload(buf.readFloat(), buf.readVarInt());
    }

    @Override
    public Type<? extends CustomPacketPayload> type() {
        return TYPE;
    }
}
