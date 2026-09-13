const fs = require("fs");
const path = require("path");
const { EmbedBuilder } = require("discord.js");

const botBansPath = path.join(
    __dirname,
    "..",
    "data",
    "botbans.json"
);

const globalBansPath = path.join(
    __dirname,
    "..",
    "data",
    "globalbans.json"
);

function loadJSON(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, "{}");
        }

        return JSON.parse(
            fs.readFileSync(filePath, "utf8")
        );
    } catch (error) {
        console.error("Ban database error:", error);
        return {};
    }
}

function saveJSON(filePath, data) {
    fs.writeFileSync(
        filePath,
        JSON.stringify(data, null, 4)
    );
}

function loadBotBans() {
    return loadJSON(botBansPath);
}

function saveBotBans(data) {
    saveJSON(botBansPath, data);
}

function loadGlobalBans() {
    return loadJSON(globalBansPath);
}

function saveGlobalBans(data) {
    saveJSON(globalBansPath, data);
}

function isBotBanned(userId) {
    const bans = loadBotBans();
    return Boolean(bans[userId]);
}

function isGloballyBanned(userId) {
    const bans = loadGlobalBans();
    return Boolean(bans[userId]);
}

async function sendBanDM(user, {
    type,
    reason,
    bannedBy
}) {
    try {
        const isGlobal = type === "Global Ban";

        const embed = new EmbedBuilder()
            .setColor(isGlobal ? 0xED4245 : 0xFEE75C)
            .setTitle(
                isGlobal
                    ? "🌐 You have been globally banned"
                    : "🤖 You have been bot banned"
            )
            .setDescription(
                isGlobal
                    ? "You have been globally banned from servers using Atlas Utilities."
                    : "You have been banned from using Atlas Utilities."
            )
            .addFields(
                {
                    name: "📝 Reason",
                    value: reason || "No reason provided."
                },
                {
                    name: "🛡️ Banned By",
                    value: `${bannedBy}`
                }
            )
            .setTimestamp()
            .setFooter({
                text: "Atlas Utilities • Ban System"
            });

        await user.send({
            embeds: [embed]
        });

        return true;
    } catch {
        return false;
    }
}

async function sendBanLog(client, {
    type,
    target,
    reason,
    bannedBy,
    action = "Ban"
}) {
    try {
        const supportServerId =
            process.env.SUPPORT_SERVER_ID;

        const logChannelId =
            process.env.BAN_LOG_CHANNEL_ID;

        if (!supportServerId || !logChannelId) {
            console.log(
                "❌ SUPPORT_SERVER_ID or BAN_LOG_CHANNEL_ID is missing."
            );
            return;
        }

        const supportGuild =
            await client.guilds.fetch(supportServerId);

        if (!supportGuild) {
            console.log(
                "❌ Support server could not be found."
            );
            return;
        }

        const channel =
            await supportGuild.channels.fetch(
                logChannelId
            );

        if (!channel || !channel.isTextBased()) {
            console.log(
                "❌ Ban log channel could not be found."
            );
            return;
        }

        const isGlobal =
            type === "Global Ban";

        const embed = new EmbedBuilder()
            .setColor(
                action === "Unban"
                    ? 0x57F287
                    : isGlobal
                        ? 0xED4245
                        : 0xFEE75C
            )
            .setTitle(
                action === "Unban"
                    ? `✅ ${type} Removed`
                    : isGlobal
                        ? "🌐 Global Ban"
                        : "🤖 Bot Ban"
            )
            .addFields(
                {
                    name: "👤 User",
                    value: `${target}`,
                    inline: true
                },
                {
                    name: "🛡️ Moderator",
                    value: `${bannedBy}`,
                    inline: true
                },
                {
                    name: "📝 Reason",
                    value:
                        reason ||
                        "No reason provided.",
                    inline: false
                }
            )
            .setTimestamp()
            .setFooter({
                text: "Atlas Utilities • Ban Logs"
            });

        await channel.send({
            embeds: [embed]
        });

        console.log(
            `✅ ${type} log sent.`
        );
    } catch (error) {
        console.error(
            "❌ Failed to send ban log:",
            error
        );
    }
}

module.exports = {
    loadBotBans,
    saveBotBans,
    loadGlobalBans,
    saveGlobalBans,
    isBotBanned,
    isGloballyBanned,
    sendBanDM,
    sendBanLog
};