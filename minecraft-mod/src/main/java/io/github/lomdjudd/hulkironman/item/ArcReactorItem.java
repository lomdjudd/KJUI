package io.github.lomdjudd.hulkironman.item;

import io.github.lomdjudd.hulkironman.hero.HeroForm;
import io.github.lomdjudd.hulkironman.hero.HeroManager;
import java.util.List;
import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResultHolder;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.TooltipFlag;
import net.minecraft.world.level.Level;

/** Réacteur Arc : clic droit pour revêtir l'armure d'Iron Man (ou l'enlever). L'objet n'est pas consommé. */
public class ArcReactorItem extends Item {
    public ArcReactorItem(Properties props) {
        super(props);
    }

    @Override
    public InteractionResultHolder<ItemStack> use(Level level, Player player, InteractionHand hand) {
        ItemStack stack = player.getItemInHand(hand);
        if (player instanceof ServerPlayer sp) {
            if (HeroForm.of(sp) == HeroForm.IRONMAN) HeroManager.revert(sp, true);
            else HeroManager.transform(sp, HeroForm.IRONMAN);
            sp.getCooldowns().addCooldown(this, 20);
        }
        return InteractionResultHolder.sidedSuccess(stack, level.isClientSide());
    }

    @Override
    public boolean isFoil(ItemStack stack) {
        return true;
    }

    @Override
    public void appendHoverText(ItemStack stack, TooltipContext context, List<Component> lines, TooltipFlag flag) {
        lines.add(Component.translatable("item.hulkironman.arc_reactor.desc").withStyle(ChatFormatting.GOLD));
        lines.add(Component.translatable("item.hulkironman.transform_key", Component.keybind("key.hulkironman.transform")).withStyle(ChatFormatting.GRAY));
    }
}
