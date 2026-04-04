const { Events, PermissionsBitField } = require("discord.js");

module.exports = (client, { SETTINGS_CACHE, cfg, getUserLanguage, getI18n }) => {
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;

    try {
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();
    } catch {
      return;
    }

    const settingsInfo = SETTINGS_CACHE.get(reaction.message.id);
    if (!settingsInfo) return;

    const { vcId, ownerId, textChannelId } = settingsInfo;
    if (user.id !== ownerId) {
      console.log(`⚙️  [SETTINGS] Non-owner tried to use reaction: ${user.username}`);
      await reaction.users.remove(user.id).catch(() => {});
      return;
    }

    const guild = reaction.message.guild;
    const voiceChannel = guild.channels.cache.get(vcId);
    const textChannel = guild.channels.cache.get(textChannelId);
    const member = await guild.members.fetch(user.id).catch(() => null);

    if (!voiceChannel || !member || !textChannel) {
      console.log(`⚙️  [SETTINGS] ❌ VC or member or text channel not found`);
      return;
    }

    console.log(`⚙️  [SETTINGS] Owner ${user.username} reacted with: ${reaction.emoji.name}`);
    await reaction.users.remove(user.id).catch(() => {});

    if (reaction.emoji.name === "🔒") {
      try {
        const lang = settingsInfo?.lang || (await getUserLanguage(guild, ownerId, { cfg }));
        const everyoneOverwrite = voiceChannel.permissionOverwrites.cache.find(
          (ow) => ow.id === guild.roles.everyone.id
        );
        
        const isLocked = !everyoneOverwrite?.allow.has(PermissionsBitField.Flags.Connect);

        if (isLocked) {
          console.log(`   🔓 Unlocking VC...`);
          await voiceChannel.permissionOverwrites
            .edit(guild.roles.everyone, { Connect: true, ViewChannel: true })
            .catch(() => {});
          await textChannel.send(getI18n(lang, "lockUnlocked")).catch(() => {});
        } else {
          console.log(`   🔒 Locking VC...`);
          
          await voiceChannel.permissionOverwrites
            .edit(guild.roles.everyone, { Connect: false })
            .catch(() => {});
          
          for (const voiceMember of voiceChannel.members.values()) {
            await voiceChannel.permissionOverwrites
              .edit(voiceMember.id, { ViewChannel: true, Connect: true })
              .catch(() => {});
          }
          
          await textChannel.send(getI18n(lang, "lockLocked")).catch(() => {});
        }
      } catch (err) {
        console.error(`   ❌ Lock error: ${err.message}`);
      }
    }

    if (reaction.emoji.name === "👥") {
      try {
        const lang = settingsInfo?.lang || (await getUserLanguage(guild, ownerId, { cfg }));
        console.log(`   👥 Requesting user limit from owner...`);
        const promptMsg = await textChannel
          .send(getI18n(lang, "limitPrompt"))
          .catch(() => null);

        if (!promptMsg) {
          console.log(`   ❌ Failed to send prompt message`);
          return;
        }

        const filter = (m) => m.author.id === ownerId && !isNaN(parseInt(m.content));
        const collector = textChannel.createMessageCollector({ filter, time: 60000, max: 1 });

        collector.on("collect", async (msg) => {
          try {
            const limit = parseInt(msg.content);
            
            if (!Number.isInteger(limit) || limit < 0 || limit > 99) {
              console.log(`   👥 Invalid limit: ${msg.content}`);
              await msg.delete().catch(() => {});
              await textChannel.send(getI18n(lang, "limitInvalid")).catch(() => {});
              await promptMsg.delete().catch(() => {});
              return;
            }

            console.log(`   👥 Setting user limit to: ${limit === 0 ? "unlimited" : limit}`);
            await voiceChannel.setUserLimit(limit).catch(() => {});
            
            await msg.delete().catch(() => {});
            await promptMsg.delete().catch(() => {});
            
            const limitText = limit === 0 ? getI18n(lang, "limitUnlimited") : limit;
            const message = getI18n(lang, "limitSuccess").replace("{limit}", limitText);
            await textChannel.send(message).catch(() => {});
          } catch (err) {
            console.error(`   ❌ Collect error: ${err.message}`);
          }
        });

        collector.on("end", async (collected) => {
          try {
            if (collected.size === 0) {
              console.log(`   👥 No response from owner (timeout)`);
              await promptMsg.delete().catch(() => {});
            }
          } catch (err) {
            console.error(`   ❌ End error: ${err.message}`);
          }
        });

        collector.on("error", (err) => {
          console.error(`   ❌ Collector error: ${err.message}`);
        });
      } catch (err) {
        console.error(`   ❌ User limit error: ${err.message}`);
      }
    }

    if (reaction.emoji.name === "⛔") {
      try {
        const lang = settingsInfo?.lang || (await getUserLanguage(guild, ownerId, { cfg }));
        const members = voiceChannel.members.filter((m) => m.id !== ownerId);
        
        if (members.size === 0) {
          console.log(`   ⛔ No one to kick`);
          await textChannel.send(getI18n(lang, "noOneToKick")).catch(() => {});
          return;
        }

        console.log(`   ⛔ Showing kick list with ${members.size} member(s)...`);
        
        const memberList = members
          .map((m, i) => `${i === 0 ? "1️⃣" : i === 1 ? "2️⃣" : i === 2 ? "3️⃣" : i === 3 ? "4️⃣" : i === 4 ? "5️⃣" : "❌"} **${m.user.username}**`)
          .join("\n");

        const kickMsg = await textChannel
          .send(`${getI18n(lang, "selectKick")}\n${memberList}`)
          .catch(() => null);

        if (!kickMsg) return;

        const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];
        const maxEmojis = Math.min(members.size, emojis.length);
        
        for (let i = 0; i < maxEmojis; i++) {
          await kickMsg.react(emojis[i]).catch(() => {});
        }

        const emojiFilter = (reaction, kickUser) =>
          kickUser.id === ownerId && emojis.indexOf(reaction.emoji.name) < maxEmojis;

        const kickCollector = kickMsg.createReactionCollector({ filter: emojiFilter, time: 30000, max: 1 });

        kickCollector.on("collect", async (reaction) => {
          try {
            const selectedIdx = emojis.indexOf(reaction.emoji.name);
            const memberArray = Array.from(members.values());
            const toKick = memberArray[selectedIdx];

            if (toKick) {
              console.log(`   ⛔ Kicking: ${toKick.user.username}`);
              await toKick.voice.disconnect("Kicked by room owner").catch(() => {});
              await kickMsg.delete().catch(() => {});
              const message = getI18n(lang, "kickSuccess").replace("{user}", toKick.user.username);
              await textChannel.send(message).catch(() => {});
            }
          } catch (err) {
            console.error(`   ❌ Kick error: ${err.message}`);
          }
        });

        kickCollector.on("end", async () => {
          try {
            await kickMsg.delete().catch(() => {});
          } catch (err) {
            console.error(`   ❌ Error cleaning up kick message: ${err.message}`);
          }
        });

        kickCollector.on("error", (err) => {
          console.error(`   ❌ Kick collector error: ${err.message}`);
        });
      } catch (err) {
        console.error(`   ❌ Kick system error: ${err.message}`);
      }
    }
  });
};
