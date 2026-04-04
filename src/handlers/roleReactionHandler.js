const { Events } = require("discord.js");

module.exports = (client, { cfg, findRole }) => {
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
    if (!message.content.includes("To gain access")) return;

    const guild = message.guild;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const config = cfg();
    
    // Try to get roles by ID first (more reliable)
    let ruRole = config.roleRuId 
      ? guild.roles.cache.get(config.roleRuId)
      : await findRole(guild, config.roleRuName);
    
    let engRole = config.roleEngId
      ? guild.roles.cache.get(config.roleEngId)
      : await findRole(guild, config.roleEngName);
    
    const additionalRole = guild.roles.cache.get("1329007888332754944");

    if (!ruRole || !engRole) {
      console.log(`👤 [ROLES] ❌ Role not found - RU: ${ruRole?.id || "NOT FOUND"} (${ruRole?.name || "N/A"}), ENG: ${engRole?.id || "NOT FOUND"} (${engRole?.name || "N/A"})`);
      console.log(`   Config: roleRuId=${config.roleRuId}, roleEngId=${config.roleEngId}`);
      return;
    }

    if (reaction.emoji.name === "🇷🇺") {
      console.log(`👤 [ROLES] ${member.user.username} selected RU`);
      await member.roles.add(ruRole).catch(() => {});
      await member.roles.remove(engRole).catch(() => {});
      if (additionalRole) {
        await member.roles.add(additionalRole).catch(() => {});
        console.log(`   ✅ Added roles: ${ruRole.name}, ${additionalRole.name}`);
      } else {
        console.log(`   ✅ Added role: ${ruRole.name}`);
      }
    } else if (reaction.emoji.name === "🇪🇺") {
      console.log(`👤 [ROLES] ${member.user.username} selected ENG`);
      await member.roles.add(engRole).catch(() => {});
      await member.roles.remove(ruRole).catch(() => {});
      if (additionalRole) {
        await member.roles.add(additionalRole).catch(() => {});
        console.log(`   ✅ Added roles: ${engRole.name}, ${additionalRole.name}`);
      } else {
        console.log(`   ✅ Added role: ${engRole.name}`);
      }
    } else {
      return;
    }

    await reaction.users.remove(user.id).catch(() => {});
  });
};
