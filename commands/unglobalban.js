const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const {
    loadGlobalBans,
    saveGlobalBans,
    sendBanLog
} = require("../utils/banSystem");

const OWNER_ID = "1221055882515709975";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("unglobalban")
        .setDescription(
            "Remove a user's global ban."
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

        const bans = loadGlobalBans();

        if (!bans[user.id]) {
            return interaction.reply({
                content:
                    "❌ This user is not globally banned.",
                ephemeral: true
            });
        }

        delete bans[user.id];

        saveGlobalBans(bans);

        let unbannedCount = 0;

        for (const guild of interaction.client.guilds.cache.values()) {
            if (
                guild.id ===
                process.env.SUPPORT_SERVER_ID
            ) {
                continue;
            }

            try {
                await guild.bans.remove(
                    user.id,
                    "Global Ban Removed"
                );

                unbannedCount++;
            } catch {
                // User was not banned or bot lacks permission.
            }
        }

        await sendBanLog(interaction.client, {
            type: "Global Ban",
            action: "Unban",
            target: `${user.tag} (${user.id})`,
            reason: "Global ban removed.",
            bannedBy: interaction.user.tag
        });

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle("✅ Global Ban Removed")
            .setDescription(
                `The global ban for **${user.tag}** has been removed.`
            )
            .addFields({
                name: "🔓 Servers Unbanned",
                value: `${unbannedCount}`
            })
            .setTimestamp()
            .setFooter({
                text: "Atlas Utilities • Global Ban"
            });

        await interaction.reply({
            embeds: [embed]
        });
    }
};