const { ChannelType } = require("discord.js");

const SETTINGS_CACHE = new Map();

async function createSettingsMessage(textChannel, voiceChannelId, ownerId, { getUserLanguage, getI18n }) {
  const lang = await getUserLanguage(textChannel.guild, ownerId, { cfg: require("./config").cfg });
  
  const msg = await textChannel
    .send(
      [
        getI18n(lang, "settingsTitle"),
        "",
        getI18n(lang, "lockDesc"),
        getI18n(lang, "limitDesc"),
        getI18n(lang, "kickDesc"),
        "",
        getI18n(lang, "reactMsg"),
      ].join("\n"),
    )
    .catch(() => null);

  if (!msg) return null;

  SETTINGS_CACHE.set(msg.id, {
    vcId: voiceChannelId,
    ownerId: ownerId,
    textChannelId: textChannel.id,
    lang: lang,
  });

  await msg.react("🔒").catch(() => {});
  await msg.react("👥").catch(() => {});
  await msg.react("⛔").catch(() => {});

  return msg;
}

async function getReactionPanelMessage(channel, client) {
  const messages = await channel.messages
    .fetch({ limit: 30 })
    .catch(() => null);
  if (!messages) return null;

  return (
    messages.find(
      (m) =>
        m.author.id === client.user.id && m.content.includes("To gain access"),
    ) || null
  );
}

async function createReactionPanel(channel) {
  const msg = await channel.send(
    [
      "Hi! To gain access to the server, please select your language:",
      "",
      "🇷🇺 — Russian",
      "🇪🇺 — English",
      "",
      "Note: Only one role can be active at a time.",
    ].join("\n"),
  );

  await msg.react("🇷🇺").catch(() => {});
  await msg.react("🇪🇺").catch(() => {});

  return msg;
}

async function ensureReactionPanel(client, { cfg, findChannel }) {
  const config = cfg();
  const guild = await client.guilds.fetch(config.guildId).catch(() => null);
  if (!guild) return;

  // Try to fetch by ID first
  let channel = null;
  if (config.reactionChannelId) {
    channel = await guild.channels.fetch(config.reactionChannelId).catch(() => null);
  }

  // Fall back to finding by name
  if (!channel) {
    channel = await findChannel(
      guild,
      config.reactionChannelName,
      ChannelType.GuildText,
    );
  }

  if (!channel) {
    console.log(`❌ Channel not found: ${config.reactionChannelId || config.reactionChannelName}`);
    return;
  }

  const existing = await getReactionPanelMessage(channel, client);
  if (!existing) {
    await createReactionPanel(channel);
    console.log("✅ LANGUAGE SELECTION PANEL CREATED.");
  } else {
    console.log("✅ LANGUAGE SELECTION PANEL ALREADY EXISTS.");
  }
}

module.exports = {
  SETTINGS_CACHE,
  createSettingsMessage,
  getReactionPanelMessage,
  createReactionPanel,
  ensureReactionPanel,
};
