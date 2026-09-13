const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} = require("discord.js");

const {
    isServerPremium,
    getServerProfile,
    setServerProfile
} = require("../utils/premium");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("premiumprofile")
        .setDescription("Manage this server's Atlas Premium profile.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName("set")
                .setDescription("Set a Premium profile setting.")
                .addStringOption(option =>
                    option
                        .setName("setting")
                        .setDescription("The setting to change.")
                        .setRequired(true)
                        .addChoices(
                            {
                                name: "Name",
                                value: "name"
                            },
                            {
                                name: "Bio",
                                value: "bio"
                            },
                            {
                                name: "Avatar",
                                value: "avatar"
                            },
                            {
                                name: "Banner",
                                value: "banner"
                            }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName("value")
                        .setDescription("The new value.")
                        .setRequired(true)
                        .setMaxLength(1000)
                )
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName("view")
                .setDescription("View this server's Premium profile.")
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName("reset")
                .setDescription("Reset a Premium profile setting.")
                .addStringOption(option =>
                    option
                        .setName("setting")
                        .setDescription("The setting to reset.")
                        .setRequired(true)
                        .addChoices(
                            {
                                name: "Name",
                                value: "name"
                            },
                            {
                                name: "Bio",
                                value: "bio"
                            },
                            {
                                name: "Avatar",
                                value: "avatar"
                            },
                            {
                                name: "Banner",
                                value: "banner"
                            }
                        )
                )
        ),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content:
                    "❌ This command can only be used inside a server.",
                ephemeral: true
            });
        }

        const guildId = interaction.guild.id;

        /*
         * PREMIUM IS SERVER-BASED
         */
        if (!isServerPremium(guildId)) {
            return interaction.reply({
                content:
                    "💎 This server does not have Atlas Premium activated.\n\nUse `/redeem` to activate Premium for this server.",
                ephemeral: true
            });
        }

        const subcommand =
            interaction.options.getSubcommand();

        /*
         * SET
         */
        if (subcommand === "set") {
            const setting =
                interaction.options.getString("setting");

            const value =
                interaction.options.getString("value").trim();

            if (!value) {
                return interaction.reply({
                    content:
                        "❌ You must provide a value.",
                    ephemeral: true
                });
            }

            /*
             * Avatar and Banner must be URLs.
             */
            if (
                setting === "avatar" ||
                setting === "banner"
            ) {
                if (
                    !/^https?:\/\/.+/i.test(value)
                ) {
                    return interaction.reply({
                        content:
                            "❌ Avatar and Banner must be a valid HTTP/HTTPS image URL.",
                        ephemeral: true
                    });
                }
            }

            /*
             * Name has a shorter practical limit.
             */
            if (
                setting === "name" &&
                value.length > 80
            ) {
                return interaction.reply({
                    content:
                        "❌ The Premium profile name cannot be longer than 80 characters.",
                    ephemeral: true
                });
            }

            /*
             * Bio limit.
             */
            if (
                setting === "bio" &&
                value.length > 1000
            ) {
                return interaction.reply({
                    content:
                        "❌ The Premium profile bio cannot be longer than 1000 characters.",
                    ephemeral: true
                });
            }

            const profile =
                setServerProfile(
                    guildId,
                    {
                        [setting]: value
                    }
                );

            const settingNames = {
                name: "🏷️ Name",
                bio: "📝 Bio",
                avatar: "🖼️ Avatar",
                banner: "🎨 Banner"
            };

            const embed =
                new EmbedBuilder()
                    .setColor(0xFEE75C)
                    .setTitle(
                        "💎 Premium Profile Updated"
                    )
                    .setDescription(
                        `The Premium profile for **${interaction.guild.name}** has been updated.`
                    )
                    .addFields(
                        {
                            name: "Setting",
                            value:
                                settingNames[setting],
                            inline: true
                        },
                        {
                            name: "Value",
                            value:
                                value.length > 1024
                                    ? value.slice(0, 1021) + "..."
                                    : value,
                            inline: false
                        }
                    )
                    .setTimestamp()
                    .setFooter({
                        text:
                            "Atlas Utilities • Premium"
                    });

            if (profile.avatar) {
                embed.setThumbnail(
                    profile.avatar
                );
            }

            if (profile.banner) {
                embed.setImage(
                    profile.banner
                );
            }

            return interaction.reply({
                embeds: [embed]
            });
        }

        /*
         * VIEW
         */
        if (subcommand === "view") {
            const profile =
                getServerProfile(guildId);

            const embed =
                new EmbedBuilder()
                    .setColor(0xFEE75C)
                    .setTitle(
                        profile.name ||
                        `${interaction.guild.name} • Atlas Premium`
                    )
                    .setDescription(
                        profile.bio ||
                        "No Premium bio has been configured."
                    )
                    .addFields(
                        {
                            name: "🏠 Server",
                            value:
                                interaction.guild.name
                        },
                        {
                            name: "🏷️ Name",
                            value:
                                profile.name ||
                                "Not configured",
                            inline: true
                        },
                        {
                            name: "📝 Bio",
                            value:
                                profile.bio ||
                                "Not configured"
                        },
                        {
                            name: "🖼️ Avatar",
                            value:
                                profile.avatar
                                    ? "Configured"
                                    : "Not configured",
                            inline: true
                        },
                        {
                            name: "🎨 Banner",
                            value:
                                profile.banner
                                    ? "Configured"
                                    : "Not configured",
                            inline: true
                        }
                    )
                    .setTimestamp()
                    .setFooter({
                        text:
                            "Atlas Utilities • Premium"
                    });

            if (profile.avatar) {
                embed.setThumbnail(
                    profile.avatar
                );
            }

            if (profile.banner) {
                embed.setImage(
                    profile.banner
                );
            }

            return interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        }

        /*
         * RESET
         */
        if (subcommand === "reset") {
            const setting =
                interaction.options.getString("setting");

            setServerProfile(
                guildId,
                {
                    [setting]: null
                }
            );

            return interaction.reply({
                content:
                    `✅ The Premium **${setting}** setting has been reset.`,
                ephemeral: true
            });
        }
    }
};