const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { createTicketChannel, closeTicket } = require("../tickets");

// Store tickets in memory (ticketChannelId -> userId)
const activeTickets = new Map();
// Store user's active tickets (userId -> ticketChannelId)
const userActiveTickets = new Map();

function setupTicketHandler(client, { cfg, getUserLanguage, getI18n }) {
  // Handle ticket creation reactions
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    // Ignore bot reactions
    if (user.bot) return;

    try {
      // Check if this is a ticket creation message
      await reaction.message.fetch();
      if (reaction.message.author.id !== client.user.id) return;

      // Only handle 🎟️ reaction for ticket creation
      if (reaction.emoji.name === "🎟️") {
        const guild = reaction.message.guild;
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) return;

        // Check if user already has an active ticket
        if (userActiveTickets.has(user.id)) {
          await user
            .send("❌ You already have an active ticket.\nPlease close it before creating a new one.")
            .catch(() => {});
          await reaction.users.remove(user.id).catch(() => {});
          return;
        }

        // Get ticket category from config or use default
        const ticketCategoryId =
          process.env.TICKET_CATEGORY_ID ||
          reaction.message.channelId;

        // Create ticket
        const ticketData = await createTicketChannel(guild, member, ticketCategoryId, {
          getUserLanguage,
          getI18n,
          cfg,
        });
        if (!ticketData) {
          await user
            .send("❌ Failed to create ticket.\nPlease try again.")
            .catch(() => {});
          return;
        }

        // Store ticket info
        activeTickets.set(ticketData.ticketChannelId, {
          userId: ticketData.userId,
          closeMessageId: ticketData.closeMessageId,
        });
        userActiveTickets.set(user.id, ticketData.ticketChannelId);

        // Send confirmation DM
        await user
          .send(`✅ Your ticket has been created!\n<#${ticketData.ticketChannelId}>`)
          .catch(() => {});

        // Remove user reaction
        await reaction.users.remove(user.id).catch(() => {});
      }

      // Handle ticket close reactions
      if (reaction.emoji.name === "⛔") {
        // Check if this ticket is tracked
        const ticketInfo = activeTickets.get(reaction.message.channelId);
        if (!ticketInfo) return;

        const guild = reaction.message.guild;

        // Close the ticket (remove user access but keep channel)
        await closeTicket(reaction.message.channelId, guild, {
          getI18n,
          getUserLanguage,
          cfg,
        });

        // Remove from active tickets
        activeTickets.delete(reaction.message.channelId);
        userActiveTickets.delete(ticketInfo.userId);

        // Remove user reaction
        await reaction.users.remove(user.id).catch(() => {});
      }
    } catch (err) {
      console.error("   ❌ Error in ticket reaction handler:", err.message);
    }
  });

  // Handle message reaction remove for cleanup
  client.on(Events.MessageReactionRemove, async (reaction, user) => {
    if (user.bot) return;
    // Optional: handle undo close ticket logic here
  });
}

function loadTicketMessage(channelId, messageContent = "Press 🎟️ to create a ticket.") {
  return {
    content: messageContent,
    components: [],
  };
}

module.exports = setupTicketHandler;
module.exports.createTicketChannel = createTicketChannel;
module.exports.loadTicketMessage = loadTicketMessage;
module.exports.activeTickets = activeTickets;
