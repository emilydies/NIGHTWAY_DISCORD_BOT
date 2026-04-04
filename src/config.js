require("dotenv").config();

function cfg() {
  return {
    guildId: process.env.GUILD_ID,
    roleRuName: process.env.ROLE_RU_NAME || "RU",
    roleEngName: process.env.ROLE_ENG_NAME || "ENG",
    roleRuId: process.env.ROLE_RU_ID,
    roleEngId: process.env.ROLE_ENG_ID,
    createVcName: process.env.CREATE_VC_NAME || "Create VC",
    createVcId: process.env.CREATE_VC_ID,
    vcCategoryId: process.env.VC_CATEGORY_ID,
    vcCategoryName: process.env.VC_CATEGORY_NAME || "Voice",
    reactionChannelId: process.env.REACTION_CHANNEL_ID,
    reactionChannelName: process.env.REACTION_CHANNEL_NAME || "roles",
  };
}

module.exports = { cfg };
