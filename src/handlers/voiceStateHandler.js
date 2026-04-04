const { Events, ChannelType } = require("discord.js");

module.exports = (client, { cfg, createPrivateVoice, cleanupOwnedChannel, vcOwners, saveDb, getOwnedChannelIdByUser, createPrivateTextChannel }) => {
  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    const config = cfg();
    const userName = newState.member?.user.username || "Unknown";

    if (oldState.channel) {
      console.log(`🔊 [VC EVENT] ${userName} left VC: ${oldState.channel.name}`);
      await cleanupOwnedChannel(oldState.channel, { cfg, vcOwners, saveDb });
    }

    if (
      newState.channel &&
      newState.channel.type === ChannelType.GuildVoice &&
      (newState.channel.id === config.createVcId ||
        newState.channel.name === config.createVcName)
    ) {
      console.log(`🔊 [VC EVENT] ${userName} joined trigger VC: ${newState.channel.name}`);
      await createPrivateVoice(newState.member, {
        cfg,
        vcOwners,
        saveDb,
        getOwnedChannelIdByUser,
        createPrivateTextChannel,
      });
    }

    if (oldState.channel) {
      await cleanupOwnedChannel(oldState.channel, { cfg, vcOwners, saveDb });
    }
  });
};
