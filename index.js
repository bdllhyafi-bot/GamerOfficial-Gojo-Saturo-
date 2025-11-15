require("dotenv").config();
const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    PermissionsBitField 
} = require("discord.js");

const prefix = "!"; 
const LOG_CHANNEL = process.env.LOG_CHANNEL;
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

// ----------------------------------------------------
// LOGGING FUNCTION
// ----------------------------------------------------
function log(guild, msg) {
    const channel = guild.channels.cache.get(LOG_CHANNEL);
    if (channel) channel.send(msg).catch(() => {});
}

// ----------------------------------------------------
// ON READY
// ----------------------------------------------------
client.on("ready", () => {
    console.log(`Bot online as ${client.user.tag}`);
});

// ----------------------------------------------------
// WELCOME + LEAVE SYSTEM
// ----------------------------------------------------
client.on("guildMemberAdd", member => {
    member.guild.channels.cache.get(LOG_CHANNEL)
        ?.send(`👋 Welcome <@${member.id}>!`);

    // Auto-ban raid bots (0-day accounts)
    const accountAge = Date.now() - member.user.createdTimestamp;
    if (accountAge < 1000 * 60 * 60 * 24) {
        member.ban({ reason: "Auto-ban raid bot (new account)" })
            .catch(() => {});
        log(member.guild, `🚫 Auto-banned **${member.user.tag}** (Suspicious account)`);
    }
});

client.on("guildMemberRemove", member => {
    log(member.guild, `👋 User left: **${member.user.tag}**`);
});

// ----------------------------------------------------
// ANTI-GHOST PING
// ----------------------------------------------------
client.on("messageDelete", msg => {
    if (msg.mentions.users.size > 0) {
        log(msg.guild, `👻 **Ghost ping detected!**  
User: <@${msg.author.id}>  
Message: ${msg.content}`);
    }
});

// ----------------------------------------------------
// MODERATION COMMANDS
// ----------------------------------------------------
client.on("messageCreate", async (message) => {
    if (!message.guild || !message.content.startsWith(prefix)) return;
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    const logChannel = message.guild.channels.cache.get(LOG_CHANNEL);

    // LOCK
    if (cmd === "lock") {
        const channel = message.channel;
        channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false });
        channel.send("🔒 Channel locked.");
        logChannel?.send(`🔒 ${channel} locked by <@${message.author.id}>`);
    }

    // UNLOCK
    if (cmd === "unlock") {
        const channel = message.channel;
        channel.permissionOverwrites.edit(message.guild.id, { SendMessages: true });
        channel.send("🔓 Channel unlocked.");
        logChannel?.send(`🔓 ${channel} unlocked by <@${message.author.id}>`);
    }

    // CLEAR
    if (cmd === "clear") {
        let amount = parseInt(args[0]);
        if (!amount) return message.reply("Enter a number.");
        if (amount > 100) amount = 100;

        await message.channel.bulkDelete(amount, true);
        message.channel.send(`🧹 Deleted **${amount}** messages.`);
        logChannel?.send(`🧹 <@${message.author.id}> cleared **${amount}** messages in ${message.channel}`);
    }

    // BAN
    if (cmd === "ban") {
        const user = message.mentions.users.first();
        if (!user) return message.reply("Mention someone to ban.");
        const member = message.guild.members.cache.get(user.id);

        await member.ban({ reason: "Banned by command" });
        message.reply(`🔨 Banned **${user.tag}**`);
        logChannel?.send(`🔨 <@${message.author.id}> banned **${user.tag}**`);
    }

    // UNBAN
    if (cmd === "unban") {
        const id = args[0];
        if (!id) return message.reply("Provide user ID.");
        await message.guild.members.unban(id);
        message.reply(`♻️ Unbanned user.`);
        logChannel?.send(`♻️ <@${message.author.id}> unbanned **${id}**`);
    }

    // KICK
    if (cmd === "kick") {
        const user = message.mentions.users.first();
        if (!user) return message.reply("Mention someone to kick.");
        const member = message.guild.members.cache.get(user.id);

        await member.kick();
        message.reply(`👢 Kicked **${user.tag}**`);
        logChannel?.send(`👢 <@${message.author.id}> kicked **${user.tag}**`);
    }

    // MUTE
    if (cmd === "mute") {
        const user = message.mentions.users.first();
        if (!user) return;
        const member = message.guild.members.cache.get(user.id);

        await member.timeout(9999999999);
        message.reply(`🔇 Muted **${user.tag}**`);
        logChannel?.send(`🔇 <@${message.author.id}> muted **${user.tag}**`);
    }

    // UNMUTE
    if (cmd === "unmute") {
        const user = message.mentions.users.first();
        if (!user) return;
        const member = message.guild.members.cache.get(user.id);

        await member.timeout(null);
        message.reply(`🔊 Unmuted **${user.tag}**`);
        logChannel?.send(`🔊 <@${message.author.id}> unmuted **${user.tag}**`);
    }
});

// ----------------------------------------------------
// ANTI-NUKE
// Prevent roles deleted, channels deleted, mass kicks, etc.
// ----------------------------------------------------
client.on("guildAuditLogEntryCreate", async (entry) => {
    const { action, executorId, targetId, guild } = entry;

    // If bot is owner / admin of server, safe
    const executor = guild.members.cache.get(executorId);
    if (!executor) return;

    const dangerousActions = [
        "CHANNEL_DELETE",
        "ROLE_DELETE",
        "MEMBER_KICK",
        "MEMBER_BAN"
    ];

    if (dangerousActions.includes(entry.action)) {
        // Auto-ban nuker
        executor.ban({ reason: "Anti-Nuke: Suspicious destructive action" })
            .catch(() => {});

        log(guild, `🚨 **ANTI-NUKE TRIGGERED**  
User: <@${executorId}>  
Action: ${action}`);
    }
});

// ----------------------------------------------------
client.login(process.env.TOKEN);
