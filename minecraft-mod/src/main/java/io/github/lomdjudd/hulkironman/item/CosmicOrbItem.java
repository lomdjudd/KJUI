package io.github.lomdjudd.hulkironman.item;

import io.github.lomdjudd.hulkironman.entity.GalactusEntity;
import java.util.List;
import net.minecraft.ChatFormatting;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.TooltipFlag;
import net.minecraft.world.item.context.UseOnContext;

/** Orbe Cosmique : clic droit sur le sol pour invoquer Galactus. */
public class CosmicOrbItem extends Item {
    public CosmicOrbItem(Properties props) {
        super(props);
    }

    @Override
    public InteractionResult useOn(UseOnContext ctx) {
        if (ctx.getLevel() instanceof ServerLevel level) {
            BlockPos pos = ctx.getClickedPos().relative(ctx.getClickedFace());
            GalactusEntity.summonFromSky(level, pos);
            Player player = ctx.getPlayer();
            if (player == null || !player.getAbilities().instabuild) ctx.getItemInHand().shrink(1);
            if (player != null) player.getCooldowns().addCooldown(this, 100);
        }
        return InteractionResult.sidedSuccess(ctx.getLevel().isClientSide());
    }

    @Override
    public boolean isFoil(ItemStack stack) {
        return true;
    }

    @Override
    public void appendHoverText(ItemStack stack, TooltipContext context, List<Component> lines, TooltipFlag flag) {
        lines.add(Component.translatable("item.hulkironman.cosmic_orb.desc").withStyle(ChatFormatting.LIGHT_PURPLE));
        lines.add(Component.translatable("item.hulkironman.cosmic_orb.warn").withStyle(ChatFormatting.DARK_RED));
    }
}
