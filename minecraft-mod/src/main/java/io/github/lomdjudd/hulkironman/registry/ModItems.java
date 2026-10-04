package io.github.lomdjudd.hulkironman.registry;

import io.github.lomdjudd.hulkironman.HulkIronMan;
import io.github.lomdjudd.hulkironman.item.ArcReactorItem;
import io.github.lomdjudd.hulkironman.item.CosmicHeartItem;
import io.github.lomdjudd.hulkironman.item.CosmicOrbItem;
import io.github.lomdjudd.hulkironman.item.GammaSerumItem;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.Rarity;
import net.neoforged.neoforge.common.DeferredSpawnEggItem;
import net.neoforged.neoforge.registries.DeferredItem;
import net.neoforged.neoforge.registries.DeferredRegister;

public final class ModItems {
    public static final DeferredRegister.Items ITEMS = DeferredRegister.createItems(HulkIronMan.MODID);

    public static final DeferredItem<GammaSerumItem> GAMMA_SERUM = ITEMS.register("gamma_serum",
            () -> new GammaSerumItem(new Item.Properties().stacksTo(1).rarity(Rarity.RARE)));
    public static final DeferredItem<ArcReactorItem> ARC_REACTOR = ITEMS.register("arc_reactor",
            () -> new ArcReactorItem(new Item.Properties().stacksTo(1).rarity(Rarity.RARE)));
    public static final DeferredItem<CosmicOrbItem> COSMIC_ORB = ITEMS.register("cosmic_orb",
            () -> new CosmicOrbItem(new Item.Properties().stacksTo(16).rarity(Rarity.EPIC)));
    public static final DeferredItem<CosmicHeartItem> COSMIC_HEART = ITEMS.register("cosmic_heart",
            () -> new CosmicHeartItem(new Item.Properties().stacksTo(1).rarity(Rarity.EPIC).fireResistant()));
    public static final DeferredItem<Item> MISSILE = ITEMS.register("missile",
            () -> new Item(new Item.Properties()));
    public static final DeferredItem<DeferredSpawnEggItem> GALACTUS_SPAWN_EGG = ITEMS.register("galactus_spawn_egg",
            () -> new DeferredSpawnEggItem(ModEntities.GALACTUS, 0x3d1a5c, 0x6fdcff, new Item.Properties()));

    private ModItems() {
    }
}
