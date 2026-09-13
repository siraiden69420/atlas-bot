const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const {
    loadBotBans,
    saveBotBans,
    sendBanDM,
    sendBanLog
} = require("../utils/banSystem");

const OWNER_ID = "1221055882515709975";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("botban")
        .setDescription(
            "Ban a user from using Atlas."
        )
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The user to bot ban.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("The reason for the bot ban.")
                .setRequired(false)
        ),

    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({
                content:
                    "❌ You don't have permission to use this command.",
                ephemeral: true
            });
        }

        const user =
            interaction.options.getUser("user");

        const reason =
            interaction.options.getString("reason") ||
            "No reason provided.";

        const bans = loadBotBans();

        if (bans[user.id]) {
            return interaction.reply({
                content:
                    "❌ This user is already bot banned.",
                ephemeral: true
            });
        }

        /*
         * DM BEFORE BOT BAN
         */
        const dmSent = await sendBanDM(user, {
            type: "Bot Ban",
            reason,
            bannedBy: interaction.user.tag
        });

        bans[user.id] = {
            reason,
            bannedBy: interaction.user.id,
            bannedAt: new Date().toISOString()
        };

        saveBotBans(bans);

        await sendBanLog(interaction.client, {
            type: "Bot Ban",
            target: `${user.tag} (${user.id})`,
            reason,
            bannedBy: interaction.user.tag
        });

        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle("🤖 Bot Ban")
            .setDescription(
                `**${user.tag}** has been banned from using Atlas.`
            )
            .addFields(
                {
                    name: "👤 User",
                    value: `${user.tag} (${user.id})`
                },
                {
                    name: "📝 Reason",
                    value: reason
                },
                {
                    name: "📨 DM",
                    value: dmSent
                        ? "✅ Sent"
                        : "❌ Could not send"
                }
            )
            .setTimestamp()
            .setFooter({
                text: "Atlas Utilities • Bot Ban"
            });

        await interaction.reply({
            embeds: [embed]
        });
    }
};