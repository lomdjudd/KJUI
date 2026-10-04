package io.github.lomdjudd.hulkironman.client;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import io.github.lomdjudd.hulkironman.hero.HeroForm;
import net.minecraft.client.model.PlayerModel;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.client.renderer.LightTexture;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.client.renderer.entity.RenderLayerParent;
import net.minecraft.client.renderer.entity.layers.RenderLayer;
import net.minecraft.client.renderer.texture.OverlayTexture;
import net.minecraft.resources.ResourceLocation;

/** Parties lumineuses des héros : yeux de Hulk (rouges en rage), visière, réacteur et répulseurs d'Iron Man. */
public class HeroGlowLayer extends RenderLayer<AbstractClientPlayer, PlayerModel<AbstractClientPlayer>> {

    public HeroGlowLayer(RenderLayerParent<AbstractClientPlayer, PlayerModel<AbstractClientPlayer>> parent) {
        super(parent);
    }

    @Override
    public void render(PoseStack poseStack, MultiBufferSource buffers, int light, AbstractClientPlayer player, float limbSwing,
                       float limbSwingAmount, float partialTick, float ageInTicks, float netHeadYaw, float headPitch) {
        if (player.isInvisible()) return;
        HeroForm form = HeroForm.of(player);
        ResourceLocation tex = switch (form) {
            case HULK -> HeroForm.isRaging(player) ? HeroSkins.HULK_RAGE_GLOW : HeroSkins.HULK_GLOW;
            case IRONMAN -> HeroSkins.IRONMAN_GLOW;
            default -> null;
        };
        if (tex == null) return;
        VertexConsumer vc = buffers.getBuffer(RenderType.eyes(tex));
        getParentModel().renderToBuffer(poseStack, vc, LightTexture.FULL_BRIGHT, OverlayTexture.NO_OVERLAY, -1);
    }
}
