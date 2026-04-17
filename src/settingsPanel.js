const {
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const SETTINGS_CACHE = new Map();
const PANEL_TITLE = "Select Your Region";




function buildRegionEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setDescription(
      [
        "# PLEASE SELECT YOUR REGION",
      ].join("\n")
    );
}

function buildHelloEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setDescription(
      [
        "# CONNECT TO ‐ [NIGHTWAY.ORG](https://nightway.org)",
      ].join("\n")
    );
}

function buildRegionButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("region_ru")
        .setLabel("RU")
        .setEmoji("🇷🇺")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("region_eu")
        .setLabel("EU")
        .setEmoji("🇪🇺")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("region_na")
        .setLabel("NA")
        .setEmoji("🇺🇸")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("region_sa")
        .setLabel("SA")
        .setEmoji("🇧🇷")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("region_oce")
        .setLabel("OCE")
        .setEmoji("🇦🇺")
        .setStyle(ButtonStyle.Primary),
    ),
  ];
}

function buildSettingsButtonsEn() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("settings_lock")
        .setLabel("Lock/Unlock")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("settings_limit")
        .setLabel("Set Limit")
        .setEmoji("👥")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("settings_kick")
        .setLabel("Kick User")
        .setEmoji("⛔")
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}
function buildSettingsButtonsRu() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("settings_lock")
        .setLabel("Закрыть/Открыть")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("settings_limit")
        .setLabel("Установить лимит")
        .setEmoji("👥")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("settings_kick")
        .setLabel("Выкинуть пользователя")
        .setEmoji("⛔")
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}
async function createSettingsMessage(textChannel, voiceChannelId, ownerId, { getUserLanguage, getI18n }) {
  const lang = await getUserLanguage(textChannel.guild, ownerId, { cfg: require("./config").cfg });
  
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(getI18n(lang, "settingsTitle"))
    .setDescription(
      [
        getI18n(lang, "lockDesc"),
        getI18n(lang, "limitDesc"),
        getI18n(lang, "kickDesc"),
        "",
        getI18n(lang, "reactMsg"),
      ].join("\n")
    );

  const msg = await textChannel
    .send({
      embeds: [embed],
      components: lang === "ru" ? buildSettingsButtonsRu() : buildSettingsButtonsEn(),
    })
    .catch(() => null);

  if (!msg) return null;

  SETTINGS_CACHE.set(msg.id, {
    vcId: voiceChannelId,
    ownerId: ownerId,
    textChannelId: textChannel.id,
    lang: lang,
  });

  return msg;
}

async function getReactionPanelMessage(channel, client) {
  const messages = await channel.messages
    .fetch({ limit: 30 })
    .catch(() => null);
  if (!messages) return null;

  return (
    messages.find(
      (m) => {
        if (m.author.id !== client.user.id) return false;
        const embedMatch = m.embeds?.some((e) => {
          const title = e.title || "";
          const desc = e.description || "";
          return (
            title.includes("Select Your Language") ||
            title.includes("Select Your Region") ||
            title.includes("Select Your Language & Region") ||
            desc.includes("please select your language") ||
            desc.includes("please select your region")
          );
        });
        return Boolean(
          embedMatch ||
          m.content.includes("To gain access") ||
          m.content.includes("select your region") ||
          m.content.includes("select your language")
        );
      },
    ) || null
  );
}

async function createReactionPanel(channel) {
  const embed = buildRegionEmbed();
  const helloEmbed = buildHelloEmbed();
  
  await channel.send({ embeds: [helloEmbed] }).catch(() => null);
 
  const msg = await channel.send({
    embeds: [embed],
    components: buildRegionButtons(),
  });

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
    console.log("✅ REGION SELECTION PANEL CREATED.");
  } else {
    const title = existing.embeds?.[0]?.title || "";
    const description = existing.embeds?.[0]?.description || "";
    const hasButtons = existing.components?.some((row) =>
      row.components?.some((component) =>
        ["region_ru", "region_eu", "region_na", "region_sa", "region_oce"].includes(component.customId),
      ),
    );
    const hasAllOptions =
      description.includes("🇷🇺") &&
      description.includes("🇪🇺") &&
      description.includes("🇺🇸") &&
      description.includes("🇧🇷") &&
      description.includes("🇦🇺");

    if (title !== PANEL_TITLE || !hasAllOptions || !hasButtons) {
      await existing.edit({
        embeds: [buildRegionEmbed()],
        components: buildRegionButtons(),
        content: "",
      }).catch(() => null);
      await existing.reactions.removeAll().catch(() => null);
      console.log("✅ REGION SELECTION PANEL UPDATED.");
    } else {
      console.log("✅ REGION SELECTION PANEL ALREADY EXISTS.");
    }
  }
}

module.exports = {
  SETTINGS_CACHE,
  createSettingsMessage,
  getReactionPanelMessage,
  createReactionPanel,
  ensureReactionPanel,
};
