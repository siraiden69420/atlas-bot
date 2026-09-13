require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
    Client,
    GatewayIntentBits,
    Collection,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");

const setup = require("./commands/setup");
const { getPrefix } = require("./utils/prefix");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();

/* =========================================================
   DATA
========================================================= */

const DATA = path.join(__dirname, "data");
const CONFIG = path.join(DATA, "config.json");
const BOT_BANS = path.join(DATA, "botbans.json");
const GLOBAL_BANS = path.join(DATA, "globalbans.json");

function ensureFile(file) {
    if (!fs.existsSync(DATA)) {
        fs.mkdirSync(DATA, { recursive: true });
    }

    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, "{}");
    }
}

function read(file) {
    try {
        ensureFile(file);
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        return {};
    }
}

function write(file, data) {
    ensureFile(file);
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function guildConfig(id) {
    const data = read(CONFIG);

    if (!data[id]) {
        data[id] = defaults();
        write(CONFIG, data);
    }

    return data[id];
}

function updateGuild(id, fn) {
    const data = read(CONFIG);

    if (!data[id]) data[id] = defaults();

    fn(data[id]);
    write(CONFIG, data);

    return data[id];
}

function defaults() {
    return {
        premium: {
            enabled: false,
            plan: "free",
            expiresAt: null
        },

        serverProfile: {
            enabled: false,
            name: null,
            description: null,
            color: 0x5865F2,
            footer: "Atlas Utilities"
        },

        welcome: {
            enabled: false,
            channel: null,
            message:
                "Welcome {user} to **{server}**!\nYou are member #{membercount}.",
            dmEnabled: false,
            dmMessage: "Welcome to **{server}**!"
        },

        automod: {
            enabled: false,
            links: false,
            spam: false,
            words: [],
            maxMessages: 5,
            interval: 5000,
            timeout: 60000
        },

        logging: {
            enabled: false,
            channel: null,
            events: ["moderation"]
        },

        permissions: {
            enabled: false,
            adminRoles: [],
            moderatorRoles: [],
            supportRoles: []
        },

        tickets: {
            enabled: false,
            category: null,
            staffRole: null,
            logChannel: null,

            panels: {
                title: "🎫 Support Tickets",
                description:
                    "Need help from our staff team?\n\nClick the button below to create a private support ticket.",
                buttonText: "Create Ticket",
                buttonEmoji: "🎫",
                color: 0x5865F2
            },

            active: {}
        }
    };
}

/* =========================================================
   COMMAND LOADING
========================================================= */

const commandPath = path.join(__dirname, "commands");

if (fs.existsSync(commandPath)) {
    for (const file of fs.readdirSync(commandPath)) {
        if (!file.endsWith(".js")) continue;

        try {
            const command = require(path.join(commandPath, file));

            if (command.data && command.execute) {
                client.commands.set(
                    command.data.name,
                    command
                );

                console.log(
                    "✅ Loaded command:",
                    command.data.name
                );
            }
        } catch (error) {
            console.error(
                "❌ Failed to load:",
                file,
                error
            );
        }
    }
}

/* =========================================================
   PREMIUM
========================================================= */

function isPremium(guildId) {
    if (!guildId) return false;

    const envIds = String(
        process.env.PREMIUM_GUILD_IDS || ""
    )
        .split(",")
        .map(x => x.trim())
        .filter(Boolean);

    if (envIds.includes(guildId)) return true;

    const premium = guildConfig(guildId).premium;

    if (!premium?.enabled) return false;

    if (
        premium.expiresAt &&
        Date.now() > Number(premium.expiresAt)
    ) {
        return false;
    }

    return true;
}

/* =========================================================
   SERVER PROFILE
========================================================= */

function applyProfile(embed, guildId) {
    const profile = guildConfig(guildId).serverProfile;

    if (!profile?.enabled) return embed;

    if (profile.name) {
        embed.setAuthor({
            name: String(profile.name).slice(0, 256)
        });
    }

    if (
        profile.description &&
        !embed.data.description
    ) {
        embed.setDescription(
            String(profile.description).slice(0, 4096)
        );
    }

    if (Number.isInteger(profile.color)) {
        embed.setColor(profile.color);
    }

    if (profile.footer) {
        embed.setFooter({
            text: String(profile.footer).slice(0, 2048)
        });
    }

    return embed;
}

/* =========================================================
   ERROR LOGGING
========================================================= */

async function errorLog(error, info = {}) {
    try {
        const guild =
            info.guild ||
            null;

        const user =
            info.user ||
            null;

        const support =
            client.guilds.cache.get(
                process.env.SUPPORT_SERVER_ID
            );

        const channel =
            support?.channels.cache.get(
                process.env.ERROR_LOG_CHANNEL_ID
            );

        if (!channel?.isTextBased()) return;

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("🚨 Atlas Error")
            .addFields(
                {
                    name: "Type",
                    value: String(info.type || "Unknown"),
                    inline: true
                },
                {
                    name: "Server",
                    value: guild
                        ? guild.name + "\n" + guild.id
                        : "Unknown",
                    inline: true
                },
                {
                    name: "User",
                    value: user
                        ? (user.tag || user.username) +
                          "\n" +
                          user.id
                        : "Unknown",
                    inline: true
                },
                {
                    name: "Command",
                    value:
                        String(
                            info.command ||
                            "Unknown"
                        ).slice(0, 1024),
                    inline: false
                },
                {
                    name: "Error",
                    value:
                        "```text\n" +
                        String(
                            error?.stack ||
                            error?.message ||
                            error
                        ).slice(0, 3500) +
                        "\n```",
                    inline: false
                }
            )
            .setTimestamp()
            .setFooter({
                text: "Atlas Utilities • Error Logs"
            });

        await channel.send({
            embeds: [embed]
        });
    } catch {}
}

/* =========================================================
   ACCESS CONTROL
========================================================= */

function hasRole(member, roles) {
    return Array.isArray(roles) &&
        roles.some(id =>
            member?.roles?.cache.has(id)
        );
}

function hasPermission(interaction, command) {
    if (
        !interaction.guild ||
        !interaction.member
    ) {
        return true;
    }

    if (
        interaction.member.permissions.has(
            PermissionFlagsBits.Administrator
        )
    ) {
        return true;
    }

    const permissions =
        guildConfig(
            interaction.guild.id
        ).permissions;

    if (!permissions.enabled) return true;

    const required =
        command.requiredPermission ||
        command.permission;

    if (!required) return true;

    if (
        typeof required === "bigint" &&
        interaction.member.permissions.has(required)
    ) {
        return true;
    }

    if (required === "ADMIN") {
        return hasRole(
            interaction.member,
            permissions.adminRoles
        );
    }

    if (required === "MODERATOR") {
        return hasRole(
            interaction.member,
            permissions.moderatorRoles
        );
    }

    if (required === "SUPPORT") {
        return hasRole(
            interaction.member,
            permissions.supportRoles
        );
    }

    return false;
}

function commandAccess(interaction, command) {
    if (
        command.premium &&
        !isPremium(interaction.guild?.id)
    ) {
        return {
            allowed: false,
            message:
                "💎 This command requires Atlas Premium."
        };
    }

    if (!hasPermission(interaction, command)) {
        return {
            allowed: false,
            message:
                "❌ You do not have permission to use this command."
        };
    }

    return { allowed: true };
}

/* =========================================================
   PREFIX SUPPORT
========================================================= */

function resolveUser(guild, value) {
    if (!value) return null;

    const id = String(value).replace(
        /[<@!>]/g,
        ""
    );

    return guild.members.cache.get(id) || null;
}

function resolveChannel(guild, value) {
    if (!value) return null;

    const id = String(value).replace(
        /[<#>]/g,
        ""
    );

    return guild.channels.cache.get(id) || null;
}

function resolveRole(guild, value) {
    if (!value) return null;

    const id = String(value).replace(
        /[<@&>]/g,
        ""
    );

    return guild.roles.cache.get(id) || null;
}

function prefixInteraction(message, command, args) {
    const values = [...args];

    function value(name, fallback = 0) {
        const index =
            command.prefixOptions?.indexOf(name);

        return index >= 0
            ? values[index]
            : values[fallback];
    }

    return {
        ...message,
        id: message.id,
        user: message.author,
        author: message.author,
        guild: message.guild,
        guildId: message.guild.id,
        channel: message.channel,
        channelId: message.channel.id,
        member: message.member,
        client,
        commandName: command.data.name,
        replied: false,
        deferred: false,
        isPrefixCommand: true,

        isRepliable: () => true,

        reply: payload => {
            this.replied = true;
            return message.reply(payload);
        },

        followUp: payload =>
            message.channel.send(payload),

        deferReply: async function () {
            this.deferred = true;
        },

        editReply: payload =>
            message.reply(payload),

        options: {
            getString(name) {
                const v = value(name);
                return v == null
                    ? null
                    : String(v);
            },

            getInteger(name) {
                const n = Number(value(name));
                return Number.isNaN(n)
                    ? null
                    : n;
            },

            getNumber(name) {
                const n = Number(value(name));
                return Number.isNaN(n)
                    ? null
                    : n;
            },

            getBoolean(name) {
                return [
                    "true",
                    "yes",
                    "on",
                    "1"
                ].includes(
                    String(value(name)).toLowerCase()
                );
            },

            getUser(name) {
                return (
                    resolveUser(
                        message.guild,
                        value(name)
                    )?.user || null
                );
            },

            getMember(name) {
                return resolveUser(
                    message.guild,
                    value(name)
                );
            },

            getChannel(name) {
                return resolveChannel(
                    message.guild,
                    value(name)
                );
            },

            getRole(name) {
                return resolveRole(
                    message.guild,
                    value(name)
                );
            }
        }
    };
}

/* =========================================================
   WELCOME
========================================================= */

function placeholders(text, member) {
    return String(text || "")
        .replaceAll("{user}", String(member))
        .replaceAll(
            "{username}",
            member.user.username
        )
        .replaceAll(
            "{userid}",
            member.user.id
        )
        .replaceAll(
            "{server}",
            member.guild.name
        )
        .replaceAll(
            "{serverid}",
            member.guild.id
        )
        .replaceAll(
            "{membercount}",
            String(member.guild.memberCount)
        );
}

async function welcome(member) {
    const config =
        guildConfig(member.guild.id);

    const w = config.welcome;

    if (!w.enabled || !w.channel) return;

    const channel =
        member.guild.channels.cache.get(
            w.channel
        );

    if (!channel?.isTextBased()) return;

    const embed = applyProfile(
        new EmbedBuilder()
            .setColor(
                config.serverProfile?.color ||
                0x5865F2
            )
            .setDescription(
                placeholders(w.message, member)
            )
            .setThumbnail(
                member.user.displayAvatarURL()
            )
            .setTimestamp(),
        member.guild.id
    );

    await channel.send({
        embeds: [embed]
    });

    if (w.dmEnabled) {
        try {
            await member.send(
                placeholders(
                    w.dmMessage,
                    member
                )
            );
        } catch {}
    }
}

/* =========================================================
   AUTOMOD
========================================================= */

const spam = new Map();

function hasLink(text) {
    return /(https?:\/\/|www\.|discord\.gg\/|discord\.com\/invite\/)/i.test(
        text
    );
}

async function autoMod(message) {
    const config =
        guildConfig(message.guild.id);

    const a = config.automod;

    if (!a.enabled || message.author.bot) {
        return false;
    }

    if (
        message.member?.permissions.has(
            PermissionFlagsBits.ManageMessages
        )
    ) {
        return false;
    }

    let reason = null;

    if (a.links && hasLink(message.content)) {
        reason = "Links are not allowed.";
    }

    if (
        !reason &&
        Array.isArray(a.words) &&
        a.words.some(word =>
            word &&
            message.content
                .toLowerCase()
                .includes(
                    String(word).toLowerCase()
                )
        )
    ) {
        reason =
            "That message contains a blocked word.";
    }

    if (!reason && a.spam) {
        const key =
            message.guild.id +
            ":" +
            message.author.id;

        const now = Date.now();

        let entries =
            spam.get(key) || [];

        entries = entries.filter(
            t =>
                now - t <
                Number(a.interval || 5000)
        );

        entries.push(now);
        spam.set(key, entries);

        if (
            entries.length >=
            Number(a.maxMessages || 5)
        ) {
            reason =
                "Please slow down — spam protection was triggered.";

            spam.delete(key);
        }
    }

    if (!reason) return false;

    try {
        await message.delete().catch(() => {});

        const warning =
            await message.channel.send({
                content:
                    "⚠️ " +
                    message.author +
                    ", " +
                    reason
            });

        setTimeout(
            () => warning.delete().catch(() => {}),
            5000
        );

        if (
            a.timeout &&
            message.member?.moderatable &&
            reason.includes("spam")
        ) {
            await message.member
                .timeout(
                    Number(a.timeout),
                    "Atlas AutoMod"
                )
                .catch(() => {});
        }

        return true;
    } catch (error) {
        await errorLog(error, {
            type: "AutoMod",
            guild: message.guild,
            user: message.author
        });

        return false;
    }
}

/* =========================================================
   TICKET HELPERS
========================================================= */

function tickets(guildId) {
    return guildConfig(guildId).tickets;
}

function saveTickets(guildId, data) {
    updateGuild(guildId, g => {
        g.tickets = data;
    });
}

function staff(guild) {
    const roleId =
        tickets(guild.id).staffRole;

    return roleId
        ? guild.roles.cache.get(roleId)
        : null;
}

function isStaff(member) {
    const role = staff(member.guild);

    return Boolean(
        role &&
        member.roles.cache.has(role.id)
    ) ||
    member.permissions.has(
        PermissionFlagsBits.Administrator
    );
}

function ticketButtons(ticket) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(
                    "atlas_ticket_claim"
                )
                .setLabel(
                    ticket.claimedBy
                        ? "Claimed"
                        : "Claim"
                )
                .setStyle(
                    ButtonStyle.Success
                )
                .setDisabled(
                    Boolean(ticket.claimedBy)
                ),

            new ButtonBuilder()
                .setCustomId(
                    "atlas_ticket_unclaim"
                )
                .setLabel("Unclaim")
                .setStyle(
                    ButtonStyle.Secondary
                ),

            new ButtonBuilder()
                .setCustomId(
                    "atlas_ticket_close"
                )
                .setLabel("Close")
                .setStyle(
                    ButtonStyle.Danger
                )
        );
}

