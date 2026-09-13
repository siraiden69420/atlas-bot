const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Show all available Atlas commands."),

    async execute(interaction) {
        const commands = interaction.client.commands;

        const commandList = commands
            .map(command => {
                const name = command.data.name;
                const description =
                    command.data.description ||
                    "No description provided.";

                return "**/" + name + "** — " + description;
            })
            .join("\n");

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("🤖 Atlas Utilities")
            .setDescription(
                "### Help & Commands\n\n" +
                "Here are all commands currently available in Atlas.\n\n" +
                commandList +
                "\n\n" +
                "### ⌨️ Prefix\n" +
                "The default prefix is **a!**\n" +
                "Example: **a!ping**"
            )
            .setFooter({
                text: "Atlas Utilities • Help"
            })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("Join Support Server")
                .setEmoji("💬")
                .setStyle(ButtonStyle.Link)
                .setURL("https://discord.gg/weYTNbs3j8")
        );

        await interaction.reply({
            embeds: [embed],
            components: [row]
        });
    }
};