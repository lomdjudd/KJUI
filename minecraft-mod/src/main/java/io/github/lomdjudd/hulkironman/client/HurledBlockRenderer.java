package io.github.lomdjudd.hulkironman.client;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.math.Axis;
import io.github.lomdjudd.hulkironman.entity.HurledBlockEntity;
import net.minecraft.client.renderer.LightTexture;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.block.BlockRenderDispatcher;
import net.minecraft.client.renderer.entity.EntityRenderer;
import net.minecraft.client.renderer.entity.EntityRendererProvider;
import net.minecraft.client.renderer.texture.OverlayTexture;
import net.minecraft.client.renderer.texture.TextureAtlas;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.level.block.state.BlockState;

/** Dessine le rocher / météore comme un gros bloc qui tourne sur lui-même. */
public class HurledBlockRenderer extends EntityRenderer<HurledBlockEntity> {
    private final BlockRenderDispatcher blocks;

    public HurledBlockRenderer(EntityRendererProvider.Context ctx) {
        super(ctx);
        this.blocks = ctx.getBlockRenderDispatcher();
        this.shadowRadius = 0.7F;
    }

    @Override
    public void render(HurledBlockEntity e, float yaw, float partialTick, PoseStack poseStack, MultiBufferSource buffers, int light) {
        BlockState state = e.getBlockState();
        float size = e.getSize();
        float spin = (e.tickCount + partialTick) * 17F;
        poseStack.pushPose();
        poseStack.translate(0.0, size * 0.5, 0.0);
        poseStack.mulPose(Axis.XP.rotationDegrees(spin));
        poseStack.mulPose(Axis.ZP.rotationDegrees(spin * 0.7F));
        poseStack.scale(size, size, size);
        poseStack.translate(-0.5, -0.5, -0.5);
        blocks.renderSingleBlock(state, poseStack, buffers, e.isMeteor() ? LightTexture.FULL_BRIGHT : light, OverlayTexture.NO_OVERLAY);
        poseStack.popPose();
        super.render(e, yaw, partialTick, poseStack, buffers, light);
    }

    @Override
    public ResourceLocation getTextureLocation(HurledBlockEntity entity) {
        return TextureAtlas.LOCATION_BLOCKS;
    }
}
