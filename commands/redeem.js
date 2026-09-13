const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const {
    activateServerPremium
} = require("../utils/premium");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("redeem")
        .setDescription("Activate Atlas Premium for this server.")
        .addStringOption(option =>
            option
                .setName("code")
                .setDescription("Your Atlas Premium code.")
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content:
                    "❌ Premium can only be activated inside a server.",
                ephemeral: true
            });
        }

        const code =
            interaction.options.getString("code");

        const result =
            activateServerPremium(
                interaction.user.id,
                interaction.guild.id,
                interaction.guild.name,
                code
            );

        if (!result.success) {
            let message;

            if (result.error === "INVALID_CODE") {
                message =
                    "❌ That Premium code is invalid.";
            } else if (result.error === "NO_USES") {
                message =
                    "❌ That Premium code has no remaining uses.";
            } else if (
                result.error === "SERVER_ALREADY_PREMIUM"
            ) {
                message =
                    "💎 This server already has Atlas Premium activated.";
            } else {
                message =
                    "❌ This Premium code could not be redeemed.";
            }

            return interaction.reply({
                content: message,
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle("💎 Atlas Premium Activated!")
            .setDescription(
                `Atlas Premium has been activated for **${interaction.guild.name}**.`
            )
            .addFields(
                {
                    name: "🏠 Server",
                    value: interaction.guild.name,
                    inline: true
                },
                {
                    name: "👤 Activated By",
                    value: `${interaction.user}`,
                    inline: true
                },
                {
                    name: "🔢 Code Uses Remaining",
                    value: `${result.remainingUses}`,
                    inline: true
                },
                {
                    name: "✨ Premium Features",
                    value:
                        "• Server Name\n" +
                        "• Server Bio\n" +
                        "• Server Avatar\n" +
                        "• Server Banner\n" +
                        "• Priority Support"
                }
            )
            .setTimestamp()
            .setFooter({
                text: "Atlas Utilities • Premium"
            });

        await interaction.reply({
            embeds: [embed]
        });
    }
};