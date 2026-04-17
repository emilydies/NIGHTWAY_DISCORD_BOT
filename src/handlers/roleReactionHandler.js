const { Events } = require("discord.js");

module.exports = (client, { cfg, findRole }) => {
  console.log("🔧 [ROLES] Region button handler initialized");

  const isRegionPanelMessage = (message) => {
    const content = (message.content || "").toLowerCase();
    const byContent =
      content.includes("to gain access") ||
      content.includes("select your region");

    const byEmbed = message.embeds?.some((embed) => {
      const title = (embed.title || "").toLowerCase();
      const desc = (embed.description || "").toLowerCase();
      return (
        title.includes("select your region") ||
        title.includes("select your language") ||
        title.includes("select your language & region") ||
        desc.includes("please select your region") ||
        desc.includes("please select your language")
      );
    });

    return Boolean(byContent || byEmbed);
  };

  const getRoleById = async (guild, roleId) => {
    if (!roleId) return null;
    return guild.roles.cache.get(roleId) || (await guild.roles.fetch(roleId).catch(() => null));
  };

  const codeByCustomId = {
    region_ru: "RU",
    region_eu: "EU",
    region_na: "NA",
    region_sa: "SA",
    region_oce: "OCE",
  };

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    if (!codeByCustomId[interaction.customId]) return;

    const message = interaction.message;
    if (!message?.guild) return;

    const user = interaction.user;
    if (user.bot) return;

    const config = cfg();

    if (config.reactionChannelId && interaction.channelId !== config.reactionChannelId) {
      return;
    }

    if (message.author.id !== client.user.id) {
      console.log("⚠️ [ROLES] Ignored reaction: message is not authored by bot");
      return;
    }
    if (!isRegionPanelMessage(message)) {
      console.log("⚠️ [ROLES] Ignored button: message does not match region panel signature");
      return;
    }

    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    const guild = message.guild;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      console.log(`⚠️ [ROLES] Failed to fetch member for user ${user.id}`);
      return;
    }

    const me = guild.members.me || (await guild.members.fetchMe().catch(() => null));
    if (!me) {
      console.log("❌ [ROLES] Failed to fetch bot member object");
      return;
    }
    if (!me.permissions.has("ManageRoles")) {
      console.log("❌ [ROLES] Missing permission: Manage Roles");
      return;
    }

    const ruRole = await getRoleById(guild, config.roleRuId);
    const euRole = await getRoleById(guild, config.roleEngId);

    const naRole = await getRoleById(
      guild,
      config.roleNaId,
    );
    const saRole = await getRoleById(
      guild,
      config.roleSaId,
    );
    const oceRole = await getRoleById(
      guild,
      config.roleOceId,
    );

    const additionalRole = await getRoleById(guild, config.verifiedRoleId);

    if (!ruRole || !euRole || !naRole || !saRole || !oceRole) {
      console.log(
        `👤 [ROLES] ❌ Role missing - RU: ${ruRole?.id || "NOT FOUND"}, EU: ${euRole?.id || "NOT FOUND"}, NA: ${naRole?.id || "NOT FOUND"}, SA: ${saRole?.id || "NOT FOUND"}, OCE: ${oceRole?.id || "NOT FOUND"}`,
      );
      console.log(
        `   Config: roleRuId=${config.roleRuId}, roleEngId=${config.roleEngId}, roleNaId=${config.roleNaId}, roleSaId=${config.roleSaId}, roleOceId=${config.roleOceId}`,
      );
      await interaction.editReply({ content: "❌ Region roles are not configured correctly." }).catch(() => {});
      return;
    }

    const regionByCode = {
      RU: { code: "RU", role: ruRole },
      EU: { code: "EU", role: euRole },
      NA: { code: "NA", role: naRole },
      SA: { code: "SA", role: saRole },
      OCE: { code: "OCE", role: oceRole },
    };

    const selected = regionByCode[codeByCustomId[interaction.customId]];
    if (!selected) {
      console.log(`⚠️ [ROLES] Ignored unsupported button: ${interaction.customId}`);
      await interaction.editReply({ content: "⚠️ Unsupported region selection." }).catch(() => {});
      return;
    }

    if (selected.role.position >= me.roles.highest.position) {
      console.log(
        `❌ [ROLES] Cannot manage role ${selected.role.name}: move bot role above it`,
      );
      await interaction.editReply({ content: "❌ I cannot manage that role. Move the bot role higher." }).catch(() => {});
      return;
    }

    console.log(`👤 [ROLES] ${member.user.username} selected ${selected.code}`);

    const allRegionRoles = [ruRole, euRole, naRole, saRole, oceRole];
    for (const role of allRegionRoles) {
      if (role.position >= me.roles.highest.position) continue;
      if (role.id === selected.role.id) {
        await member.roles.add(role).catch((err) => {
          console.log(`❌ [ROLES] Failed to add ${role.name}: ${err.message}`);
        });
      } else {
        await member.roles.remove(role).catch((err) => {
          console.log(`❌ [ROLES] Failed to remove ${role.name}: ${err.message}`);
        });
      }
    }

    if (additionalRole) {
      if (additionalRole.position < me.roles.highest.position) {
        await member.roles.add(additionalRole).catch((err) => {
          console.log(`❌ [ROLES] Failed to add ${additionalRole.name}: ${err.message}`);
        });
        console.log(`   ✅ Applied roles: ${selected.role.name}, ${additionalRole.name}`);
      } else {
        console.log(`⚠️ [ROLES] Skipped additional role ${additionalRole.name}: bot role is lower`);
        console.log(`   ✅ Applied role: ${selected.role.name}`);
      }
    } else {
      console.log(`   ✅ Applied role: ${selected.role.name}`);
    }

    await interaction.editReply({ content: `✅ Region selected: ${selected.code}` }).catch(() => {});
  });
};
