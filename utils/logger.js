const fs = require("fs");
const path = require("path");
const { EmbedBuilder } = require("discord.js");

const configPath = path.join(
    __dirname,
    "..",
    "data",
    "config.json"
);

function loadConfig() {
    try {
        return JSON.parse(
            fs.readFileSync(configPath, "utf8")
        );
    } catch (error) {
        console.error("Logger config error:", error);
        return {};
    }
}

async function logModeration(guild, {
    action,
    target,
    moderator,
    reason
}) {
    try {
        const config = loadConfig();
        const logging = config[guild.id]?.logging;

        if (!logging) {
            console.log("❌ No logging configuration found.");
            return;
        }

        if (!logging.enabled) {
            console.log("❌ Logging is disabled.");
            return;
        }

        if (!logging.events?.includes("moderation")) {
            console.log("❌ Moderation logging is not enabled.");
            return;
        }

        if (!logging.channel) {
            console.log("❌ No logging channel configured.");
            return;
        }

        const channel =
            guild.channels.cache.get(logging.channel);

        if (!channel) {
            console.log("❌ Logging channel could not be found.");
            return;
        }

        if (!channel.isTextBased()) {
            console.log("❌ Logging channel is not a text channel.");
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle(`🛡️ Moderation Action — ${action}`)
            .addFields(
                {
                    name: "👤 Target",
                    value: `${target}`,
                    inline: true
                },
                {
                    name: "🛡️ Moderator",
                    value: `${moderator}`,
                    inline: true
                },
                {
                    name: "📝 Reason",
                    value: reason || "No reason provided.",
                    inline: false
                }
            )
            .setTimestamp()
            .setFooter({
                text: "Atlas Utilities • Moderation Logs"
            });

        await channel.send({
            embeds: [embed]
        });

        console.log(`✅ Moderation log sent: ${action}`);

    } catch (error) {
        console.error(
            "❌ Failed to send moderation log:",
            error
        );
    }
}

module.exports = {
    logModeration
};