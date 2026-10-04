package io.github.lomdjudd.hulkironman.network;

import io.github.lomdjudd.hulkironman.HulkIronMan;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.phys.Vec3;
import net.neoforged.neoforge.network.PacketDistributor;

/**
 * Serveur -> clients proches : un effet visuel à dessiner avec des particules.
 * Un seul petit paquet par effet, les particules sont générées côté client.
 *
 * @param type   type d'effet (constantes ci-dessous)
 * @param data   donnée entière : identifiant d'entité ou d'état de bloc selon le type
 * @param a      point principal
 * @param b      second point, direction ou couleur selon le type
 * @param size   rayon / portée / hauteur selon le type
 */
public record FxPayload(int type, int data, double ax, double ay, double az, double bx, double by, double bz, float size)
        implements CustomPacketPayload {

    public static final int REPULSOR = 1;       // a -> b
    public static final int UNIBEAM = 2;        // a -> b
    public static final int ORBITAL = 3;        // a = impact, size = hauteur
    public static final int RING = 4;           // onde de choc au sol : a = centre, size = rayon, b = couleur (b.x < 0 : aucune)
    public static final int LASER_RING = 5;     // a = centre, size = rayon
    public static final int SPHERE = 6;         // a = centre, size = rayon, b = couleur
    public static final int CLAP = 7;           // a = origine, b = direction, size = portée
    public static final int IMPACT = 8;         // a = point, size = rayon, data = état de bloc, b.x > 0 : gros
    public static final int TRANSFORM_HULK = 9; // data = entité
    public static final int TRANSFORM_IRON = 10;
    public static final int WARNING = 11;       // a = centre au sol, size = rayon
    public static final int GRAVITY = 12;       // a = centre, size = rayon
    public static final int CHARGE = 13;        // a = point, size = rayon, b = couleur
    public static final int SUMMON = 14;        // a = point
    public static final int THRUSTER = 15;      // data = entité
    public static final int RAGE_AURA = 16;     // data = entité
    public static final int TRAIL = 17;         // data = entité
    public static final int PUNCH = 18;         // a = point
    public static final int GALACTUS_PHASE = 19; // a = centre, size = rayon
    public static final int REVERT = 20;        // data = entité
    public static final int LOCK_ON = 21;       // data = entité
    public static final int DEVOUR = 22;        // a = centre, size = rayon
    public static final int DEFLECT = 23;       // a = point

    public static final Type<FxPayload> TYPE = new Type<>(HulkIronMan.id("fx"));
    public static final StreamCodec<FriendlyByteBuf, FxPayload> STREAM_CODEC =
            CustomPacketPayload.codec(FxPayload::write, FxPayload::read);

    private void write(FriendlyByteBuf buf) {
        buf.writeVarInt(type);
        buf.writeVarInt(data);
        buf.writeDouble(ax);
        buf.writeDouble(ay);
        buf.writeDouble(az);
        buf.writeDouble(bx);
        buf.writeDouble(by);
        buf.writeDouble(bz);
        buf.writeFloat(size);
    }

    private static FxPayload read(FriendlyByteBuf buf) {
        return new FxPayload(buf.readVarInt(), buf.readVarInt(), buf.readDouble(), buf.readDouble(), buf.readDouble(),
                buf.readDouble(), buf.readDouble(), buf.readDouble(), buf.readFloat());
    }

    public Vec3 a() {
        return new Vec3(ax, ay, az);
    }

    public Vec3 b() {
        return new Vec3(bx, by, bz);
    }

    @Override
    public Type<? extends CustomPacketPayload> type() {
        return TYPE;
    }

    // ---------- envoi côté serveur ----------

    public static void send(ServerLevel level, int type, int data, Vec3 a, Vec3 b, float size) {
        FxPayload p = new FxPayload(type, data, a.x, a.y, a.z, b.x, b.y, b.z, size);
        PacketDistributor.sendToPlayersNear(level, null, a.x, a.y, a.z, 160.0, p);
    }

    public static void send(ServerLevel level, int type, Vec3 a, float size) {
        send(level, type, 0, a, Vec3.ZERO, size);
    }

    public static void send(ServerLevel level, int type, int data, Vec3 a) {
        send(level, type, data, a, Vec3.ZERO, 0F);
    }
}