function closedButtons() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(
                    "atlas_ticket_delete"
                )
                .setLabel("Delete Ticket")
                .setStyle(
                    ButtonStyle.Danger
                )
        );
}

/* =========================================================
   READY
========================================================= */

client.once("ready", () => {
    console.log(
        "========================================"
    );

    console.log(
        "✅ Logged in as " +
        client.user.tag
    );

    console.log(
        "📡 Servers: " +
        client.guilds.cache.size
    );

    console.log(
        "⚙️ Commands: " +
        client.commands.size
    );

    console.log(
        "⌨️ Prefix: ENABLED"
    );

    console.log(
        "🎫 Tickets: ENABLED"
    );

    console.log(
        "🛡️ AutoMod: ENABLED"
    );

    console.log(
        "👋 Welcome: ENABLED"
    );

    console.log(
        "========================================"
    );
});

/* =========================================================
   MEMBER JOIN
========================================================= */

client.on("guildMemberAdd", async member => {
    try {
        const globalBans =
            read(GLOBAL_BANS);

        if (
            member.guild.id !==
                process.env.SUPPORT_SERVER_ID &&
            globalBans[member.user.id]
        ) {
            const bot =
                member.guild.members.me;

            if (
                bot?.permissions.has(
                    PermissionFlagsBits.BanMembers
                )
            ) {
                const data =
                    globalBans[
                        member.user.id
                    ];

                const reason =
                    typeof data === "object"
                        ? data.reason ||
                          "No reason provided."
                        : "Atlas Global Ban";

                try {
                    await member.send(
                        "🌐 You have been globally banned from servers using Atlas Utilities.\n\nReason: " +
                        reason
                    );
                } catch {}

                await member.ban({
                    reason:
                        "Atlas Global Ban: " +
                        String(reason).slice(0, 400)
                });

                return;
            }
        }

        await welcome(member);
    } catch (error) {
        await errorLog(error, {
            type: "Member Join",
            guild: member.guild,
            user: member.user
        });
    }
});

/* =========================================================
   PREFIX COMMANDS
========================================================= */

