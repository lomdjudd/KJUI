package io.github.lomdjudd.hulkironman.client;

import io.github.lomdjudd.hulkironman.hero.HeroForm;
import io.github.lomdjudd.hulkironman.registry.ModItems;
import net.minecraft.client.DeltaTracker;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Mth;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;

/** Interface du héros : jauge (rage / énergie), 5 pouvoirs avec recharges, et HUD J.A.R.V.I.S. pour Iron Man. */
public final class HeroHud {
    private static final int SLOT = 20;
    private static final int GAP = 2;

    private static ItemStack[] hulkIcons;
    private static ItemStack[] ironIcons;

    private static ItemStack[] icons(HeroForm form) {
        if (hulkIcons == null) {
            hulkIcons = new ItemStack[]{new ItemStack(Items.WIND_CHARGE), new ItemStack(Items.MACE), new ItemStack(Items.RABBIT_FOOT),
                    new ItemStack(Items.COBBLESTONE), new ItemStack(ModItems.GAMMA_SERUM.get())};
            ironIcons = new ItemStack[]{new ItemStack(Items.HEART_OF_THE_SEA), new ItemStack(Items.BEACON), new ItemStack(Items.FIREWORK_ROCKET),
                    new ItemStack(Items.BLAZE_ROD), new ItemStack(ModItems.ARC_REACTOR.get())};
        }
        return form == HeroForm.HULK ? hulkIcons : ironIcons;
    }

    public static void render(GuiGraphics g, DeltaTracker delta) {
        Minecraft mc = Minecraft.getInstance();
        LocalPlayer player = mc.player;
        if (player == null || mc.options.hideGui || player.isSpectator()) return;
        HeroForm form = HeroForm.of(player);
        if (form == HeroForm.NONE) return;
        Font font = mc.font;
        int w = g.guiWidth();
        int h = g.guiHeight();
        float time = player.tickCount + delta.getGameTimeDeltaPartialTick(true);

        if (form == HeroForm.IRONMAN && mc.options.getCameraType().isFirstPerson()) jarvis(g, mc, player, font, w, h, time);
        if (form == HeroForm.HULK && ClientHeroData.rageTicks > 0) rageVignette(g, w, h, time);

        int panelW = 5 * SLOT + 4 * GAP;
        int x0 = w - panelW - 6;
        int y0 = h - SLOT - 20;
        if (x0 < w / 2 + 96) {
            // écran étroit : le panneau passe au milieu à droite
            y0 = h / 2 + 10;
        }
        boolean hulk = form == HeroForm.HULK;
        int color = hulk ? 0xFF5BE04A : 0xFFFFC23A;
        int accent = hulk ? 0xFF2E8B22 : 0xFFC0201E;

        // titre + jauge
        String title = hulk ? "HULK" : "IRON MAN";
        g.drawString(font, title, x0, y0 - 29, color, true);
        float res = Mth.clamp(ClientHeroData.resource / 100F, 0F, 1F);
        String label = hulk
                ? (ClientHeroData.rageTicks > 0 ? Component.translatable("hud.hulkironman.rage_active", ClientHeroData.rageTicks / 20).getString()
                : Component.translatable("hud.hulkironman.rage", (int) (res * 100)).getString())
                : Component.translatable("hud.hulkironman.energy", (int) (res * 100)).getString();
        int lw = font.width(label);
        g.drawString(font, label, x0 + panelW - lw, y0 - 18, ClientHeroData.rageTicks > 0 && ((int) (time / 4) % 2 == 0) ? 0xFFFF4040 : 0xFFE0E0E0, true);
        int barY = y0 - 7;
        g.fill(x0 - 1, barY - 1, x0 + panelW + 1, barY + 5, 0xC0000000);
        int fillW = (int) (panelW * (ClientHeroData.rageTicks > 0 ? ClientHeroData.rageTicks / 400F : res));
        int barColor = res >= 1F && ClientHeroData.rageTicks <= 0 ? pulse(color, time) : (ClientHeroData.rageTicks > 0 ? 0xFFFF3B2F : color);
        g.fillGradient(x0, barY, x0 + fillW, barY + 4, barColor, accent);

        // pouvoirs
        ItemStack[] ic = icons(form);
        for (int i = 0; i < 5; i++) {
            int sx = x0 + i * (SLOT + GAP);
            boolean ult = i == 4;
            float cd = i < ClientHeroData.cooldowns.length ? ClientHeroData.cooldowns[i] : 0F;
            boolean ready = ult ? ClientHeroData.resource >= 100F : cd <= 0F;
            int border = ult ? (ready ? pulse(color, time) : 0xFF555555) : (ready ? color : 0xFF666666);
            g.fill(sx - 1, y0 - 1, sx + SLOT + 1, y0 + SLOT + 1, border);
            g.fill(sx, y0, sx + SLOT, y0 + SLOT, 0xD0101010);
            g.renderItem(ic[i], sx + 2, y0 + 2);
            if (!ready) {
                float k = ult ? 1F - Mth.clamp(ClientHeroData.resource / 100F, 0F, 1F) : Mth.clamp(cd, 0F, 1F);
                int top = y0 + (int) (SLOT * (1F - k));
                g.fill(sx, top, sx + SLOT, y0 + SLOT, 0xB0000000);
            }
            Component key = Keys.ALL.get(i + 1).getTranslatedKeyMessage();
            String ks = key.getString();
            if (ks.length() > 3) ks = ks.substring(0, 3);
            g.pose().pushPose();
            g.pose().translate(0, 0, 200);
            g.pose().scale(0.75F, 0.75F, 1F);
            g.drawString(font, ks, (int) ((sx + SLOT - font.width(ks) * 0.75F - 1) / 0.75F), (int) ((y0 + SLOT - 7) / 0.75F), 0xFFFFFF55, true);
            g.pose().popPose();
        }
        g.pose().pushPose();
        g.pose().translate(0, 0, 200);
        g.pose().scale(0.75F, 0.75F, 1F);
        String hint = Component.translatable("hud.hulkironman.transform_hint", Keys.TRANSFORM.getTranslatedKeyMessage()).getString();
        g.drawString(font, hint, (int) ((x0 + panelW - font.width(hint) * 0.75F) / 0.75F), (int) ((y0 + SLOT + 3) / 0.75F), 0xFFAAAAAA, true);
        g.pose().popPose();
    }

