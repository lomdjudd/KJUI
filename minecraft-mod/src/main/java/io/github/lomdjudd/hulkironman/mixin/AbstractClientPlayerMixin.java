package io.github.lomdjudd.hulkironman.mixin;

import io.github.lomdjudd.hulkironman.client.HeroSkins;
import io.github.lomdjudd.hulkironman.hero.HeroForm;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.client.resources.PlayerSkin;
import net.minecraft.world.entity.player.Player;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Un joueur transformé s'affiche avec le skin de Hulk ou d'Iron Man (y compris son bras en vue subjective). */
@Mixin(AbstractClientPlayer.class)
public abstract class AbstractClientPlayerMixin {

    @Inject(method = "getSkin", at = @At("HEAD"), cancellable = true)
    private void hulkironman$heroSkin(CallbackInfoReturnable<PlayerSkin> cir) {
        PlayerSkin skin = HeroSkins.forForm(HeroForm.of((Player) (Object) this));
        if (skin != null) cir.setReturnValue(skin);
    }
}
