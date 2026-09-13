const {
    SlashCommandBuilder
} = require("discord.js");

const OWNER_ID = "1221055882515709975";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("say")
        .setDescription("Make Atlas send a message.")
        .addStringOption(option =>
            option
                .setName("message")
                .setDescription("The message Atlas should send.")
                .setRequired(true)
                .setMaxLength(2000)
        ),

    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({
                content:
                    "❌ You don't have permission to use this command.",
                ephemeral: true
            });
        }

        const message =
            interaction.options.getString("message");

        await interaction.channel.send({
            content: message,
            allowedMentions: {
                parse: []
            }
        });

        await interaction.reply({
            content: "✅ Message sent.",
            ephemeral: true
        });
    }
};