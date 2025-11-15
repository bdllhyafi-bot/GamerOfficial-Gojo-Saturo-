require("dotenv").config();
const { 
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

// --------------------------
// 🚀 Client Setup
// --------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// --------------------------
// 😡 Bad Words Filter
// --------------------------
const badWords = ["stfu", "yuri", "sex", "cock", "pussy", "tits", "boobs", "gyatt"];

// --------------------------
// 🚨 Anti-Raid: Message Spam
// --------------------------
let messageCount = {};
const RAID_LIMIT = 7;
const RAID_TIME = 5000;

client.on("messageCreate", (msg) => {
  if (!msg.guild || msg.author.bot) return;

  const id = msg.author.id;

  if (!messageCount[id]) messageCount[id] = { count: 0, time: Date.now() };

  if (Date.now() - messageCount[id].time < RAID_TIME) {
    messageCount[id].count++;

    if (messageCount[id].count >= RAID_LIMIT) {
      msg.member.timeout(10 * 60 * 1000).catch(() => {});
      msg.channel.send(`${msg.author} has been muted for spamming.`);
    }
  } else {
    messageCount[id] = { count: 1, time: Date.now() };
  }
});

// --------------------------
// 🚨 Anti-Raid: MASS JOIN RAID
// --------------------------
let joinCount = 0;
let raidActive = false;

client.on("guildMemberAdd", (member) => {
  joinCount++;

  // RAID TRIGGER = 5 joins in 10 seconds
  if (joinCount >= 5 && !raidActive) {
    raidActive = true;

    const channel = member.guild.systemChannel;
    if (channel) channel.send("🚨 **RAID ALERT!** Too many members joined too fast!");

    // CLEAR 50 MESSAGES EVERY 10 SECONDS
    const raidInterval = setInterval(async () => {
      if (!raidActive) {
        clearInterval(raidInterval);
        return;
      }

      try {
        const ch = member.guild.systemChannel;
        if (ch) {
          await ch.bulkDelete(50, true);
          ch.send("🧹 Cleared 50 messages due to raid.");
        }
      } catch (err) {
        console.log("Clear error:", err);
      }
    }, 10000);

    // RAID ENDS AFTER 60 SECONDS
    setTimeout(() => {
      raidActive = false;
      joinCount = 0;
      const ch = member.guild.systemChannel;
      if (ch) ch.send("✅ **Raid ended. Returning to normal.**");
    }, 60000);
  }

  // Reset join counter every 10 seconds
  setTimeout(() => {
    joinCount = 0;
  }, 10000);
});

// --------------------------
// 👋 Welcome Message
// --------------------------
client.on("guildMemberAdd", (member) => {
  const channel = member.guild.systemChannel;
  if (channel) channel.send(`Welcome ${member.user}!`);
});

// --------------------------
// 🤬 Anti-Swear
// --------------------------
client.on("messageCreate", (msg) => {
  if (!msg.guild || msg.author.bot) return;

  if (badWords.some(w => msg.content.toLowerCase().includes(w))) {
    msg.delete().catch(() => {});
    msg.channel.send(`${msg.author}, please avoid using that language here.`);
  }
});

// --------------------------
// ❗ PREFIX COMMANDS (!)
// --------------------------
client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith("!")) return;

  const args = msg.content.slice(1).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  if (cmd === "clear") {
    const amt = parseInt(args[0]);
    if (!amt) return msg.reply("Use: !clear 10");
    await msg.channel.bulkDelete(amt, true);
    msg.channel.send(`Cleared ${amt} messages.`);
  }

  if (cmd === "ban") {
    const user = msg.mentions.members.first();
    if (!user) return msg.reply("Mention someone to ban.");
    user.ban();
    msg.channel.send(`${user.user.username} was banned.`);
  }

  if (cmd === "kick") {
    const user = msg.mentions.members.first();
    if (!user) return msg.reply("Mention someone to kick.");
    user.kick();
    msg.channel.send(`${user.user.username} was kicked.`);
  }

  if (cmd === "mute") {
    const user = msg.mentions.members.first();
    if (!user) return msg.reply("Mention someone to mute.");
    user.timeout(10 * 60 * 1000);
    msg.channel.send(`${user.user.username} is muted for 10 minutes.`);
  }

  if (cmd === "unmute") {
    const user = msg.mentions.members.first();
    if (!user) return msg.reply("Mention someone to unmute.");
    user.timeout(null);
    msg.channel.send(`${user.user.username} is now unmuted.`);
  }
});

// --------------------------
// ⬇ Slash Commands
// --------------------------
const slash = [
  new SlashCommandBuilder().setName("ban").setDescription("Ban a user").addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("kick").setDescription("Kick a user").addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("clear").setDescription("Clear messages").addIntegerOption(o => o.setName("amount").setDescription("Amount").setRequired(true)),
  new SlashCommandBuilder().setName("mute").setDescription("Mute a user").addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("unmute").setDescription("Unmute a user").addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
].map(cmd => cmd.toJSON());

// --------------------------
// ➕ Slash Command Registration
// --------------------------
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

client.once("ready", async () => {
  console.log("Bot is online!");

  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: slash });
    console.log("Slash commands registered!");
  } catch (err) {
    console.error(err);
  }
});

// --------------------------
// 🎯 Slash Command Handler
// --------------------------
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === "ban") {
    const user = options.getMember("user");
    if (!user) return interaction.reply({ content: "User not found.", ephemeral: true });
    try {
      await user.ban();
      interaction.reply(`${user.user.username} has been banned.`);
    } catch (error) {
      interaction.reply({ content: "I don't have permission to ban that user.", ephemeral: true });
    }
  }

  if (commandName === "kick") {
    const user = options.getMember("user");
    if (!user) return interaction.reply({ content: "User not found.", ephemeral: true });
    try {
      await user.kick();
      interaction.reply(`${user.user.username} has been kicked.`);
    } catch (error) {
      interaction.reply({ content: "I don't have permission to kick that user.", ephemeral: true });
    }
  }

  if (commandName === "clear") {
    const amount = options.getInteger("amount");
    if (amount < 1 || amount > 100) {
      return interaction.reply({ content: "Please provide a number between 1 and 100.", ephemeral: true });
    }
    try {
      await interaction.channel.bulkDelete(amount, true);
      interaction.reply({ content: `Cleared ${amount} messages.`, ephemeral: true });
    } catch (error) {
      interaction.reply({ content: "Failed to clear messages.", ephemeral: true });
    }
  }

  if (commandName === "mute") {
    const user = options.getMember("user");
    if (!user) return interaction.reply({ content: "User not found.", ephemeral: true });
    try {
      await user.timeout(10 * 60 * 1000);
      interaction.reply(`${user.user.username} has been muted for 10 minutes.`);
    } catch (error) {
      interaction.reply({ content: "I don't have permission to mute that user.", ephemeral: true });
    }
  }

  if (commandName === "unmute") {
    const user = options.getMember("user");
    if (!user) return interaction.reply({ content: "User not found.", ephemeral: true });
    try {
      await user.timeout(null);
      interaction.reply(`${user.user.username} has been unmuted.`);
    } catch (error) {
      interaction.reply({ content: "I don't have permission to unmute that user.", ephemeral: true });
    }
  }
});

// --------------------------
// 🔑 Login
// --------------------------
client.login(process.env.TOKEN);