client.on("messageCreate", async message => {
    try {
        if (
            message.author.bot ||
            !message.guild
        ) {
            return;
        }

        if (await autoMod(message)) {
            return;
        }

        if (
            read(BOT_BANS)[
                message.author.id
            ]
        ) {
            return;
        }

        const configured =
            getPrefix(message.guild.id);

        const prefix =
            message.content.startsWith(
                configured || "a!"
            )
                ? configured || "a!"
                : message.content.startsWith("a!")
                    ? "a!"
                    : null;

        if (!prefix) return;

        const content =
            message.content
                .slice(prefix.length)
                .trim();

        if (!content) return;

        const args =
            content.split(/\s+/);

        const name =
            args.shift().toLowerCase();

        const command =
            client.commands.get(name);

        if (!command) return;

        const fake =
            prefixInteraction(
                message,
                command,
                args
            );

        const access =
            commandAccess(
                fake,
                command
            );

        if (!access.allowed) {
            return message.reply({
                content: access.message
            });
        }

        await command.execute(fake);
    } catch (error) {
        console.error(
            "❌ Prefix error:",
            error
        );

        await errorLog(error, {
            type: "Prefix Command",
            guild: message.guild,
            user: message.author,
            command: message.content
        });
    }
});

```js
/* =========================================================
   INTERACTIONS
========================================================= */

client.on("interactionCreate", async interaction => {
    try {
        /* =====================================================
           BOT BAN CHECK
        ===================================================== */

        if (
            interaction.user &&
            read(BOT_BANS)[interaction.user.id]
        ) {
            if (interaction.isRepliable()) {
                return interaction.reply({
                    content:
                        "🚫 You are banned from using Atlas.",
                    ephemeral: true
                });
            }

            return;
        }

        /* =====================================================
           SLASH COMMANDS
        ===================================================== */

        if (interaction.isChatInputCommand()) {
            const command =
                client.commands.get(
                    interaction.commandName
                );

            if (!command) return;

            const access =
                commandAccess(
                    interaction,
                    command
                );

            if (!access.allowed) {
                return interaction.reply({
                    content: access.message,
                    ephemeral: true
                });
            }

            return command.execute(interaction);
        }

        /* =====================================================
           SETUP ACCESS
        ===================================================== */

        const setupIds = [
            "atlas_setup",
            "atlas_setup_back",

            "atlas_moderation_toggle",
            "atlas_moderation_channel",
            "atlas_moderation_role",

            "atlas_logging_toggle",
            "atlas_logging_channel",
            "atlas_logging_events",

            "atlas_welcome_toggle",
            "atlas_welcome_channel",
            "atlas_welcome_message",

            "atlas_ticket_toggle",
            "atlas_ticket_category",
            "atlas_ticket_role",
            "atlas_ticket_log_channel",
            "atlas_ticket_customize",
            "atlas_ticket_panel",

            "atlas_automod_toggle",
            "atlas_automod_links",
            "atlas_automod_spam",
            "atlas_automod_words",

            "atlas_permissions_role",
            "atlas_permissions_reset"
        ];

        const isSetupInteraction =
            setupIds.includes(interaction.customId) ||
            interaction.customId?.startsWith(
                "atlas_setup_"
            ) ||
            interaction.customId?.startsWith(
                "atlas_select_"
            );

        if (isSetupInteraction) {
            if (!interaction.guild) {
                return interaction.reply({
                    content:
                        "❌ Setup can only be used inside a server.",
                    ephemeral: true
                });
            }

            if (
                !interaction.memberPermissions?.has(
                    PermissionFlagsBits.Administrator
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ You need Administrator permission to configure Atlas.",
                    ephemeral: true
                });
            }
        }

        /* =====================================================
           SETUP MAIN MENU
        ===================================================== */

        if (
            interaction.isStringSelectMenu() &&
            interaction.customId === "atlas_setup"
        ) {
            const selected =
                interaction.values[0];

            const guild =
                interaction.guild;

            const config =
                guildConfig(guild.id);

            function setupEmbed(
                title,
                description,
                color = 0x5865F2
            ) {
                return new EmbedBuilder()
                    .setColor(color)
                    .setTitle(title)
                    .setDescription(description)
                    .setFooter({
                        text:
                            "Atlas Utilities • Server Setup"
                    })
                    .setTimestamp();
            }

            function backButton() {
                return new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(
                                "atlas_setup_back"
                            )
                            .setLabel("Back")
                            .setEmoji("⬅️")
                            .setStyle(
                                ButtonStyle.Secondary
                            )
                    );
            }

            /* ---------------------------------------------
               MODERATION
            --------------------------------------------- */

            if (selected === "moderation") {
                const m = config.moderation || {};

                const status = m.enabled
                    ? "🟢 Enabled"
                    : "🔴 Disabled";

                const logChannel = m.logChannel
                    ? "<#" + m.logChannel + ">"
                    : "Not configured";

                const moderatorRole = m.role
                    ? "<@&" + m.role + ">"
                    : "Not configured";

                const embed = setupEmbed(
                    "🛡️ Moderation Setup",
                    [
                        "**Status:** " + status,
                        "",
                        "**Log Channel:** " + logChannel,
                        "**Moderator Role:** " + moderatorRole
                    ].join("\n"),
                    0xED4245
                );

                const row =
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(
                                    "atlas_moderation_toggle"
                                )
                                .setLabel(
                                    m.enabled
                                        ? "Disable"
                                        : "Enable"
                                )
                                .setEmoji("🛡️")
                                .setStyle(
                                    m.enabled
                                        ? ButtonStyle.Danger
                                        : ButtonStyle.Success
                                ),

                            new ButtonBuilder()
                                .setCustomId(
                                    "atlas_moderation_channel"
                                )
                                .setLabel(
                                    "Log Channel"
                                )
                                .setEmoji("📋")
                                .setStyle(
                                    ButtonStyle.Primary
                                ),

                            new ButtonBuilder()
                                .setCustomId(
                                    "atlas_moderation_role"
                                )
                                .setLabel(
                                    "Moderator Role"
                                )
                                .setEmoji("👮")
                                .setStyle(
                                    ButtonStyle.Secondary
                                )
                        );

                return interaction.update({
                    embeds: [embed],
                    components: [
                        row,
                        backButton()
                    ]
                });
            }
            /* ---------------------------------------------
               LOGGING
            --------------------------------------------- */

            if (selected === "logging") {
                const l = config.logging || {};

                const status = l.enabled
                    ? "🟢 Enabled"
                    : "🔴 Disabled";

                const channel = l.channel
                    ? "<#" + l.channel + ">"
                    : "Not configured";

                const events = Array.isArray(l.events) && l.events.length
                    ? l.events.join(", ")
                    : "None";

                const embed = setupEmbed(
                    "📋 Logging Setup",
                    [
                        "**Status:** " + status,
                        "",
                        "**Channel:** " + channel,
                        "",
                        "**Events:** " + events
                    ].join("\n")
                );

                const row =
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(
                                    "atlas_logging_toggle"
                                )
                                .setLabel(
                                    l.enabled
                                        ? "Disable"
                                        : "Enable"
                                )
                                .setEmoji("📋")
                                .setStyle(
                                    l.enabled
                                        ? ButtonStyle.Danger
                                        : ButtonStyle.Success
                                ),

                            new ButtonBuilder()
                                .setCustomId(
                                    "atlas_logging_channel"
                                )
                                .setLabel(
                                    "Log Channel"
                                )
                                .setEmoji("📁")
                                .setStyle(
                                    ButtonStyle.Primary
                                ),

                            new ButtonBuilder()
                                .setCustomId(
                                    "atlas_logging_events"
                                )
                                .setLabel(
                                    "Events"
                                )
                                .setEmoji("⚙️")
                                .setStyle(
                                    ButtonStyle.Secondary
                                )
                        );

                return interaction.update({
                    embeds: [embed],
                    components: [
                        row,
                        backButton()
                    ]
                });
            }

            /* ---------------------------------------------
               WELCOME
            --------------------------------------------- */

            if (selected === "welcome") {
                const w = config.welcome || {};

                const status = w.enabled
                    ? "🟢 Enabled"
                    : "🔴 Disabled";

                const channel = w.channel
                    ? "<#" + w.channel + ">"
                    : "Not configured";

                const message = w.message || "No message configured.";

                const embed = setupEmbed(
                    "👋 Welcome Setup",
                    [
                        "**Status:** " + status,
                        "",
                        "**Channel:** " + channel,
                        "",
                        "**Current Message:**",
                        message
                    ].join("\n"),
                    0x57F287
                );

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId("atlas_welcome_toggle")
                            .setLabel(
                                w.enabled
                                    ? "Disable"
                                    : "Enable"
                            )
                            .setEmoji("👋")
                            .setStyle(
                                w.enabled
                                    ? ButtonStyle.Danger
                                    : ButtonStyle.Success
                            ),

                        new ButtonBuilder()
                            .setCustomId("atlas_welcome_channel")
                            .setLabel("Channel")
                            .setEmoji("📁")
                            .setStyle(ButtonStyle.Primary),

                        new ButtonBuilder()
                            .setCustomId("atlas_welcome_message")
                            .setLabel("Message")
                            .setEmoji("💬")
                            .setStyle(ButtonStyle.Secondary)
                    );

                return interaction.update({
                    embeds: [embed],
                    components: [
                        row,
                        backButton()
                    ]
                });
            }

            /* ---------------------------------------------
               TICKETS
            --------------------------------------------- */

            if (selected === "tickets") {
                const t = config.tickets || {};

                const status = t.enabled
                    ? "🟢 Enabled"
                    : "🔴 Disabled";

                const category = t.category
                    ? "<#" + t.category + ">"
                    : "Not configured";

                const staffRole = t.staffRole
                    ? "<@&" + t.staffRole + ">"
                    : "Not configured";

                const logChannel = t.logChannel
                    ? "<#" + t.logChannel + ">"
                    : "Not configured";

                const panelStatus = t.panel?.channel
                    ? "🟢 Sent"
                    : "⚪ Not sent";

                const embed = setupEmbed(
                    "🎫 Ticket Setup",
                    [
                        "**Status:** " + status,
                        "",
                        "**Category:** " + category,
                        "**Staff Role:** " + staffRole,
                        "**Log Channel:** " + logChannel,
                        "",
                        "**Ticket Panel:** " + panelStatus
                    ].join("\n"),
                    0x5865F2
                );

                const row1 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId("atlas_ticket_toggle")
                            .setLabel(
                                t.enabled
                                    ? "Disable"
                                    : "Enable"
                            )
                            .setEmoji("🎫")
                            .setStyle(
                                t.enabled
                                    ? ButtonStyle.Danger
                                    : ButtonStyle.Success
                            ),

                        new ButtonBuilder()
                            .setCustomId("atlas_ticket_category")
                            .setLabel("Category")
                            .setEmoji("📁")
                            .setStyle(ButtonStyle.Primary),

                        new ButtonBuilder()
                            .setCustomId("atlas_ticket_role")
                            .setLabel("Staff Role")
                            .setEmoji("👮")
                            .setStyle(ButtonStyle.Primary)
                    );

                const row2 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId("atlas_ticket_log_channel")
                            .setLabel("Log Channel")
                            .setEmoji("📋")
                            .setStyle(ButtonStyle.Secondary),

                        new ButtonBuilder()
                            .setCustomId("atlas_ticket_customize")
                            .setLabel("Customize")
                            .setEmoji("🎨")
                            .setStyle(ButtonStyle.Secondary),

                        new ButtonBuilder()
                            .setCustomId("atlas_ticket_panel")
                            .setLabel("Send Panel")
                            .setEmoji("📨")
                            .setStyle(ButtonStyle.Success)
                    );

                return interaction.update({
                    embeds: [embed],
                    components: [
                        row1,
                        row2,
                        backButton()
                    ]
                });
            }

            /* ---------------------------------------------
               AUTOMOD
            --------------------------------------------- */

            if (selected === "automod") {
                const a = config.automod || {};

                const status = a.enabled
                    ? "🟢 Enabled"
                    : "🔴 Disabled";

                const links = a.links
                    ? "🟢 Enabled"
                    : "🔴 Disabled";

                const spam = a.spam
                    ? "🟢 Enabled"
                    : "🔴 Disabled";

                const words = Array.isArray(a.words) && a.words.length
                    ? "🟢 " + a.words.length + " words"
                    : "🔴 Disabled";

                const embed = setupEmbed(
                    "🤖 AutoMod Setup",
                    [
                        "**Status:** " + status,
                        "",
                        "**Anti-Links:** " + links,
                        "**Anti-Spam:** " + spam,
                        "**Word Filter:** " + words
                    ].join("\n"),
                    0xED4245
                );

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId("atlas_automod_toggle")
                            .setLabel(
                                a.enabled
                                    ? "Disable"
                                    : "Enable"
                            )
                            .setEmoji("🤖")
                            .setStyle(
                                a.enabled
                                    ? ButtonStyle.Danger
                                    : ButtonStyle.Success
                            ),

                        new ButtonBuilder()
                            .setCustomId("atlas_automod_links")
                            .setLabel("Anti-Links")
                            .setEmoji("🔗")
                            .setStyle(
                                a.links
                                    ? ButtonStyle.Success
                                    : ButtonStyle.Secondary
                            ),

                        new ButtonBuilder()
                            .setCustomId("atlas_automod_spam")
                            .setLabel("Anti-Spam")
                            .setEmoji("📢")
                            .setStyle(
                                a.spam
                                    ? ButtonStyle.Success
                                    : ButtonStyle.Secondary
                            ),

                        new ButtonBuilder()
                            .setCustomId("atlas_automod_words")
                            .setLabel("Words")
                            .setEmoji("🚫")
                            .setStyle(ButtonStyle.Secondary)
                    );

                return interaction.update({
                    embeds: [embed],
                    components: [
                        row,
                        backButton()
                    ]
                });
            }

            /* ---------------------------------------------
               PERMISSIONS
            --------------------------------------------- */

            if (selected === "permissions") {
                const p = config.permissions || {};

                const adminRoles = p.adminRoles?.length
                    ? p.adminRoles
                        .map(id => "<@&" + id + ">")
                        .join(", ")
                    : "None";

                const moderatorRoles = p.moderatorRoles?.length
                    ? p.moderatorRoles
                        .map(id => "<@&" + id + ">")
                        .join(", ")
                    : "None";

                const supportRoles = p.supportRoles?.length
                    ? p.supportRoles
                        .map(id => "<@&" + id + ">")
                        .join(", ")
                    : "None";

                const customPermissions = p.enabled
                    ? "🟢 Enabled"
                    : "⚪ Disabled";

                const embed = setupEmbed(
                    "🔐 Permissions Setup",
                    [
                        "**Custom Permissions:** " + customPermissions,
                        "",
                        "**Admin Roles:** " + adminRoles,
                        "**Moderator Roles:** " + moderatorRoles,
                        "**Support Roles:** " + supportRoles
                    ].join("\n"),
                    0x9B59B6
                );

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId("atlas_permissions_role")
                            .setLabel("Configure Roles")
                            .setEmoji("👮")
                            .setStyle(ButtonStyle.Primary),

                        new ButtonBuilder()
                            .setCustomId("atlas_permissions_reset")
                            .setLabel("Reset")
                            .setEmoji("♻️")
                            .setStyle(ButtonStyle.Danger)
                    );

                return interaction.update({
                    embeds: [embed],
                    components: [
                        row,
                        backButton()
                    ]
                });
            }

        /* =====================================================
           SETUP BACK
        ===================================================== */

        if (
            interaction.isButton() &&
            interaction.customId ===
                "atlas_setup_back"
        ) {
            return interaction.update({
                embeds: [
                    setup.createMainEmbed(
                        interaction.guild.id,
                        interaction.guild.name
                    )
                ],
                components: [
                    setup.createMainMenu()
                ]
            });
        }

        /* =====================================================
           MODERATION
        ===================================================== */

        if (
            interaction.isButton() &&
            interaction.customId ===
                "atlas_moderation_toggle"
        ) {
            let enabled;

            updateGuild(
                interaction.guild.id,
                g => {
                    if (!g.moderation) {
                        g.moderation = {
                            enabled: false,
                            logChannel: null,
                            role: null
                        };
                    }

                    g.moderation.enabled =
                        !g.moderation.enabled;

                    enabled =
                        g.moderation.enabled;
                }
            );

            return interaction.reply({
                content:
                    enabled
                        ? "🟢 Moderation enabled."
                        : "🔴 Moderation disabled.",
                ephemeral: true
            });
        }

        if (
            interaction.isButton() &&
            interaction.customId ===
                "atlas_moderation_channel"
        ) {
            return interaction.reply({
                content:
                    "📋 Select the moderation log channel.",
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new ChannelSelectMenuBuilder()
                                .setCustomId(
                                    "atlas_select_mod_channel"
                                )
                                .setPlaceholder(
                                    "Select a channel..."
                                )
                                .setChannelTypes(
                                    ChannelType.GuildText
                                )
                        )
                ],
                ephemeral: true
            });
        }

        if (
            interaction.isChannelSelectMenu() &&
            interaction.customId ===
                "atlas_select_mod_channel"
        ) {
            const channel =
                interaction.channels.first();

            updateGuild(
                interaction.guild.id,
                g => {
                    if (!g.moderation) {
                        g.moderation = {};
                    }

                    g.moderation.logChannel =
                        channel.id;
                }
            );

            return interaction.update({
                content:
                    `✅ Moderation log channel set to ${channel}.`,
                components: []
            });
        }

        if (
            interaction.isButton() &&
            interaction.customId ===
                "atlas_moderation_role"
        ) {
            return interaction.reply({
                content:
                    "👮 Select the moderator role.",
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new RoleSelectMenuBuilder()
                                .setCustomId(
                                    "atlas_select_mod_role"
                                )
                                .setPlaceholder(
                                    "Select moderator role..."
                                )
                        )
                ],
                ephemeral: true
            });
        }

        if (
            interaction.isRoleSelectMenu() &&
            interaction.customId ===
                "atlas_select_mod_role"
        ) {
            const role =
                interaction.roles.first();

            updateGuild(
                interaction.guild.id,
                g => {
                    if (!g.moderation) {
                        g.moderation = {};
                    }

                    g.moderation.role =
                        role.id;
                }
            );

            return interaction.update({
                content:
                    `✅ Moderator role set to ${role}.`,
                components: []
            });
        }

        /* =====================================================
           LOGGING
        ===================================================== */

        if (
            interaction.isButton() &&
            interaction.customId ===
                "atlas_logging_toggle"
        ) {
            let enabled;

            updateGuild(
                interaction.guild.id,
                g => {
                    g.logging.enabled =
                        !g.logging.enabled;

                    enabled =
                        g.logging.enabled;
                }
            );

            return interaction.reply({
                content:
                    enabled
                        ? "🟢 Logging enabled."
                        : "🔴 Logging disabled.",
                ephemeral: true
            });
        }

        if (
            interaction.isButton() &&
            interaction.customId ===
                "atlas_logging_channel"
        ) {
            return interaction.reply({
                content:
                    "📋 Select the logging channel.",
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new ChannelSelectMenuBuilder()
                                .setCustomId(
                                    "atlas_select_log_channel"
                                )
                                .setPlaceholder(
                                    "Select logging channel..."
                                )
                                .setChannelTypes(
                                    ChannelType.GuildText
                                )
                        )
                ],
                ephemeral: true
            });
        }

        if (
            interaction.isChannelSelectMenu() &&
            interaction.customId ===
                "atlas_select_log_channel"
        ) {
            const channel =
                interaction.channels.first();

            updateGuild(
                interaction.guild.id,
                g => {
                    g.logging.channel =
                        channel.id;
                }
            );

            return interaction.update({
                content:
                    `✅ Logging channel set to ${channel}.`,
                components: []
            });
        }

        if (
            interaction.isButton() &&
            interaction.customId ===
                "atlas_logging_events"
        ) {
            return interaction.reply({
                content:
                    "📋 Select which event types Atlas should log.",
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId(
                                    "atlas_logging_events_select"
                                )
                                .setPlaceholder(
                                    "Select events..."
                                )
                                .setMinValues(1)
                                .setMaxValues(4)
                                .addOptions(
                                    {
                                        label:
                                            "Moderation",
                                        value:
                                            "moderation",
                                        emoji:
                                            "🛡️"
                                    },
                                    {
                                        label:
                                            "Member Events",
                                        value:
                                            "members",
                                        emoji:
                                            "👤"
                                    },
                                    {
                                        label:
                                            "Messages",
                                        value:
                                            "messages",
                                        emoji:
                                            "💬"
                                    },
                                    {
                                        label:
                                            "Server",
                                        value:
                                            "server",
                                        emoji:
                                            "⚙️"
                                    }
                                )
                        )
                ],
                ephemeral: true
            });
        }

        if (
            interaction.isStringSelectMenu() &&
            interaction.customId ===
                "atlas_logging_events_select"
        ) {
            updateGuild(
                interaction.guild.id,
                g => {
                    g.logging.events =
                        interaction.values;
                }
            );

            return interaction.update({
                content:
                    "✅ Logging events saved.",
                components: []
            });
        }

        /* =====================================================
           WELCOME
        ===================================================== */

        if (
            interaction.isButton() &&
            interaction.customId ===
                "atlas_welcome_toggle"
        ) {
            let enabled;

            updateGuild(
                interaction.guild.id,
                g => {
                    g.welcome.enabled =
                        !g.welcome.enabled;

                    enabled =
                        g.welcome.enabled;
                }
            );

            return interaction.reply({
                content:
                    enabled
                        ? "🟢 Welcome messages enabled."
                        : "🔴 Welcome messages disabled.",
                ephemeral: true
            });
        }

        if (
            interaction.isButton() &&
            interaction.customId ===
                "atlas_welcome_channel"
        ) {
            return interaction.reply({
                content:
                    "👋 Select the welcome channel.",
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new ChannelSelectMenuBuilder()
                                .setCustomId(
                                    "atlas_select_welcome_channel"
                                )
                                .setPlaceholder(
                                    "Select welcome channel..."
                                )
                                .setChannelTypes(
                                    ChannelType.GuildText
                                )
                        )
                ],
                ephemeral: true
            });
        }

        if (
            interaction.isChannelSelectMenu() &&
            interaction.customId ===
                "atlas_select_welcome_channel"
        ) {
            const channel =
                interaction.channels.first();

            updateGuild(
                interaction.guild.id,
                g => {
                    g.welcome.channel =
                        channel.id;
                }
            );

            return interaction.update({
                content:
                    `✅ Welcome channel set to ${channel}.`,
                components: []
            });
        }

        if (
            interaction.isButton() &&
            interaction.customId ===
                "atlas_welcome_message"
        ) {
            const current =
                guildConfig(
                    interaction.guild.id
                ).welcome.message;

            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "atlas_welcome_message_modal"
                    )
                    .setTitle(
                        "Welcome Message"
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        new TextInputBuilder()
                            .setCustomId(
                                "welcome_message"
                            )
                            .setLabel(
                                "Welcome message"
                            )
                            .setStyle(
                                TextInputStyle.Paragraph
                            )
                            .setRequired(true)
                            .setMaxLength(4000)
                            .setValue(
                                String(
                                    current ||
                                    "Welcome {user} to **{server}**!"
                                ).slice(
                                    0,
                                    4000
                                )
                            )
                    )
            );

            return interaction.showModal(
                modal
            );
        }

        if (
            interaction.isModalSubmit() &&
            interaction.customId ===
                "atlas_welcome_message_modal"
        ) {
            const value =
                interaction.fields.getTextInputValue(
                    "welcome_message"
                );

            updateGuild(
                interaction.guild.id,
                g => {
                    g.welcome.message =
                        value;
                }
            );

            return interaction.reply({
                content:
                    "✅ Welcome message saved.",
                ephemeral: true
            });
        }

        /* =====================================================
           AUTOMOD
        ===================================================== */

        const automodToggles = {
            atlas_automod_toggle:
                "enabled",
            atlas_automod_links:
                "links",
            atlas_automod_spam:
                "spam"
        };

        if (
            interaction.isButton() &&
            automodToggles[
                interaction.customId
            ]
        ) {
            const key =
                automodToggles[
                    interaction.customId
                ];

            let enabled;

            updateGuild(
                interaction.guild.id,
                g => {
                    g.automod[key] =
                        !g.automod[key];

                    enabled =
                        g.automod[key];
                }
            );

            return interaction.reply({
                content:
                    enabled
                        ? `🟢 AutoMod ${key} enabled.`
                        : `🔴 AutoMod ${key} disabled.`,
                ephemeral: true
            });
        }

        if (
            interaction.isButton() &&
            interaction.customId ===
                "atlas_automod_words"
        ) {
            const words =
                guildConfig(
                    interaction.guild.id
                ).automod.words || [];

            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "atlas_automod_words_modal"
                    )
                    .setTitle(
                        "AutoMod Word Filter"
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        new TextInputBuilder()
                            .setCustomId(
                                "automod_words"
                            )
                            .setLabel(
                                "Words separated by commas"
                            )
                            .setStyle(
                                TextInputStyle.Paragraph
                            )
                            .setRequired(false)
                            .setMaxLength(4000)
                            .setValue(
                                words.join(
                                    ", "
                                ).slice(
                                    0,
                                    4000
                                )
                            )
                    )
            );

            return interaction.showModal(
                modal
            );
        }

        if (
            interaction.isModalSubmit() &&
            interaction.customId ===
                "atlas_automod_words_modal"
        ) {
            const words =
                interaction.fields
                    .getTextInputValue(
                        "automod_words"
                    )
                    .split(",")
                    .map(x =>
                        x.trim()
                    )
                    .filter(Boolean)
                    .slice(0, 100);

            updateGuild(
                interaction.guild.id,
                g => {
                    g.automod.words =
                        words;
                }
            );

            return interaction.reply({
                content:
                    `✅ Saved ${words.length} blocked word(s).`,
                ephemeral: true
            });
        }

        /* =====================================================
           PERMISSIONS
        ===================================================== */

        if (
            interaction.isButton() &&
            interaction.customId ===
                "atlas_permissions_role"
        ) {
            return interaction.reply({
                content:
                    "👮 Select the role type you want to configure.",
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId(
                                    "atlas_permissions_role_type"
                                )
                                .setPlaceholder(
                                    "Select role type..."
                                )
                                .addOptions(
                                    {
                                        label:
                                            "Administrator",
                                        description:
                                            "Full Atlas administrator access.",
                                        value:
                                            "admin",
                                        emoji:
                                            "👑"
                                    },
                                    {
                                        label:
                                            "Moderator",
                                        description:
                                            "Moderation command access.",
                                        value:
                                            "moderator",
                                        emoji:
                                            "🛡️"
                                    },
                                    {
                                        label:
                                            "Support",
                                        description:
                                            "Ticket/support access.",
                                        value:
                                            "support",
                                        emoji:
                                            "🎫"
                                    }
                                )
                        )
                ],
                ephemeral: true
            });
        }

        if (
            interaction.isStringSelectMenu() &&
            interaction.customId ===
                "atlas_permissions_role_type"
        ) {
            const type =
                interaction.values[0];

            return interaction.update({
                content:
                    `👮 Select the ${type} role(s).`,
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new RoleSelectMenuBuilder()
                                .setCustomId(
                                    `atlas_select_${type}_roles`
                                )
                                .setPlaceholder(
                                    `Select ${type} role(s)...`
                                )
                                .setMinValues(1)
                                .setMaxValues(10)
                        )
                ]
            });
        }

        if (
            interaction.isRoleSelectMenu() &&
            interaction.customId.startsWith(
                "atlas_select_"
            ) &&
            interaction.customId.endsWith(
                "_roles"
            )
        ) {
            const type =
                interaction.customId
                    .replace(
                        "atlas_select_",
                        ""
                    )
                    .replace(
                        "_roles",
                        ""
                    );

            const roleIds =
                interaction.roles.map(
                    role => role.id
                );

            updateGuild(
                interaction.guild.id,
                g => {
                    if (!g.permissions) {
                        g.permissions =
                            {
                                enabled:
                                    true,
                                adminRoles:
                                    [],
                                moderatorRoles:
                                    [],
                                supportRoles:
                                    []
                            };
                    }

                    g.permissions.enabled =
                        true;

                    if (
                        type ===
                        "admin"
                    ) {
                        g.permissions.adminRoles =
                            roleIds;
                    }

                    if (
                        type ===
                        "moderator"
                    ) {
                        g.permissions.moderatorRoles =
                            roleIds;
                    }

                    if (
                        type ===
                        "support"
                    ) {
                        g.permissions.supportRoles =
                            roleIds;
                    }
                }
            );

            return interaction.update({
                content:
                    `✅ ${type} role configuration saved.`,
                components: []
            });
        }

        if (
            interaction.isButton() &&
            interaction.customId ===
                "atlas_permissions_reset"
        ) {
            updateGuild(
                interaction.guild.id,
                g => {
                    g.permissions = {
                        enabled: false,
                        adminRoles: [],
                        moderatorRoles: [],
                        supportRoles: []
                    };
                }
            );

            return interaction.reply({
                content:
                    "♻️ Custom Atlas permissions have been reset.",
                ephemeral: true
            });
        }

        /* =====================================================
           TICKETS
        ===================================================== */

        if (
            interaction.isButton() &&
            interaction.customId ===
                "atlas_ticket_toggle"
        ) {
            let enabled;

            updateGuild(
                interaction.guild.id,
                g => {
                    g.tickets.enabled =
                        !g.tickets.enabled;

                    enabled =
                        g.tickets.enabled;
                }
            );

            return interaction.reply({
                content:
                    enabled
                        ? "🟢 Ticket system enabled."
                        : "🔴 Ticket system disabled.",
                ephemeral: true
            });
        }

        if (
            interaction.isButton() &&
            interaction.customId ===
                "atlas_ticket_category"
        ) {
            return interaction.reply({
                content:
                    "📁 Select the ticket category.",
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new ChannelSelectMenuBuilder()
                                .setCustomId(
                                    "atlas_select_ticket_category"
                                )
                                .setPlaceholder(
                                    "Select category..."
                                )
                                .setChannelTypes(
                                    ChannelType.GuildCategory
                                )
                        )
                ],
                ephemeral: true
            });
        }

        if (
            interaction.isChannelSelectMenu() &&
            interaction.customId ===
                "atlas_select_ticket_category"
        ) {
            const channel =
                interaction.channels.first();

            updateGuild(
                interaction.guild.id,
                g => {
                    g.tickets.category =
                        channel.id;
                }
            );

            return interaction.update({
                content:
                    `✅ Ticket category set to ${channel}.`,
                components: []
            });
        }

        if (
            interaction.isButton() &&
            interaction.customId ===
                "atlas_ticket_role"
        ) {
            return interaction.reply({
                content:
                    "👮 Select the ticket staff role.",
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new RoleSelectMenuBuilder()
                                .setCustomId(
                                    "atlas_select_ticket_role"
                                )
                                .setPlaceholder(
                                    "Select staff role..."
                                )
                        )
                ],
                ephemeral: true
            });
        }

        if (
            interaction.isRoleSelectMenu() &&
            interaction.customId ===
                "atlas_select_ticket_role"
        ) {
            const role =
                interaction.roles.first();

            updateGuild(
                interaction.guild.id,
                g => {
                    g.tickets.staffRole =
                        role.id;
                }
            );

            return interaction.update({
                content:
                    `✅ Ticket staff role set to ${role}.`,
                components: []
            });
        }

        if (
            interaction.isButton() &&
            interaction.customId ===
                "atlas_ticket_log_channel"
        ) {
            return interaction.reply({
                content:
                    "📋 Select the ticket log channel.",
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new ChannelSelectMenuBuilder()
                                .setCustomId(
                                    "atlas_select_ticket_log"
                                )
                                .setPlaceholder(
                                    "Select ticket log channel..."
                                )
                                .setChannelTypes(
                                    ChannelType.GuildText
                                )
                        )
                ],
                ephemeral: true
            });
        }

        if (
            interaction.isChannelSelectMenu() &&
            interaction.customId ===
                "atlas_select_ticket_log"
        ) {
            const channel =
                interaction.channels.first();

            updateGuild(
                interaction.guild.id,
                g => {
                    g.tickets.logChannel =
                        channel.id;
                }
            );

            return interaction.update({
                content:
                    `✅ Ticket log channel set to ${channel}.`,
                components: []
            });
        }

        /* =====================================================
           TICKET CUSTOMIZATION
        ===================================================== */

        if (
            interaction.isButton() &&
            interaction.customId ===
                "atlas_ticket_customize"
        ) {
            const panel =
                guildConfig(
                    interaction.guild.id
                ).tickets.panels;

            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "atlas_ticket_customize_modal"
                    )
                    .setTitle(
                        "Customize Ticket Panel"
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        new TextInputBuilder()
                            .setCustomId(
                                "title"
                            )
                            .setLabel(
                                "Panel title"
                            )
                            .setStyle(
                                TextInputStyle.Short
                            )
                            .setRequired(true)
                            .setMaxLength(256)
                            .setValue(
                                String(
                                    panel.title ||
                                    "🎫 Support Tickets"
                                ).slice(
                                    0,
                                    256
                                )
                            )
                    ),

                new ActionRowBuilder()
                    .addComponents(
                        new TextInputBuilder()
                            .setCustomId(
                                "description"
                            )
                            .setLabel(
                                "Panel description"
                            )
                            .setStyle(
                                TextInputStyle.Paragraph
                            )
                            .setRequired(true)
                            .setMaxLength(4000)
                            .setValue(
                                String(
                                    panel.description ||
                                    "Need help from our staff team?"
                                ).slice(
                                    0,
                                    4000
                                )
                            )
                    ),

                new ActionRowBuilder()
                    .addComponents(
                        new TextInputBuilder()
                            .setCustomId(
                                "button"
                            )
                            .setLabel(
                                "Button text"
                            )
                            .setStyle(
                                TextInputStyle.Short
                            )
                            .setRequired(true)
                            .setMaxLength(80)
                            .setValue(
                                String(
                                    panel.buttonText ||
                                    "Create Ticket"
                                ).slice(
                                    0,
                                    80
                                )
                            )
                    ),

                new ActionRowBuilder()
                    .addComponents(
                        new TextInputBuilder()
                            .setCustomId(
                                "emoji"
                            )
                            .setLabel(
                                "Button emoji"
                            )
                            .setStyle(
                                TextInputStyle.Short
                            )
                            .setRequired(false)
                            .setMaxLength(10)
                            .setValue(
                                String(
                                    panel.buttonEmoji ||
                                    "🎫"
                                )
                            )
                    ),

                new ActionRowBuilder()
                    .addComponents(
                        new TextInputBuilder()
                            .setCustomId(
                                "color"
                            )
                            .setLabel(
                                "Embed color (HEX)"
                            )
                            .setStyle(
                                TextInputStyle.Short
                            )
                            .setRequired(false)
                            .setMaxLength(7)
                            .setValue(
                                "5865F2"
                            )
                    )
            );

            return interaction.showModal(
                modal
            );
        }

        if (
            interaction.isModalSubmit() &&
            interaction.customId ===
                "atlas_ticket_customize_modal"
        ) {
            const title =
                interaction.fields.getTextInputValue(
                    "title"
                );

            const description =
                interaction.fields.getTextInputValue(
                    "description"
                );

            const button =
                interaction.fields.getTextInputValue(
                    "button"
                );

            const emoji =
                interaction.fields.getTextInputValue(
                    "emoji"
                );

            const color =
                interaction.fields.getTextInputValue(
                    "color"
                );

            let parsedColor =
                parseInt(
                    color
                        .replace(
                            "#",
                            ""
                        )
                        .trim(),
                    16
                );

            if (
                Number.isNaN(
                    parsedColor
                ) ||
                parsedColor < 0 ||
                parsedColor >
                    0xFFFFFF
            ) {
                parsedColor =
                    0x5865F2;
            }

            updateGuild(
                interaction.guild.id,
                g => {
                    if (
                        !g.tickets
                            .panels
                    ) {
                        g.tickets.panels =
                            {};
                    }

                    g.tickets.panels.title =
                        title;

                    g.tickets.panels.description =
                        description;

                    g.tickets.panels.buttonText =
                        button;

                    g.tickets.panels.buttonEmoji =
                        emoji ||
                        "🎫";

                    g.tickets.panels.color =
                        parsedColor;
                }
            );

            return interaction.reply({
                content:
                    "✅ Ticket panel customization saved.",
                ephemeral: true
            });
        }

        /* =====================================================
           SEND TICKET PANEL
        ===================================================== */

        if (
            interaction.isButton() &&
            interaction.customId ===
                "atlas_ticket_panel"
        ) {
            const t =
                tickets(
                    interaction.guild.id
                );

            if (!t.enabled) {
                return interaction.reply({
                    content:
                        "❌ Enable the ticket system first.",
                    ephemeral: true
                });
            }

            if (
                !t.category ||
                !t.staffRole
            ) {
                return interaction.reply({
                    content:
                        "❌ Configure the ticket category and staff role first.",
                    ephemeral: true
                });
            }

            if (
                !interaction.channel
                    ?.isTextBased()
            ) {
                return interaction.reply({
                    content:
                        "❌ This channel cannot receive a ticket panel.",
                    ephemeral: true
                });
            }

            const panel =
                new EmbedBuilder()
                    .setColor(
                        t.panels?.color ||
                        0x5865F2
                    )
                    .setTitle(
                        t.panels?.title ||
                        "🎫 Support Tickets"
                    )
                    .setDescription(
                        t.panels?.description ||
                        "Click the button below to create a ticket."
                    )
                    .setTimestamp()
                    .setFooter({
                        text:
                            "Atlas Utilities • Tickets"
                    });

            const button =
                new ButtonBuilder()
                    .setCustomId(
                        "atlas_ticket_create"
                    )
                    .setLabel(
                        t.panels?.buttonText ||
                        "Create Ticket"
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    );

            if (
                t.panels?.buttonEmoji
            ) {
                button.setEmoji(
                    t.panels.buttonEmoji
                );
            }

            await interaction.channel.send({
                embeds: [panel],
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            button
                        )
                ]
            });

            return interaction.reply({
                content:
                    "✅ Ticket panel sent successfully.",
                ephemeral: true
            });
        }

        /* =====================================================
           TICKET CREATE
        ===================================================== */

        if (
            interaction.isButton() &&
            interaction.customId ===
                "atlas_ticket_create"
        ) {
            const t =
                tickets(
                    interaction.guild.id
                );

            if (!t.enabled) {
                return interaction.reply({
                    content:
                        "❌ The ticket system is disabled.",
                    ephemeral: true
                });
            }

            if (
                !t.category ||
                !t.staffRole
            ) {
                return interaction.reply({
                    content:
                        "❌ The ticket system has not been configured.",
                    ephemeral: true
                });
            }

            const existing =
                Object.entries(
                    t.active || {}
                ).find(
                    ([, ticket]) =>
                        ticket.userId ===
                            interaction.user.id &&
                        ticket.status ===
                            "open"
                );

            if (existing) {
                return interaction.reply({
                    content:
                        `❌ You already have an open ticket: <#${existing[0]}>`,
                    ephemeral: true
                });
            }

            const safeName =
                (
                    "ticket-" +
                    interaction.user.username
                )
                    .toLowerCase()
                    .replace(
                        /[^a-z0-9-]/g,
                        ""
                    )
                    .slice(
                        0,
                        80
                    );

            const channelName =
                safeName ||
                `ticket-${interaction.user.id}`;

            const channel =
                await interaction.guild.channels.create(
                    {
                        name:
                            channelName,
                        type:
                            ChannelType.GuildText,
                        parent:
                            t.category,

                        permissionOverwrites:
                            [
                                {
                                    id:
                                        interaction.guild
                                            .id,
                                    deny: [
                                        PermissionFlagsBits.ViewChannel
                                    ]
                                },

                                {
                                    id:
                                        interaction.user
                                            .id,
                                    allow: [
                                        PermissionFlagsBits.ViewChannel,
                                        PermissionFlagsBits.SendMessages,
                                        PermissionFlagsBits.ReadMessageHistory
                                    ]
                                },

                                {
                                    id:
                                        t.staffRole,
                                    allow: [
                                        PermissionFlagsBits.ViewChannel,
                                        PermissionFlagsBits.SendMessages,
                                        PermissionFlagsBits.ReadMessageHistory,
                                        PermissionFlagsBits.ManageMessages
                                    ]
                                }
                            ]
                    }
                );

            if (!t.active) {
                t.active = {};
            }

            t.active[channel.id] = {
                userId:
                    interaction.user.id,
                claimedBy:
                    null,
                status:
                    "open",
                openedAt:
                    new Date().toISOString()
            };

            saveTickets(
                interaction.guild.id,
                t
            );

            await channel.send({
                content:
                    `${interaction.user} <@&${t.staffRole}>`,

                embeds: [
                    applyProfile(
                        new EmbedBuilder()
                            .setColor(
                                t.panels?.color ||
                                0x5865F2
                            )
                            .setTitle(
                                "🎫 Ticket Created"
                            )
                            .setDescription(
                                [
                                    `Welcome ${interaction.user}!`,
                                    "",
                                    "A member of our staff team will assist you shortly.",
                                    "",
                                    "Please explain your issue clearly."
                                ].join("\n")
                            )
                            .setTimestamp(),
                        interaction.guild.id
                    )
                ],

                components: [
                    ticketButtons(
                        t.active[channel.id]
                    )
                ]
            });

            return interaction.reply({
                content:
                    `✅ Your ticket has been created: ${channel}`,
                ephemeral: true
            });
        }

        /* =====================================================
           TICKET CLAIM
        ===================================================== */

        if (
            interaction.isButton() &&
            interaction.customId ===
                "atlas_ticket_claim"
        ) {
            const t =
                tickets(
                    interaction.guild.id
                );

            const ticket =
                t.active?.[
                    interaction.channel.id
                ];

            if (!ticket) {
                return interaction.reply({
                    content:
                        "❌ Ticket not found.",
                    ephemeral: true
                });
            }

            if (
                !isStaff(
                    interaction.member
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ You are not ticket staff.",
                    ephemeral: true
                });
            }

            if (ticket.claimedBy) {
                return interaction.reply({
                    content:
                        "❌ This ticket is already claimed.",
                    ephemeral: true
                });
            }

            ticket.claimedBy =
                interaction.user.id;

            saveTickets(
                interaction.guild.id,
                t
            );

            await interaction.message
                .edit({
                    components: [
                        ticketButtons(
                            ticket
                        )
                    ]
                })
                .catch(() => {});

            return interaction.reply({
                content:
                    "✅ Ticket claimed.",
                ephemeral: true
            });
        }

        /* =====================================================
           TICKET UNCLAIM
        ===================================================== */

        if (
            interaction.isButton() &&
            interaction.customId ===
                "atlas_ticket_unclaim"
        ) {
            const t =
                tickets(
                    interaction.guild.id
                );

            const ticket =
                t.active?.[
                    interaction.channel.id
                ];

            if (!ticket) {
                return interaction.reply({
                    content:
                        "❌ Ticket not found.",
                    ephemeral: true
                });
            }

            if (
                ticket.claimedBy !==
                interaction.user.id
            ) {
                return interaction.reply({
                    content:
                        "❌ Only the staff member who claimed this ticket can unclaim it.",
                    ephemeral: true
                });
            }

            ticket.claimedBy =
                null;

            saveTickets(
                interaction.guild.id,
                t
            );

            await interaction.message
                .edit({
                    components: [
                        ticketButtons(
                            ticket
                        )
                    ]
                })
                .catch(() => {});

            return interaction.reply({
                content:
                    "✅ Ticket unclaimed.",
                ephemeral: true
            });
        }

        /* =====================================================
           TICKET CLOSE
        ===================================================== */

        if (
            interaction.isButton() &&
            interaction.customId ===
                "atlas_ticket_close"
        ) {
            const t =
                tickets(
                    interaction.guild.id
                );

            const ticket =
                t.active?.[
                    interaction.channel.id
                ];

            if (!ticket) {
                return interaction.reply({
                    content:
                        "❌ Ticket not found.",
                    ephemeral: true
                });
            }

            if (
                ticket.userId !==
                    interaction.user.id &&
                !isStaff(
                    interaction.member
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ You cannot close this ticket.",
                    ephemeral: true
                });
            }

            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "atlas_ticket_close_modal"
                    )
                    .setTitle(
                        "Close Ticket"
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        new TextInputBuilder()
                            .setCustomId(
                                "close_reason"
                            )
                            .setLabel(
                                "Close reason"
                            )
                            .setStyle(
                                TextInputStyle.Paragraph
                            )
                            .setRequired(true)
                            .setMaxLength(
                                1000
                            )
                    )
            );

            return interaction.showModal(
                modal
            );
        }

        /* =====================================================
           TICKET CLOSE MODAL
        ===================================================== */

        if (
            interaction.isModalSubmit() &&
            interaction.customId ===
                "atlas_ticket_close_modal"
        ) {
            const t =
                tickets(
                    interaction.guild.id
                );

            const ticket =
                t.active?.[
                    interaction.channel.id
                ];

            if (!ticket) {
                return interaction.reply({
                    content:
                        "❌ Ticket not found.",
                    ephemeral: true
                });
            }

            const reason =
                interaction.fields.getTextInputValue(
                    "close_reason"
                );

            ticket.status =
                "closed";

            ticket.closedBy =
                interaction.user.id;

            ticket.closeReason =
                reason;

            ticket.closedAt =
                new Date().toISOString();

            saveTickets(
                interaction.guild.id,
                t
            );

            await interaction.channel
                .permissionOverwrites
                .edit(
                    ticket.userId,
                    {
                        ViewChannel: false,
                        SendMessages: false
                    }
                )
                .catch(() => {});

            await interaction.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(
                            0xED4245
                        )
                        .setTitle(
                            "🔒 Ticket Closed"
                        )
                        .setDescription(
                            "This ticket has been closed."
                        )
                        .addFields({
                            name:
                                "Reason",
                            value:
                                reason.slice(
                                    0,
                                    1024
                                )
                        })
                        .setTimestamp()
                ],
                components: [
                    closedButtons()
                ]
            });

            return interaction.reply({
                content:
                    "✅ Ticket closed.",
                ephemeral: true
            });
        }

        /* =====================================================
           TICKET DELETE
        ===================================================== */

        if (
            interaction.isButton() &&
            interaction.customId ===
                "atlas_ticket_delete"
        ) {
            const t =
                tickets(
                    interaction.guild.id
                );

            const ticket =
                t.active?.[
                    interaction.channel.id
                ];

            if (!ticket) {
                return interaction.reply({
                    content:
                        "❌ Ticket not found.",
                    ephemeral: true
                });
            }

            if (
                !isStaff(
                    interaction.member
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ Only ticket staff can delete tickets.",
                    ephemeral: true
                });
            }

            if (
                ticket.status !==
                "closed"
            ) {
                return interaction.reply({
                    content:
                        "❌ Close the ticket first.",
                    ephemeral: true
                });
            }

            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "atlas_ticket_delete_modal"
                    )
                    .setTitle(
                        "Delete Ticket"
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        new TextInputBuilder()
                            .setCustomId(
                                "delete_reason"
                            )
                            .setLabel(
                                "Delete reason"
                            )
                            .setStyle(
                                TextInputStyle.Paragraph
                            )
                            .setRequired(true)
                            .setMaxLength(
                                1000
                            )
                    )
            );

            return interaction.showModal(
                modal
            );
        }

        /* =====================================================
           TICKET DELETE MODAL
        ===================================================== */

        if (
            interaction.isModalSubmit() &&
            interaction.customId ===
                "atlas_ticket_delete_modal"
        ) {
            const t =
                tickets(
                    interaction.guild.id
                );

            const ticket =
                t.active?.[
                    interaction.channel.id
                ];

            if (!ticket) {
                return interaction.reply({
                    content:
                        "❌ Ticket not found.",
                    ephemeral: true
                });
            }

            if (
                !isStaff(
                    interaction.member
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ Only ticket staff can delete tickets.",
                    ephemeral: true
                });
            }

            const reason =
                interaction.fields.getTextInputValue(
                    "delete_reason"
                );

            ticket.deleteReason =
                reason;

            delete t.active[
                interaction.channel.id
            ];

            saveTickets(
                interaction.guild.id,
                t
            );

            await interaction.reply({
                content:
                    "🗑️ Ticket deleted.",
                ephemeral: true
            });

            setTimeout(
                () =>
                    interaction.channel
                        .delete()
                        .catch(
                            () => {}
                        ),
                1500
            );

            return;
        }

    } catch (error) {
        console.error(
            "❌ Interaction error:",
            error
        );

        await errorLog(
            error,
            {
                type:
                    "Interaction",
                guild:
                    interaction.guild,
                user:
                    interaction.user,
                command:
                    interaction.commandName ||
                    interaction.customId
            }
        );

        if (
            interaction.isRepliable() &&
            !interaction.replied &&
            !interaction.deferred
        ) {
            await interaction
                .reply({
                    content:
                        "❌ Something went wrong while processing that interaction.",
                    ephemeral: true
                })
                .catch(
                    () => {}
                );
        }
    }
});


/* =========================================================
   ERRORS
========================================================= */

client.on("error", error => {
    console.error(
        "❌ Discord error:",
        error
    );

    errorLog(error, {
        type: "Discord Client Error"
    });
});

process.on(
    "unhandledRejection",
    error => {
        console.error(
            "❌ Unhandled rejection:",
            error
        );

        errorLog(error, {
            type: "Unhandled Rejection"
        });
    }
);

process.on(
    "uncaughtException",
    error => {
        console.error(
            "❌ Uncaught exception:",
            error
        );

        errorLog(error, {
            type: "Uncaught Exception"
        });
    }
);

/* =========================================================
   START
========================================================= */

ensureFile(CONFIG);
ensureFile(BOT_BANS);
ensureFile(GLOBAL_BANS);

if (!process.env.TOKEN) {
    console.error(
        "❌ TOKEN is missing from .env"
    );

    process.exit(1);
}

client.login(
    process.env.TOKEN
);