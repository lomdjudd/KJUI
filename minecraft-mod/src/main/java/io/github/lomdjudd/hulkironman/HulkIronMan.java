package io.github.lomdjudd.hulkironman;

import com.mojang.logging.LogUtils;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.ModContainer;
import net.neoforged.fml.common.Mod;
import org.slf4j.Logger;

@Mod(HulkIronMan.MODID)
public class HulkIronMan {
    public static final String MODID = "hulkironman";
    public static final Logger LOGGER = LogUtils.getLogger();

    public HulkIronMan(IEventBus modBus, ModContainer container) {
        LOGGER.info("Hulk & Iron Man vs Galactus : chargement");
    }
}
