const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

const {
    setPrefix
} = require("../utils/prefix");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("prefix")
        .setDescription("Manage the server prefix.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("set")
                .setDescription("Change the bot prefix.")
                .addStringOption(option =>
                    option
                        .setName("prefix")
                        .setDescription("The new prefix.")
                        .setRequired(true)
                        .setMinLength(1)
                        .setMaxLength(10)
                )
        ),

    async execute(interaction) {
        const prefix =
            interaction.options.getString("prefix");

        if (
            prefix.includes(" ") ||
            prefix.includes("\n") ||
            prefix.includes("\r")
        ) {
            return interaction.reply({
                content:
                    "❌ The prefix cannot contain spaces or line breaks.",
                ephemeral: true
            });
        }

        setPrefix(
            interaction.guild.id,
            prefix
        );

        await interaction.reply({
            content:
                `✅ The server prefix has been changed to \`${prefix}\`.`
        });
    }
};