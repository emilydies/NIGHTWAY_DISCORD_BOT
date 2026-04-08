const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
} = require("discord.js");

// Import configurations
const { cfg } = require("./src/config");
const { loadDb, saveDb } = require("./src/db");
const { getI18n, getUserLanguage } = require("./src/i18n");
const { findRole, findChannel, getOwnedChannelIdByUser, isOwner } = require("./src/utils");

// Import voice channel operations
const {
  cleanupOwnedChannel,
  createPrivateTextChannel,
  createPrivateVoice,
  createRestrictedChannel,
} = require("./src/voiceChannels");

// Import settings panel
const {
  SETTINGS_CACHE,
  createSettingsMessage,
  getReactionPanelMessage,
  createReactionPanel,
  ensureReactionPanel,
} = require("./src/settingsPanel");

// Import event handlers
const setupRoleReactionHandler = require("./src/handlers/roleReactionHandler");
const setupSettingsReactionHandler = require("./src/handlers/settingsReactionHandler");
const setupVoiceStateHandler = require("./src/handlers/voiceStateHandler");
const setupMessageHandler = require("./src/handlers/messageHandler");
const setupTicketHandler = require("./src/handlers/ticketHandler");

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Load database
let vcOwners = loadDb();


// Ready event
client.once(Events.ClientReady, async () => {
  console.log(`\n✅ Bot logged in as ${client.user.tag}`);
  console.log(`📋 Guild ID: ${process.env.GUILD_ID}`);
  console.log(`🎧 Trigger VC ID: ${process.env.CREATE_VC_ID}`);
  console.log(`📢 Reaction Channel: ${process.env.REACTION_CHANNEL_NAME || "verify"}`);
  console.log(`🎟️  Ticket Channel: ${process.env.TICKET_CHANNEL_ID}`);
  console.log("================================\n");
  
  await ensureReactionPanel(client, { cfg, findChannel });
  await ensureTicketPanel(client, { findChannel });
});

// Function to ensure ticket message exists
async function ensureTicketPanel(client, { findChannel }) {
  try {
    const ticketChannelId = process.env.TICKET_CHANNEL_ID || "1490115817394798795";
    const channel = await findChannel(client, ticketChannelId);
    if (!channel) {
      console.warn(`⚠️  Ticket channel not found: ${ticketChannelId}`);
      return;
    }

    // Check if ticket message already exists
    const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
    const ticketMessage = messages?.find(
      (msg) => msg.author.id === client.user.id && msg.content.includes("ticket system")
    );

    if (!ticketMessage) {
      const msg = await channel.send(
        [
          "Use the ticket system to:",
          "",
          "• Ask questions about the platform",
          "• Report issues",
          "• Report players",
          "• Request an account recovery",
          "",
          "Your request will be reviewed as soon as possible.",
          "",
          "Press 🎟️ to create a ticket.",
        ].join("\n")
      );
      await msg.react("🎟️").catch(() => {});
      console.log("   ✅ Ticket message created in #" + channel.name);
    } else {
      console.log("   ✅ Ticket message already exists");
    }
  } catch (err) {
    console.error("   ❌ Error ensuring ticket panel:", err.message);
  }
}

// Setup event handlers with dependency injection
setupRoleReactionHandler(client, { cfg, findRole });

setupSettingsReactionHandler(client, { 
  SETTINGS_CACHE, 
  cfg, 
  getUserLanguage, 
  getI18n 
});

setupVoiceStateHandler(client, {
  cfg,
  createPrivateVoice,
  cleanupOwnedChannel,
  vcOwners,
  saveDb,
  getOwnedChannelIdByUser,
  createPrivateTextChannel,
});

setupMessageHandler(client, {
  cfg,
  findChannel,
  findRole,
  createReactionPanel,
  getReactionPanelMessage,
  isOwner,
  getOwnedChannelIdByUser,
  vcOwners,
  saveDb,
});

setupTicketHandler(client, {
  cfg,
  getUserLanguage,
  getI18n,
});

// Login
console.log("\n🚀 Starting bot...\n");
client.login(process.env.TOKEN).catch((err) => {
  console.error("❌ Failed to login:", err.message);
});

// Global error handlers
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ [UNHANDLED REJECTION]", reason);
});

process.on("uncaughtException", (err) => {
  console.error("❌ [UNCAUGHT EXCEPTION]", err);
});

client.on("error", (err) => {
  console.error("❌ [CLIENT ERROR]", err.message);
});
