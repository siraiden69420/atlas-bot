require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
    Client,
    GatewayIntentBits,
    Collection,
    EmbedBuilder,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
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

/* =========================================================
   CLIENT
========================================================= */

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
   LOAD COMMANDS
========================================================= */

const commandsPath = path.join(__dirname, "commands");

const commandFiles = fs
    .readdirSync(commandsPath)
    .filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    try {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);

        if (command?.data && command?.execute) {
            client.commands.set(
                command.data.name,
                command
            );

            console.log(
                `✅ Loaded command: ${command.data.name}`
            );
        } else {
            console.warn(
                `⚠️ Skipped invalid command file: ${file}`
            );
        }
    } catch (error) {
        console.error(
            `❌ Failed to load command ${file}:`,
            error
        );
    }
}

/* =========================================================
   CONFIG
========================================================= */

const configPath = path.join(
    __dirname,
    "data",
    "config.json"
);

function loadConfig() {
    try {
        if (!fs.existsSync(configPath)) {
            fs.writeFileSync(
                configPath,
                "{}"
            );
        }

        return JSON.parse(
            fs.readFileSync(
                configPath,
                "utf8"
            )
        );
    } catch (error) {
        console.error(
            "❌ Config load error:",
            error
        );

        return {};
    }
}

function saveConfig(config) {
    try {
        fs.writeFileSync(
            configPath,
            JSON.stringify(
                config,
                null,
                4
            )
        );
    } catch (error) {
        console.error(
            "❌ Config save error:",
            error
        );

        throw error;
    }
}

function getGuildConfig(guildId) {
    const config = loadConfig();

    if (!config[guildId]) {
        config[guildId] = {};
        saveConfig(config);
    }

    return config[guildId];
}

/* =========================================================
   BOT BAN SYSTEM
========================================================= */

const botBansPath = path.join(
    __dirname,
    "data",
    "botbans.json"
);

function loadBotBans() {
    try {
        if (!fs.existsSync(botBansPath)) {
            fs.writeFileSync(
                botBansPath,
                "{}"
            );
        }

        return JSON.parse(
            fs.readFileSync(
                botBansPath,
                "utf8"
            )
        );
    } catch (error) {
        console.error(
            "❌ Bot ban database error:",
            error
        );

        return {};
    }
}

function isBotBanned(userId) {
    const bans = loadBotBans();

    return Boolean(
        bans[userId]
    );
}

/* =========================================================
   GLOBAL BAN SYSTEM
========================================================= */

const globalBansPath = path.join(
    __dirname,
    "data",
    "globalbans.json"
);

function loadGlobalBans() {
    try {
        if (!fs.existsSync(globalBansPath)) {
            fs.writeFileSync(
                globalBansPath,
                "{}"
            );
        }

        return JSON.parse(
            fs.readFileSync(
                globalBansPath,
                "utf8"
            )
        );
    } catch (error) {
        console.error(
            "❌ Global ban database error:",
            error
        );

        return {};
    }
}

function isGloballyBanned(userId) {
    const bans = loadGlobalBans();

    return Boolean(
        bans[userId]
    );
}

/* =========================================================
   ERROR LOGGING
========================================================= */

async function sendBotErrorLog(
    error,
    {
        type = "Unknown",
        guild = null,
        user = null,
        command = "Unknown"
    } = {}
) {
    try {
        const supportServerId =
            process.env.SUPPORT_SERVER_ID;

        const errorChannelId =
            process.env.ERROR_LOG_CHANNEL_ID;

        if (
            !supportServerId ||
            !errorChannelId
        ) {
            console.error(
                "⚠️ SUPPORT_SERVER_ID or ERROR_LOG_CHANNEL_ID is missing from .env"
            );

            return;
        }

        let supportGuild =
            client.guilds.cache.get(
                supportServerId
            );

        if (!supportGuild) {
            supportGuild =
                await client.guilds.fetch(
                    supportServerId
                ).catch(
                    () => null
                );
        }

        if (!supportGuild) {
            console.error(
                "⚠️ Atlas is not in the configured support server."
            );

            return;
        }

        let channel =
            supportGuild.channels.cache.get(
                errorChannelId
            );

        if (!channel) {
            channel =
                await supportGuild.channels.fetch(
                    errorChannelId
                ).catch(
                    () => null
                );
        }

        if (
            !channel ||
            !channel.isTextBased()
        ) {
            console.error(
                "⚠️ Error log channel could not be found."
            );

            return;
        }

        const errorText =
            error?.stack ||
            error?.message ||
            String(error);

        const safeError =
            String(errorText).slice(0, 950);

        const serverName =
            guild?.name ||
            "Unknown Server";

        const serverId =
            guild?.id ||
            "Unknown";

        const userName =
            user?.tag ||
            user?.username ||
            "Unknown User";

        const userId =
            user?.id ||
            "Unknown";

        const commandText =
            typeof command === "string"
                ? command
                : command?.name ||
                  "Unknown";

        const embed =
            new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle(
                    "🚨 Atlas Error"
                )
                .setDescription(
                    "An error occurred while Atlas was running."
                )
                .addFields(
                    {
                        name: "📍 Type",
                        value:
                            String(type)
                                .slice(0, 1024),
                        inline: true
                    },
                    {
                        name: "🌐 Server",
                        value:
                            `**${String(serverName).slice(0, 900)}**\nID: \`${String(serverId).slice(0, 100)}\``,
                        inline: true
                    },
                    {
                        name: "👤 User",
                        value:
                            `**${String(userName).slice(0, 900)}**\nID: \`${String(userId).slice(0, 100)}\``,
                        inline: true
                    },
                    {
                        name: "⌨️ Command",
                        value:
                            `\`${String(commandText)
                                .slice(0, 1024)}\``,
                        inline: false
                    },
                    {
                        name: "❌ Error",
                        value:
                            "```text\n" +
                            safeError +
                            "\n```",
                        inline: false
                    }
                )
                .setFooter({
                    text:
                        "Atlas Utilities • Error Logs"
                })
                .setTimestamp();

        await channel.send({
            embeds: [embed]
        });

        console.log(
            "✅ Atlas error log sent."
        );

    } catch (logError) {
        console.error(
            "❌ Failed to send Atlas error log:",
            logError
        );
    }
}

/* =========================================================
   TICKET SYSTEM
========================================================= */

function getTickets(guildId) {
    const config = loadConfig();

    if (!config[guildId]) {
        config[guildId] = {};
    }

    if (!config[guildId].tickets) {
        config[guildId].tickets = {};
    }

    const tickets =
        config[guildId].tickets;

    if (!tickets.panels) {
        tickets.panels = {
            title: "🎫 Support Tickets",

            description:
                "Need help from our staff team?\n\n" +
                "Click the button below to create a private support ticket.",

            buttonText: "Create Ticket",

            buttonEmoji: "🎫",

            color: 0x5865F2
        };
    }

    if (!tickets.active) {
        tickets.active = {};
    }

    if (!("category" in tickets)) {
        tickets.category = null;
    }

    if (!("staffRole" in tickets)) {
        tickets.staffRole = null;
    }

    if (!("enabled" in tickets)) {
        tickets.enabled = false;
    }

    if (!("logChannel" in tickets)) {
        tickets.logChannel = null;
    }

    config[guildId].tickets = tickets;
    saveConfig(config);

    return tickets;
}

function getTicketLogChannel(guild) {
    const tickets =
        getTickets(guild.id);

    if (!tickets.logChannel) {
        return null;
    }

    return (
        guild.channels.cache.get(
            tickets.logChannel
        ) || null
    );
}

function createTicketLogEmbed(
    title,
    color,
    fields
) {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .addFields(fields)
        .setFooter({
            text:
                "Atlas Utilities • Ticket Logs"
        })
        .setTimestamp();
}

async function sendTicketLog(
    guild,
    embed,
    user = null,
    command = "Ticket System"
) {
    try {
        const channel =
            getTicketLogChannel(guild);

        if (!channel) {
            return;
        }

        if (!channel.isTextBased()) {
            return;
        }

        await channel.send({
            embeds: [embed]
        });

    } catch (error) {
        console.error(
            "❌ Failed to send ticket log:",
            error
        );

        await sendBotErrorLog(
            error,
            {
                type: "Ticket Log",
                guild,
                user,
                command
            }
        );
    }
}

