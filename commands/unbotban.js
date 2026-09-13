const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const {
    loadBotBans,
    saveBotBans,
    sendBanLog
} = require("../utils/banSystem");

const OWNER_ID = "1221055882515709975";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("unbotban")
        .setDescription(
            "Remove a user's Atlas bot ban."
        )
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The user to unban.")
                .setRequired(true)
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

        const bans = loadBotBans();

        if (!bans[user.id]) {
            return interaction.reply({
                content:
                    "❌ This user is not bot banned.",
                ephemeral: true
            });
        }

        delete bans[user.id];

        saveBotBans(bans);

        await sendBanLog(interaction.client, {
            type: "Bot Ban",
            action: "Unban",
            target: `${user.tag} (${user.id})`,
            reason: "Bot ban removed.",
            bannedBy: interaction.user.tag
        });

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle("✅ Bot Ban Removed")
            .setDescription(
                `**${user.tag}** can now use Atlas again.`
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