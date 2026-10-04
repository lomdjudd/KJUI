package io.github.lomdjudd.hulkironman.registry;

import io.github.lomdjudd.hulkironman.HulkIronMan;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.world.item.CreativeModeTab;
import net.minecraft.world.item.ItemStack;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.neoforged.neoforge.registries.DeferredRegister;

public final class ModTabs {
    public static final DeferredRegister<CreativeModeTab> TABS = DeferredRegister.create(Registries.CREATIVE_MODE_TAB, HulkIronMan.MODID);

    public static final DeferredHolder<CreativeModeTab, CreativeModeTab> MAIN = TABS.register("main", () -> CreativeModeTab.builder()
            .title(Component.translatable("itemGroup.hulkironman"))
            .icon(() -> new ItemStack(ModItems.GAMMA_SERUM.get()))
            .displayItems((params, output) -> {
                output.accept(ModItems.GAMMA_SERUM.get());
                output.accept(ModItems.ARC_REACTOR.get());
                output.accept(ModItems.COSMIC_ORB.get());
                output.accept(ModItems.COSMIC_HEART.get());
                output.accept(ModItems.GALACTUS_SPAWN_EGG.get());
            })
            .build());

    private ModTabs() {
    }
}
