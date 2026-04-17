const {
  ChannelType,
  OverwriteType,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

async function createTicketChannel(guild, member, ticketCategoryId, { getUserLanguage, getI18n, cfg }) {
  try {
    let category = await guild.channels.fetch(ticketCategoryId).catch(() => null);

    // Create category if it doesn't exist
    if (!category) {
      category = await guild.channels.create({
        name: "📋 Tickets",
        type: ChannelType.GuildCategory,
      });
    }

    // Create private channel for the ticket
    const ticketChannel = await guild.channels.create({
      name: `ticket-${member.user.username}`,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          type: OverwriteType.Role,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: member.id,
          type: OverwriteType.Member,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.AttachFiles,
          ],
        },
        {
          id: process.env.TICKET_SUPPORT_ROLE_ID || "1329007606110359624",
          type: OverwriteType.Role,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.ManageMessages,
          ],
        },
      ],
    });

    // Get user language
    const userLang = await getUserLanguage(guild, member.id, { cfg });
    const welcomeMessage = getI18n(userLang, "ticketWelcome");
    const welcomeTitle = getI18n(userLang, "ticketWelcomeTitle");
    const roomIdButtonLabel = getI18n(userLang, "ticketButtonRoomId");
    const accountButtonLabel = getI18n(userLang, "ticketButtonAccount");
    const closeButtonLabel = getI18n(userLang, "ticketButtonClose");
    // Create welcome embed
    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(welcomeTitle)
      .setDescription(welcomeMessage);

    const controlsRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_room_id")
        .setLabel(roomIdButtonLabel)
        .setEmoji("🆔")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("ticket_account")
        .setLabel(accountButtonLabel)
        .setEmoji("🔎")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("ticket_close")
        .setLabel(closeButtonLabel)
        .setEmoji("⛔")
        .setStyle(ButtonStyle.Danger),
    );

    // Send welcome message
    const message = await ticketChannel.send({
      embeds: [welcomeEmbed],
      components: [controlsRow],
    });

    console.log(
      `✅ Ticket channel created: #${ticketChannel.name} for ${member.user.username}`
    );

    return {
      ticketChannelId: ticketChannel.id,
      closeMessageId: message.id,
      userId: member.id,
    };
  } catch (err) {
    console.error("   ❌ Error creating ticket channel:", err.message);
    return null;
  }
}

async function sendTicketRoomIdInfo(ticketChannel, lang, { getI18n }) {
  const roomIdMessage = getI18n(lang, "ticketRoomId");
  const roomIdTitle = getI18n(lang, "ticketRoomIdTitle");

  const roomIdEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(roomIdTitle)
    .setDescription(roomIdMessage)
    .setImage("https://media.discordapp.net/attachments/1329008642074087505/1490127320470654996/a5d3342db2410f07.png?ex=69d2ecb6&is=69d19b36&hm=b6d24e15e7dbed003ce466d250b943a018459f757466ab8cda8b39d095dcce88&=&format=webp&quality=lossless&width=3158&height=1588");

  await ticketChannel.send({ embeds: [roomIdEmbed] }).catch(() => {});
}

async function sendTicketAccountInfo(ticketChannel, lang, { getI18n }) {
  const accountInfoMessage = getI18n(lang, "ticketAccountInfo");
  const accountTitle = getI18n(lang, "ticketAccountTitle");

  const accountEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(accountTitle)
    .setDescription(accountInfoMessage);

  await ticketChannel.send({ embeds: [accountEmbed] }).catch(() => {});
}

async function closeTicket(ticketChannelId, guild, { getI18n, getUserLanguage, cfg }) {
  try {
    const channel = await guild.channels.fetch(ticketChannelId).catch(() => null);
    if (!channel) return;

    // Delete the ticket channel
    await channel.delete().catch((err) => {
      console.error("   ❌ Error deleting ticket channel:", err.message);
    });

    console.log(`   ✅ Ticket deleted: #${channel.name}`);
  } catch (err) {
    console.error("   ❌ Error closing ticket:", err.message);
  }
}

module.exports = {
  createTicketChannel,
  closeTicket,
  sendTicketRoomIdInfo,
  sendTicketAccountInfo,
};
