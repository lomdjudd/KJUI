package io.github.lomdjudd.hulkironman;

import com.mojang.logging.LogUtils;
import io.github.lomdjudd.hulkironman.entity.GalactusEntity;
import io.github.lomdjudd.hulkironman.registry.ModEntities;
import io.github.lomdjudd.hulkironman.registry.ModItems;
import io.github.lomdjudd.hulkironman.registry.ModTabs;
import net.minecraft.resources.ResourceLocation;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.ModContainer;
import net.neoforged.fml.common.Mod;
import net.neoforged.neoforge.event.entity.EntityAttributeCreationEvent;
import org.slf4j.Logger;

/**
 * Hulk & Iron Man vs Galactus.
 *
 * Deviens Hulk (Sérum Gamma) ou Iron Man (Réacteur Arc), déchaîne des pouvoirs
 * spectaculaires et affronte Galactus, le Dévoreur de Mondes (Orbe Cosmique).
 */
@Mod(HulkIronMan.MODID)
public class HulkIronMan {
    public static final String MODID = "hulkironman";
    public static final Logger LOGGER = LogUtils.getLogger();

    public HulkIronMan(IEventBus modBus, ModContainer container) {
        ModItems.ITEMS.register(modBus);
        ModEntities.ENTITIES.register(modBus);
        ModTabs.TABS.register(modBus);
        modBus.addListener(HulkIronMan::onAttributes);
    }

    private static void onAttributes(EntityAttributeCreationEvent event) {
        event.put(ModEntities.GALACTUS.get(), GalactusEntity.createAttributes().build());
    }

    public static ResourceLocation id(String path) {
        return ResourceLocation.fromNamespaceAndPath(MODID, path);
    }
}