function getStaffRole(guild) {
    const tickets =
        getTickets(guild.id);

    if (!tickets.staffRole) {
        return null;
    }

    return (
        guild.roles.cache.get(
            tickets.staffRole
        ) || null
    );
}

function isTicketStaff(member) {
    if (!member) {
        return false;
    }

    if (
        member.permissions.has(
            PermissionFlagsBits.Administrator
        )
    ) {
        return true;
    }

    const role =
        getStaffRole(member.guild);

    if (!role) {
        return false;
    }

    return member.roles.cache.has(
        role.id
    );
}

function formatTime(timestamp) {
    if (!timestamp) {
        return "Not recorded";
    }

    return `<t:${Math.floor(
        new Date(timestamp).getTime() / 1000
    )}:F>`;
}

function createTicketButtons(ticket) {
    const row =
        new ActionRowBuilder();

    if (!ticket.claimedBy) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(
                    "atlas_ticket_claim"
                )
                .setLabel("Claim")
                .setEmoji("🙋")
                .setStyle(
                    ButtonStyle.Primary
                )
        );
    } else {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(
                    "atlas_ticket_unclaim"
                )
                .setLabel("Unclaim")
                .setEmoji("↩️")
                .setStyle(
                    ButtonStyle.Secondary
                )
        );
    }

    row.addComponents(
        new ButtonBuilder()
            .setCustomId(
                "atlas_ticket_close"
            )
            .setLabel("Close")
            .setEmoji("🔒")
            .setStyle(
                ButtonStyle.Danger
            )
    );

    return row;
}

function createClosedTicketButtons() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(
                    "atlas_ticket_delete"
                )
                .setLabel(
                    "Delete Ticket"
                )
                .setEmoji("🗑️")
                .setStyle(
                    ButtonStyle.Danger
                )
        );
}

/* =========================================================
   PREFIX COMMAND SYSTEM
========================================================= */

function resolveUser(
    guild,
    value
) {
    if (!value) {
        return null;
    }

    const cleaned =
        String(value)
            .replace(
                /[<@!>]/g,
                ""
            );

    return (
        guild.members.cache.get(
            cleaned
        ) ||
        guild.client.users.cache.get(
            cleaned
        ) ||
        null
    );
}

