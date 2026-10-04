package io.github.lomdjudd.hulkironman.client;

import io.github.lomdjudd.hulkironman.HulkIronMan;
import io.github.lomdjudd.hulkironman.entity.GalactusEntity;
import net.minecraft.client.model.HierarchicalModel;
import net.minecraft.client.model.geom.ModelLayerLocation;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.model.geom.PartPose;
import net.minecraft.client.model.geom.builders.CubeListBuilder;
import net.minecraft.client.model.geom.builders.LayerDefinition;
import net.minecraft.client.model.geom.builders.MeshDefinition;
import net.minecraft.client.model.geom.builders.PartDefinition;
import net.minecraft.util.Mth;

/**
 * Modèle de Galactus (texture 128x128). Les boîtes et coordonnées UV doivent rester
 * identiques à GAL_BOXES / GAL_PARTS dans tools/generate_textures.py.
 */
public class GalactusModel extends HierarchicalModel<GalactusEntity> {
    public static final ModelLayerLocation LAYER = new ModelLayerLocation(HulkIronMan.id("galactus"), "main");

    private final ModelPart root;
    private final ModelPart head;
    private final ModelPart rightArm;
    private final ModelPart leftArm;
    private final ModelPart rightLeg;
    private final ModelPart leftLeg;

    public GalactusModel(ModelPart root) {
        this.root = root;
        this.head = root.getChild("head");
        this.rightArm = root.getChild("right_arm");
        this.leftArm = root.getChild("left_arm");
        this.rightLeg = root.getChild("right_leg");
        this.leftLeg = root.getChild("left_leg");
    }

    public static LayerDefinition createBodyLayer() {
        MeshDefinition mesh = new MeshDefinition();
        PartDefinition r = mesh.getRoot();

        PartDefinition body = r.addOrReplaceChild("body", CubeListBuilder.create().texOffs(0, 20).addBox(-7F, -4F, -3.5F, 14F, 14F, 7F), PartPose.ZERO);
        body.addOrReplaceChild("belt", CubeListBuilder.create().texOffs(42, 20).addBox(-7.5F, 7F, -4F, 15F, 3F, 8F), PartPose.ZERO);
        body.addOrReplaceChild("chest", CubeListBuilder.create().texOffs(42, 34).addBox(-6F, -3F, -4.5F, 12F, 8F, 1F), PartPose.ZERO);

        PartDefinition head = r.addOrReplaceChild("head", CubeListBuilder.create().texOffs(0, 0).addBox(-4F, -8F, -4F, 8F, 8F, 8F), PartPose.offset(0F, -4F, 0F));
        head.addOrReplaceChild("helmet", CubeListBuilder.create().texOffs(32, 0).addBox(-5F, -10F, -5F, 10F, 7F, 10F), PartPose.ZERO);
        head.addOrReplaceChild("fin_r", CubeListBuilder.create().texOffs(72, 0).addBox(-3F, -9F, -2F, 3F, 9F, 4F),
                PartPose.offsetAndRotation(-5F, -7F, 0F, 0F, 0F, -0.18F));
        head.addOrReplaceChild("fin_l", CubeListBuilder.create().texOffs(86, 0).addBox(0F, -9F, -2F, 3F, 9F, 4F),
                PartPose.offsetAndRotation(5F, -7F, 0F, 0F, 0F, 0.18F));
        head.addOrReplaceChild("crest", CubeListBuilder.create().texOffs(100, 0).addBox(-2F, -12F, -5.5F, 4F, 4F, 2F), PartPose.ZERO);

        PartDefinition ra = r.addOrReplaceChild("right_arm", CubeListBuilder.create().texOffs(0, 44).addBox(-3F, -2F, -3F, 5F, 15F, 6F),
                PartPose.offset(-9.5F, -2F, 0F));
        ra.addOrReplaceChild("pad_r", CubeListBuilder.create().texOffs(44, 44).addBox(-4.5F, -4F, -4F, 7F, 4F, 8F), PartPose.ZERO);
        ra.addOrReplaceChild("cuff_r", CubeListBuilder.create().texOffs(0, 90).addBox(-3.5F, 8F, -3.5F, 6F, 3F, 7F), PartPose.ZERO);

        PartDefinition la = r.addOrReplaceChild("left_arm", CubeListBuilder.create().texOffs(22, 44).addBox(-2F, -2F, -3F, 5F, 15F, 6F),
                PartPose.offset(9.5F, -2F, 0F));
        la.addOrReplaceChild("pad_l", CubeListBuilder.create().texOffs(74, 44).addBox(-2.5F, -4F, -4F, 7F, 4F, 8F), PartPose.ZERO);
        la.addOrReplaceChild("cuff_l", CubeListBuilder.create().texOffs(26, 90).addBox(-2.5F, 8F, -3.5F, 6F, 3F, 7F), PartPose.ZERO);

        PartDefinition rl = r.addOrReplaceChild("right_leg", CubeListBuilder.create().texOffs(0, 68).addBox(-3F, 0F, -3F, 6F, 14F, 6F),
                PartPose.offset(-3.6F, 10F, 0F));
        rl.addOrReplaceChild("boot_r", CubeListBuilder.create().texOffs(48, 68).addBox(-3.5F, 7F, -3.5F, 7F, 3F, 7F), PartPose.ZERO);

        PartDefinition ll = r.addOrReplaceChild("left_leg", CubeListBuilder.create().texOffs(24, 68).addBox(-3F, 0F, -3F, 6F, 14F, 6F),
                PartPose.offset(3.6F, 10F, 0F));
        ll.addOrReplaceChild("boot_l", CubeListBuilder.create().texOffs(76, 68).addBox(-3.5F, 7F, -3.5F, 7F, 3F, 7F), PartPose.ZERO);

        return LayerDefinition.create(mesh, 128, 128);
    }

