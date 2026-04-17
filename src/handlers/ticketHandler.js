const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const {
  createTicketChannel,
  closeTicket,
  sendTicketRoomIdInfo,
  sendTicketAccountInfo,
} = require("../tickets");

// Store tickets in memory (ticketChannelId -> userId)
const activeTickets = new Map();
// Store user's active tickets (userId -> ticketChannelId)
const userActiveTickets = new Map();

async function hasEmbedWithAnyTitle(channel, botUserId, titles) {
  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!messages) return false;

  const normalizedTitles = titles.map((t) => t.toLowerCase());

  return messages.some(
    (msg) =>
      msg.author.id === botUserId &&
      msg.embeds?.some((embed) => normalizedTitles.includes((embed.title || "").toLowerCase())),
  );
}

function isButtonDisabled(message, customId) {
  return message.components?.some((row) =>
    row.components?.some((component) => component.customId === customId && component.disabled),
  );
}

function withDisabledButton(message, customId) {
  return message.components.map((row) => {
    const nextRow = new ActionRowBuilder();

    for (const component of row.components || []) {
      if (typeof component.customId !== "string") continue;

      const button = ButtonBuilder.from(component);
      if (component.customId === customId) {
        button.setDisabled(true);
      }
      nextRow.addComponents(button);
    }

    return nextRow;
  });
}

function setupTicketHandler(client, { cfg, getUserLanguage, getI18n }) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    if (!["ticket_create", "ticket_close", "ticket_room_id", "ticket_account"].includes(interaction.customId)) return;
    if (interaction.user.bot || !interaction.guild) return;

    try {
      if (interaction.customId === "ticket_create") {
        const guild = interaction.guild;
        const member = await guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member) {
          await interaction.reply({ content: "❌ Failed to resolve your member profile.", ephemeral: true }).catch(() => {});
          return;
        }

        if (userActiveTickets.has(interaction.user.id)) {
          await interaction.reply({
            content: "❌ You already have an active ticket. Please close it before creating a new one.",
            ephemeral: true,
          }).catch(() => {});
          return;
        }

        const ticketCategoryId = process.env.TICKET_CATEGORY_ID || interaction.channelId;
        const ticketData = await createTicketChannel(guild, member, ticketCategoryId, {
          getUserLanguage,
          getI18n,
          cfg,
        });

        if (!ticketData) {
          await interaction.reply({ content: "❌ Failed to create ticket. Please try again.", ephemeral: true }).catch(() => {});
          return;
        }

        activeTickets.set(ticketData.ticketChannelId, {
          userId: ticketData.userId,
          closeMessageId: ticketData.closeMessageId,
        });
        userActiveTickets.set(interaction.user.id, ticketData.ticketChannelId);

        await interaction.reply({
          content: `✅ Your ticket has been created: <#${ticketData.ticketChannelId}>`,
          ephemeral: true,
        }).catch(() => {});
        return;
      }

      if (interaction.customId === "ticket_close") {
        const ticketInfo = activeTickets.get(interaction.channelId);
        if (!ticketInfo) {
          await interaction.reply({ content: "❌ This ticket is not tracked in memory.", ephemeral: true }).catch(() => {});
          return;
        }

        await interaction.reply({ content: "🔒 Closing ticket...", ephemeral: true }).catch(() => {});

        await closeTicket(interaction.channelId, interaction.guild, {
          getI18n,
          getUserLanguage,
          cfg,
        });

        activeTickets.delete(interaction.channelId);
        userActiveTickets.delete(ticketInfo.userId);
        return;
      }

      if (interaction.customId === "ticket_room_id" || interaction.customId === "ticket_account") {
        const ticketInfo = activeTickets.get(interaction.channelId);
        const isTicketChannel = Boolean(interaction.channel?.name?.startsWith("ticket-"));

        if (!ticketInfo && !isTicketChannel) {
          await interaction.reply({ content: "❌ This action is available only in ticket channels.", ephemeral: true }).catch(() => {});
          return;
        }

        const languageUserId = ticketInfo?.userId || interaction.user.id;
        const lang = await getUserLanguage(interaction.guild, languageUserId, { cfg });

        const infoTitles =
          interaction.customId === "ticket_room_id"
            ? [getI18n("en", "ticketRoomIdTitle"), getI18n("ru", "ticketRoomIdTitle")]
            : [getI18n("en", "ticketAccountTitle"), getI18n("ru", "ticketAccountTitle")];

        const alreadySent = await hasEmbedWithAnyTitle(interaction.channel, client.user.id, infoTitles);
        const alreadyDisabled = isButtonDisabled(interaction.message, interaction.customId);

        if (alreadySent || alreadyDisabled) {
          if (!alreadyDisabled) {
            const disabledRows = withDisabledButton(interaction.message, interaction.customId);
            await interaction.message.edit({ components: disabledRows }).catch(() => {});
          }

          const label = interaction.customId === "ticket_room_id" ? "Room ID" : "Account";
          await interaction.reply({
            content: `ℹ️ ${label} info can only be sent once in this ticket.`,
            ephemeral: true,
          }).catch(() => {});
          return;
        }

        if (interaction.customId === "ticket_room_id") {
          await sendTicketRoomIdInfo(interaction.channel, lang, { getI18n });
          const disabledRows = withDisabledButton(interaction.message, interaction.customId);
          await interaction.message.edit({ components: disabledRows }).catch(() => {});
          await interaction.reply({ content: "✅ Room ID info sent.", ephemeral: true }).catch(() => {});
          return;
        }

        await sendTicketAccountInfo(interaction.channel, lang, { getI18n });
        const disabledRows = withDisabledButton(interaction.message, interaction.customId);
        await interaction.message.edit({ components: disabledRows }).catch(() => {});
        await interaction.reply({ content: "✅ Account info sent.", ephemeral: true }).catch(() => {});
      }
    } catch (err) {
      console.error("   ❌ Error in ticket interaction handler:", err.message);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "❌ Ticket action failed.", ephemeral: true }).catch(() => {});
      }
    }
  });
}

function loadTicketMessage(channelId, messageContent = "Press the button below to create a ticket.") {
  return {
    content: messageContent,
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_create")
          .setLabel("Create Ticket")
          .setEmoji("🎟️")
          .setStyle(ButtonStyle.Primary),
      ),
    ],
  };
}

module.exports = setupTicketHandler;
module.exports.createTicketChannel = createTicketChannel;
module.exports.loadTicketMessage = loadTicketMessage;
module.exports.activeTickets = activeTickets;
