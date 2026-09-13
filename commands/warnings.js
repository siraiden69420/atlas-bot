const fs = require("fs");
const path = require("path");

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const warningsPath = path.join(__dirname, "..", "data", "warnings.json");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("warnings")
        .setDescription("View a member's warnings.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The member whose warnings you want to view.")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const user = interaction.options.getUser("user");

        let warnings = {};

        try {
            warnings = JSON.parse(
                fs.readFileSync(warningsPath, "utf8")
            );
        } catch (error) {
            console.error("Could not read warnings database:", error);
        }

        const guildWarnings =
            warnings[interaction.guild.id]?.[user.id] || [];

        if (guildWarnings.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle("✅ No Warnings")
                .setDescription(`**${user.tag}** has no warnings.`)
                .setThumbnail(user.displayAvatarURL())
                .setTimestamp();

            return interaction.reply({
                embeds: [embed]
            });
        }

        const warningList = guildWarnings
            .map((warning, index) => {
                const date = new Date(warning.timestamp).toLocaleString();

                return (
                    `**#${index + 1}** — ${warning.reason}\n` +
                    `**Moderator:** <@${warning.moderator}>\n` +
                    `**Date:** ${date}`
                );
            })
            .join("\n\n");

        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle(`⚠️ Warnings for ${user.tag}`)
            .setDescription(warningList)
            .setThumbnail(user.displayAvatarURL())
            .setFooter({
                text: `Total warnings: ${guildWarnings.length}`
            })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed]
        });
    },
};