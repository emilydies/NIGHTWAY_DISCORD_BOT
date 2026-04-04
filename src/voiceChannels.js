const {
  ChannelType,
  PermissionsBitField,
  OverwriteType,
} = require("discord.js");

const { getUserLanguage, getI18n } = require("./i18n");
const { createSettingsMessage } = require("./settingsPanel");

async function cleanupOwnedChannel(channel, { cfg, vcOwners, saveDb }) {
  if (!channel) return;
  if (channel.type !== ChannelType.GuildVoice) return;
  if (!vcOwners[channel.id]) return;

  if (channel.members.size === 0) {
    console.log(`🗑️  [CLEANUP] VC is empty: ${channel.name} (${channel.id}), deleting...`);
    
    const data = vcOwners[channel.id];
    const textChannelId = typeof data === "object" ? data.textChannel : null;
    const guild = channel.guild;
    const categoryId = channel.parentId;
    
    delete vcOwners[channel.id];
    saveDb(vcOwners);
    
    if (textChannelId) {
      const textChannel = guild.channels.cache.get(textChannelId);
      if (textChannel) {
        console.log(`   🗑️  Deleting text channel: ${textChannel.name}`);
        await textChannel.delete("Cleanup text channel").catch(() => {});
      }
    }
    
    console.log(`   🗑️  Deleting voice channel`);
    await channel.delete("Empty private voice channel").catch(() => {});
    
    if (categoryId) {
      const config = cfg();
      const isFixedCategory = categoryId === config.vcCategoryId;
      
      if (!isFixedCategory) {
        const category = guild.channels.cache.get(categoryId);
        if (category) {
          const channelsInCategory = guild.channels.cache.filter(c => c.parentId === categoryId);
          if (channelsInCategory.size === 0) {
            console.log(`   🗑️  Deleting empty category: ${category.name}`);
            await category.delete("Cleanup empty category").catch(() => {});
          }
        }
      }
    }
    
    console.log(`   ✅ Cleanup complete\n`);
  }
}

async function createPrivateTextChannel(guild, voiceChannel, ownerId, category) {
  console.log(`   📝 Creating text channel for VC: ${voiceChannel.id}`);
  
  const textChannel = await guild.channels
    .create({
      name: `${voiceChannel.name}-settings`,
      type: ChannelType.GuildText,
      parent: category ? category.id : undefined,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          type: OverwriteType.Role,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: ownerId,
          type: OverwriteType.Member,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.AddReactions,
          ],
        },
      ],
    })
    .catch((err) => {
      console.error(`   ❌ Error creating text channel: ${err.message}`);
      return null;
    });

  if (textChannel) {
    console.log(`   ✅ Text channel created: ${textChannel.name} (${textChannel.id})`);
    console.log(`   ⚙️  Creating settings message...`);
    await createSettingsMessage(textChannel, voiceChannel.id, ownerId, { getUserLanguage, getI18n });
    console.log(`   ✅ Settings message created`);
  }

  return textChannel;
}

async function createPrivateVoice(member, { cfg, vcOwners, saveDb, getOwnedChannelIdByUser, createPrivateTextChannel }) {
  const guild = member.guild;
  const config = cfg();
  console.log(`\n🔊 [VC CREATE] User joined trigger VC: ${member.user.username} (${member.id})`);

  const existingId = getOwnedChannelIdByUser(member.id, vcOwners);
  if (existingId) {
    console.log(`   ⚠️  User already has a VC: ${existingId}, moving there...`);
    const existingChannel = guild.channels.cache.get(existingId);
    if (existingChannel) {
      await member.voice.setChannel(existingChannel).catch(() => {});
      console.log(`   ✅ Moved to existing VC`);
      return existingChannel;
    } else {
      console.log(`   ❌ Existing VC not found, creating new one...`);
      delete vcOwners[existingId];
      saveDb(vcOwners);
    }
  }

  const categoryId = config.vcCategoryId;
  console.log(`   📁 Using category: "${categoryId}"`);
  
  let category = null;
  if (categoryId) {
    category = guild.channels.cache.get(categoryId);
    if (!category) {
      console.error(`   ❌ Category not found with ID: ${categoryId}`);
    } else {
      console.log(`   ✅ Category found: ${category.name}`);
    }
  }

  const channel = await guild.channels
    .create({
      name: `${member.user.username} room`,
      type: ChannelType.GuildVoice,
      parent: category ? category.id : undefined,
      userLimit: 5,
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
      console.error("   ❌ Error creating private voice channel:", err.message);
      return null;
    });

  if (!channel) {
    console.log(`   ❌ Failed to create voice channel`);
    return null;
  }
  
  console.log(`   ✅ Voice channel created: ${channel.name} (${channel.id})`);

  console.log(`   📝 Creating text settings channel...`);
  const textChannel = await createPrivateTextChannel(guild, channel, member.id, category, { createSettingsMessage });

  vcOwners[channel.id] = {
    owner: member.id,
    textChannel: textChannel ? textChannel.id : null,
  };
  saveDb(vcOwners);
  console.log(`   💾 Data saved to DB`);

  await member.voice.setChannel(channel).catch(() => {});
  console.log(`   ✅ User moved to new VC\n`);
  return channel;
}

async function createRestrictedChannel(guild, userIds, channelName, categoryName = null) {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    console.error("userIds must be a non-empty array");
    return null;
  }

  let category = null;

  if (categoryName) {
    category = guild.channels.cache.find(
      (c) => c.name === categoryName && c.type === ChannelType.GuildCategory,
    );

    if (!category) {
      category = await guild.channels
        .create({
          name: categoryName,
          type: ChannelType.GuildCategory,
        })
        .catch((err) => {
          console.error("Error creating category:", err);
          return null;
        });
    }
  }

  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      type: OverwriteType.Role,
      deny: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.Connect,
      ],
    },
  ];

  userIds.forEach((userId) => {
    permissionOverwrites.push({
      id: userId,
      type: OverwriteType.Member,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.Connect,
        PermissionsBitField.Flags.Speak,
        PermissionsBitField.Flags.Stream,
        PermissionsBitField.Flags.UseVAD,
      ],
    });
  });

  const channel = await guild.channels
    .create({
      name: channelName,
      type: ChannelType.GuildVoice,
      parent: category ? category.id : undefined,
      userLimit: 4,
      permissionOverwrites,
    })
    .catch((err) => {
      console.error("Error creating restricted channel:", err);
      return null;
    });

  if (channel) {
    console.log(
      `Restricted channel created: ${channel.name} (${channel.id}) for users: ${userIds.join(", ")}`,
    );
  }

  return channel;
}

module.exports = {
  cleanupOwnedChannel,
  createPrivateTextChannel,
  createPrivateVoice,
  createRestrictedChannel,
};