    @Override
    public ModelPart root() {
        return root;
    }

    @Override
    public void setupAnim(GalactusEntity e, float limbSwing, float limbSwingAmount, float ageInTicks, float netHeadYaw, float headPitch) {
        root.getAllParts().forEach(ModelPart::resetPose);
        head.yRot = netHeadYaw * Mth.DEG_TO_RAD;
        head.xRot = headPitch * Mth.DEG_TO_RAD;

        float walk = limbSwing * 0.35F;
        float amount = Math.min(1F, limbSwingAmount * 1.4F);
        rightLeg.xRot = Mth.cos(walk) * 0.8F * amount;
        leftLeg.xRot = -rightLeg.xRot;
        rightArm.xRot = -Mth.cos(walk) * 0.5F * amount;
        leftArm.xRot = -rightArm.xRot;
        float breathe = Mth.sin(ageInTicks * 0.05F) * 0.04F;
        rightArm.zRot = 0.08F + breathe;
        leftArm.zRot = -0.08F - breathe;

        float t = e.clientStateTicks + (ageInTicks - e.tickCount);
        switch (e.getState()) {
            case GalactusEntity.S_BEAM_CHARGE, GalactusEntity.S_BEAM -> {
                float k = Mth.clamp(t / 10F, 0F, 1F);
                rightArm.xRot = -1.2F * k;
                leftArm.xRot = -1.2F * k;
                rightArm.zRot = 0.55F * k;
                leftArm.zRot = -0.55F * k;
            }
            case GalactusEntity.S_METEOR -> {
                float k = Mth.clamp(t / 12F, 0F, 1F);
                float wave = Mth.sin(t * 0.3F) * 0.15F;
                rightArm.xRot = -2.9F * k + wave;
                leftArm.xRot = -2.9F * k - wave;
                rightArm.zRot = -0.25F * k;
                leftArm.zRot = 0.25F * k;
            }
            case GalactusEntity.S_SLAM -> {
                float raise = Mth.clamp(t / 20F, 0F, 1F);
                float down = Mth.clamp((t - 22F) / 3F, 0F, 1F);
                float x = Mth.lerp(down, -2.9F * raise, 0.5F);
                rightArm.xRot = x;
                leftArm.xRot = x;
                rightArm.zRot = 0.1F;
                leftArm.zRot = -0.1F;
                head.xRot += down * 0.35F;
            }
            case GalactusEntity.S_GRAVITY -> {
                float k = Mth.clamp(t / 10F, 0F, 1F);
                float shake = Mth.sin(t * 1.7F) * 0.05F;
                rightArm.xRot = -1.5F * k + shake;
                leftArm.xRot = -1.5F * k - shake;
                rightArm.zRot = -0.45F * k;
                leftArm.zRot = 0.45F * k;
            }
            case GalactusEntity.S_SUMMON -> {
                float k = Mth.clamp(t / 10F, 0F, 1F);
                rightArm.xRot = -2.7F * k;
                rightArm.zRot = 0.2F;
            }
            case GalactusEntity.S_DESCEND -> {
                rightArm.zRot = 1.1F;
                leftArm.zRot = -1.1F;
                rightLeg.xRot = 0.1F;
                leftLeg.xRot = -0.1F;
            }
            case GalactusEntity.S_PHASE -> {
                float k = Mth.clamp(t / 8F, 0F, 1F);
                rightArm.zRot = 1.0F * k;
                leftArm.zRot = -1.0F * k;
                rightArm.xRot = -0.4F * k;
                leftArm.xRot = -0.4F * k;
                head.xRot = -0.5F * k;
            }
            default -> {
            }
        }
    }
}
