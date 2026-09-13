const {
    SlashCommandBuilder,
    ActivityType,
    EmbedBuilder
} = require("discord.js");

const STATUS_OWNER_ID = "1221055882515709975";

const activityTypes = {
    playing: ActivityType.Playing,
    listening: ActivityType.Listening,
    watching: ActivityType.Watching,
    competing: ActivityType.Competing,
    streaming: ActivityType.Streaming
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName("status")
        .setDescription("Change Atlas's Discord status.")
        .addStringOption(option =>
            option
                .setName("activity")
                .setDescription("The activity type.")
                .setRequired(true)
                .addChoices(
                    { name: "Playing", value: "playing" },
                    { name: "Listening to", value: "listening" },
                    { name: "Watching", value: "watching" },
                    { name: "Competing in", value: "competing" },
                    { name: "Streaming", value: "streaming" }
                )
        )
        .addStringOption(option =>
            option
                .setName("text")
                .setDescription("What Atlas should display.")
                .setRequired(true)
        ),

    async execute(interaction) {
        if (interaction.user.id !== STATUS_OWNER_ID) {
            return interaction.reply({
                content: "You don't have permission to use this command.",
                ephemeral: !interaction.isPrefixCommand
            });
        }

        const activity = interaction.options.getString("activity");
        const text = interaction.options.getString("text");

        if (!activity || !text) {
            return interaction.reply({
                content: "Usage: a!status <playing|listening|watching|competing|streaming> <text>",
                ephemeral: !interaction.isPrefixCommand
            });
        }

        const activityType = activityTypes[activity.toLowerCase()];

        if (activityType === undefined) {
            return interaction.reply({
                content: "Invalid activity type.",
                ephemeral: !interaction.isPrefixCommand
            });
        }

        interaction.client.user.setActivity(text, {
            type: activityType
        });

        const formattedActivity =
            activity.charAt(0).toUpperCase() +
            activity.slice(1);

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("Status Updated")
            .setDescription(
                "Atlas's status has been changed to:\n\n" +
                formattedActivity +
                " " +
                text
            )
            .setTimestamp()
            .setFooter({
                text: "Atlas Utilities"
            });

        await interaction.reply({
            embeds: [embed],
            ephemeral: !interaction.isPrefixCommand
        });
    }
};