const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    PermissionFlagsBits
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setup")
        .setDescription("Configure Atlas for this server.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {
        await interaction.reply({
            embeds: [createMainEmbed()],
            components: [createMainMenu()]
        });
    }
};

function createMainEmbed() {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("⚙️ Atlas Setup")
        .setDescription(
            "Welcome to the **Atlas Setup Panel**!\n\n" +
            "Select a category below to configure Atlas."
        )
        .setFooter({
            text: "Atlas Utilities • Setup"
        })
        .setTimestamp();
}

function createMainMenu() {
    const menu = new StringSelectMenuBuilder()
        .setCustomId("atlas_setup")
        .setPlaceholder("Select a setup category...")
        .addOptions(
            {
                label: "Moderation",
                description: "Configure moderation features.",
                value: "moderation",
                emoji: "🛡️"
            },
            {
                label: "Logging",
                description: "Configure server logging.",
                value: "logging",
                emoji: "📋"
            },
            {
                label: "Welcome",
                description: "Configure welcome messages.",
                value: "welcome",
                emoji: "👋"
            },
            {
                label: "Tickets",
                description: "Configure the ticket system.",
                value: "tickets",
                emoji: "🎫"
            },
            {
                label: "AutoMod",
                description: "Configure automatic moderation.",
                value: "automod",
                emoji: "🤖"
            },
            {
                label: "Permissions",
                description: "Configure Atlas permissions.",
                value: "permissions",
                emoji: "🔐"
            }
        );

    return new ActionRowBuilder().addComponents(menu);
}

function createBackButton() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("atlas_setup_back")
            .setLabel("Back")
            .setEmoji("⬅️")
            .setStyle(ButtonStyle.Secondary)
    );
}

function createLoggingPanel() {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("📋 Logging Setup")
        .setDescription(
            "Configure Atlas's server logging system."
        )
        .addFields(
            {
                name: "📁 Log Channel",
                value: "Choose where Atlas sends logs.",
                inline: true
            },
            {
                name: "⚙️ Log Events",
                value: "Choose which events Atlas logs.",
                inline: true
            },
            {
                name: "🔘 Status",
                value: "Enable or disable logging.",
                inline: true
            }
        )
        .setFooter({
            text: "Atlas Utilities • Logging"
        })
        .setTimestamp();

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("atlas_logging_channel")
            .setLabel("Log Channel")
            .setEmoji("📁")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("atlas_logging_events")
            .setLabel("Log Events")
            .setEmoji("⚙️")
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId("atlas_logging_toggle")
            .setLabel("Enable / Disable")
            .setEmoji("🔘")
            .setStyle(ButtonStyle.Success)
    );

    return {
        embeds: [embed],
        components: [
            buttons,
            createBackButton()
        ]
    };
}

function createTicketsPanel() {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("🎫 Ticket Setup")
        .setDescription(
            "Configure Atlas's ticket system."
        )
        .addFields(
            {
                name: "📁 Ticket Category",
                value: "Choose where tickets are created.",
                inline: true
            },
            {
                name: "👮 Staff Role",
                value: "Choose who can manage tickets.",
                inline: true
            },
            {
                name: "📋 Ticket Log Channel",
                value: "Choose where ticket logs will be sent.",
                inline: true
            },
            {
                name: "🎨 Customize Panel",
                value: "Customize the public ticket panel.",
                inline: true
            },
            {
                name: "📋 Send Panel",
                value: "Send the ticket panel.",
                inline: true
            },
            {
                name: "🔘 Status",
                value: "Enable or disable tickets.",
                inline: true
            }
        )
        .setFooter({
            text: "Atlas Utilities • Tickets"
        })
        .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("atlas_ticket_category")
            .setLabel("Ticket Category")
            .setEmoji("📁")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("atlas_ticket_role")
            .setLabel("Staff Role")
            .setEmoji("👮")
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId("atlas_ticket_log_channel")
            .setLabel("Ticket Logs")
            .setEmoji("📋")
            .setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("atlas_ticket_customize")
            .setLabel("Customize Panel")
            .setEmoji("🎨")
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId("atlas_ticket_panel")
            .setLabel("Send Panel")
            .setEmoji("📨")
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId("atlas_ticket_toggle")
            .setLabel("Enable / Disable")
            .setEmoji("🔘")
            .setStyle(ButtonStyle.Secondary)
    );

    return {
        embeds: [embed],
        components: [
            row1,
            row2,
            createBackButton()
        ]
    };
}

function createSimplePanel(title, description, color) {
    return {
        embeds: [
            new EmbedBuilder()
                .setColor(color)
                .setTitle(title)
                .setDescription(description)
                .setFooter({
                    text: "Atlas Utilities • Setup"
                })
                .setTimestamp()
        ],
        components: [createBackButton()]
    };
}

module.exports.createMainEmbed = createMainEmbed;
module.exports.createMainMenu = createMainMenu;
module.exports.createLoggingPanel = createLoggingPanel;
module.exports.createTicketsPanel = createTicketsPanel;

module.exports.createModerationPanel = () =>
    createSimplePanel(
        "🛡️ Moderation Setup",
        "Moderation configuration will be added here.",
        0xED4245
    );

module.exports.createWelcomePanel = () =>
    createSimplePanel(
        "👋 Welcome Setup",
        "Welcome configuration will be added here.",
        0x57F287
    );

module.exports.createAutoModPanel = () =>
    createSimplePanel(
        "🤖 AutoMod Setup",
        "AutoMod configuration will be added here.",
        0xED4245
    );

module.exports.createPermissionsPanel = () =>
    createSimplePanel(
        "🔐 Permissions Setup",
        "Permission configuration will be added here.",
        0x9B59B6
    );