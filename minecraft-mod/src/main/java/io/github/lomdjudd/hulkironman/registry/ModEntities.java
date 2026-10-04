package io.github.lomdjudd.hulkironman.registry;

import io.github.lomdjudd.hulkironman.HulkIronMan;
import io.github.lomdjudd.hulkironman.entity.GalactusEntity;
import io.github.lomdjudd.hulkironman.entity.HurledBlockEntity;
import io.github.lomdjudd.hulkironman.entity.MissileEntity;
import net.minecraft.core.registries.Registries;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.MobCategory;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.neoforged.neoforge.registries.DeferredRegister;

public final class ModEntities {
    public static final DeferredRegister<EntityType<?>> ENTITIES = DeferredRegister.create(Registries.ENTITY_TYPE, HulkIronMan.MODID);

    public static final DeferredHolder<EntityType<?>, EntityType<GalactusEntity>> GALACTUS = ENTITIES.register("galactus",
            () -> EntityType.Builder.<GalactusEntity>of(GalactusEntity::new, MobCategory.MONSTER)
                    .sized(4.0F, 10.5F)
                    .eyeHeight(9.1F)
                    .fireImmune()
                    .clientTrackingRange(16)
                    .build("galactus"));

    public static final DeferredHolder<EntityType<?>, EntityType<HurledBlockEntity>> HURLED_BLOCK = ENTITIES.register("hurled_block",
            () -> EntityType.Builder.<HurledBlockEntity>of(HurledBlockEntity::new, MobCategory.MISC)
                    .sized(1.0F, 1.0F)
                    .clientTrackingRange(10)
                    .updateInterval(1)
                    .build("hurled_block"));

    public static final DeferredHolder<EntityType<?>, EntityType<MissileEntity>> MISSILE = ENTITIES.register("missile",
            () -> EntityType.Builder.<MissileEntity>of(MissileEntity::new, MobCategory.MISC)
                    .sized(0.4F, 0.4F)
                    .clientTrackingRange(8)
                    .updateInterval(1)
                    .build("missile"));

    private ModEntities() {
    }
}