function resolveChannel(
    guild,
    value
) {
    if (!value) {
        return null;
    }

    const cleaned =
        String(value)
            .replace(
                /[<#>]/g,
                ""
            );

    return (
        guild.channels.cache.get(
            cleaned
        ) || null
    );
}

function resolveRole(
    guild,
    value
) {
    if (!value) {
        return null;
    }

    const cleaned =
        String(value)
            .replace(
                /[<@&>]/g,
                ""
            );

    return (
        guild.roles.cache.get(
            cleaned
        ) || null
    );
}

/*
    Discord option types:

    1  = SUB_COMMAND
    2  = SUB_COMMAND_GROUP
    3  = STRING
    4  = INTEGER
    5  = BOOLEAN
    6  = USER
    7  = CHANNEL
    8  = ROLE
    9  = MENTIONABLE
    10 = NUMBER
*/

function parseOptions(
    optionDefinitions,
    args,
    guild
) {
    const options = {};
    let remaining = [...args];

    for (
        let i = 0;
        i < optionDefinitions.length;
        i++
    ) {
        const option =
            optionDefinitions[i];

        if (
            option.type === 1 ||
            option.type === 2
        ) {
            continue;
        }

        const isLastOption =
            i ===
            optionDefinitions.length - 1;

        let value;

        if (
            option.type === 3 &&
            isLastOption
        ) {
            value =
                remaining.join(" ");

            remaining = [];
        } else {
            value =
                remaining.shift();
        }

        if (
            value === undefined
        ) {
            options[option.name] =
                null;

            continue;
        }

        switch (option.type) {
            case 3:
                options[option.name] =
                    value;
                break;

            case 4:
                options[option.name] =
                    Number(value);
                break;

            case 5:
                options[option.name] =
                    String(value).toLowerCase() ===
                    "true";
                break;

            case 6:
                options[option.name] =
                    resolveUser(
                        guild,
                        value
                    );
                break;

            case 7:
                options[option.name] =
                    resolveChannel(
                        guild,
                        value
                    );
                break;

            case 8:
                options[option.name] =
                    resolveRole(
                        guild,
                        value
                    );
                break;

            case 9:
                options[option.name] =
                    resolveUser(
                        guild,
                        value
                    ) ||
                    resolveRole(
                        guild,
                        value
                    );
                break;

            case 10:
                options[option.name] =
                    Number(value);
                break;

            default:
                options[option.name] =
                    value;
        }
    }

    return options;
}

function parsePrefixArguments(
    command,
    args,
    guild
) {
    const commandOptions =
        command.data?.options || [];

    let remainingArgs =
        [...args];

    let subcommand =
        null;

    const subcommands =
        commandOptions.filter(
            option =>
                option.type === 1
        );

    if (
        subcommands.length > 0 &&
        remainingArgs.length > 0
    ) {
        const possibleSubcommand =
            remainingArgs[0].toLowerCase();

        const selectedSubcommand =
            subcommands.find(
                option =>
                    option.name ===
                    possibleSubcommand
            );

        if (selectedSubcommand) {
            subcommand =
                selectedSubcommand.name;

            remainingArgs.shift();

            return {
                options:
                    parseOptions(
                        selectedSubcommand.options || [],
                        remainingArgs,
                        guild
                    ),

                subcommand
            };
        }
    }

    return {
        options:
            parseOptions(
                commandOptions,
                remainingArgs,
                guild
            ),

        subcommand
    };
}

/* =========================================================
   PREFIX INTERACTION ADAPTER
========================================================= */

function createPrefixInteraction(
    message,
    command,
    args
) {
    const parsed =
        parsePrefixArguments(
            command,
            args,
            message.guild
        );

    let replyMessage = null;

    const options = {
        getString(name) {
            const value =
                parsed.options[name];

            return value == null
                ? null
                : String(value);
        },

        getInteger(name) {
            const value =
                parsed.options[name];

            return value == null
                ? null
                : Number(value);
        },

        getNumber(name) {
            const value =
                parsed.options[name];

            return value == null
                ? null
                : Number(value);
        },

        getBoolean(name) {
            return Boolean(
                parsed.options[name]
            );
        },

        getUser(name) {
            const value =
                parsed.options[name];

            if (!value) {
                return null;
            }

            return value.user ||
                value;
        },

        getMember(name) {
            const value =
                parsed.options[name];

            if (!value) {
                return null;
            }

            return value.member ||
                value;
        },

        getChannel(name) {
            return (
                parsed.options[name] ||
                null
            );
        },

        getRole(name) {
            return (
                parsed.options[name] ||
                null
            );
        },

        getMentionable(name) {
            return (
                parsed.options[name] ||
                null
            );
        },

        getSubcommand() {
            if (!parsed.subcommand) {
                throw new Error(
                    "This command does not have a subcommand."
                );
            }

            return parsed.subcommand;
        }
    };

    const prefixInteraction = {
        id: message.id,

        user: message.author,

        author: message.author,

        member: message.member,

        guild: message.guild,

        guildId: message.guildId,

        channel: message.channel,

        channelId: message.channelId,

        client: message.client,

        createdTimestamp:
            message.createdTimestamp,

        createdAt:
            message.createdAt,

        applicationId:
            message.client.application?.id || null,

        commandName:
            command.data.name,

        command:
            command,

        options,

        replied: false,

        deferred: false,

        _replyMessage: null,

        isChatInputCommand() {
            return true;
        },

        isPrefixCommand: true,

        isRepliable() {
            return true;
        },

        async reply(payload) {
            this.replied = true;

            let safePayload;

            if (
                typeof payload === "string"
            ) {
                safePayload = {
                    content: payload
                };
            } else {
                safePayload = {
                    ...payload
                };
            }

            delete safePayload.ephemeral;

            replyMessage =
                await message.reply(
                    safePayload
                );

            this._replyMessage =
                replyMessage;

            return replyMessage;
        },

        async followUp(payload) {
            let safePayload;

            if (
                typeof payload === "string"
            ) {
                safePayload = {
                    content: payload
                };
            } else {
                safePayload = {
                    ...payload
                };
            }

            delete safePayload.ephemeral;

            replyMessage =
                await message.reply(
                    safePayload
                );

            this._replyMessage =
                replyMessage;

            return replyMessage;
        },

        async deferReply() {
            this.deferred = true;
        },

        async editReply(payload) {
            let safePayload;

            if (
                typeof payload === "string"
            ) {
                safePayload = {
                    content: payload
                };
            } else {
                safePayload = {
                    ...payload
                };
            }

            delete safePayload.ephemeral;

            if (this._replyMessage) {
                return this._replyMessage.edit(
                    safePayload
                );
            }

            return this.reply(
                safePayload
            );
        },

        async deleteReply() {
            if (this._replyMessage) {
                return this._replyMessage.delete();
            }

            return null;
        }
    };

    return prefixInteraction;
}

/* =========================================================
   READY
========================================================= */

client.once(
    "ready",
    () => {
        console.log(
            "========================================"
        );

        console.log(
            `✅ Logged in as ${client.user.tag}`
        );

        console.log(
            `📡 Serving ${client.guilds.cache.size} server(s)`
        );

        console.log(
            `⚙️ Loaded ${client.commands.size} command(s)`
        );

        console.log(
            "⌨️ Prefix system: ENABLED"
        );

        console.log(
            "🔵 Message Content Intent: REQUIRED"
        );

        console.log(
            "🛡️ Bot Ban system: ENABLED"
        );

        console.log(
            "🌐 Global Ban system: ENABLED"
        );

        console.log(
            "========================================"
        );
    }
);

/* =========================================================
   GLOBAL BAN ENFORCEMENT
========================================================= */

async function sendBanLog({
    action,
    user,
    reason = "No reason provided.",
    guild = null,
    moderator = null
}) {
    try {
        const supportServerId =
            process.env.SUPPORT_SERVER_ID;

        const banLogChannelId =
            process.env.BAN_LOG_CHANNEL_ID;

        if (!banLogChannelId) {
            console.warn(
                "⚠️ BAN_LOG_CHANNEL_ID is missing from .env"
            );

            return;
        }

        /*
            Never send ban logs to the support server
            through normal guild logging.
        */

        let logGuild = null;

        if (guild) {
            logGuild = guild;
        }

        /*
            If the current guild is the support server,
            use the configured support server only as the
            log destination if appropriate.
        */

        if (!logGuild) {
            logGuild =
                client.guilds.cache.get(
                    supportServerId
                );
        }

        if (!logGuild) {
            return;
        }

        let channel =
            logGuild.channels.cache.get(
                banLogChannelId
            );

        if (!channel) {
            channel =
                await logGuild.channels.fetch(
                    banLogChannelId
                ).catch(
                    () => null
                );
        }

        if (
            !channel ||
            !channel.isTextBased()
        ) {
            console.warn(
                "⚠️ Ban log channel could not be found."
            );

            return;
        }

        const embed =
            new EmbedBuilder()
                .setColor(
                    action === "Global Ban"
                        ? 0xED4245
                        : 0x5865F2
                )
                .setTitle(
                    action === "Global Ban"
                        ? "🌐 Global Ban"
                        : "🤖 Bot Ban"
                )
                .setDescription(
                    action === "Global Ban"
                        ? "A user has been globally banned by Atlas."
                        : "A user has been banned from using Atlas."
                )
                .addFields(
                    {
                        name: "👤 User",
                        value:
                            `${user}\n\`${user.id}\``,
                        inline: true
                    },
                    {
                        name: "🛡️ Action",
                        value:
                            action,
                        inline: true
                    },
                    {
                        name: "📝 Reason",
                        value:
                            String(reason)
                                .slice(0, 1024),
                        inline: false
                    },
                    {
                        name: "🌐 Server",
                        value:
                            guild
                                ? `${guild.name}\n\`${guild.id}\``
                                : "Global",
                        inline: true
                    },
                    {
                        name: "👮 Moderator",
                        value:
                            moderator
                                ? `${moderator}\n\`${moderator.id}\``
                                : "Atlas",
                        inline: true
                    }
                )
                .setThumbnail(
                    user.displayAvatarURL({
                        extension: "png",
                        size: 256
                    })
                )
                .setFooter({
                    text:
                        "Atlas Utilities • Ban Logs"
                })
                .setTimestamp();

        await channel.send({
            embeds: [embed]
        });

        console.log(
            `✅ ${action} log sent for ${user.tag || user.username}.`
        );

    } catch (error) {
        console.error(
            "❌ Failed to send ban log:",
            error
        );

        await sendBotErrorLog(
            error,
            {
                type: "Ban Log",
                guild,
                user,
                command: action
            }
        );
    }
}

async function sendBanDM({
    user,
    action,
    reason
}) {
    try {
        const embed =
            new EmbedBuilder()
                .setColor(
                    action === "Global Ban"
                        ? 0xED4245
                        : 0x5865F2
                )
                .setTitle(
                    action === "Global Ban"
                        ? "🌐 You Have Been Globally Banned"
                        : "🤖 You Have Been Bot Banned"
                )
                .setDescription(
                    action === "Global Ban"
                        ? "You have been globally banned from servers using Atlas Utilities."
                        : "You have been banned from using Atlas Utilities."
                )
                .addFields(
                    {
                        name: "📝 Reason",
                        value:
                            String(
                                reason ||
                                "No reason provided."
                            ).slice(0, 1024),
                        inline: false
                    },
                    {
                        name: "🆔 User ID",
                        value:
                            `\`${user.id}\``,
                        inline: true
                    },
                    {
                        name: "🤖 System",
                        value:
                            "Atlas Utilities",
                        inline: true
                    }
                )
                .setFooter({
                    text:
                        "Atlas Utilities • Ban System"
                })
                .setTimestamp();

        await user.send({
            embeds: [embed]
        });

        console.log(
            `📩 Ban DM sent to ${user.tag || user.username}.`
        );

        return true;

    } catch (error) {
        console.warn(
            `⚠️ Could not DM ${user.tag || user.username} before ban.`
        );

        return false;
    }
}

client.on(
    "guildMemberAdd",
    async member => {
        try {
            if (
                !member ||
                !member.user
            ) {
                return;
            }

            /*
                Never enforce Global Bans in the
                Atlas support server.
            */

            const supportServerId =
                process.env.SUPPORT_SERVER_ID;

            if (
                supportServerId &&
                member.guild.id ===
                    supportServerId
            ) {
                console.log(
                    `🛡️ Global Ban skipped in support server for ${member.user.tag}.`
                );

                return;
            }

            if (
                member.user.bot &&
                member.user.id === client.user?.id
            ) {
                return;
            }

            if (
                !isGloballyBanned(
                    member.user.id
                )
            ) {
                return;
            }

            console.log(
                `🌐 Global ban detected: ${member.user.tag} (${member.user.id}) joined ${member.guild.name}`
            );

            /*
                Get the bot's member object.
            */

            const botMember =
                member.guild.members.me;

            if (!botMember) {
                console.warn(
                    `⚠️ Could not find Atlas in ${member.guild.name}.`
                );

                return;
            }

            /*
                Check Ban Members permission.
            */

            if (
                !botMember.permissions.has(
                    PermissionFlagsBits.BanMembers
                )
            ) {
                console.warn(
                    `⚠️ Atlas cannot enforce Global Ban in ${member.guild.name}: missing Ban Members permission.`
                );

                return;
            }

            /*
                Get stored ban information.
            */

            const bans =
                loadGlobalBans();

            const banData =
                bans[member.user.id];

            const reason =
                typeof banData === "object"
                    ? (
                        banData.reason ||
                        "No reason provided."
                    )
                    : "Atlas Global Ban";

            /*
                DM USER BEFORE BAN
            */

            await sendBanDM({
                user:
                    member.user,
                action:
                    "Global Ban",
                reason
            });

            /*
                BAN USER
            */

            await member.ban({
                reason:
                    `Atlas Global Ban: ${String(reason).slice(0, 400)}`
            });

            console.log(
                `✅ Globally banned ${member.user.tag} from ${member.guild.name}.`
            );

            /*
                SEND BAN LOG
            */

            await sendBanLog({
                action:
                    "Global Ban",
                user:
                    member.user,
                reason,
                guild:
                    member.guild,
                moderator:
                    null
            });

        } catch (error) {
            console.error(
                "❌ Global ban enforcement error:",
                error
            );

            await sendBotErrorLog(
                error,
                {
                    type:
                        "Global Ban Enforcement",
                    guild:
                        member?.guild || null,
                    user:
                        member?.user || null,
                    command:
                        "guildMemberAdd"
                }
            );
        }
    }
);

/* =========================================================
   PREFIX COMMANDS
========================================================= */

client.on(
    "messageCreate",
    async message => {
        try {
            if (
                message.author.bot ||
                !message.guild
            ) {
                return;
            }

            console.log(
                `📨 Message received: "${message.content}"`
            );

            if (
                isBotBanned(
                    message.author.id
                )
            ) {
                return message.reply(
                    "🚫 You are banned from using Atlas."
                );
            }

            const configuredPrefix =
                getPrefix(
                    message.guild.id
                );

            let usedPrefix = null;

            if (
                configuredPrefix &&
                message.content.startsWith(
                    configuredPrefix
                )
            ) {
                usedPrefix =
                    configuredPrefix;
            }

            if (
                !usedPrefix &&
                message.content.startsWith(
                    "a!"
                )
            ) {
                usedPrefix =
                    "a!";
            }

            if (!usedPrefix) {
                return;
            }

            const content =
                message.content
                    .slice(
                        usedPrefix.length
                    )
                    .trim();

            if (!content) {
                return;
            }

            const args =
                content.split(
                    /\s+/
                );

            const commandName =
                args
                    .shift()
                    .toLowerCase();

            console.log(
                `⌨️ Prefix command detected: ${commandName}`
            );

            const command =
                client.commands.get(
                    commandName
                );

            if (!command) {
                console.log(
                    `❌ Unknown prefix command: ${commandName}`
                );

                return message.reply(
                    `❌ Unknown command: \`${commandName}\``
                );
            }

            const prefixInteraction =
                createPrefixInteraction(
                    message,
                    command,
                    args
                );

            console.log(
                `▶️ Executing prefix command: ${commandName}`
            );

            await command.execute(
                prefixInteraction
            );

            console.log(
                `✅ Prefix command completed: ${commandName}`
            );

        } catch (error) {
            console.error(
                "❌ Prefix command error:",
                error
            );

            await sendBotErrorLog(
                error,
                {
                    type: "Prefix Command",
                    guild: message.guild,
                    user: message.author,
                    command: message.content
                }
            );

            try {
                await message.reply(
                    "❌ Something went wrong while running that command."
                );
            } catch {}
        }
    }
);

/* =========================================================
   INTERACTIONS
========================================================= */

client.on(
    "interactionCreate",
    async interaction => {
        try {

            /* =====================================================
               BOT BAN
            ===================================================== */

            if (
                interaction.user &&
                isBotBanned(
                    interaction.user.id
                )
            ) {
                if (
                    interaction.isRepliable()
                ) {
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

            if (
                interaction.isChatInputCommand()
            ) {
                const command =
                    client.commands.get(
                        interaction.commandName
                    );

                if (!command) {
                    console.warn(
                        `⚠️ Unknown command: ${interaction.commandName}`
                    );

                    return;
                }

                console.log(
                    `⚡ Slash command: /${interaction.commandName}`
                );

                await command.execute(
                    interaction
                );

                console.log(
                    `✅ Slash command completed: /${interaction.commandName}`
                );

                return;
            }

            /* =====================================================
               MAIN SETUP MENU
            ===================================================== */

            if (
                interaction.isStringSelectMenu() &&
                interaction.customId ===
                    "atlas_setup"
            ) {
                const selected =
                    interaction.values[0];

                if (
                    selected === "moderation"
                ) {
                    return interaction.update(
                        setup.createModerationPanel()
                    );
                }

                if (
                    selected === "logging"
                ) {
                    return interaction.update(
                        setup.createLoggingPanel()
                    );
                }

                if (
                    selected === "welcome"
                ) {
                    return interaction.update(
                        setup.createWelcomePanel()
                    );
                }

                if (
                    selected === "tickets"
                ) {
                    return interaction.update(
                        setup.createTicketsPanel()
                    );
                }

                if (
                    selected === "automod"
                ) {
                    return interaction.update(
                        setup.createAutoModPanel()
                    );
                }

                if (
                    selected === "permissions"
                ) {
                    return interaction.update(
                        setup.createPermissionsPanel()
                    );
                }

                return;
            }

            /* =====================================================
               BACK TO SETUP
            ===================================================== */

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "atlas_setup_back"
            ) {
                return interaction.update({
                    embeds: [
                        setup.createMainEmbed()
                    ],
                    components: [
                        setup.createMainMenu()
                    ]
                });
            }

            /* =====================================================
               LOGGING CHANNEL
            ===================================================== */

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "atlas_logging_channel"
            ) {
                const menu =
                    new ChannelSelectMenuBuilder()
                        .setCustomId(
                            "atlas_logging_channel_select"
                        )
                        .setPlaceholder(
                            "Select the logging channel..."
                        )
                        .setChannelTypes(
                            ChannelType.GuildText
                        );

                return interaction.reply({
                    content:
                        "📋 Select the channel where Atlas should send logs.",

                    components: [
                        new ActionRowBuilder()
                            .addComponents(menu)
                    ],

                    ephemeral: true
                });
            }

            if (
                interaction.isChannelSelectMenu() &&
                interaction.customId ===
                    "atlas_logging_channel_select"
            ) {
                const channel =
                    interaction.channels.first();

                if (!channel) {
                    return interaction.update({
                        content:
                            "❌ Invalid channel.",
                        components: []
                    });
                }

                const config =
                    loadConfig();

                if (
                    !config[interaction.guild.id]
                ) {
                    config[
                        interaction.guild.id
                    ] = {};
                }

                if (
                    !config[
                        interaction.guild.id
                    ].logging
                ) {
                    config[
                        interaction.guild.id
                    ].logging = {};
                }

                config[
                    interaction.guild.id
                ].logging.channel =
                    channel.id;

                saveConfig(config);

                return interaction.update({
                    content:
                        `✅ Logging channel set to ${channel}.`,
                    components: []
                });
            }

            /* =====================================================
               LOGGING EVENTS
            ===================================================== */

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "atlas_logging_events"
            ) {
                const menu =
                    new StringSelectMenuBuilder()
                        .setCustomId(
                            "atlas_logging_events_select"
                        )
                        .setPlaceholder(
                            "Select logging events..."
                        )
                        .setMinValues(1)
                        .setMaxValues(1)
                        .addOptions({
                            label:
                                "Moderation",
                            description:
                                "Log moderation actions.",
                            value:
                                "moderation",
                            emoji:
                                "🛡️"
                        });

                return interaction.reply({
                    content:
                        "⚙️ Select the events Atlas should log.",

                    components: [
                        new ActionRowBuilder()
                            .addComponents(menu)
                    ],

                    ephemeral: true
                });
            }

            if (
                interaction.isStringSelectMenu() &&
                interaction.customId ===
                    "atlas_logging_events_select"
            ) {
                const event =
                    interaction.values[0];

                const config =
                    loadConfig();

                if (
                    !config[interaction.guild.id]
                ) {
                    config[
                        interaction.guild.id
                    ] = {};
                }

                if (
                    !config[
                        interaction.guild.id
                    ].logging
                ) {
                    config[
                        interaction.guild.id
                    ].logging = {};
                }

                config[
                    interaction.guild.id
                ].logging.events =
                    [event];

                config[
                    interaction.guild.id
                ].logging.enabled =
                    true;

                saveConfig(config);

                return interaction.update({
                    content:
                        `✅ Logging event enabled: **${event}**`,
                    components: []
                });
            }

            /* =====================================================
               LOGGING TOGGLE
            ===================================================== */

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "atlas_logging_toggle"
            ) {
                const config =
                    loadConfig();

                if (
                    !config[interaction.guild.id]
                ) {
                    config[
                        interaction.guild.id
                    ] = {};
                }

                if (
                    !config[
                        interaction.guild.id
                    ].logging
                ) {
                    config[
                        interaction.guild.id
                    ].logging = {};
                }

                const logging =
                    config[
                        interaction.guild.id
                    ].logging;

                logging.enabled =
                    !logging.enabled;

                saveConfig(config);

                return interaction.reply({
                    content:
                        logging.enabled
                            ? "✅ Logging has been enabled."
                            : "❌ Logging has been disabled.",

                    ephemeral: true
                });
            }

            /* =====================================================
               TICKET CATEGORY
            ===================================================== */

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "atlas_ticket_category"
            ) {
                const menu =
                    new ChannelSelectMenuBuilder()
                        .setCustomId(
                            "atlas_ticket_category_select"
                        )
                        .setPlaceholder(
                            "Select the ticket category..."
                        )
                        .setChannelTypes(
                            ChannelType.GuildCategory
                        );

                return interaction.reply({
                    content:
                        "📁 Select the category where tickets should be created.",

                    components: [
                        new ActionRowBuilder()
                            .addComponents(menu)
                    ],

                    ephemeral: true
                });
            }

            if (
                interaction.isChannelSelectMenu() &&
                interaction.customId ===
                    "atlas_ticket_category_select"
            ) {
                const channel =
                    interaction.channels.first();

                if (!channel) {
                    return interaction.update({
                        content:
                            "❌ Invalid category.",
                        components: []
                    });
                }

                const config =
                    loadConfig();

                if (
                    !config[interaction.guild.id]
                ) {
                    config[
                        interaction.guild.id
                    ] = {};
                }

                if (
                    !config[
                        interaction.guild.id
                    ].tickets
                ) {
                    config[
                        interaction.guild.id
                    ].tickets = {};
                }

                config[
                    interaction.guild.id
                ].tickets.category =
                    channel.id;

                saveConfig(config);

                return interaction.update({
                    content:
                        `✅ Ticket category set to ${channel}.`,
                    components: []
                });
            }

            /* =====================================================
               TICKET STAFF ROLE
            ===================================================== */

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "atlas_ticket_role"
            ) {
                const menu =
                    new RoleSelectMenuBuilder()
                        .setCustomId(
                            "atlas_ticket_role_select"
                        )
                        .setPlaceholder(
                            "Select the ticket staff role..."
                        );

                return interaction.reply({
                    content:
                        "👮 Select the role that should manage tickets.",

                    components: [
                        new ActionRowBuilder()
                            .addComponents(menu)
                    ],

                    ephemeral: true
                });
            }

            if (
                interaction.isRoleSelectMenu() &&
                interaction.customId ===
                    "atlas_ticket_role_select"
            ) {
                const role =
                    interaction.roles.first();

                if (!role) {
                    return interaction.update({
                        content:
                            "❌ Invalid role.",
                        components: []
                    });
                }

                const config =
                    loadConfig();

                if (
                    !config[interaction.guild.id]
                ) {
                    config[
                        interaction.guild.id
                    ] = {};
                }

                if (
                    !config[
                        interaction.guild.id
                    ].tickets
                ) {
                    config[
                        interaction.guild.id
                    ].tickets = {};
                }

                config[
                    interaction.guild.id
                ].tickets.staffRole =
                    role.id;

                saveConfig(config);

                return interaction.update({
                    content:
                        `✅ Ticket staff role set to ${role}.`,
                    components: []
                });
            }

            /* =====================================================
               TICKET LOG CHANNEL
            ===================================================== */

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "atlas_ticket_log_channel"
            ) {
                const menu =
                    new ChannelSelectMenuBuilder()
                        .setCustomId(
                            "atlas_ticket_log_channel_select"
                        )
                        .setPlaceholder(
                            "Select the ticket log channel..."
                        )
                        .setChannelTypes(
                            ChannelType.GuildText
                        );

                return interaction.reply({
                    content:
                        "📋 Select the channel where Atlas should send ticket logs.",

                    components: [
                        new ActionRowBuilder()
                            .addComponents(menu)
                    ],

                    ephemeral: true
                });
            }

            if (
                interaction.isChannelSelectMenu() &&
                interaction.customId ===
                    "atlas_ticket_log_channel_select"
            ) {
                const channel =
                    interaction.channels.first();

                if (!channel) {
                    return interaction.update({
                        content:
                            "❌ Invalid channel.",
                        components: []
                    });
                }

                const config =
                    loadConfig();

                if (
                    !config[interaction.guild.id]
                ) {
                    config[
                        interaction.guild.id
                    ] = {};
                }

                if (
                    !config[
                        interaction.guild.id
                    ].tickets
                ) {
                    config[
                        interaction.guild.id
                    ].tickets = {};
                }

                config[
                    interaction.guild.id
                ].tickets.logChannel =
                    channel.id;

                saveConfig(config);

                return interaction.update({
                    content:
                        `✅ Ticket log channel set to ${channel}.\n\n` +
                        "Ticket logging is now configured.",

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
                const tickets =
                    getTickets(
                        interaction.guild.id
                    );

                const modal =
                    new ModalBuilder()
                        .setCustomId(
                            "atlas_ticket_customize_modal"
                        )
                        .setTitle(
                            "Customize Ticket Panel"
                        );

                const title =
                    new TextInputBuilder()
                        .setCustomId(
                            "ticket_title"
                        )
                        .setLabel(
                            "Panel Title"
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setRequired(true)
                        .setMaxLength(256)
                        .setValue(
                            tickets.panels.title
                        );

                const description =
                    new TextInputBuilder()
                        .setCustomId(
                            "ticket_description"
                        )
                        .setLabel(
                            "Panel Description"
                        )
                        .setStyle(
                            TextInputStyle.Paragraph
                        )
                        .setRequired(true)
                        .setMaxLength(4000)
                        .setValue(
                            tickets.panels.description
                        );

                const buttonText =
                    new TextInputBuilder()
                        .setCustomId(
                            "ticket_button"
                        )
                        .setLabel(
                            "Button Text"
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setRequired(true)
                        .setMaxLength(80)
                        .setValue(
                            tickets.panels.buttonText
                        );

                const emoji =
                    new TextInputBuilder()
                        .setCustomId(
                            "ticket_emoji"
                        )
                        .setLabel(
                            "Button Emoji"
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setRequired(false)
                        .setMaxLength(20)
                        .setValue(
                            tickets.panels.buttonEmoji
                        );

                const color =
                    new TextInputBuilder()
                        .setCustomId(
                            "ticket_color"
                        )
                        .setLabel(
                            "Embed Color"
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setRequired(false)
                        .setMaxLength(20)
                        .setValue(
                            String(
                                tickets.panels.color
                            )
                        );

                modal.addComponents(
                    new ActionRowBuilder()
                        .addComponents(title),

                    new ActionRowBuilder()
                        .addComponents(description),

                    new ActionRowBuilder()
                        .addComponents(buttonText),

                    new ActionRowBuilder()
                        .addComponents(emoji),

                    new ActionRowBuilder()
                        .addComponents(color)
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
                const config =
                    loadConfig();

                const tickets =
                    getTickets(
                        interaction.guild.id
                    );

                tickets.panels.title =
                    interaction.fields.getTextInputValue(
                        "ticket_title"
                    );

                tickets.panels.description =
                    interaction.fields.getTextInputValue(
                        "ticket_description"
                    );

                tickets.panels.buttonText =
                    interaction.fields.getTextInputValue(
                        "ticket_button"
                    );

                tickets.panels.buttonEmoji =
                    interaction.fields.getTextInputValue(
                        "ticket_emoji"
                    ) || "🎫";

                const colorInput =
                    interaction.fields.getTextInputValue(
                        "ticket_color"
                    );

                if (colorInput) {
                    const parsed =
                        Number(
                            colorInput
                        );

                    if (
                        !Number.isNaN(parsed)
                    ) {
                        tickets.panels.color =
                            parsed;
                    }
                }

                config[
                    interaction.guild.id
                ].tickets =
                    tickets;

                saveConfig(config);

                return interaction.reply({
                    content:
                        "✅ Ticket panel customization saved.",
                    ephemeral: true
                });
            }

            /* =====================================================
               TICKET TOGGLE
            ===================================================== */

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "atlas_ticket_toggle"
            ) {
                const config =
                    loadConfig();

                if (
                    !config[interaction.guild.id]
                ) {
                    config[
                        interaction.guild.id
                    ] = {};
                }

                if (
                    !config[
                        interaction.guild.id
                    ].tickets
                ) {
                    config[
                        interaction.guild.id
                    ].tickets = {};
                }

                const tickets =
                    config[
                        interaction.guild.id
                    ].tickets;

                tickets.enabled =
                    !tickets.enabled;

                saveConfig(config);

                return interaction.reply({
                    content:
                        tickets.enabled
                            ? "✅ Tickets have been enabled."
                            : "❌ Tickets have been disabled.",

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
                const tickets =
                    getTickets(
                        interaction.guild.id
                    );

                if (!tickets.enabled) {
                    return interaction.reply({
                        content:
                            "❌ Tickets are currently disabled. Enable them first.",
                        ephemeral: true
                    });
                }

                const panel =
                    tickets.panels;

                const embed =
                    new EmbedBuilder()
                        .setColor(
                            panel.color
                        )
                        .setTitle(
                            panel.title
                        )
                        .setDescription(
                            panel.description
                        )
                        .setFooter({
                            text:
                                "Atlas Utilities • Tickets"
                        })
                        .setTimestamp();

                const button =
                    new ButtonBuilder()
                        .setCustomId(
                            "atlas_ticket_create"
                        )
                        .setLabel(
                            panel.buttonText
                        )
                        .setStyle(
                            ButtonStyle.Primary
                        );

                if (
                    panel.buttonEmoji
                ) {
                    button.setEmoji(
                        panel.buttonEmoji
                    );
                }

                await interaction.channel.send({
                    embeds: [embed],
                    components: [
                        new ActionRowBuilder()
                            .addComponents(
                                button
                            )
                    ]
                });

                return interaction.reply({
                    content:
                        "✅ Ticket panel sent.",
                    ephemeral: true
                });
            }

            /* =====================================================
               CREATE TICKET
            ===================================================== */

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "atlas_ticket_create"
            ) {
                const tickets =
                    getTickets(
                        interaction.guild.id
                    );

                if (!tickets.enabled) {
                    return interaction.reply({
                        content:
                            "❌ The ticket system is currently disabled.",
                        ephemeral: true
                    });
                }

                if (!tickets.category) {
                    return interaction.reply({
                        content:
                            "❌ No ticket category has been configured.",
                        ephemeral: true
                    });
                }

                if (!tickets.staffRole) {
                    return interaction.reply({
                        content:
                            "❌ No ticket staff role has been configured.",
                        ephemeral: true
                    });
                }

                const existingTicket =
                    Object.entries(
                        tickets.active
                    ).find(
                        ([, ticket]) =>
                            ticket.userId ===
                                interaction.user.id &&
                            ticket.status ===
                                "open"
                    );

                if (existingTicket) {
                    const existingChannel =
                        interaction.guild.channels.cache.get(
                            existingTicket[0]
                        );

                    if (existingChannel) {
                        return interaction.reply({
                            content:
                                `❌ You already have an open ticket: ${existingChannel}`,
                            ephemeral: true
                        });
                    }
                }

                const safeName =
                    `ticket-${interaction.user.username}`
                        .toLowerCase()
                        .replace(
                            /[^a-z0-9-]/g,
                            ""
                        )
                        .slice(0, 90) ||
                    `ticket-${interaction.user.id}`;

                const channel =
                    await interaction.guild.channels.create({
                        name: safeName,

                        type:
                            ChannelType.GuildText,

                        parent:
                            tickets.category,

                        permissionOverwrites: [
                            {
                                id:
                                    interaction.guild.id,

                                deny: [
                                    PermissionFlagsBits.ViewChannel
                                ]
                            },

                            {
                                id:
                                    interaction.user.id,

                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory
                                ]
                            },

                            {
                                id:
                                    tickets.staffRole,

                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory,
                                    PermissionFlagsBits.ManageMessages
                                ]
                            }
                        ]
                    });

                const openedAt =
                    new Date().toISOString();

                tickets.active[channel.id] = {
                    userId:
                        interaction.user.id,

                    claimedBy: null,

                    openedAt,

                    closedAt: null,

                    closedBy: null,

                    closeReason: null,

                    deletedBy: null,

                    deleteReason: null,

                    deletedAt: null,

                    status: "open"
                };

                const config =
                    loadConfig();

                config[
                    interaction.guild.id
                ].tickets =
                    tickets;

                saveConfig(config);

                const embed =
                    new EmbedBuilder()
                        .setColor(0x5865F2)
                        .setTitle(
                            "🎫 Ticket Created"
                        )
                        .setDescription(
                            `Welcome ${interaction.user}!\n\n` +
                            "A member of our staff team will assist you shortly.\n\n" +
                            "Please explain your issue clearly."
                        )
                        .addFields(
                            {
                                name:
                                    "👤 Opened By",
                                value:
                                    `${interaction.user}`,
                                inline:
                                    true
                            },
                            {
                                name:
                                    "🕐 Opened",
                                value:
                                    formatTime(
                                        openedAt
                                    ),
                                inline:
                                    true
                            }
                        )
                        .setFooter({
                            text:
                                "Atlas Utilities • Tickets"
                        })
                        .setTimestamp();

                await channel.send({
                    content:
                        `${interaction.user} <@&${tickets.staffRole}>`,

                    embeds: [embed],

                    components: [
                        createTicketButtons(
                            tickets.active[
                                channel.id
                            ]
                        )
                    ]
                });

                try {
                    await interaction.user.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(
                                    0x5865F2
                                )
                                .setTitle(
                                    "🎫 Ticket Created"
                                )
                                .setDescription(
                                    `Your ticket has been created in **${interaction.guild.name}**.`
                                )
                                .addFields({
                                    name:
                                        "Ticket",
                                    value:
                                        `${channel}`
                                })
                                .setTimestamp()
                        ]
                    });
                } catch {
                    console.log(
                        "⚠️ Could not DM ticket creator."
                    );
                }

                await sendTicketLog(
                    interaction.guild,

                    createTicketLogEmbed(
                        "🎫 Ticket Created",

                        0x5865F2,

                        [
                            {
                                name:
                                    "🎫 Ticket",
                                value:
                                    `${channel}`,
                                inline:
                                    true
                            },
                            {
                                name:
                                    "👤 Opened By",
                                value:
                                    `${interaction.user}`,
                                inline:
                                    true
                            },
                            {
                                name:
                                    "🕐 Opened",
                                value:
                                    formatTime(
                                        openedAt
                                    ),
                                inline:
                                    true
                            }
                        ]
                    ),

                    interaction.user,

                    "Ticket Create"
                );

                return interaction.reply({
                    content:
                        `✅ Your ticket has been created: ${channel}`,

                    ephemeral: true
                });
            }

            /* =====================================================
               CLAIM TICKET
            ===================================================== */

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "atlas_ticket_claim"
            ) {
                const tickets =
                    getTickets(
                        interaction.guild.id
                    );

                const ticket =
                    tickets.active[
                        interaction.channel.id
                    ];

                if (!ticket) {
                    return interaction.reply({
                        content:
                            "❌ This channel is not an active ticket.",
                        ephemeral: true
                    });
                }

                if (
                    !isTicketStaff(
                        interaction.member
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ You don't have permission to claim tickets.",
                        ephemeral: true
                    });
                }

                if (ticket.claimedBy) {
                    return interaction.reply({
                        content:
                            "❌ This ticket has already been claimed.",
                        ephemeral: true
                    });
                }

                ticket.claimedBy =
                    interaction.user.id;

                const config =
                    loadConfig();

                config[
                    interaction.guild.id
                ].tickets =
                    tickets;

                saveConfig(config);

                await interaction.channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(
                                0x57F287
                            )
                            .setDescription(
                                `🙋 **${interaction.user}** claimed this ticket.`
                            )
                            .setTimestamp()
                    ]
                });

                await sendTicketLog(
                    interaction.guild,

                    createTicketLogEmbed(
                        "🙋 Ticket Claimed",

                        0x57F287,

                        [
                            {
                                name:
                                    "🎫 Ticket",
                                value:
                                    `${interaction.channel}`,
                                inline:
                                    true
                            },
                            {
                                name:
                                    "👤 Claimed By",
                                value:
                                    `${interaction.user}`,
                                inline:
                                    true
                            }
                        ]
                    ),

                    interaction.user,

                    "Ticket Claim"
                );

                return interaction.reply({
                    content:
                        "✅ Ticket claimed.",
                    ephemeral:
                        true
                });
            }

            /* =====================================================
               UNCLAIM TICKET
            ===================================================== */

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "atlas_ticket_unclaim"
            ) {
                const tickets =
                    getTickets(
                        interaction.guild.id
                    );

                const ticket =
                    tickets.active[
                        interaction.channel.id
                    ];

                if (!ticket) {
                    return interaction.reply({
                        content:
                            "❌ This channel is not an active ticket.",
                        ephemeral:
                            true
                    });
                }

                if (
                    ticket.claimedBy !==
                    interaction.user.id
                ) {
                    return interaction.reply({
                        content:
                            "❌ Only the person who claimed this ticket can unclaim it.",
                        ephemeral:
                            true
                    });
                }

                ticket.claimedBy = null;

                const config =
                    loadConfig();

                config[
                    interaction.guild.id
                ].tickets =
                    tickets;

                saveConfig(config);

                await interaction.channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(
                                0xFEE75C
                            )
                            .setDescription(
                                `↩️ **${interaction.user}** unclaimed this ticket.`
                            )
                            .setTimestamp()
                    ]
                });

                await sendTicketLog(
                    interaction.guild,

                    createTicketLogEmbed(
                        "↩️ Ticket Unclaimed",

                        0xFEE75C,

                        [
                            {
                                name:
                                    "🎫 Ticket",
                                value:
                                    `${interaction.channel}`,
                                inline:
                                    true
                            },
                            {
                                name:
                                    "👤 Unclaimed By",
                                value:
                                    `${interaction.user}`,
                                inline:
                                    true
                            }
                        ]
                    ),

                    interaction.user,

                    "Ticket Unclaim"
                );

                return interaction.reply({
                    content:
                        "✅ Ticket unclaimed.",
                    ephemeral:
                        true
                });
            }

            /* =====================================================
               CLOSE TICKET
            ===================================================== */

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "atlas_ticket_close"
            ) {
                const tickets =
                    getTickets(
                        interaction.guild.id
                    );

                const ticket =
                    tickets.active[
                        interaction.channel.id
                    ];

                if (!ticket) {
                    return interaction.reply({
                        content:
                            "❌ This channel is not an active ticket.",
                        ephemeral:
                            true
                    });
                }

                const isOwner =
                    ticket.userId ===
                    interaction.user.id;

                if (
                    !isOwner &&
                    !isTicketStaff(
                        interaction.member
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ You don't have permission to close this ticket.",
                        ephemeral:
                            true
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

                const reason =
                    new TextInputBuilder()
                        .setCustomId(
                            "close_reason"
                        )
                        .setLabel(
                            "Close Reason"
                        )
                        .setStyle(
                            TextInputStyle.Paragraph
                        )
                        .setRequired(true)
                        .setMaxLength(1000)
                        .setPlaceholder(
                            "Why is this ticket being closed?"
                        );

                modal.addComponents(
                    new ActionRowBuilder()
                        .addComponents(
                            reason
                        )
                );

                return interaction.showModal(
                    modal
                );
            }

            if (
                interaction.isModalSubmit() &&
                interaction.customId ===
                    "atlas_ticket_close_modal"
            ) {
                const tickets =
                    getTickets(
                        interaction.guild.id
                    );

                const ticket =
                    tickets.active[
                        interaction.channel.id
                    ];

                if (!ticket) {
                    return interaction.reply({
                        content:
                            "❌ This ticket no longer exists.",
                        ephemeral:
                            true
                    });
                }

                const reason =
                    interaction.fields.getTextInputValue(
                        "close_reason"
                    );

                ticket.closedAt =
                    new Date().toISOString();

                ticket.closedBy =
                    interaction.user.id;

                ticket.closeReason =
                    reason;

                ticket.status =
                    "closed";

                const config =
                    loadConfig();

                config[
                    interaction.guild.id
                ].tickets =
                    tickets;

                saveConfig(config);

                try {
                    await interaction.channel.permissionOverwrites.edit(
                        ticket.userId,
                        {
                            ViewChannel: false,
                            SendMessages: false
                        }
                    );
                } catch (error) {
                    console.error(
                        "❌ Could not remove ticket owner access:",
                        error
                    );

                    await sendBotErrorLog(
                        error,
                        {
                            type:
                                "Ticket Close",
                            guild:
                                interaction.guild,
                            user:
                                interaction.user,
                            command:
                                "Ticket Close"
                        }
                    );
                }

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
                            .addFields(
                                {
                                    name:
                                        "👤 Closed By",
                                    value:
                                        `${interaction.user}`,
                                    inline:
                                        true
                                },
                                {
                                    name:
                                        "📝 Reason",
                                    value:
                                        reason,
                                    inline:
                                        false
                                },
                                {
                                    name:
                                        "🕐 Closed",
                                    value:
                                        formatTime(
                                            ticket.closedAt
                                        ),
                                    inline:
                                        true
                                }
                            )
                            .setTimestamp()
                    ],

                    components: [
                        createClosedTicketButtons()
                    ]
                });

                await sendTicketLog(
                    interaction.guild,

                    createTicketLogEmbed(
                        "🔒 Ticket Closed",

                        0xED4245,

                        [
                            {
                                name:
                                    "🎫 Ticket",
                                value:
                                    `${interaction.channel}`,
                                inline:
                                    true
                            },
                            {
                                name:
                                    "👤 Opened By",
                                value:
                                    `<@${ticket.userId}>`,
                                inline:
                                    true
                            },
                            {
                                name:
                                    "🛡️ Claimed By",
                                value:
                                    ticket.claimedBy
                                        ? `<@${ticket.claimedBy}>`
                                        : "Nobody",
                                inline:
                                    true
                            },
                            {
                                name:
                                    "🔒 Closed By",
                                value:
                                    `${interaction.user}`,
                                inline:
                                    true
                            },
                            {
                                name:
                                    "🕐 Opened",
                                value:
                                    formatTime(
                                        ticket.openedAt
                                    ),
                                inline:
                                    true
                            },
                            {
                                name:
                                    "🕐 Closed",
                                value:
                                    formatTime(
                                        ticket.closedAt
                                    ),
                                inline:
                                    true
                            },
                            {
                                name:
                                    "📝 Close Reason",
                                value:
                                    reason,
                                inline:
                                    false
                            }
                        ]
                    ),

                    interaction.user,

                    "Ticket Close"
                );

                return interaction.reply({
                    content:
                        "✅ Ticket closed.",
                    ephemeral:
                        true
                });
            }

            /* =====================================================
               DELETE TICKET
            ===================================================== */

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "atlas_ticket_delete"
            ) {
                const tickets =
                    getTickets(
                        interaction.guild.id
                    );

                const ticket =
                    tickets.active[
                        interaction.channel.id
                    ];

                if (!ticket) {
                    return interaction.reply({
                        content:
                            "❌ This ticket no longer exists.",
                        ephemeral:
                            true
                    });
                }

                if (
                    !isTicketStaff(
                        interaction.member
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ Only ticket staff can delete tickets.",
                        ephemeral:
                            true
                    });
                }

                if (
                    ticket.status !==
                    "closed"
                ) {
                    return interaction.reply({
                        content:
                            "❌ The ticket must be closed before it can be deleted.",
                        ephemeral:
                            true
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

                const reason =
                    new TextInputBuilder()
                        .setCustomId(
                            "delete_reason"
                        )
                        .setLabel(
                            "Delete Reason"
                        )
                        .setStyle(
                            TextInputStyle.Paragraph
                        )
                        .setRequired(true)
                        .setMaxLength(1000)
                        .setPlaceholder(
                            "Why is this ticket being deleted?"
                        );

                modal.addComponents(
                    new ActionRowBuilder()
                        .addComponents(
                            reason
                        )
                );

                return interaction.showModal(
                    modal
                );
            }

            if (
                interaction.isModalSubmit() &&
                interaction.customId ===
                    "atlas_ticket_delete_modal"
            ) {
                const tickets =
                    getTickets(
                        interaction.guild.id
                    );

                const ticket =
                    tickets.active[
                        interaction.channel.id
                    ];

                if (!ticket) {
                    return interaction.reply({
                        content:
                            "❌ This ticket no longer exists.",
                        ephemeral:
                            true
                    });
                }

                const deleteReason =
                    interaction.fields.getTextInputValue(
                        "delete_reason"
                    );

                ticket.deletedBy =
                    interaction.user.id;

                ticket.deleteReason =
                    deleteReason;

                ticket.deletedAt =
                    new Date().toISOString();

                ticket.status =
                    "deleted";

                const config =
                    loadConfig();

                config[
                    interaction.guild.id
                ].tickets =
                    tickets;

                saveConfig(config);

                const owner =
                    await client.users.fetch(
                        ticket.userId
                    ).catch(
                        () => null
                    );

                if (owner) {
                    try {
                        await owner.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(
                                        0xED4245
                                    )
                                    .setTitle(
                                        "🗑️ Ticket Deleted"
                                    )
                                    .setDescription(
                                        `Your ticket in **${interaction.guild.name}** has been deleted.`
                                    )
                                    .addFields(
                                        {
                                            name:
                                                "👤 Opened By",
                                            value:
                                                `<@${ticket.userId}>`,
                                            inline:
                                                true
                                        },
                                        {
                                            name:
                                                "🙋 Claimed By",
                                            value:
                                                ticket.claimedBy
                                                    ? `<@${ticket.claimedBy}>`
                                                    : "Nobody",
                                            inline:
                                                true
                                        },
                                        {
                                            name:
                                                "🔒 Closed By",
                                            value:
                                                ticket.closedBy
                                                    ? `<@${ticket.closedBy}>`
                                                    : "Unknown",
                                            inline:
                                                true
                                        },
                                        {
                                            name:
                                                "🗑️ Deleted By",
                                            value:
                                                `${interaction.user}`,
                                            inline:
                                                true
                                        },
                                        {
                                            name:
                                                "🕐 Opened",
                                            value:
                                                formatTime(
                                                    ticket.openedAt
                                                ),
                                            inline:
                                                true
                                        },
                                        {
                                            name:
                                                "🕐 Closed",
                                            value:
                                                formatTime(
                                                    ticket.closedAt
                                                ),
                                            inline:
                                                true
                                        },
                                        {
                                            name:
                                                "📝 Close Reason",
                                            value:
                                                ticket.closeReason ||
                                                "No reason provided.",
                                            inline:
                                                false
                                        },
                                        {
                                            name:
                                                "📝 Delete Reason",
                                            value:
                                                deleteReason,
                                            inline:
                                                false
                                        }
                                    )
                                    .setFooter({
                                        text:
                                            "Atlas Utilities • Ticket Summary"
                                    })
                                    .setTimestamp()
                            ]
                        });
                    } catch {
                        console.log(
                            "⚠️ Could not DM ticket owner."
                        );
                    }
                }

                await sendTicketLog(
                    interaction.guild,

                    createTicketLogEmbed(
                        "🗑️ Ticket Deleted",

                        0xED4245,

                        [
                            {
                                name:
                                    "🎫 Ticket",
                                value:
                                    interaction.channel.name,
                                inline:
                                    true
                            },
                            {
                                name:
                                    "👤 Opened By",
                                value:
                                    `<@${ticket.userId}>`,
                                inline:
                                    true
                            },
                            {
                                name:
                                    "🙋 Claimed By",
                                value:
                                    ticket.claimedBy
                                        ? `<@${ticket.claimedBy}>`
                                        : "Nobody",
                                inline:
                                    true
                            },
                            {
                                name:
                                    "🔒 Closed By",
                                value:
                                    ticket.closedBy
                                        ? `<@${ticket.closedBy}>`
                                        : "Unknown",
                                inline:
                                    true
                            },
                            {
                                name:
                                    "🗑️ Deleted By",
                                value:
                                    `${interaction.user}`,
                                inline:
                                    true
                            },
                            {
                                name:
                                    "🕐 Opened",
                                value:
                                    formatTime(
                                        ticket.openedAt
                                    ),
                                inline:
                                    true
                            },
                            {
                                name:
                                    "🕐 Closed",
                                value:
                                    formatTime(
                                        ticket.closedAt
                                    ),
                                inline:
                                    true
                            },
                            {
                                name:
                                    "📝 Close Reason",
                                value:
                                    ticket.closeReason ||
                                    "No reason provided.",
                                inline:
                                    false
                            },
                            {
                                name:
                                    "📝 Delete Reason",
                                value:
                                    deleteReason,
                                inline:
                                    false
                            }
                        ]
                    ),

                    interaction.user,

                    "Ticket Delete"
                );

                await interaction.reply({
                    content:
                        "🗑️ Ticket deleted. The ticket owner has been notified.",
                    ephemeral:
                        true
                });

                setTimeout(
                    async () => {
                        try {
                            delete tickets.active[
                                interaction.channel.id
                            ];

                            const updatedConfig =
                                loadConfig();

                            if (
                                updatedConfig[
                                    interaction.guild.id
                                ]?.tickets
                            ) {
                                updatedConfig[
                                    interaction.guild.id
                                ].tickets.active =
                                    tickets.active;

                                saveConfig(
                                    updatedConfig
                                );
                            }

                            await interaction.channel.delete();

                        } catch (error) {
                            console.error(
                                "❌ Failed to delete ticket channel:",
                                error
                            );

                            await sendBotErrorLog(
                                error,
                                {
                                    type:
                                        "Ticket Channel Deletion",
                                    guild:
                                        interaction.guild,
                                    user:
                                        interaction.user,
                                    command:
                                        "Ticket Delete"
                                }
                            );
                        }
                    },
                    1500
                );

                return;
            }

        } catch (error) {
            console.error(
                "❌ Interaction error:",
                error
            );

            await sendBotErrorLog(
                error,
                {
                    type:
                        "Interaction Error",

                    guild:
                        interaction.guild,

                    user:
                        interaction.user,

                    command:
                        interaction.commandName ||
                        interaction.customId ||
                        "Unknown Interaction"
                }
            );

            if (
                !interaction.replied &&
                !interaction.deferred &&
                interaction.isRepliable()
            ) {
                try {
                    await interaction.reply({
                        content:
                            "❌ Something went wrong while processing this interaction.",
                        ephemeral:
                            true
                    });
                } catch {}
            }
        }
    }
);

