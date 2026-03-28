const fs = require("fs");
const path = require("path");
require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ChannelType,
  Events,
  OverwriteType,
} = require("discord.js");

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

const PREFIX = "!";
const DB_FILE = path.join(__dirname, "vcOwners.json");

function loadDb() {
  try {
    if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "{}");
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch (err) {
    console.error("Ошибка чтения БД:", err);
    return {};
  }
}

function saveDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

let vcOwners = loadDb();

function cfg() {
  return {
    guildId: process.env.GUILD_ID,
    roleRuName: process.env.ROLE_RU_NAME || "RU",
    roleEngName: process.env.ROLE_ENG_NAME || "ENG",
    createVcName: process.env.CREATE_VC_NAME || "Create VC",
    vcCategoryName: process.env.VC_CATEGORY_NAME || "Voice",
    reactionChannelName: process.env.REACTION_CHANNEL_NAME || "roles",
  };
}

function getOwnedChannelIdByUser(userId) {
  for (const [channelId, ownerId] of Object.entries(vcOwners)) {
    if (ownerId === userId) return channelId;
  }
  return null;
}

function isOwner(userId, channelId) {
  return vcOwners[channelId] === userId;
}

async function findRole(guild, name) {
  return guild.roles.cache.find((r) => r.name === name) || null;
}

async function findChannel(guild, name, type = null) {
  return (
    guild.channels.cache.find(
      (c) => c.name === name && (type ? c.type === type : true),
    ) || null
  );
}

async function cleanupOwnedChannel(channel) {
  if (!channel) return;
  if (channel.type !== ChannelType.GuildVoice) return;
  if (!vcOwners[channel.id]) return;

  if (channel.members.size === 0) {
    delete vcOwners[channel.id];
    saveDb(vcOwners);
    await channel.delete("Удаление пустого приватного войса").catch(() => {});
  }
}

async function getReactionPanelMessage(channel) {
  const messages = await channel.messages
    .fetch({ limit: 30 })
    .catch(() => null);
  if (!messages) return null;

  return (
    messages.find(
      (m) =>
        m.author.id === client.user.id && m.content.includes("Выбери язык"),
    ) || null
  );
}

async function createReactionPanel(channel) {
  const msg = await channel.send(
    [
      "Выбери язык:",
      "",
      "🇷🇺 — роль RU",
      "🇬🇧 — роль ENG",
      "",
      "Одновременно активна только одна роль.",
    ].join("\n"),
  );

  await msg.react("🇷🇺").catch(() => {});
  await msg.react("🇬🇧").catch(() => {});

  return msg;
}

async function ensureReactionPanel() {
  const config = cfg();
  const guild = await client.guilds.fetch(config.guildId).catch(() => null);
  if (!guild) return;

  const channel = await findChannel(
    guild,
    config.reactionChannelName,
    ChannelType.GuildText,
  );
  if (!channel) {
    console.log(`Не найден канал ${config.reactionChannelName}`);
    return;
  }

  const existing = await getReactionPanelMessage(channel);
  if (!existing) {
    await createReactionPanel(channel);
    console.log("Панель выбора языка создана.");
  } else {
    console.log("Панель выбора языка уже существует.");
  }
}

async function createPrivateVoice(member) {
  const guild = member.guild;
  const config = cfg();

  const existingId = getOwnedChannelIdByUser(member.id);
  if (existingId) {
    const existingChannel = guild.channels.cache.get(existingId);
    if (existingChannel) {
      await member.voice.setChannel(existingChannel).catch(() => {});
      return existingChannel;
    } else {
      delete vcOwners[existingId];
      saveDb(vcOwners);
    }
  }

  const category =
    guild.channels.cache.find(
      (c) =>
        c.name === config.vcCategoryName &&
        c.type === ChannelType.GuildCategory,
    ) || null;

  const channel = await guild.channels
    .create({
      name: `${member.user.username} room`,
      type: ChannelType.GuildVoice,
      parent: category ? category.id : undefined,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          type: OverwriteType.Role,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.Connect,
          ],
        },
        {
          id: member.id,
          type: OverwriteType.Member,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.Connect,
            PermissionsBitField.Flags.Speak,
            PermissionsBitField.Flags.Stream,
            PermissionsBitField.Flags.UseVAD,
          ],
        },
      ],
    })
    .catch((err) => {
      console.error("Ошибка создания приватного войса:", err);
      return null;
    });

  if (!channel) return null;

  vcOwners[channel.id] = member.id;
  saveDb(vcOwners);

  await member.voice.setChannel(channel).catch(() => {});
  return channel;
}

