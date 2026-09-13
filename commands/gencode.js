const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const {
    createPremiumCode
} = require("../utils/premium");

const OWNER_ID = "1221055882515709975";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("gencode")
        .setDescription("Generate an Atlas Premium code.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The user who will receive the code.")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("uses")
                .setDescription("How many times the code can be redeemed.")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(1000)
        ),

    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({
                content:
                    "❌ You don't have permission to use this command.",
                ephemeral: true
            });
        }

        const user =
            interaction.options.getUser("user");

        const uses =
            interaction.options.getInteger("uses");

        const code =
            createPremiumCode(user.id, uses);

        const dmEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("💎 Atlas Premium Code")
            .setDescription(
                "You have received an Atlas Premium code!"
            )
            .addFields(
                {
                    name: "🔑 Premium Code",
                    value: `\`${code}\``
                },
                {
                    name: "🔢 Available Uses",
                    value: `${uses}`
                },
                {
                    name: "🎟️ Redeem",
                    value: `Use \`a!redeem ${code}\``
                }
            )
            .setTimestamp()
            .setFooter({
                text: "Atlas Utilities • Premium"
            });

        let dmSent = true;

        try {
            await user.send({
                embeds: [dmEmbed]
            });
        } catch {
            dmSent = false;
        }

        const replyEmbed = new EmbedBuilder()
            .setColor(
                dmSent
                    ? 0x57F287
                    : 0xED4245
            )
            .setTitle("💎 Premium Code Generated")
            .setDescription(
                `A Premium code has been generated for **${user.tag}**.`
            )
            .addFields(
                {
                    name: "🔢 Uses",
                    value: `${uses}`,
                    inline: true
                },
                {
                    name: "📨 DM",
                    value: dmSent
                        ? "✅ Sent"
                        : "❌ Could not send",
                    inline: true
                }
            )
            .setTimestamp()
            .setFooter({
                text: "Atlas Utilities • Premium"
            });

        await interaction.reply({
            embeds: [replyEmbed],
            ephemeral: true
        });
    }
};