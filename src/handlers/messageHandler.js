const { Events, ChannelType } = require("discord.js");

const PREFIX = "!";

module.exports = (client, { cfg, findChannel, findRole, createReactionPanel, getReactionPanelMessage, isOwner, getOwnedChannelIdByUser, vcOwners, saveDb }) => {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = (args.shift() || "").toLowerCase();
    const member = message.member;
    const voiceChannel = member.voice.channel;

    async function requireOwner() {
      if (!voiceChannel) {
        await message.reply("You must be in a voice channel first.");
        return false;
      }
      if (!isOwner(member.id, voiceChannel.id, vcOwners)) {
        await message.reply("You are not the owner of this channel.");
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
        return message.reply(`Channel not found: ${config.reactionChannelName}`);

      const existing = await getReactionPanelMessage(channel, client);
      if (existing) return message.reply("Role selection panel already exists.");

      await createReactionPanel(channel);
      return message.reply("Role selection panel created.");
    }

    if (command === "myvc") {
      const ownedId = getOwnedChannelIdByUser(member.id, vcOwners);
      if (!ownedId) {
        return message.reply("You don't have your own room yet.");
      }

      const ch = message.guild.channels.cache.get(ownedId);
      if (!ch) {
        delete vcOwners[ownedId];
        saveDb(vcOwners);
        return message.reply("Channel not found. Record cleared.");
      }

      return message.reply(
        [
          `Your room: **${ch.name}**`,
          "",
          "**Available commands:**",
          "`!limit <0-99>` - Set user limit",
          "`!lock` / `!unlock` - Lock/unlock the room",
          "`!hide` / `!show` - Hide/show the room",
          "`!invite @user` - Grant access",
          "`!uninvite @user` - Remove access",
          "`!kick @user` - Kick from room",
          "`!name <name>` - Rename room",
          "`!transfer @user` - Transfer ownership",
        ].join("\n"),
      );
    }

    if (command === "help") {
      return message.reply(
        [
          "**Commands:**",
          "",
          "`!setuproles` — Create role selection panel (RU/ENG)",
          "`!myvc` — Show your room info",
          "`!limit <0-99>` — Set user limit",
          "`!lock` — Lock room (prevent joins)",
          "`!unlock` — Unlock room (allow joins)",
          "`!hide` — Hide room from others",
          "`!show` — Show room to others",
          "`!invite @user` — Grant access to user",
          "`!uninvite @user` — Remove user access",
          "`!kick @user` — Kick from room",
          "`!name <name>` — Rename room",
          "`!transfer @user` — Transfer ownership",
          "`!claim` — Take room if owner left",
        ].join("\n"),
      );
    }

    if (command === "claim") {
      if (!voiceChannel)
        return message.reply("You must be in a voice channel first.");
      const data = vcOwners[voiceChannel.id];
      const ownerId = typeof data === "object" ? data.owner : data;

      if (!ownerId) return message.reply("This is not a private bot room.");
      if (ownerId === member.id)
        return message.reply("You are already the owner of this room.");

      const ownerStillInside = voiceChannel.members.has(ownerId);
      if (ownerStillInside) {
        return message.reply(
          "You cannot claim the room while the owner is still in it.",
        );
      }

      vcOwners[voiceChannel.id] = typeof data === "object" ? { ...data, owner: member.id } : member.id;
      saveDb(vcOwners);

      return message.reply(
        `You are now the owner of **${voiceChannel.name}**.`,
      );
    }

    if (command === "limit") {
      if (!(await requireOwner())) return;

      const limit = Number(args[0]);
      if (!Number.isInteger(limit) || limit < 0 || limit > 99) {
        return message.reply("Please provide a number between 0 and 99.");
      }

      await voiceChannel.setUserLimit(limit).catch(() => {});
      return message.reply(`User limit set to: **${limit}**`);
    }

    if (command === "lock") {
      if (!(await requireOwner())) return;

      await voiceChannel.permissionOverwrites
        .edit(message.guild.roles.everyone, {
          Connect: false,
        })
        .catch(() => {});

      return message.reply("Room locked. New members cannot join.");
    }

    if (command === "unlock") {
      if (!(await requireOwner())) return;

      await voiceChannel.permissionOverwrites
        .edit(message.guild.roles.everyone, {
          Connect: true,
        })
        .catch(() => {});

      return message.reply("Room unlocked. All members can now join.");
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

      return message.reply("Room hidden. Only you can see it now.");
    }

    if (command === "show") {
      if (!(await requireOwner())) return;

      await voiceChannel.permissionOverwrites
        .edit(message.guild.roles.everyone, {
          ViewChannel: true,
        })
        .catch(() => {});

      return message.reply("Room is now visible to everyone.");
    }

    if (command === "invite") {
      if (!(await requireOwner())) return;

      const target = message.mentions.members.first();
      if (!target) return message.reply("Usage: `!invite @user`");

      await voiceChannel.permissionOverwrites
        .edit(target.id, {
          ViewChannel: true,
          Connect: true,
        })
        .catch(() => {});

      return message.reply(`${target} has been granted access to the room.`);
    }

    if (command === "uninvite") {
      if (!(await requireOwner())) return;

      const target = message.mentions.members.first();
      if (!target) return message.reply("Usage: `!uninvite @user`");

      await voiceChannel.permissionOverwrites.delete(target.id).catch(() => {});
      return message.reply(`${target}'s access has been removed.`);
    }

    if (command === "kick") {
      if (!(await requireOwner())) return;

      const target = message.mentions.members.first();
      if (!target) return message.reply("Usage: `!kick @user`");
      if (target.id === member.id) return message.reply("You cannot kick yourself.");
      if (target.voice.channelId !== voiceChannel.id) {
        return message.reply("This user is not in your room.");
      }

      await target.voice
        .disconnect("Kicked by room owner")
        .catch(() => {});
      return message.reply(`${target.user.tag} has been kicked from the room.`);
    }

    if (command === "name") {
      if (!(await requireOwner())) return;

      const newName = args.join(" ").trim();
      if (!newName) return message.reply("Usage: `!name My Room`");
      if (newName.length > 100) return message.reply("Name is too long (max 100 characters).");

      await voiceChannel.setName(newName).catch(() => {});
      return message.reply(`Room name changed to **${newName}**`);
    }

    if (command === "transfer") {
      if (!(await requireOwner())) return;

      const target = message.mentions.members.first();
      if (!target) return message.reply("Usage: `!transfer @user`");
      if (target.voice.channelId !== voiceChannel.id) {
        return message.reply("The user must be in your room.");
      }

      const data = vcOwners[voiceChannel.id];
      vcOwners[voiceChannel.id] = typeof data === "object" ? { ...data, owner: target.id } : target.id;
      saveDb(vcOwners);

      await voiceChannel.permissionOverwrites
        .edit(target.id, {
          ViewChannel: true,
          Connect: true,
        })
        .catch(() => {});

      return message.reply(`Room ownership transferred to ${target}.`);
    }
  });
};
