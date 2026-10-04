package io.github.lomdjudd.hulkironman.client;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import io.github.lomdjudd.hulkironman.HulkIronMan;
import io.github.lomdjudd.hulkironman.entity.GalactusEntity;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.client.renderer.culling.Frustum;
import net.minecraft.client.renderer.entity.EntityRendererProvider;
import net.minecraft.client.renderer.entity.MobRenderer;
import net.minecraft.client.renderer.entity.layers.EyesLayer;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.util.Mth;
import net.minecraft.world.phys.Vec3;
import org.joml.Matrix4f;
import org.joml.Vector3f;

/** Rendu de Galactus (x4,5), de ses yeux lumineux et de son rayon cosmique. */
public class GalactusRenderer extends MobRenderer<GalactusEntity, GalactusModel> {
    private static final ResourceLocation TEXTURE = HulkIronMan.id("textures/entity/galactus.png");
    private static final ResourceLocation GLOW = HulkIronMan.id("textures/entity/galactus_glow.png");
    private static final RenderType GLOW_TYPE = RenderType.eyes(GLOW);
    public static final float SCALE = 4.5F;

    public GalactusRenderer(EntityRendererProvider.Context ctx) {
        super(ctx, new GalactusModel(ctx.bakeLayer(GalactusModel.LAYER)), 3.5F);
        this.addLayer(new EyesLayer<GalactusEntity, GalactusModel>(this) {
            @Override
            public RenderType renderType() {
                return GLOW_TYPE;
            }
        });
    }

    @Override
    public ResourceLocation getTextureLocation(GalactusEntity entity) {
        return TEXTURE;
    }

    @Override
    protected void scale(GalactusEntity entity, PoseStack poseStack, float partialTick) {
        poseStack.scale(SCALE, SCALE, SCALE);
    }

    @Override
    public boolean shouldRender(GalactusEntity entity, Frustum frustum, double x, double y, double z) {
        return true;
    }

    @Override
    public void render(GalactusEntity e, float yaw, float partialTick, PoseStack poseStack, MultiBufferSource buffers, int light) {
        super.render(e, yaw, partialTick, poseStack, buffers, light);
        if (e.getState() == GalactusEntity.S_BEAM && e.deathTime == 0) renderBeam(e, partialTick, poseStack, buffers);
    }

    private void renderBeam(GalactusEntity e, float partialTick, PoseStack poseStack, MultiBufferSource buffers) {
        Vector3f endW = e.getBeamEnd();
        if (endW.lengthSquared() < 1.0E-3F) return;
        Vec3 pos = e.getPosition(partialTick);
        float headYaw = Mth.rotLerp(partialTick, e.yHeadRotO, e.yHeadRot);
        Vec3 fwd = Vec3.directionFromRotation(0F, headYaw);
        Vec3 start = new Vec3(0, e.getEyeHeight() - 0.2, 0).add(fwd.scale(1.5));
        Vec3 end = new Vec3(endW.x() - pos.x, endW.y() - pos.y, endW.z() - pos.z);
        VertexConsumer vc = buffers.getBuffer(RenderType.lightning());
        Matrix4f m = poseStack.last().pose();
        float time = e.tickCount + partialTick;
        float pulse = 1F + 0.15F * Mth.sin(time * 1.3F);
        prism(vc, m, start, end, 1.1F * pulse, 110, 30, 200, 70);
        prism(vc, m, start, end, 0.55F * pulse, 190, 120, 255, 140);
        prism(vc, m, start, end, 0.22F, 255, 255, 255, 220);
    }

    /** Prisme à 4 faces entre a et b, dessiné des deux côtés (additif, lumineux). */
    private static void prism(VertexConsumer vc, Matrix4f m, Vec3 a, Vec3 b, float radius, int r, int g, int bl, int alpha) {
        Vec3 d = b.subtract(a);
        if (d.lengthSqr() < 1.0E-6) return;
        d = d.normalize();
        Vec3 up = Math.abs(d.y) > 0.95 ? new Vec3(1, 0, 0) : new Vec3(0, 1, 0);
        Vec3 u = d.cross(up).normalize();
        Vec3 v = d.cross(u).normalize();
        Vec3[] c = new Vec3[4];
        for (int i = 0; i < 4; i++) {
            double ang = Math.PI / 4 + i * Math.PI / 2;
            c[i] = u.scale(Math.cos(ang) * radius).add(v.scale(Math.sin(ang) * radius));
        }
        for (int i = 0; i < 4; i++) {
            Vec3 c0 = c[i];
            Vec3 c1 = c[(i + 1) % 4];
            quad(vc, m, a.add(c0), a.add(c1), b.add(c1), b.add(c0), r, g, bl, alpha);
            quad(vc, m, a.add(c1), a.add(c0), b.add(c0), b.add(c1), r, g, bl, alpha);
        }
    }

    private static void quad(VertexConsumer vc, Matrix4f m, Vec3 p0, Vec3 p1, Vec3 p2, Vec3 p3, int r, int g, int b, int a) {
        vc.addVertex(m, (float) p0.x, (float) p0.y, (float) p0.z).setColor(r, g, b, a);
        vc.addVertex(m, (float) p1.x, (float) p1.y, (float) p1.z).setColor(r, g, b, a);
        vc.addVertex(m, (float) p2.x, (float) p2.y, (float) p2.z).setColor(r, g, b, a);
        vc.addVertex(m, (float) p3.x, (float) p3.y, (float) p3.z).setColor(r, g, b, a);
    }
}
