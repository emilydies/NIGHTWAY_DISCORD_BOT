const { ChannelType } = require("discord.js");

async function findRole(guild, name) {
  return guild.roles.cache.find((r) => r.name === name) || null;
}

async function findChannel(guild, nameOrId, type = null) {
  // Try to find by ID first if it looks like an ID
  if (typeof nameOrId === "string" && /^\d+$/.test(nameOrId)) {
    const channel = guild.channels.cache.get(nameOrId);
    if (channel && (type ? channel.type === type : true)) {
      return channel;
    }
  }

  // Fall back to finding by name
  return (
    guild.channels.cache.find(
      (c) => c.name === nameOrId && (type ? c.type === type : true),
    ) || null
  );
}

function getOwnedChannelIdByUser(userId, vcOwners) {
  for (const [channelId, data] of Object.entries(vcOwners)) {
    if (typeof data === "object" && data.owner === userId) return channelId;
    if (typeof data === "string" && data === userId) return channelId;
  }
  return null;
}

function isOwner(userId, channelId, vcOwners) {
  const data = vcOwners[channelId];
  if (typeof data === "object") return data.owner === userId;
  return data === userId;
}

module.exports = { findRole, findChannel, getOwnedChannelIdByUser, isOwner };
