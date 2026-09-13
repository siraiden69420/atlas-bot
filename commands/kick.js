const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const { logModeration } = require("../utils/logger");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a member from the server.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.KickMembers
        )
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The member to kick.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("The reason for the kick.")
                .setRequired(false)
        ),

    async execute(interaction) {
        const user =
            interaction.options.getUser("user");

        const reason =
            interaction.options.getString("reason") ||
            "No reason provided.";

        const member =
            await interaction.guild.members.fetch(
                user.id
            ).catch(() => null);

        if (!member) {
            return interaction.reply({
                content:
                    "❌ That member could not be found.",
                ephemeral: true
            });
        }

        if (member.id === interaction.user.id) {
            return interaction.reply({
                content:
                    "❌ You cannot kick yourself.",
                ephemeral: true
            });
        }

        if (!member.kickable) {
            return interaction.reply({
                content:
                    "❌ I cannot kick this member. They may have a higher role than me.",
                ephemeral: true
            });
        }

        await member.kick(reason);

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("👢 Member Kicked")
            .setDescription(
                `${user} has been kicked from the server.`
            )
            .addFields(
                {
                    name: "📝 Reason",
                    value: reason,
                    inline: false
                },
                {
                    name: "🛡️ Moderator",
                    value: `${interaction.user}`,
                    inline: true
                }
            )
            .setTimestamp()
            .setFooter({
                text: "Atlas Utilities"
            });

        await interaction.reply({
            embeds: [embed]
        });

        await logModeration(
            interaction.guild,
            {
                action: "Kick",
                target: `${user} (${user.tag})`,
                moderator: `${interaction.user} (${interaction.user.tag})`,
                reason: reason
            }
        );
    }
};