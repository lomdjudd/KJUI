package io.github.lomdjudd.hulkironman.network;

import io.github.lomdjudd.hulkironman.HulkIronMan;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;

/** Serveur -> client : fixe (ou ajoute à) la vitesse du joueur local (sauts, aspiration, recul). */
public record MotionPayload(double x, double y, double z, boolean add) implements CustomPacketPayload {
    public static final Type<MotionPayload> TYPE = new Type<>(HulkIronMan.id("motion"));
    public static final StreamCodec<FriendlyByteBuf, MotionPayload> STREAM_CODEC =
            CustomPacketPayload.codec(MotionPayload::write, MotionPayload::read);

    private void write(FriendlyByteBuf buf) {
        buf.writeDouble(x);
        buf.writeDouble(y);
        buf.writeDouble(z);
        buf.writeBoolean(add);
    }

    private static MotionPayload read(FriendlyByteBuf buf) {
        return new MotionPayload(buf.readDouble(), buf.readDouble(), buf.readDouble(), buf.readBoolean());
    }

    @Override
    public Type<? extends CustomPacketPayload> type() {
        return TYPE;
    }
}
