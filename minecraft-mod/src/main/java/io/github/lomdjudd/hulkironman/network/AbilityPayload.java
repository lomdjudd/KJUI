package io.github.lomdjudd.hulkironman.network;

import io.github.lomdjudd.hulkironman.HulkIronMan;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;

/** Client -> serveur : touche de pouvoir pressée (0 = transformation, 1-4 = pouvoirs, 5 = ultime). */
public record AbilityPayload(int slot) implements CustomPacketPayload {
    public static final Type<AbilityPayload> TYPE = new Type<>(HulkIronMan.id("ability"));
    public static final StreamCodec<FriendlyByteBuf, AbilityPayload> STREAM_CODEC =
            CustomPacketPayload.codec(AbilityPayload::write, AbilityPayload::read);

    private void write(FriendlyByteBuf buf) {
        buf.writeVarInt(slot);
    }

    private static AbilityPayload read(FriendlyByteBuf buf) {
        return new AbilityPayload(buf.readVarInt());
    }

    @Override
    public Type<? extends CustomPacketPayload> type() {
        return TYPE;
    }
}
