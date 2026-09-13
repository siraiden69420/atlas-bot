const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const {
    getUserPremiumServers
} = require("../utils/premium");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("premiumcheck")
        .setDescription("Check Atlas Premium activations.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The user to check.")
                .setRequired(true)
        ),

    async execute(interaction) {
        const user =
            interaction.options.getUser("user");

        const servers =
            getUserPremiumServers(user.id);

        const embed = new EmbedBuilder()
            .setColor(
                servers.length > 0
                    ? 0xFEE75C
                    : 0x5865F2
            )
            .setTitle("💎 Atlas Premium Check")
            .setThumbnail(
                user.displayAvatarURL({
                    size: 256
                })
            )
            .addFields({
                name: "👤 User",
                value: `${user.tag}`,
                inline: true
            });

        if (servers.length === 0) {
            embed.addFields({
                name: "💎 Premium",
                value: "❌ No active Premium servers."
            });
        } else {
            const serverList = servers
                .map(
                    (server, index) =>
                        `**${index + 1}.** 🟢 ${server.guildName}`
                )
                .join("\n");

            embed.addFields(
                {
                    name: "💎 Premium",
                    value: "✅ Active"
                },
                {
                    name: `🏠 Activated Servers (${servers.length})`,
                    value: serverList
                }
            );
        }

        embed
            .setTimestamp()
            .setFooter({
                text: "Atlas Utilities • Premium"
            });

        await interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    }
};