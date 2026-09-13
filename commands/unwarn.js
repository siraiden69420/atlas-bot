const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const fs = require("fs");
const path = require("path");
const { logModeration } = require("../utils/logger");

const warningsPath = path.join(
    __dirname,
    "..",
    "data",
    "warnings.json"
);

function loadWarnings() {
    try {
        return JSON.parse(
            fs.readFileSync(warningsPath, "utf8")
        );
    } catch {
        return {};
    }
}

function saveWarnings(warnings) {
    fs.writeFileSync(
        warningsPath,
        JSON.stringify(warnings, null, 4)
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("unwarn")
        .setDescription("Remove a warning from a member.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers
        )
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The member.")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("number")
                .setDescription("The warning number to remove.")
                .setRequired(true)
                .setMinValue(1)
        ),

    async execute(interaction) {
        const user =
            interaction.options.getUser("user");

        const number =
            interaction.options.getInteger("number");

        const warnings = loadWarnings();

        const guildWarnings =
            warnings[interaction.guild.id];

        if (
            !guildWarnings ||
            !guildWarnings[user.id] ||
            guildWarnings[user.id].length < number
        ) {
            return interaction.reply({
                content:
                    "❌ That warning does not exist.",
                ephemeral: true
            });
        }

        const removedWarning =
            guildWarnings[user.id].splice(
                number - 1,
                1
            )[0];

        saveWarnings(warnings);

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle("✅ Warning Removed")
            .setDescription(
                `Warning **#${number}** has been removed from ${user}.`
            )
            .addFields(
                {
                    name: "📝 Original Reason",
                    value:
                        removedWarning.reason ||
                        "No reason provided.",
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
                action: "Warning Removed",
                target: `${user} (${user.tag})`,
                moderator: `${interaction.user} (${interaction.user.tag})`,
                reason:
                    `Removed warning #${number}: ${
                        removedWarning.reason ||
                        "No reason provided."
                    }`
            }
        );
    }
};