    private static int pulse(int color, float time) {
        float k = 0.65F + 0.35F * Mth.sin(time * 0.35F);
        int r = (int) (((color >> 16) & 0xFF) * k);
        int gg = (int) (((color >> 8) & 0xFF) * k);
        int b = (int) ((color & 0xFF) * k);
        return 0xFF000000 | (r << 16) | (gg << 8) | b;
    }

    private static void rageVignette(GuiGraphics g, int w, int h, float time) {
        int a = (int) (60 + 30 * Mth.sin(time * 0.3F));
        int c = (a << 24) | 0x10C020;
        g.fillGradient(0, 0, w, h / 5, c, 0x0010C020);
        g.fillGradient(0, h - h / 5, w, h, 0x0010C020, c);
    }

    /** Affichage tête haute d'Iron Man (vue à la première personne). */
    private static void jarvis(GuiGraphics g, Minecraft mc, LocalPlayer player, Font font, int w, int h, float time) {
        int cyan = 0xFF6FE6FF;
        int dim = 0x806FE6FF;
        int m = 14;
        int len = 26;
        // coins
        g.fill(m, m, m + len, m + 1, dim);
        g.fill(m, m, m + 1, m + len, dim);
        g.fill(w - m - len, m, w - m, m + 1, dim);
        g.fill(w - m - 1, m, w - m, m + len, dim);
        g.fill(m, h - m - 1, m + len, h - m, dim);
        g.fill(m, h - m - len, m + 1, h - m, dim);
        g.fill(w - m - len, h - m - 1, w - m, h - m, dim);
        g.fill(w - m - 1, h - m - len, w - m, h - m, dim);
        g.fillGradient(0, 0, w, 18, 0x3000C8FF, 0x0000C8FF);

        g.fill(m + 2, m + 2, m + 128, m + 46, 0x70001820);
        g.drawString(font, "J.A.R.V.I.S.", m + 4, m + 4, cyan, false);
        int alt = (int) player.getY();
        double speed = player.getDeltaMovement().length() * 20.0;
        g.drawString(font, Component.translatable("hud.hulkironman.altitude", alt).getString(), m + 4, m + 15, 0xFFBFF6FF, false);
        g.drawString(font, Component.translatable("hud.hulkironman.speed", (int) speed).getString(), m + 4, m + 25, 0xFFBFF6FF, false);
        if (player.getAbilities().flying) {
            String fl = Component.translatable("hud.hulkironman.flying").getString();
            g.drawString(font, fl, m + 4, m + 35, (int) (time / 5) % 2 == 0 ? cyan : 0xFF2FA9C9, false);
        } else {
            g.drawString(font, Component.translatable("hud.hulkironman.fly_hint").getString(), m + 4, m + 35, 0xA0BFF6FF, false);
        }
        // boussole
        float yaw = Mth.wrapDegrees(player.getYRot());
        String[] dirs = {"S", "SO", "O", "NO", "N", "NE", "E", "SE"};
        String dir = dirs[Math.floorMod(Math.round(yaw / 45F), 8)];
        String comp = "◆ " + dir + " " + Math.round((yaw + 360) % 360) + "° ◆";
        g.fill(w - m - 8 - font.width(comp), m + 2, w - m - 2, m + 14, 0x70001820);
        g.drawString(font, comp, w - m - 4 - font.width(comp), m + 4, cyan, false);

        // cible
        Entity target = mc.crosshairPickEntity;
        int cx = w / 2;
        int cy = h / 2;
        float spin = time * 0.08F;
        for (int i = 0; i < 4; i++) {
            double a = spin + i * Math.PI / 2;
            int px = cx + (int) (Math.cos(a) * 11);
            int py = cy + (int) (Math.sin(a) * 11);
            g.fill(px - 1, py - 1, px + 2, py + 2, target != null ? 0xFFFF5040 : dim);
        }
        if (target instanceof LivingEntity le) {
            String name = le.getDisplayName().getString();
            String hp = Math.round(le.getHealth()) + " / " + Math.round(le.getMaxHealth()) + " ❤";
            g.drawString(font, name, cx + 18, cy - 12, 0xFFFF7060, true);
            g.drawString(font, hp, cx + 18, cy - 2, 0xFFFFB0A0, true);
            g.drawString(font, Component.translatable("hud.hulkironman.locked").getString(), cx + 18, cy + 8, cyan, true);
        }
    }

    private HeroHud() {
    }
}
