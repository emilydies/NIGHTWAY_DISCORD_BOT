const i18n = {
  ru: {
    settingsTitle: "⚙️ **Управление комнатой**",
    lockDesc: "- В данном канале вы можете управлять своей приватной комнатой.",
    limitDesc: "- Вы можете установить лимит пользователей, закрыть комнату от новых участников,а также исключить нежелательных гостей из комнаты.",
    kickDesc: "- Или выкинуть нежелательных гостей из комнаты.",
    reactMsg: " ",
    lockUnlocked: "✅ Комната разблокирована!",
    lockLocked: "🔒 Комната заблокирована!\nТолько текущие участники могут присоединиться.",
    limitPrompt: 'Напишите лимит пользователей в VC как целое число\n(например: "1", "4", "9" без кавычек)',
    limitInvalid: "❌ Пожалуйста, напишите целое число (0-99)",
    limitSuccess: "✅ Лимит пользователей установлен: **{limit}** пользователей",
    limitUnlimited: "Неограниченно",
    noOneToKick: "⛔ Больше никого нет в комнате для выкидывания.",
    selectKick: "**Выберите пользователя для выкидывания:**",
    kickSuccess: "✅ **{user}** был выкинут.",
    ticketWelcomeTitle: "Добро пожаловать в тикет поддержки",
    ticketWelcome: "В этом чате вы можете задавать вопросы и администратор поможет вам!\n\nИспользуйте кнопки ниже: Room ID, Доступ к матчмейкингу и ⛔.",
    ticketButtonRoomId: "Room ID",
    ticketButtonAccount: "Доступ к матчмейкингу",
    ticketButtonClose: "Закрыть тикет",
    ticketClosed: "🔐 Этот тикет был закрыт.\nВы больше не имеете доступ.",
    ticketRoomIdTitle: "Информация о Room ID",
    ticketRoomId: "- Если у вас вопрос о конкретной игре на нашей платформе, отправьте ID комнаты.\n- Вы можете найти его в левом верхнем углу страницы игровой комнаты.",
    ticketAccountTitle: "Доступ к матчмейкингу",
    ticketAccountInfo: "- Если у вас основной прогресс в игре привязан к аккаунту не на платформе Steam, то для получения доступа к матчмейкингу платформы NIGHTWAY вам понадобиться перенести прогресс на аккаунт Steam.\n- Сделать это можно на [Оффициальном сайте Behavior interactive](https://account.bhvr.com/?sign-in).\n - Так как у вас на новом аккаунте Steam не будет достаточного количества часов (500), вам нужно будет предоставить доказательства наигранных часов на другой платформе.\n- Есть множество сервисов, предоставляющих кол-во часов с консолей и с других платформ по типу Epic games и др.\n- Помимо кол-ва часов, вам нужно будет предоставить доказательства привязки ваших аккаунтов друг к другу на сайте BHVR.\n\n *Примечание: вы все равно можете подключить аккаунт Steam, даже если он не соответствует нашим требованиям, мы предоставим вам доступ к матчмейкингу вручную после проверки предоставленной вами информации.*",
  },
  en: {
    settingsTitle: "⚙️ **Room Settings**",
    lockDesc: "- In this channel you can manage your private VC and people in it.",
    limitDesc: "- You can set a user limit, lock the VC from new members.",
    kickDesc: "- And also kick unwanted guests from the VC.",
    reactMsg: "Use the buttons below to manage.",
    lockUnlocked: "✅ Room unlocked!",
    lockLocked: "🔒 Room locked!\nOnly current members can join.",
    limitPrompt: 'Write the user limit for the VC as an integer\n(example: "1", "4", "9" without quotes)',
    limitInvalid: "❌ Please write an integer number only (0-99)",
    limitSuccess: "✅ User limit set to: **{limit}** users",
    limitUnlimited: "Unlimited",
    noOneToKick: "⛔ No one else in the room to kick.",
    selectKick: "**Select a user to kick:**",
    kickSuccess: "✅ **{user}** has been kicked.",
    ticketWelcomeTitle: "Welcome to Support Ticket",
    ticketWelcome: "In this channel you can ask your questions and staff will help you!\n\nUse the buttons below: Room ID, Matchmaking access and ⛔.",
    ticketButtonRoomId: "Room ID",
    ticketButtonAccount: "Matchmaking access",
    ticketButtonClose: "Close Ticket",
    ticketClosed: "🔐 This ticket has been closed.\nYou no longer have access.",
    ticketRoomIdTitle: "Room ID Information",
    ticketRoomId: "- If you have a question about a specific game on our platform, please send the room ID.\n- You can find it in the top left corner of the game room page.",
    ticketAccountTitle: "Matchmaking access",
    ticketAccountInfo: "- If you have your main game progress linked to an account not on the Steam platform, you will need to transfer your progress to a Steam account to gain access to matchmaking of NIGHTWAY platform.\n- You can do this on the [official Behavior interactive website](https://account.bhvr.com/?sign-in).\n- Since your new Steam account won't have enough hours (500), you will need to provide proof of hours played on another platform.\n- There are many services that provide hours played from consoles and other platforms like Epic games, etc.\n- In addition to the number of hours, you will need to provide proof of linking your accounts to each other on the BHVR website.\n\n *Note: you can still connect steam account even if it's not up to our requirements, we will give you access to matchmaking manually after checking on your provided information.*",
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
