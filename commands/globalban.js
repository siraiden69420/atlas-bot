const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const {
    loadGlobalBans,
    saveGlobalBans,
    sendBanDM,
    sendBanLog
} = require("../utils/banSystem");

const OWNER_ID = "1221055882515709975";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("globalban")
        .setDescription(
            "Globally ban a user from servers using Atlas."
        )
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The user to globally ban.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("The reason for the global ban.")
                .setRequired(false)
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

        const reason =
            interaction.options.getString("reason") ||
            "No reason provided.";

        const supportServerId =
            process.env.SUPPORT_SERVER_ID;

        const bans = loadGlobalBans();

        if (bans[user.id]) {
            return interaction.reply({
                content:
                    "❌ This user is already globally banned.",
                ephemeral: true
            });
        }

        /*
         * DM THE USER FIRST
         */
        const dmSent = await sendBanDM(user, {
            type: "Global Ban",
            reason,
            bannedBy: interaction.user.tag
        });

        /*
         * SAVE GLOBAL BAN
         */
        bans[user.id] = {
            reason,
            bannedBy: interaction.user.id,
            bannedAt: new Date().toISOString()
        };

        saveGlobalBans(bans);

        let bannedCount = 0;
        let failedCount = 0;

        /*
         * BAN FROM ALL SERVERS
         * EXCEPT SUPPORT SERVER
         */
        for (const guild of interaction.client.guilds.cache.values()) {
            if (guild.id === supportServerId) {
                continue;
            }

            try {
                const member =
                    await guild.members.fetch(user.id)
                        .catch(() => null);

                if (!member) {
                    continue;
                }

                if (!guild.members.me.permissions.has(
                    PermissionFlagsBits.BanMembers
                )) {
                    failedCount++;
                    continue;
                }

                await member.ban({
                    reason:
                        `Global Ban | ${reason}`
                });

                bannedCount++;
            } catch {
                failedCount++;
            }
        }

        /*
         * CENTRAL LOG
         */
        await sendBanLog(interaction.client, {
            type: "Global Ban",
            target: `${user.tag} (${user.id})`,
            reason,
            bannedBy: interaction.user.tag
        });

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("🌐 Global Ban")
            .setDescription(
                `**${user.tag}** has been globally banned.`
            )
            .addFields(
                {
                    name: "👤 User",
                    value: `${user.tag} (${user.id})`
                },
                {
                    name: "📝 Reason",
                    value: reason
                },
                {
                    name: "📨 DM",
                    value: dmSent
                        ? "✅ Sent"
                        : "❌ Could not send"
                },
                {
                    name: "🔨 Servers Banned",
                    value: `${bannedCount}`,
                    inline: true
                },
                {
                    name: "⚠️ Failed",
                    value: `${failedCount}`,
                    inline: true
                }
            )
            .setTimestamp()
            .setFooter({
                text: "Atlas Utilities • Global Ban"
            });

        await interaction.reply({
            embeds: [embed]
        });
    }
};