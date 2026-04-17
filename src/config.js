require("dotenv").config();

function cfg() {
  return {
    guildId: process.env.GUILD_ID,
    roleRuId: process.env.ROLE_RU_ID,
    roleEngId: process.env.ROLE_ENG_ID,
    roleNaId: process.env.ROLE_NA_ID,
    roleSaId: process.env.ROLE_SA_ID,
    roleOceId: process.env.ROLE_OCE_ID,
    verifiedRoleId: process.env.VERIFIED_ROLE_ID,
    createVcName: process.env.CREATE_VC_NAME,
    createVcId: process.env.CREATE_VC_ID,
    vcCategoryId: process.env.VC_CATEGORY_ID,
    vcCategoryName: process.env.VC_CATEGORY_NAME,
    reactionChannelId: process.env.REACTION_CHANNEL_ID,
    reactionChannelName: process.env.REACTION_CHANNEL_NAME,
    ticketChannelId: process.env.TICKET_CHANNEL_ID,
    ticketRuChannelId: process.env.TICKET_RU_CHANNEL_ID,
    ticketCategoryId: process.env.TICKET_CATEGORY_ID,
  };
}

module.exports = { cfg };