/* =========================================================
   CLIENT ERROR EVENTS
========================================================= */

client.on(
    "error",
    async error => {
        console.error(
            "❌ Discord client error:",
            error
        );

        await sendBotErrorLog(
            error,
            {
                type:
                    "Discord Client Error"
            }
        );
    }
);

client.on(
    "warn",
    warning => {
        console.warn(
            "⚠️ Discord warning:",
            warning
        );
    }
);

client.on(
    "shardError",
    async error => {
        console.error(
            "❌ Discord shard error:",
            error
        );

        await sendBotErrorLog(
            error,
            {
                type:
                    "Discord Shard Error"
            }
        );
    }
);

/* =========================================================
   GLOBAL PROCESS ERRORS
========================================================= */

process.on(
    "unhandledRejection",
    async error => {
        console.error(
            "❌ Unhandled Promise Rejection:",
            error
        );

        await sendBotErrorLog(
            error,
            {
                type:
                    "Unhandled Promise Rejection"
            }
        );
    }
);

process.on(
    "uncaughtException",
    async error => {
        console.error(
            "❌ Uncaught Exception:",
            error
        );

        await sendBotErrorLog(
            error,
            {
                type:
                    "Uncaught Exception"
            }
        );
    }
);

/* =========================================================
   LOGIN
========================================================= */

if (!process.env.TOKEN) {
    console.error(
        "❌ TOKEN is missing from .env"
    );

    process.exit(1);
}

client.login(
    process.env.TOKEN
).catch(
    async error => {
        console.error(
            "❌ Failed to login:",
            error
        );

        await sendBotErrorLog(
            error,
            {
                type:
                    "Bot Login"
            }
        );
    }
);