client.once(Events.ClientReady, async () => {
  console.log(`Бот запущен как ${client.user.tag}`);
  await ensureReactionPanel();
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;

  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();
  } catch {
    return;
  }

  const message = reaction.message;
  if (!message.guild) return;
  if (message.author.id !== client.user.id) return;
  if (!message.content.includes("Выбери язык")) return;

  const guild = message.guild;
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  const config = cfg();
  const ruRole = await findRole(guild, config.roleRuName);
  const engRole = await findRole(guild, config.roleEngName);

  if (!ruRole || !engRole) return;

  if (reaction.emoji.name === "🇷🇺") {
    await member.roles.add(ruRole).catch(() => {});
    await member.roles.remove(engRole).catch(() => {});
  } else if (reaction.emoji.name === "🇬🇧") {
    await member.roles.add(engRole).catch(() => {});
    await member.roles.remove(ruRole).catch(() => {});
  } else {
    return;
  }

  await reaction.users.remove(user.id).catch(() => {});
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  const config = cfg();

  if (oldState.channel) {
    await cleanupOwnedChannel(oldState.channel);
  }

  if (
    newState.channel &&
    newState.channel.type === ChannelType.GuildVoice &&
    newState.channel.name === config.createVcName
  ) {
    await createPrivateVoice(newState.member);
  }

  if (oldState.channel) {
    await cleanupOwnedChannel(oldState.channel);
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = (args.shift() || "").toLowerCase();
  const member = message.member;
  const voiceChannel = member.voice.channel;

  async function requireOwner() {
    if (!voiceChannel) {
      await message.reply("Ты должен быть в голосовом канале.");
      return false;
    }
    if (!isOwner(member.id, voiceChannel.id)) {
      await message.reply("Ты не владелец этого канала.");
      return false;
    }
    return true;
  }

  if (command === "setuproles") {
    const config = cfg();
    const channel = await findChannel(
      message.guild,
      config.reactionChannelName,
      ChannelType.GuildText,
    );
    if (!channel)
      return message.reply(`Не найден канал ${config.reactionChannelName}`);

    const existing = await getReactionPanelMessage(channel);
    if (existing) return message.reply("Панель ролей уже существует.");

    await createReactionPanel(channel);
    return message.reply("Панель ролей создана.");
  }

  if (command === "myvc") {
    const ownedId = getOwnedChannelIdByUser(member.id);
    if (!ownedId) {
      return message.reply("У тебя пока нет своей комнаты.");
    }

    const ch = message.guild.channels.cache.get(ownedId);
    if (!ch) {
      delete vcOwners[ownedId];
      saveDb(vcOwners);
      return message.reply("Комната не найдена, запись очищена.");
    }

    return message.reply(
      [
        `Твоя комната: **${ch.name}**`,
        "Команды:",
        "`!limit <0-99>`",
        "`!lock` / `!unlock`",
        "`!hide` / `!show`",
        "`!invite @user` / `!uninvite @user`",
        "`!kick @user`",
        "`!name <название>`",
        "`!transfer @user`",
      ].join("\n"),
    );
  }

  if (command === "help") {
    return message.reply(
      [
        "**Команды:**",
        "`!setuproles` — создать панель выбора RU/ENG",
        "`!myvc` — показать твою комнату",
        "`!limit <0-99>` — лимит пользователей",
        "`!lock` — запретить вход",
        "`!unlock` — разрешить вход",
        "`!hide` — скрыть комнату",
        "`!show` — показать комнату",
        "`!invite @user` — выдать доступ",
        "`!uninvite @user` — убрать доступ",
        "`!kick @user` — выгнать из комнаты",
        "`!name <название>` — переименовать комнату",
        "`!transfer @user` — передать владение",
        "`!claim` — забрать комнату, если владелец вышел",
      ].join("\n"),
    );
  }

  if (command === "claim") {
    if (!voiceChannel)
      return message.reply("Ты должен быть в голосовом канале.");
    const ownerId = vcOwners[voiceChannel.id];

    if (!ownerId) return message.reply("Это не приватная комната бота.");
    if (ownerId === member.id)
      return message.reply("Ты уже владелец этой комнаты.");

    const ownerStillInside = voiceChannel.members.has(ownerId);
    if (ownerStillInside) {
      return message.reply(
        "Нельзя забрать комнату, пока владелец находится в ней.",
      );
    }

    vcOwners[voiceChannel.id] = member.id;
    saveDb(vcOwners);

    return message.reply(
      `Теперь ты владелец комнаты **${voiceChannel.name}**.`,
    );
  }

  if (command === "limit") {
    if (!(await requireOwner())) return;

    const limit = Number(args[0]);
    if (!Number.isInteger(limit) || limit < 0 || limit > 99) {
      return message.reply("Укажи число от 0 до 99.");
    }

    await voiceChannel.setUserLimit(limit).catch(() => {});
    return message.reply(`Лимит установлен: ${limit}`);
  }

  if (command === "lock") {
    if (!(await requireOwner())) return;

    await voiceChannel.permissionOverwrites
      .edit(message.guild.roles.everyone, {
        Connect: false,
      })
      .catch(() => {});

    return message.reply("Комната закрыта для входа.");
  }

  if (command === "unlock") {
    if (!(await requireOwner())) return;

    await voiceChannel.permissionOverwrites
      .edit(message.guild.roles.everyone, {
        Connect: true,
      })
      .catch(() => {});

    return message.reply("Комната открыта для входа.");
  }

  if (command === "hide") {
    if (!(await requireOwner())) return;

    await voiceChannel.permissionOverwrites
      .edit(message.guild.roles.everyone, {
        ViewChannel: false,
      })
      .catch(() => {});

    await voiceChannel.permissionOverwrites
      .edit(member.id, {
        ViewChannel: true,
        Connect: true,
      })
      .catch(() => {});

    return message.reply("Комната скрыта.");
  }

  if (command === "show") {
    if (!(await requireOwner())) return;

    await voiceChannel.permissionOverwrites
      .edit(message.guild.roles.everyone, {
        ViewChannel: true,
      })
      .catch(() => {});

    return message.reply("Комната снова видна.");
  }

  if (command === "invite") {
    if (!(await requireOwner())) return;

    const target = message.mentions.members.first();
    if (!target) return message.reply("Используй: `!invite @user`");

    await voiceChannel.permissionOverwrites
      .edit(target.id, {
        ViewChannel: true,
        Connect: true,
      })
      .catch(() => {});

    return message.reply(`${target} теперь может заходить в комнату.`);
  }

  if (command === "uninvite") {
    if (!(await requireOwner())) return;

    const target = message.mentions.members.first();
    if (!target) return message.reply("Используй: `!uninvite @user`");

    await voiceChannel.permissionOverwrites.delete(target.id).catch(() => {});
    return message.reply(`Персональный доступ для ${target} убран.`);
  }

  if (command === "kick") {
    if (!(await requireOwner())) return;

    const target = message.mentions.members.first();
    if (!target) return message.reply("Используй: `!kick @user`");
    if (target.id === member.id) return message.reply("Себя кикнуть нельзя.");
    if (target.voice.channelId !== voiceChannel.id) {
      return message.reply("Этот пользователь не в твоей комнате.");
    }

    await target.voice
      .disconnect("Кик владельцем приватной комнаты")
      .catch(() => {});
    return message.reply(`${target.user.tag} выгнан из комнаты.`);
  }

  if (command === "name") {
    if (!(await requireOwner())) return;

    const newName = args.join(" ").trim();
    if (!newName) return message.reply("Используй: `!name Моя комната`");
    if (newName.length > 100) return message.reply("Слишком длинное название.");

    await voiceChannel.setName(newName).catch(() => {});
    return message.reply(`Название изменено на **${newName}**`);
  }

  if (command === "transfer") {
    if (!(await requireOwner())) return;

    const target = message.mentions.members.first();
    if (!target) return message.reply("Используй: `!transfer @user`");
    if (target.voice.channelId !== voiceChannel.id) {
      return message.reply("Пользователь должен находиться в твоей комнате.");
    }

    vcOwners[voiceChannel.id] = target.id;
    saveDb(vcOwners);

    await voiceChannel.permissionOverwrites
      .edit(target.id, {
        ViewChannel: true,
        Connect: true,
      })
      .catch(() => {});

    return message.reply(`Владение комнатой передано ${target}.`);
  }
});

client.login(process.env.TOKEN);
