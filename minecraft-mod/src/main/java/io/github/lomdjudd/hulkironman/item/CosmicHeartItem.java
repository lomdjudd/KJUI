package io.github.lomdjudd.hulkironman.item;

import java.util.List;
import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.TooltipFlag;

/** Cœur Cosmique (butin de Galactus) : dans l'inventaire, recharges plus rapides et énergie doublée. */
public class CosmicHeartItem extends Item {
    public CosmicHeartItem(Properties props) {
        super(props);
    }

    @Override
    public boolean isFoil(ItemStack stack) {
        return true;
    }

    @Override
    public void appendHoverText(ItemStack stack, TooltipContext context, List<Component> lines, TooltipFlag flag) {
        lines.add(Component.translatable("item.hulkironman.cosmic_heart.desc").withStyle(ChatFormatting.LIGHT_PURPLE));
    }
}
