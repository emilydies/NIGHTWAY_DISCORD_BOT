const i18n = {
  ru: {
    settingsTitle: "⚙️ **Управление комнатой**",
    lockDesc: "🔒 — Заблокировать/разблокировать комнату",
    limitDesc: "👥 — Установить лимит пользователей",
    kickDesc: "⛔ — Выкинуть пользователя",
    reactMsg: "Реагируйте эмодзи для управления.",
    lockUnlocked: "✅ Комната разблокирована!",
    lockLocked: "🔒 Комната заблокирована!\nТолько текущие участники могут присоединиться.",
    limitPrompt: 'Напишите лимит пользователей в VC как целое число\n(например: "1", "4", "9" без кавычек)',
    limitInvalid: "❌ Пожалуйста, напишите целое число (0-99)",
    limitSuccess: "✅ Лимит пользователей установлен: **{limit}** пользователей",
    limitUnlimited: "Неограниченно",
    noOneToKick: "⛔ Больше никого нет в комнате для выкидывания.",
    selectKick: "**Выберите пользователя для выкидывания:**",
    kickSuccess: "✅ **{user}** был выкинут.",
    ticketWelcome: "В этом чате вы можете задавать вопросы и <@&1329007606110359624> поможет вам!\n\nРеагируйте с ⛔ для закрытия тикета.",
    ticketClosed: "🔐 Этот тикет был закрыт.\nВы больше не имеете доступ.",
    ticketRoomId: "Если у вас вопрос о конкретной игре на нашей платформе, отправьте ID комнаты.\n\nВы можете найти его в левом верхнем углу страницы игровой комнаты.",
  },
  en: {
    settingsTitle: "⚙️ **Room Settings**",
    lockDesc: "🔒 — Lock/unlock room",
    limitDesc: "👥 — Set user limit",
    kickDesc: "⛔ — Kick user",
    reactMsg: "React with emoji to manage.",
    lockUnlocked: "✅ Room unlocked!",
    lockLocked: "🔒 Room locked!\nOnly current members can join.",
    limitPrompt: 'Write the user limit for the VC as an integer\n(example: "1", "4", "9" without quotes)',
    limitInvalid: "❌ Please write an integer number only (0-99)",
    limitSuccess: "✅ User limit set to: **{limit}** users",
    limitUnlimited: "Unlimited",
    noOneToKick: "⛔ No one else in the room to kick.",
    selectKick: "**Select a user to kick:**",
    kickSuccess: "✅ **{user}** has been kicked.",
    ticketWelcome: "In this channel you can ask your questions and <@&1329007606110359624> will help you!\n\nReact with ⛔ to close this ticket.",
    ticketClosed: "🔐 This ticket has been closed.\nYou no longer have access.",
    ticketRoomId: "If you have a question about a specific game on our platform, please send the room ID.\n\nYou can find it in the top left corner of the game room page.",
  },
};

function getI18n(lang, key) {
  return i18n[lang]?.[key] || i18n.en[key] || "";
}

async function getUserLanguage(guild, userId, { cfg }) {
  const config = cfg();
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return "en";
  
  if (config.roleRuId && member.roles.cache.has(config.roleRuId)) return "ru";
  if (config.roleEngId && member.roles.cache.has(config.roleEngId)) return "en";
  
  return "en";
}

module.exports = { i18n, getI18n, getUserLanguage };
