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
        .setName("warn")
        .setDescription("Warn a member.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers
        )
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The member to warn.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("The reason for the warning.")
                .setRequired(true)
        ),

    async execute(interaction) {
        const user =
            interaction.options.getUser("user");

        const reason =
            interaction.options.getString("reason");

        const warnings = loadWarnings();

        if (!warnings[interaction.guild.id]) {
            warnings[interaction.guild.id] = {};
        }

        if (!warnings[interaction.guild.id][user.id]) {
            warnings[interaction.guild.id][user.id] = [];
        }

        warnings[interaction.guild.id][user.id].push({
            reason: reason,
            moderator: interaction.user.id,
            timestamp: new Date().toISOString()
        });

        saveWarnings(warnings);

        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle("⚠️ Member Warned")
            .setDescription(
                `${user} has been warned.`
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
                action: "Warning",
                target: `${user} (${user.tag})`,
                moderator: `${interaction.user} (${interaction.user.tag})`,
                reason: reason
            }
        );
    }
};