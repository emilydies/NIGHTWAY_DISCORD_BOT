const {
  Events,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

module.exports = (client, { SETTINGS_CACHE, cfg, getUserLanguage, getI18n }) => {
  const LIMIT_MODAL_PREFIX = "settings_limit_modal:";
  const KICK_BUTTON_PREFIX = "settings_kick_user:";

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.guild) return;

    if (interaction.isButton() && interaction.customId.startsWith(KICK_BUTTON_PREFIX)) {
      const [, settingsMessageId, targetUserId] = interaction.customId.split(":");
      const settingsInfo = SETTINGS_CACHE.get(settingsMessageId);
      if (!settingsInfo) {
        await interaction.reply({ content: "❌ Settings session has expired.", ephemeral: true }).catch(() => {});
        return;
      }

      if (interaction.user.id !== settingsInfo.ownerId) {
        await interaction.reply({ content: "❌ Only the room owner can use this button.", ephemeral: true }).catch(() => {});
        return;
      }

      const guild = interaction.guild;
      const voiceChannel = guild.channels.cache.get(settingsInfo.vcId);
      const textChannel = guild.channels.cache.get(settingsInfo.textChannelId);
      const lang = settingsInfo?.lang || (await getUserLanguage(guild, settingsInfo.ownerId, { cfg }));

      await interaction.deferUpdate().catch(() => {});

      if (!voiceChannel || !textChannel) {
        await interaction.followUp({ content: "❌ Room channels not found.", ephemeral: true }).catch(() => {});
        return;
      }

      const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
      if (!targetMember || targetMember.voice.channelId !== voiceChannel.id) {
        await interaction.followUp({ content: "❌ User is no longer in your room.", ephemeral: true }).catch(() => {});
        await interaction.message.delete().catch(() => {});
        return;
      }

      await targetMember.voice.disconnect("Kicked by room owner").catch(() => {});
      await interaction.message.delete().catch(() => {});

      const message = getI18n(lang, "kickSuccess").replace("{user}", targetMember.user.username);
      await textChannel.send(message).catch(() => {});
      return;
    }

    if (interaction.isButton() && ["settings_lock", "settings_limit", "settings_kick"].includes(interaction.customId)) {
      const settingsInfo = SETTINGS_CACHE.get(interaction.message.id);
      if (!settingsInfo) return;

      const { vcId, ownerId, textChannelId } = settingsInfo;
      if (interaction.user.id !== ownerId) {
        console.log(`⚙️  [SETTINGS] Non-owner tried to use buttons: ${interaction.user.username}`);
        await interaction.reply({ content: "❌ Only the room owner can use these controls.", ephemeral: true }).catch(() => {});
        return;
      }

      const guild = interaction.guild;
      const voiceChannel = guild.channels.cache.get(vcId);
      const textChannel = guild.channels.cache.get(textChannelId);
      const member = await guild.members.fetch(interaction.user.id).catch(() => null);

      if (!voiceChannel || !member || !textChannel) {
        console.log("⚙️  [SETTINGS] ❌ VC or member or text channel not found");
        await interaction.reply({ content: "❌ Room not found.", ephemeral: true }).catch(() => {});
        return;
      }

      const lang = settingsInfo?.lang || (await getUserLanguage(guild, ownerId, { cfg }));

      if (interaction.customId === "settings_lock") {
        try {
          const everyoneOverwrite = voiceChannel.permissionOverwrites.cache.find(
            (ow) => ow.id === guild.roles.everyone.id,
          );

          const isLocked = !everyoneOverwrite?.allow.has(PermissionsBitField.Flags.Connect);

          if (isLocked) {
            console.log("   🔓 Unlocking VC...");
            await voiceChannel.permissionOverwrites
              .edit(guild.roles.everyone, { Connect: true, ViewChannel: true })
              .catch(() => {});
            await textChannel.send(getI18n(lang, "lockUnlocked")).catch(() => {});
            await interaction.reply({ content: "✅ Room unlocked.", ephemeral: true }).catch(() => {});
          } else {
            console.log("   🔒 Locking VC...");

            await voiceChannel.permissionOverwrites
              .edit(guild.roles.everyone, { Connect: false })
              .catch(() => {});

            for (const voiceMember of voiceChannel.members.values()) {
              await voiceChannel.permissionOverwrites
                .edit(voiceMember.id, { ViewChannel: true, Connect: true })
                .catch(() => {});
            }

            await textChannel.send(getI18n(lang, "lockLocked")).catch(() => {});
            await interaction.reply({ content: "✅ Room locked.", ephemeral: true }).catch(() => {});
          }
        } catch (err) {
          console.error(`   ❌ Lock error: ${err.message}`);
          await interaction.reply({ content: "❌ Failed to update lock state.", ephemeral: true }).catch(() => {});
        }
        return;
      }

      if (interaction.customId === "settings_limit") {
        const modal = new ModalBuilder()
          .setCustomId(`${LIMIT_MODAL_PREFIX}${interaction.message.id}`)
          .setTitle("Set User Limit");

        const limitInput = new TextInputBuilder()
          .setCustomId("limit_value")
          .setLabel("Enter limit (0-99)")
          .setPlaceholder("0")
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
          .setMaxLength(2);

        modal.addComponents(new ActionRowBuilder().addComponents(limitInput));
        await interaction.showModal(modal).catch(() => {});
        return;
      }

      if (interaction.customId === "settings_kick") {
        const members = voiceChannel.members.filter((m) => m.id !== ownerId);

        if (members.size === 0) {
          console.log("   ⛔ No one to kick");
          await textChannel.send(getI18n(lang, "noOneToKick")).catch(() => {});
          await interaction.reply({ content: "ℹ️ No users available to kick.", ephemeral: true }).catch(() => {});
          return;
        }

        console.log(`   ⛔ Showing kick list with ${members.size} member(s)...`);

        const memberArray = Array.from(members.values()).slice(0, 25);
        const rows = [];

        for (let i = 0; i < memberArray.length; i += 5) {
          const chunk = memberArray.slice(i, i + 5);
          const row = new ActionRowBuilder().addComponents(
            ...chunk.map((m) =>
              new ButtonBuilder()
                .setCustomId(`${KICK_BUTTON_PREFIX}${interaction.message.id}:${m.id}`)
                .setLabel(m.user.username.slice(0, 80))
                .setStyle(ButtonStyle.Danger),
            ),
          );
          rows.push(row);
        }

        await textChannel
          .send({
            content: getI18n(lang, "selectKick"),
            components: rows,
          })
          .catch(() => null);

        await interaction.reply({ content: "✅ Kick panel sent.", ephemeral: true }).catch(() => {});
      }
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith(LIMIT_MODAL_PREFIX)) {
      const settingsMessageId = interaction.customId.slice(LIMIT_MODAL_PREFIX.length);
      const settingsInfo = SETTINGS_CACHE.get(settingsMessageId);
      if (!settingsInfo) {
        await interaction.reply({ content: "❌ Settings session has expired.", ephemeral: true }).catch(() => {});
        return;
      }

      if (interaction.user.id !== settingsInfo.ownerId) {
        await interaction.reply({ content: "❌ Only the room owner can do this.", ephemeral: true }).catch(() => {});
        return;
      }

      const guild = interaction.guild;
      const voiceChannel = guild.channels.cache.get(settingsInfo.vcId);
      const textChannel = guild.channels.cache.get(settingsInfo.textChannelId);
      const lang = settingsInfo?.lang || (await getUserLanguage(guild, settingsInfo.ownerId, { cfg }));

      if (!voiceChannel || !textChannel) {
        await interaction.reply({ content: "❌ Room not found.", ephemeral: true }).catch(() => {});
        return;
      }

      const input = interaction.fields.getTextInputValue("limit_value").trim();
      const limit = Number.parseInt(input, 10);

      if (!Number.isInteger(limit) || limit < 0 || limit > 99) {
        await interaction.reply({ content: getI18n(lang, "limitInvalid"), ephemeral: true }).catch(() => {});
        return;
      }

      await voiceChannel.setUserLimit(limit).catch(() => {});

      const limitText = limit === 0 ? getI18n(lang, "limitUnlimited") : String(limit);
      const message = getI18n(lang, "limitSuccess").replace("{limit}", limitText);

      await textChannel.send(message).catch(() => {});
      await interaction.reply({ content: `✅ Limit updated to ${limitText}.`, ephemeral: true }).catch(() => {});
    }
  });
};
