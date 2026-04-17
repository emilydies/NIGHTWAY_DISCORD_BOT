const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.User],
});

// Load database
let vcOwners = loadDb();


// Ready event
client.once(Events.ClientReady, async () => {
  const config = cfg();

  console.log(`\n✅ Bot logged in as ${client.user.tag}`);
  console.log(`📋 Guild ID: ${process.env.GUILD_ID}`);
  console.log(`🎧 Trigger VC ID: ${process.env.CREATE_VC_ID}`);
  console.log(`📢 Reaction Channel: ${process.env.REACTION_CHANNEL_NAME || "verify"}`);
  console.log(`🎟️  Ticket Channel (EN): ${config.ticketChannelId || "not set"}`);
  console.log(`🎟️  Ticket Channel (RU): ${config.ticketRuChannelId || "not set"}`);
  console.log("================================\n");
  
  await ensureReactionPanel(client, { cfg, findChannel });
  await ensureTicketPanels(client, { cfg });
});

function getTicketPanelContent(locale) {
  if (locale === "ru") {
    return {
      title: "📋 Система тикетов поддержки",
      description: [
        "Используйте систему тикетов, чтобы:",
        "",
        "- Задать вопросы по платформе",
        "- Сообщить о проблемах",
        "- Пожаловаться на игроков",
        "- Запросить доступ к матчмейкингу",
        "",
        "*Ваш запрос будет рассмотрен как можно скорее.*",
      ].join("\n"),
      buttonLabel: "Создать тикет",
    };
  }

  return {
    title: "📋 Support Ticket System",
    description: [
      "Use the ticket system to:",
      "",
      "- Ask questions about the platform",
      "- Report issues",
      "- Report players",
      "- Request access to matchmaking",
      "",
      "*Your request will be reviewed as soon as possible.*",
    ].join("\n"),
    buttonLabel: "Create Ticket",
  };
}

async function ensureSingleTicketPanel(client, guild, channelId, locale) {
  if (!channelId) return;

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    console.warn(`⚠️  Ticket channel (${locale.toUpperCase()}) not found: ${channelId}`);
    return;
  }

  const panel = getTicketPanelContent(locale);
  const ticketButtonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_create")
      .setLabel(panel.buttonLabel)
      .setEmoji("🎟️")
      .setStyle(ButtonStyle.Primary),
  );

  const ticketEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(panel.title)
    .setDescription(panel.description);

  const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
  const ticketMessage = messages?.find(
    (msg) =>
      msg.author.id === client.user.id &&
      (msg.components?.some((row) => row.components?.some((component) => component.customId === "ticket_create")) ||
        msg.embeds?.some((e) => {
          const title = (e.title || "").toLowerCase();
          return title.includes("ticket") || title.includes("тикет");
        })),
  );

  if (!ticketMessage) {
    await channel.send({
      embeds: [ticketEmbed],
      components: [ticketButtonRow],
    });
    console.log(`   ✅ Ticket message created in #${channel.name} (${locale.toUpperCase()})`);
    return;
  }

  const existingTitle = ticketMessage.embeds?.[0]?.title || "";
  const hasCreateButton = ticketMessage.components?.some((row) =>
    row.components?.some((component) => component.customId === "ticket_create"),
  );

  if (!hasCreateButton || existingTitle !== panel.title) {
    await ticketMessage
      .edit({
        embeds: [ticketEmbed],
        components: [ticketButtonRow],
        content: "",
      })
      .catch(() => {});
    console.log(`   ✅ Ticket message updated in #${channel.name} (${locale.toUpperCase()})`);
  } else {
    console.log(`   ✅ Ticket message already exists in #${channel.name} (${locale.toUpperCase()})`);
  }
}

// Function to ensure ticket messages exist in EN and RU channels
async function ensureTicketPanels(client, { cfg }) {
  try {
    const config = cfg();
    const guild = await client.guilds.fetch(config.guildId).catch(() => null);
    if (!guild) {
      console.warn(`⚠️  Guild not found: ${config.guildId}`);
      return;
    }

    await ensureSingleTicketPanel(client, guild, config.ticketChannelId, "en");
    await ensureSingleTicketPanel(client, guild, config.ticketRuChannelId, "ru");
  } catch (err) {
    console.error("   ❌ Error ensuring ticket panels:", err.message);
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
