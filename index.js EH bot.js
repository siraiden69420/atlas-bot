require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits,
    Events,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/* ============================================================
   CONFIG
============================================================ */

const PORT = process.env.PORT || 3000;

const API_KEY =
    process.env.API_KEY ||
    crypto.randomBytes(32).toString("hex");

const LOGS_CHANNEL_ID =
    process.env.LOGS_CHANNEL_ID || "";

const BAN_KICK_CHANNEL_ID =
    process.env.BAN_KICK_CHANNEL_ID || "";

const ROBLOX_GROUP_ID = 526376218;

/*
    Roblox rank -> Discord role
*/
const ROBLOX_RANK_ROLES = {
    255: "Oli",
    254: "Phil",
    253: "Developer",
    20: "Management",
    15: "Staff"
};

/*
    Roblox ranks allowed to access
    the Emergency Hessen admin panel.
*/
const ROBLOX_ADMIN_RANKS = {
    255: "Oli",
    254: "Phil",
    253: "Developer",
    20: "Management",
    15: "Staff"
};

/* ============================================================
   DATA FILES
============================================================ */

const DATA_DIR =
    path.join(__dirname, "data");

const CONFIG_FILE =
    path.join(DATA_DIR, "config.json");

const SERVERS_FILE =
    path.join(DATA_DIR, "servers.json");

const PLAYERS_FILE =
    path.join(DATA_DIR, "players.json");

const ANNOUNCEMENTS_FILE =
    path.join(DATA_DIR, "announcements.json");

const VERIFICATIONS_FILE =
    path.join(DATA_DIR, "verifications.json");

const LINKS_FILE =
    path.join(DATA_DIR, "links.json");

const BANS_FILE =
    path.join(DATA_DIR, "bans.json");

const ADMIN_SESSIONS_FILE =
    path.join(DATA_DIR, "admin_sessions.json");

const ADMIN_LOGS_FILE =
    path.join(DATA_DIR, "admin_logs.json");

/* ============================================================
   CREATE DATA DIRECTORY / FILES
============================================================ */

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {
        recursive: true
    });
}

function createFile(file, defaultValue) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(
            file,
            JSON.stringify(
                defaultValue,
                null,
                4
            )
        );
    }
}

createFile(CONFIG_FILE, {});
createFile(SERVERS_FILE, {});
createFile(PLAYERS_FILE, {});
createFile(ANNOUNCEMENTS_FILE, []);
createFile(VERIFICATIONS_FILE, {});
createFile(LINKS_FILE, {});
createFile(BANS_FILE, {});
createFile(ADMIN_SESSIONS_FILE, {});
createFile(ADMIN_LOGS_FILE, []);

function readJSON(file, fallback = {}) {
    try {
        return JSON.parse(
            fs.readFileSync(
                file,
                "utf8"
            )
        );
    } catch {
        return fallback;
    }
}

function writeJSON(file, data) {
    fs.writeFileSync(
        file,
        JSON.stringify(
            data,
            null,
            4
        )
    );
}

/* ============================================================
   DISCORD CLIENT
============================================================ */

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

/* ============================================================
   SLASH COMMANDS
============================================================ */

const commands = [

    new SlashCommandBuilder()
        .setName("setup")
        .setDescription(
            "Configure Emergency Hessen."
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        )
        .addChannelOption(option =>
            option
                .setName("log_channel")
                .setDescription(
                    "Emergency Hessen log channel."
                )
                .setRequired(false)
        )
        .addRoleOption(option =>
            option
                .setName("staff_role")
                .setDescription(
                    "Emergency Hessen staff role."
                )
                .setRequired(false)
        )
        .addChannelOption(option =>
            option
                .setName("announcement_channel")
                .setDescription(
                    "Announcement channel."
                )
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("status")
        .setDescription(
            "Show Emergency Hessen status."
        ),

    new SlashCommandBuilder()
        .setName("servers")
        .setDescription(
            "Show connected Roblox servers."
        ),

    new SlashCommandBuilder()
        .setName("players")
        .setDescription(
            "Show players currently tracked."
        ),

    new SlashCommandBuilder()
        .setName("announce")
        .setDescription(
            "Send an announcement to Emergency Hessen."
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        )
        .addStringOption(option =>
            option
                .setName("message")
                .setDescription(
                    "Announcement message."
                )
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("verify")
        .setDescription(
            "Verify and link your Roblox account."
        ),

    new SlashCommandBuilder()
        .setName("sync")
        .setDescription(
            "Sync your Discord role with your Roblox group rank."
        )

].map(
    command =>
        command.toJSON()
);

/* ============================================================
   REGISTER COMMANDS
============================================================ */

async function registerCommands() {

    const rest =
        new REST({
            version: "10"
        }).setToken(
            process.env.DISCORD_TOKEN
        );

    try {

        console.log(
            "🔄 Registering Discord commands..."
        );

        await rest.put(
            Routes.applicationCommands(
                client.user.id
            ),
            {
                body: commands
            }
        );

        console.log(
            "✅ Discord commands registered."
        );

    } catch (error) {

        console.error(
            "❌ Command registration failed:",
            error
        );

    }
}

/* ============================================================
   DISCORD ADMIN LOGGING
============================================================ */

async function sendDiscordLog(
    type,
    data = {}
) {

    const isBanKick =
        type === "ban" ||
        type === "kick" ||
        type === "unban";

    const channelId =
        isBanKick
            ? BAN_KICK_CHANNEL_ID
            : LOGS_CHANNEL_ID;

    if (!channelId) {

        console.warn(
            `⚠️ No ${
                isBanKick
                    ? "BAN_KICK_CHANNEL_ID"
                    : "LOGS_CHANNEL_ID"
            } configured.`
        );

        return;
    }

    try {

        const channel =
            await client.channels.fetch(
                channelId
            );

        if (
            !channel ||
            !channel.isTextBased()
        ) {

            console.error(
                `❌ Discord log channel ${channelId} is invalid.`
            );

            return;
        }

        const embed =
            new EmbedBuilder()
                .setTimestamp()
                .setFooter({
                    text:
                        "Emergency Hessen • Admin System"
                });

        if (type === "ban") {

            embed
                .setTitle(
                    "🔨 Emergency Hessen Ban"
                )
                .setDescription(
                    "A player was banned through the Emergency Hessen admin system."
                )
                .addFields(

                    {
                        name:
                            "👤 Target",

                        value:
                            data.username
                                ? `**${data.username}**`
                                : "Unknown",

                        inline: true
                    },

                    {
                        name:
                            "🆔 User ID",

                        value:
                            `\`${data.userId || "Unknown"}\``,

                        inline: true
                    },

                    {
                        name:
                            "🛡️ Staff",

                        value:
                            data.staffUsername ||
                            "Unknown",

                        inline: true
                    },

                    {
                        name:
                            "📝 Reason",

                        value:
                            data.reason ||
                            "No reason provided",

                        inline: false
                    },

                    {
                        name:
                            "⏱️ Duration",

                        value:
                            data.duration ||
                            "Permanent",

                        inline: true
                    },

                    {
                        name:
                            "🖥️ Server",

                        value:
                            data.jobId
                                ? `\`${data.jobId}\``
                                : "Unknown",

                        inline: true
                    }

                );

        } else if (type === "kick") {

            embed
                .setTitle(
                    "👢 Emergency Hessen Kick"
                )
                .setDescription(
                    "A player was kicked through the Emergency Hessen admin system."
                )
                .addFields(

                    {
                        name:
                            "👤 Target",

                        value:
                            data.username ||
                            "Unknown",

                        inline: true
                    },

                    {
                        name:
                            "🆔 User ID",

                        value:
                            `\`${data.userId || "Unknown"}\``,

                        inline: true
                    },

                    {
                        name:
                            "🛡️ Staff",

                        value:
                            data.staffUsername ||
                            "Unknown",

                        inline: true
                    },

                    {
                        name:
                            "📝 Reason",

                        value:
                            data.reason ||
                            "No reason provided",

                        inline: false
                    },

                    {
                        name:
                            "🖥️ Server",

                        value:
                            data.jobId
                                ? `\`${data.jobId}\``
                                : "Unknown",

                        inline: true
                    }

                );

        } else if (type === "unban") {

            embed
                .setTitle(
                    "🔓 Emergency Hessen Unban"
                )
                .setDescription(
                    "A player was unbanned through the Emergency Hessen admin system."
                )
                .addFields(

                    {
                        name:
                            "👤 Target",

                        value:
                            data.username ||
                            "Unknown",

                        inline: true
                    },

                    {
                        name:
                            "🆔 User ID",

                        value:
                            `\`${data.userId || "Unknown"}\``,

                        inline: true
                    },

                    {
                        name:
                            "🛡️ Staff",

                        value:
                            data.staffUsername ||
                            "Unknown",

                        inline: true
                    },

                    {
                        name:
                            "📝 Reason",

                        value:
                            data.reason ||
                            "No reason provided",

                        inline: false
                    }

                );

        } else {

            embed
                .setTitle(
                    "🛡️ Emergency Hessen Admin Action"
                )
                .setDescription(
                    "An administrative action was performed."
                )
                .addFields(

                    {
                        name:
                            "👤 Staff",

                        value:
                            data.staffUsername ||
                            "Unknown",

                        inline: true
                    },

                    {
                        name:
                            "⚙️ Action",

                        value:
                            data.action ||
                            "Unknown",

                        inline: true
                    },

                    {
                        name:
                            "🎮 Target",

                        value:
                            data.targetUsername ||
                            "None",

                        inline: true
                    },

                    {
                        name:
                            "📝 Details",

                        value:
                            data.details ||
                            "No details provided",

                        inline: false
                    },

                    {
                        name:
                            "🖥️ Server",

                        value:
                            data.jobId
                                ? `\`${data.jobId}\``
                                : "Unknown",

                        inline: true
                    }

                );

        }

        await channel.send({
            embeds: [
                embed
            ]
        });

    } catch (error) {

        console.error(
            "❌ Failed to send Discord admin log:",
            error
        );

    }
}

/* ============================================================
   ADMIN LOG STORAGE
============================================================ */

function saveAdminLog(log) {

    const logs =
        readJSON(
            ADMIN_LOGS_FILE,
            []
        );

    logs.push({

        id:
            crypto.randomUUID(),

        timestamp:
            Date.now(),

        ...log

    });

    writeJSON(
        ADMIN_LOGS_FILE,
        logs.slice(-1000)
    );
}

/* ============================================================
   ROBLOX GROUP RANK
============================================================ */

async function getRobloxGroupRank(
    robloxUserId
) {

    try {

        const response =
            await fetch(
                `https://groups.roblox.com/v1/users/${robloxUserId}/groups/roles`
            );

        if (!response.ok) {

            console.error(
                "❌ Roblox Groups API returned:",
                response.status
            );

            return null;
        }

        const data =
            await response.json();

        const group =
            data.data.find(
                entry =>
                    String(
                        entry.group.id
                    ) ===
                    String(
                        ROBLOX_GROUP_ID
                    )
            );

        if (!group) {
            return null;
        }

        return {

            rank:
                Number(
                    group.role.rank
                ),

            roleName:
                group.role.name

        };

    } catch (error) {

        console.error(
            "❌ Failed to fetch Roblox group rank:",
            error
        );

        return null;
    }
}

/* ============================================================
   ADMIN IDENTITY
============================================================ */

function getLinkedDiscordAccount(
    robloxUserId
) {

    const links =
        readJSON(
            LINKS_FILE,
            {}
        );

    return Object.values(
        links
    ).find(
        link =>
            String(
                link.robloxUserId
            ) ===
            String(
                robloxUserId
            )
    );
}

async function authorizeRobloxAdmin(
    robloxUserId
) {

    if (!robloxUserId) {

        return {
            authorized: false,
            reason:
                "missing_user_id"
        };

    }

    const link =
        getLinkedDiscordAccount(
            robloxUserId
        );

    if (!link) {

        return {
            authorized: false,
            reason:
                "not_linked"
        };

    }

    const rankData =
        await getRobloxGroupRank(
            robloxUserId
        );

    if (!rankData) {

        return {
            authorized: false,
            reason:
                "not_in_group"
        };

    }

    const permissionRole =
        ROBLOX_ADMIN_RANKS[
            rankData.rank
        ];

    if (!permissionRole) {

        return {

            authorized: false,

            reason:
                "insufficient_rank",

            rank:
                rankData.rank,

            roleName:
                rankData.roleName

        };

    }

    return {

        authorized:
            true,

        robloxUserId:
            String(
                robloxUserId
            ),

        robloxUsername:
            link.robloxUsername,

        discordUserId:
            link.discordUserId,

        discordUsername:
            link.discordUsername,

        rank:
            rankData.rank,

        roleName:
            rankData.roleName,

        permissionRole:
            permissionRole

    };
}

/* ============================================================
   ADMIN SESSION
============================================================ */

function createAdminSession(
    robloxUserId,
    identity
) {

    const sessions =
        readJSON(
            ADMIN_SESSIONS_FILE,
            {}
        );

    const token =
        crypto.randomBytes(
            32
        ).toString("hex");

    sessions[token] = {

        token,

        robloxUserId:
            String(
                robloxUserId
            ),

        discordUserId:
            identity.discordUserId,

        robloxUsername:
            identity.robloxUsername,

        discordUsername:
            identity.discordUsername,

        rank:
            identity.rank,

        roleName:
            identity.roleName,

        permissionRole:
            identity.permissionRole,

        createdAt:
            Date.now(),

        expiresAt:
            Date.now() +
            1000 * 60 * 60

    };

    writeJSON(
        ADMIN_SESSIONS_FILE,
        sessions
    );

    return token;
}

function getAdminSession(req) {

    const authorization =
        req.headers.authorization ||
        "";

    if (
        !authorization.startsWith(
            "Bearer "
        )
    ) {

        return null;
    }

    const token =
        authorization
            .slice(7)
            .trim();

    if (!token) {
        return null;
    }

    const sessions =
        readJSON(
            ADMIN_SESSIONS_FILE,
            {}
        );

    const session =
        sessions[token];

    if (!session) {
        return null;
    }

    if (
        session.expiresAt &&
        session.expiresAt <
            Date.now()
    ) {

        delete sessions[token];

        writeJSON(
            ADMIN_SESSIONS_FILE,
            sessions
        );

        return null;
    }

    return session;
}

function requireAdminSession(
    req,
    res,
    next
) {

    const session =
        getAdminSession(
            req
        );

    if (!session) {

        return res.status(401).json({

            success:
                false,

            error:
                "Invalid or expired admin session."

        });

    }

    req.adminSession =
        session;

    next();
}

/* ============================================================
   RANK DISCORD ROLE SYNC
============================================================ */

async function getOrCreateRankRole(
    guild,
    roleName
) {

    let role =
        guild.roles.cache.find(
            existingRole =>
                existingRole.name ===
                roleName
        );

    if (role) {
        return role;
    }

    try {

        role =
            await guild.roles.create({

                name:
                    roleName,

                reason:
                    "Emergency Hessen Roblox rank synchronization"

            });

        return role;

    } catch (error) {

        console.error(
            `❌ Failed to create role ${roleName}:`,
            error
        );

        return null;
    }
}

async function syncRobloxRank(
    interaction
) {

    const links =
        readJSON(
            LINKS_FILE,
            {}
        );

    const link =
        links[
            interaction.user.id
        ];

    if (!link) {

        return {

            success:
                false,

            message:
                "❌ You are not verified yet. Use `/verify` first."

        };
    }

    const rankData =
        await getRobloxGroupRank(
            link.robloxUserId
        );

    if (!rankData) {

        return {

            success:
                false,

            message:
                "❌ Your linked Roblox account is not a member of the Emergency Hessen Roblox group."

        };
    }

    const roleName =
        ROBLOX_RANK_ROLES[
            rankData.rank
        ];

    if (!roleName) {

        return {

            success:
                false,

            message:
                `⚠️ Your Roblox rank is **${rankData.roleName}** (${rankData.rank}), but that rank is not configured for a Discord role.`

        };
    }

    const targetRole =
        await getOrCreateRankRole(
            interaction.guild,
            roleName
        );

    if (!targetRole) {

        return {

            success:
                false,

            message:
                `❌ I couldn't create/find the **${roleName}** Discord role.`

        };
    }

    const member =
        await interaction.guild.members.fetch(
            interaction.user.id
        );

    const managedRoleNames =
        Object.values(
            ROBLOX_RANK_ROLES
        );

    const rolesToRemove =
        member.roles.cache.filter(
            role =>
                managedRoleNames.includes(
                    role.name
                ) &&
                role.id !==
                    targetRole.id
        );

    for (
        const role
        of rolesToRemove.values()
    ) {

        try {

            await member.roles.remove(
                role
            );

        } catch (error) {

            console.error(
                `❌ Failed to remove old role ${role.name}:`,
                error
            );

        }
    }

    if (
        !member.roles.cache.has(
            targetRole.id
        )
    ) {

        try {

            await member.roles.add(
                targetRole
            );

        } catch (error) {

            console.error(
                "❌ Failed to assign Roblox rank role:",
                error
            );

            return {

                success:
                    false,

                message:
                    `❌ I couldn't assign the **${roleName}** role. Make sure my bot role is above it.`

            };
        }
    }

    return {

        success:
            true,

        roleName,

        rank:
            rankData.rank,

        robloxRoleName:
            rankData.roleName,

        robloxUserId:
            link.robloxUserId,

        robloxUsername:
            link.robloxUsername

    };
}

/* ============================================================
   VERIFICATION HELPERS
============================================================ */

function findVerificationByDiscordUser(
    discordUserId
) {

    const verifications =
        readJSON(
            VERIFICATIONS_FILE,
            {}
        );

    return Object.values(
        verifications
    ).find(
        verification =>
            verification.discordUserId ===
                discordUserId &&
            (
                verification.status ===
                    "waiting" ||
                verification.status ===
                    "found"
            )
    );
}

function findLinkedRobloxUser(
    robloxUserId
) {

    const links =
        readJSON(
            LINKS_FILE,
            {}
        );

    return Object.values(
        links
    ).find(
        link =>
            String(
                link.robloxUserId
            ) ===
            String(
                robloxUserId
            )
    );
}

async function createVerifiedRole(
    guild
) {

    let role =
        guild.roles.cache.find(
            role =>
                role.name ===
                "Roblox Verified"
        );

    if (role) {
        return role;
    }

    try {

        role =
            await guild.roles.create({

                name:
                    "Roblox Verified",

                reason:
                    "Emergency Hessen Roblox verification system"

            });

        return role;

    } catch (error) {

        console.error(
            "❌ Could not create Roblox Verified role:",
            error
        );

        return null;
    }
}

async function updateVerificationMessage(
    verification,
    found
) {

    try {

        const channel =
            await client.channels.fetch(
                verification.channelId
            );

        if (!channel) {
            return;
        }

        const message =
            await channel.messages.fetch(
                verification.messageId
            );

        if (!message) {
            return;
        }

        if (found) {

            const embed =
                new EmbedBuilder()

                    .setTitle(
                        "🔐 Roblox Verification"
                    )

                    .setDescription(
                        "We found your Roblox account in Emergency Hessen.\n\nPlease confirm that this is your account."
                    )

                    .addFields(

                        {
                            name:
                                "👤 Roblox Username",

                            value:
                                `\`${verification.robloxUsername}\``,

                            inline: true
                        },

                        {
                            name:
                                "🆔 Roblox User ID",

                            value:
                                `\`${verification.robloxUserId}\``,

                            inline: true
                        }

                    )

                    .setFooter({
                        text:
                            "Emergency Hessen Verification"
                    })

                    .setTimestamp();

            const buttons =
                new ActionRowBuilder()
                    .addComponents(

                        new ButtonBuilder()
                            .setCustomId(
                                `verify_confirm_${verification.id}`
                            )
                            .setLabel(
                                "Verify"
                            )
                            .setEmoji(
                                "✅"
                            )
                            .setStyle(
                                ButtonStyle.Success
                            ),

                        new ButtonBuilder()
                            .setCustomId(
                                `verify_cancel_${verification.id}`
                            )
                            .setLabel(
                                "Cancel"
                            )
                            .setEmoji(
                                "❌"
                            )
                            .setStyle(
                                ButtonStyle.Danger
                            )

                    );

            await message.edit({

                embeds:
                    [embed],

                components:
                    [buttons]

            });

        }

    } catch (error) {

        console.error(
            "❌ Failed to update verification message:",
            error
        );

    }
}

/* ============================================================
   DISCORD READY
============================================================ */

client.once(
    Events.ClientReady,
    async readyClient => {

        console.log(
            `✅ Logged in as ${readyClient.user.tag}`
        );

        console.log(
            "📡 Emergency Hessen Discord system is online."
        );

        console.log(
            "🔐 API key loaded."
        );

        if (!LOGS_CHANNEL_ID) {

            console.warn(
                "⚠️ LOGS_CHANNEL_ID is not configured."
            );

        }

        if (!BAN_KICK_CHANNEL_ID) {

            console.warn(
                "⚠️ BAN_KICK_CHANNEL_ID is not configured."
            );

        }

        await registerCommands();

    }
);

/* ============================================================
   DISCORD INTERACTIONS
============================================================ */

client.on(
    Events.InteractionCreate,
    async interaction => {

        try {

            /* ====================================================
               SLASH COMMANDS
            ==================================================== */

            if (
                interaction.isChatInputCommand()
            ) {

                const guildId =
                    interaction.guild?.id;

                if (!guildId) {

                    return interaction.reply({

                        content:
                            "❌ This command can only be used inside a server.",

                        ephemeral:
                            true

                    });
                }

                /* =================================================
                   /setup
                ================================================= */

                if (
                    interaction.commandName ===
                    "setup"
                ) {

                    if (
                        !interaction.memberPermissions.has(
                            PermissionFlagsBits.Administrator
                        )
                    ) {

                        return interaction.reply({

                            content:
                                "❌ You need Administrator permission.",

                            ephemeral:
                                true

                        });
                    }

                    const configs =
                        readJSON(
                            CONFIG_FILE,
                            {}
                        );

                    if (
                        !configs[
                            guildId
                        ]
                    ) {

                        configs[
                            guildId
                        ] = {};

                    }

                    const logChannel =
                        interaction.options.getChannel(
                            "log_channel"
                        );

                    const staffRole =
                        interaction.options.getRole(
                            "staff_role"
                        );

                    const announcementChannel =
                        interaction.options.getChannel(
                            "announcement_channel"
                        );

                    if (logChannel) {

                        configs[
                            guildId
                        ].logChannel =
                            logChannel.id;

                    }

                    if (staffRole) {

                        configs[
                            guildId
                        ].staffRole =
                            staffRole.id;

                    }

                    if (
                        announcementChannel
                    ) {

                        configs[
                            guildId
                        ].announcementChannel =
                            announcementChannel.id;

                    }

                    configs[
                        guildId
                    ].configured =
                        true;

                    writeJSON(
                        CONFIG_FILE,
                        configs
                    );

                    return interaction.reply({

                        content:
                            "✅ **Emergency Hessen configured.**\n\n" +
                            `📝 Logs: ${
                                logChannel
                                    ? `<#${logChannel.id}>`
                                    : "Unchanged"
                            }\n` +
                            `🛡️ Staff: ${
                                staffRole
                                    ? `<@&${staffRole.id}>`
                                    : "Unchanged"
                            }\n` +
                            `📢 Announcements: ${
                                announcementChannel
                                    ? `<#${announcementChannel.id}>`
                                    : "Unchanged"
                            }`,

                        ephemeral:
                            true

                    });
                }

                /* =================================================
                   /status
                ================================================= */

                if (
                    interaction.commandName ===
                    "status"
                ) {

                    const servers =
                        readJSON(
                            SERVERS_FILE,
                            {}
                        );

                    const players =
                        readJSON(
                            PLAYERS_FILE,
                            {}
                        );

                    return interaction.reply({

                        embeds: [

                            new EmbedBuilder()

                                .setTitle(
                                    "🚨 Emergency Hessen Status"
                                )

                                .setDescription(
                                    "Emergency Hessen systems are operational."
                                )

                                .addFields(

                                    {
                                        name:
                                            "🤖 Discord",

                                        value:
                                            "🟢 Online",

                                        inline:
                                            true
                                    },

                                    {
                                        name:
                                            "🌐 API",

                                        value:
                                            "🟢 Online",

                                        inline:
                                            true
                                    },

                                    {
                                        name:
                                            "🎮 Roblox Servers",

                                        value:
                                            `${Object.keys(servers).length}`,

                                        inline:
                                            true
                                    },

                                    {
                                        name:
                                            "👤 Players",

                                        value:
                                            `${Object.keys(players).length}`,

                                        inline:
                                            true
                                    },

                                    {
                                        name:
                                            "📡 Ping",

                                        value:
                                            `${client.ws.ping}ms`,

                                        inline:
                                            true
                                    }

                                )

                                .setTimestamp()

                        ]

                    });
                }

                /* =================================================
                   /servers
                ================================================= */

                if (
                    interaction.commandName ===
                    "servers"
                ) {

                    const servers =
                        readJSON(
                            SERVERS_FILE,
                            {}
                        );

                    const entries =
                        Object.values(
                            servers
                        );

                    if (
                        entries.length ===
                        0
                    ) {

                        return interaction.reply(
                            "🎮 No Roblox servers are currently connected."
                        );

                    }

                    const description =
                        entries
                            .map(
                                server =>
                                    `**${server.name || "Emergency Hessen"}**\nPlayers: ${server.players || 0}\nJob ID: \`${server.jobId}\``
                            )
                            .join(
                                "\n\n"
                            );

                    return interaction.reply({

                        embeds: [

                            new EmbedBuilder()

                                .setTitle(
                                    "🎮 Emergency Hessen Servers"
                                )

                                .setDescription(
                                    description
                                )

                                .setTimestamp()

                        ]

                    });
                }

                /* =================================================
                   /players
                ================================================= */

                if (
                    interaction.commandName ===
                    "players"
                ) {

                    const players =
                        readJSON(
                            PLAYERS_FILE,
                            {}
                        );

                    const entries =
                        Object.values(
                            players
                        );

                    if (
                        entries.length ===
                        0
                    ) {

                        return interaction.reply(
                            "👤 No players are currently tracked."
                        );

                    }

                    const description =
                        entries
                            .slice(
                                0,
                                25
                            )
                            .map(
                                player =>
                                    `**${player.username}**\nUser ID: \`${player.userId}\`\nServer: \`${player.jobId}\``
                            )
                            .join(
                                "\n\n"
                            );

                    return interaction.reply({

                        embeds: [

                            new EmbedBuilder()

                                .setTitle(
                                    "👤 Emergency Hessen Players"
                                )

                                .setDescription(
                                    description
                                )

                                .setTimestamp()

                        ]

                    });
                }

                /* =================================================
                   /announce
                ================================================= */

                if (
                    interaction.commandName ===
                    "announce"
                ) {

                    const message =
                        interaction.options.getString(
                            "message",
                            true
                        );

                    const announcements =
                        readJSON(
                            ANNOUNCEMENTS_FILE,
                            []
                        );

                    announcements.push({

                        id:
                            crypto.randomUUID(),

                        message:
                            message,

                        createdAt:
                            Date.now(),

                        createdBy:
                            interaction.user.id,

                        delivered:
                            false

                    });

                    writeJSON(
                        ANNOUNCEMENTS_FILE,
                        announcements
                    );

                    return interaction.reply({

                        content:
                            "📢 Announcement queued for Emergency Hessen.",

                        ephemeral:
                            true

                    });
                }

                /* =================================================
                   /verify
                ================================================= */

                if (
                    interaction.commandName ===
                    "verify"
                ) {

                    const existing =
                        findVerificationByDiscordUser(
                            interaction.user.id
                        );

                    if (existing) {

                        return interaction.reply({

                            content:
                                "⚠️ You already have a Roblox verification in progress.",

                            ephemeral:
                                true

                        });
                    }

                    const modal =
                        new ModalBuilder()

                            .setCustomId(
                                "roblox_verify_modal"
                            )

                            .setTitle(
                                "Roblox Verification"
                            );

                    const usernameInput =
                        new TextInputBuilder()

                            .setCustomId(
                                "roblox_username"
                            )

                            .setLabel(
                                "Roblox Username"
                            )

                            .setPlaceholder(
                                "Example: sir_aidenrblx"
                            )

                            .setStyle(
                                TextInputStyle.Short
                            )

                            .setRequired(
                                true
                            )

                            .setMinLength(
                                3
                            )

                            .setMaxLength(
                                20
                            );

                    modal.addComponents(

                        new ActionRowBuilder()
                            .addComponents(
                                usernameInput
                            )

                    );

                    return interaction.showModal(
                        modal
                    );
                }

                /* =================================================
                   /sync
                ================================================= */

                if (
                    interaction.commandName ===
                    "sync"
                ) {

                    await interaction.deferReply({

                        ephemeral:
                            true

                    });

                    const result =
                        await syncRobloxRank(
                            interaction
                        );

                    if (
                        !result.success
                    ) {

                        return interaction.editReply({

                            content:
                                result.message

                        });
                    }

                    const role =
                        interaction.guild.roles.cache.find(
                            r =>
                                r.name ===
                                result.roleName
                        );

                    return interaction.editReply({

                        embeds: [

                            new EmbedBuilder()

                                .setTitle(
                                    "🔄 Roblox Rank Synced"
                                )

                                .setDescription(
                                    "Your Emergency Hessen Discord role has been synchronized with your Roblox group rank."
                                )

                                .addFields(

                                    {
                                        name:
                                            "👤 Roblox Account",

                                        value:
                                            `**${result.robloxUsername}**`,

                                        inline:
                                            true
                                    },

                                    {
                                        name:
                                            "🏷️ Roblox Rank",

                                        value:
                                            `**${result.robloxRoleName}**`,

                                        inline:
                                            true
                                    },

                                    {
                                        name:
                                            "🆔 Rank ID",

                                        value:
                                            `\`${result.rank}\``,

                                        inline:
                                            true
                                    },

                                    {
                                        name:
                                            "🎭 Discord Role",

                                        value:
                                            role
                                                ? `<@&${role.id}>`
                                                : `**${result.roleName}**`,

                                        inline:
                                            true
                                    }

                                )

                                .setFooter({

                                    text:
                                        "Emergency Hessen • Roblox Sync"

                                })

                                .setTimestamp()

                        ]

                    });
                }
            }

            /* ====================================================
               VERIFICATION MODAL
            ==================================================== */

            if (
                interaction.isModalSubmit() &&
                interaction.customId ===
                    "roblox_verify_modal"
            ) {

                const username =
                    interaction.fields
                        .getTextInputValue(
                            "roblox_username"
                        )
                        .trim();

                const verifications =
                    readJSON(
                        VERIFICATIONS_FILE,
                        {}
                    );

                const verificationId =
                    crypto.randomUUID();

                verifications[
                    verificationId
                ] = {

                    id:
                        verificationId,

                    discordUserId:
                        interaction.user.id,

                    guildId:
                        interaction.guild.id,

                    channelId:
                        interaction.channel.id,

                    messageId:
                        null,

                    robloxUsername:
                        username,

                    robloxUserId:
                        null,

                    status:
                        "waiting",

                    createdAt:
                        Date.now()

                };

                const embed =
                    new EmbedBuilder()

                        .setTitle(
                            "🔐 Roblox Verification"
                        )

                        .setDescription(
                            `Join **Emergency Hessen** with your Roblox account **${username}**.\n\nWe'll automatically detect your account when you join.`
                        )

                        .addFields({

                            name:
                                "Status",

                            value:
                                "🟡 Waiting for you to join..."

                        })

                        .setFooter({

                            text:
                                "Emergency Hessen Verification"

                        })

                        .setTimestamp();

                const message =
                    await interaction.reply({

                        embeds:
                            [embed],

                        fetchReply:
                            true

                    });

                verifications[
                    verificationId
                ].messageId =
                    message.id;

                writeJSON(
                    VERIFICATIONS_FILE,
                    verifications
                );

                return;
            }

            /* ====================================================
               VERIFY CONFIRM
            ==================================================== */

            if (
                interaction.isButton() &&
                interaction.customId.startsWith(
                    "verify_confirm_"
                )
            ) {

                const verificationId =
                    interaction.customId.replace(
                        "verify_confirm_",
                        ""
                    );

                const verifications =
                    readJSON(
                        VERIFICATIONS_FILE,
                        {}
                    );

                const verification =
                    verifications[
                        verificationId
                    ];

                if (!verification) {

                    return interaction.reply({

                        content:
                            "❌ This verification no longer exists.",

                        ephemeral:
                            true

                    });
                }

                if (
                    verification.discordUserId !==
                    interaction.user.id
                ) {

                    return interaction.reply({

                        content:
                            "❌ This verification belongs to another Discord account.",

                        ephemeral:
                            true

                    });
                }

                if (
                    verification.status !==
                    "found"
                ) {

                    return interaction.reply({

                        content:
                            "❌ Your Roblox account has not been detected yet.",

                        ephemeral:
                            true

                    });
                }

                const alreadyLinked =
                    findLinkedRobloxUser(
                        verification.robloxUserId
                    );

                if (
                    alreadyLinked &&
                    alreadyLinked.discordUserId !==
                        interaction.user.id
                ) {

                    return interaction.reply({

                        content:
                            "❌ This Roblox account is already linked to another Discord account.",

                        ephemeral:
                            true

                    });
                }

                const role =
                    await createVerifiedRole(
                        interaction.guild
                    );

                if (!role) {

                    return interaction.reply({

                        content:
                            "❌ I couldn't create/find the `Roblox Verified` role.",

                        ephemeral:
                            true

                    });
                }

                const member =
                    await interaction.guild.members.fetch(
                        interaction.user.id
                    );

                try {

                    await member.roles.add(
                        role
                    );

                } catch (error) {

                    console.error(
                        "❌ Failed to assign Roblox Verified role:",
                        error
                    );

                    return interaction.reply({

                        content:
                            "❌ I couldn't assign the `Roblox Verified` role. Check my Manage Roles permission and role hierarchy.",

                        ephemeral:
                            true

                    });

                }

                const links =
                    readJSON(
                        LINKS_FILE,
                        {}
                    );

                links[
                    interaction.user.id
                ] = {

                    discordUserId:
                        interaction.user.id,

                    discordUsername:
                        interaction.user.tag,

                    robloxUserId:
                        verification.robloxUserId,

                    robloxUsername:
                        verification.robloxUsername,

                    guildId:
                        verification.guildId,

                    linkedAt:
                        Date.now()

                };

                writeJSON(
                    LINKS_FILE,
                    links
                );

                verification.status =
                    "verified";

                writeJSON(
                    VERIFICATIONS_FILE,
                    verifications
                );

                const embed =
                    new EmbedBuilder()

                        .setTitle(
                            "✅ Roblox Account Verified"
                        )

                        .setDescription(
                            "Your Roblox account has been successfully linked to your Discord account."
                        )

                        .addFields(

                            {
                                name:
                                    "👤 Roblox Account",

                                value:
                                    `**${verification.robloxUsername}**`,

                                inline:
                                    true
                            },

                            {
                                name:
                                    "🆔 Roblox User ID",

                                value:
                                    `\`${verification.robloxUserId}\``,

                                inline:
                                    true
                            },

                            {
                                name:
                                    "🔗 Status",

                                value:
                                    "🟢 Linked",

                                inline:
                                    true
                            }

                        )

                        .setFooter({

                            text:
                                "Emergency Hessen Verification"

                        })

                        .setTimestamp();

                await interaction.update({

                    embeds:
                        [embed],

                    components:
                        []

                });

                return;
            }

            /* ====================================================
               VERIFY CANCEL
            ==================================================== */

            if (
                interaction.isButton() &&
                interaction.customId.startsWith(
                    "verify_cancel_"
                )
            ) {

                const verificationId =
                    interaction.customId.replace(
                        "verify_cancel_",
                        ""
                    );

                const verifications =
                    readJSON(
                        VERIFICATIONS_FILE,
                        {}
                    );

                const verification =
                    verifications[
                        verificationId
                    ];

                if (!verification) {

                    return interaction.reply({

                        content:
                            "❌ This verification no longer exists.",

                        ephemeral:
                            true

                    });
                }

                if (
                    verification.discordUserId !==
                    interaction.user.id
                ) {

                    return interaction.reply({

                        content:
                            "❌ This verification belongs to another Discord account.",

                        ephemeral:
                            true

                    });
                }

                verification.status =
                    "cancelled";

                writeJSON(
                    VERIFICATIONS_FILE,
                    verifications
                );

                return interaction.update({

                    embeds: [

                        new EmbedBuilder()

                            .setTitle(
                                "❌ Roblox Verification Cancelled"
                            )

                            .setDescription(
                                "Your Roblox verification has been cancelled."
                            )

                            .setTimestamp()

                    ],

                    components:
                        []

                });
            }

        } catch (error) {

            console.error(
                "❌ Interaction error:",
                error
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {

                await interaction.reply({

                    content:
                        "❌ Something went wrong while processing this request.",

                    ephemeral:
                        true

                }).catch(
                    () => {}
                );

            }

        }
    }
);

/* ============================================================
   EXPRESS API
============================================================ */

const app =
    express();

app.use(
    (req, res, next) => {

        console.log(
            `📥 ${req.method} ${req.path}`
        );

        next();

    }
);

app.use(
    cors()
);

app.use(
    express.json()
);

/* ============================================================
   BASIC API
============================================================ */

app.get(
    "/",
    (req, res) => {

        res.json({

            success:
                true,

            name:
                "Emergency Hessen API",

            version:
                "1.1.0",

            status:
                "online"

        });

    }
);

app.get(
    "/api/status",
    (req, res) => {

        const servers =
            readJSON(
                SERVERS_FILE,
                {}
            );

        const players =
            readJSON(
                PLAYERS_FILE,
                {}
            );

        res.json({

            success:
                true,

            bot:
                client.isReady(),

            servers:
                Object.keys(
                    servers
                ).length,

            players:
                Object.keys(
                    players
                ).length,

            uptime:
                process.uptime(),

            timestamp:
                Date.now()

        });

    }
);

/* ============================================================
   API AUTHENTICATION
============================================================ */

function authenticate(
    req,
    res,
    next
) {

    const receivedKey =
        req.headers[
            "x-api-key"
        ];

    if (!receivedKey) {

        return res.status(
            401
        ).json({

            success:
                false,

            error:
                "Missing API key."

        });

    }

    if (
        receivedKey !==
        API_KEY
    ) {

        return res.status(
            401
        ).json({

            success:
                false,

            error:
                "Invalid API key."

        });

    }

    next();
}

/* ============================================================
   ROBLOX SERVER REGISTER
============================================================ */

app.post(
    "/api/roblox/server/register",
    authenticate,
    (req, res) => {

        const {
            jobId,
            placeId,
            players,
            name
        } = req.body;

        if (!jobId) {

            return res.status(
                400
            ).json({

                success:
                    false,

                error:
                    "jobId is required."

            });

        }

        const servers =
            readJSON(
                SERVERS_FILE,
                {}
            );

        servers[
            String(jobId)
        ] = {

            jobId:
                String(jobId),

            placeId:
                placeId ||
                null,

            players:
                Number(players) ||
                0,

            name:
                name ||
                "Emergency Hessen",

            lastHeartbeat:
                Date.now()

        };

        writeJSON(
            SERVERS_FILE,
            servers
        );

        return res.json({

            success:
                true,

            message:
                "Roblox server registered."

        });

    }
);

/* ============================================================
   ROBLOX HEARTBEAT
============================================================ */

app.post(
    "/api/roblox/server/heartbeat",
    authenticate,
    (req, res) => {

        const {
            jobId,
            players
        } = req.body;

        if (!jobId) {

            return res.status(
                400
            ).json({

                success:
                    false,

                error:
                    "jobId is required."

            });

        }

        const servers =
            readJSON(
                SERVERS_FILE,
                {}
            );

        if (
            !servers[
                String(jobId)
            ]
        ) {

            return res.status(
                404
            ).json({

                success:
                    false,

                error:
                    "Server is not registered."

            });

        }

        servers[
            String(jobId)
        ].players =
            Number(players) ||
            0;

        servers[
            String(jobId)
        ].lastHeartbeat =
            Date.now();

        writeJSON(
            SERVERS_FILE,
            servers
        );

        return res.json({

            success:
                true

        });

    }
);

/* ============================================================
   ROBLOX PLAYER JOIN
============================================================ */

app.post(
    "/api/roblox/player/join",
    authenticate,
    async (req, res) => {

        const {
            userId,
            username,
            jobId
        } = req.body;

        if (
            !userId ||
            !username ||
            !jobId
        ) {

            return res.status(
                400
            ).json({

                success:
                    false,

                error:
                    "userId, username and jobId are required."

            });

        }

        const players =
            readJSON(
                PLAYERS_FILE,
                {}
            );

        players[
            String(userId)
        ] = {

            userId:
                String(userId),

            username:
                String(username),

            jobId:
                String(jobId),

            joinedAt:
                Date.now()

        };

        writeJSON(
            PLAYERS_FILE,
            players
        );

        const verifications =
            readJSON(
                VERIFICATIONS_FILE,
                {}
            );

        for (
            const verification
            of Object.values(
                verifications
            )
        ) {

            if (
                verification.status !==
                "waiting"
            ) {
                continue;
            }

            if (
                String(
                    verification.robloxUsername
                ).toLowerCase() !==
                String(
                    username
                ).toLowerCase()
            ) {
                continue;
            }

            verification.robloxUserId =
                String(userId);

            verification.status =
                "found";

            writeJSON(
                VERIFICATIONS_FILE,
                verifications
            );

            await updateVerificationMessage(
                verification,
                true
            );

        }

        return res.json({

            success:
                true

        });

    }
);

/* ============================================================
   ROBLOX PLAYER LEAVE
============================================================ */

app.post(
    "/api/roblox/player/leave",
    authenticate,
    (req, res) => {

        const {
            userId
        } = req.body;

        if (!userId) {

            return res.status(
                400
            ).json({

                success:
                    false,

                error:
                    "userId is required."

            });

        }

        const players =
            readJSON(
                PLAYERS_FILE,
                {}
            );

        delete players[
            String(userId)
        ];

        writeJSON(
            PLAYERS_FILE,
            players
        );

        return res.json({

            success:
                true

        });

    }
);

/* ============================================================
   ROBLOX ANNOUNCEMENTS
============================================================ */

app.get(
    "/api/roblox/announcements",
    authenticate,
    (req, res) => {

        const announcements =
            readJSON(
                ANNOUNCEMENTS_FILE,
                []
            );

        const pending =
            announcements.filter(
                announcement =>
                    !announcement.delivered
            );

        if (
            pending.length
        ) {

            const updated =
                announcements.map(
                    announcement =>
                        announcement.delivered
                            ? announcement
                            : {
                                ...announcement,
                                delivered:
                                    true
                            }
                );

            writeJSON(
                ANNOUNCEMENTS_FILE,
                updated
            );

        }

        return res.json({

            success:
                true,

            announcements:
                pending

        });

    }
);

/* ============================================================
   ADMIN PANEL LOGIN
============================================================ */

app.post(
    "/api/admin/session",
    authenticate,
    async (req, res) => {

        const {
            robloxUserId,
            robloxUsername
        } = req.body;

        if (!robloxUserId) {

            return res.status(
                400
            ).json({

                success:
                    false,

                error:
                    "robloxUserId is required."

            });

        }

        const identity =
            await authorizeRobloxAdmin(
                robloxUserId
            );

        if (
            !identity.authorized
        ) {

            const messages = {

                not_linked:
                    "Roblox account is not linked to Discord.",

                not_in_group:
                    "Roblox account is not in the Emergency Hessen group.",

                insufficient_rank:
                    "Roblox account does not have Game Staff permissions."

            };

            return res.status(
                403
            ).json({

                success:
                    false,

                error:
                    messages[
                        identity.reason
                    ] ||
                    "Admin authorization failed.",

                rank:
                    identity.rank ||
                    null,

                roleName:
                    identity.roleName ||
                    null

            });

        }

        if (
            robloxUsername &&
            identity.robloxUsername &&
            String(
                robloxUsername
            ).toLowerCase() !==
            String(
                identity.robloxUsername
            ).toLowerCase()
        ) {

            return res.status(
                403
            ).json({

                success:
                    false,

                error:
                    "Roblox username does not match the linked account."

            });

        }

        const token =
            createAdminSession(
                robloxUserId,
                identity
            );

        saveAdminLog({

            action:
                "admin_panel_login",

            staffUserId:
                String(
                    robloxUserId
                ),

            staffUsername:
                identity.robloxUsername,

            discordUserId:
                identity.discordUserId,

            staffRank:
                identity.rank,

            roleName:
                identity.roleName

        });

        await sendDiscordLog(
            "admin",
            {

                action:
                    "Admin Panel Login",

                staffUsername:
                    identity.robloxUsername,

                targetUsername:
                    identity.robloxUsername,

                details:
                    `Admin panel session created. Rank ${identity.rank} (${identity.roleName}).`

            }
        );

        return res.json({

            success:
                true,

            token,

            expiresAt:
                Date.now() +
                1000 * 60 * 60,

            staff: {

                robloxUserId:
                    String(
                        robloxUserId
                    ),

                robloxUsername:
                    identity.robloxUsername,

                discordUsername:
                    identity.discordUsername,

                rank:
                    identity.rank,

                roleName:
                    identity.roleName,

                permissionRole:
                    identity.permissionRole

            }

        });

    }
);

/* ============================================================
   ADMIN SESSION CHECK
============================================================ */

app.get(
    "/api/admin/session",
    authenticate,
    requireAdminSession,
    (req, res) => {

        return res.json({

            success:
                true,

            staff:
                req.adminSession

        });

    }
);

/* ============================================================
   ADMIN LOGS
============================================================ */

app.get(
    "/api/admin/logs",
    authenticate,
    requireAdminSession,
    (req, res) => {

        const logs =
            readJSON(
                ADMIN_LOGS_FILE,
                []
            );

        const limit =
            Math.min(
                Math.max(
                    Number(
                        req.query.limit
                    ) || 50,
                    1
                ),
                200
            );

        return res.json({

            success:
                true,

            logs:
                logs
                    .slice(
                        -limit
                    )
                    .reverse()

        });

    }
);

/* ============================================================
   ADMIN BANS
============================================================ */

app.get(
    "/api/admin/bans",
    authenticate,
    requireAdminSession,
    (req, res) => {

        const bans =
            readJSON(
                BANS_FILE,
                {}
            );

        return res.json({

            success:
                true,

            bans:
                Object.values(
                    bans
                )

        });

    }
);

/* ============================================================
   ADMIN BAN
============================================================ */

app.post(
    "/api/admin/ban",
    authenticate,
    requireAdminSession,
    async (req, res) => {

        const {
            userId,
            username,
            reason,
            duration,
            jobId
        } = req.body;

        if (!userId) {

            return res.status(
                400
            ).json({

                success:
                    false,

                error:
                    "userId is required."

            });

        }

        const bans =
            readJSON(
                BANS_FILE,
                {}
            );

        const ban = {

            userId:
                String(userId),

            username:
                username ||
                "Unknown",

            reason:
                reason ||
                "No reason provided",

            duration:
                duration ||
                "Permanent",

            staffUserId:
                req.adminSession.robloxUserId,

            staffUsername:
                req.adminSession.robloxUsername,

            staffRank:
                req.adminSession.rank,

            jobId:
                jobId ||
                null,

            bannedAt:
                Date.now(),

            active:
                true

        };

        bans[
            String(userId)
        ] =
            ban;

        writeJSON(
            BANS_FILE,
            bans
        );

        saveAdminLog({

            action:
                "ban",

            targetUserId:
                String(userId),

            targetUsername:
                username ||
                "Unknown",

            staffUserId:
                req.adminSession.robloxUserId,

            staffUsername:
                req.adminSession.robloxUsername,

            staffRank:
                req.adminSession.rank,

            reason:
                ban.reason,

            duration:
                ban.duration,

            jobId:
                jobId ||
                null

        });

        await sendDiscordLog(
            "ban",
            {

                userId:
                    String(userId),

                username:
                    username ||
                    "Unknown",

                reason:
                    ban.reason,

                duration:
                    ban.duration,

                staffUsername:
                    req.adminSession.robloxUsername,

                jobId:
                    jobId ||
                    null

            }
        );

        return res.json({

            success:
                true,

            ban

        });

    }
);

/* ============================================================
   ADMIN UNBAN
============================================================ */

app.post(
    "/api/admin/unban",
    authenticate,
    requireAdminSession,
    async (req, res) => {

        const {
            userId,
            username,
            reason
        } = req.body;

        if (!userId) {

            return res.status(
                400
            ).json({

                success:
                    false,

                error:
                    "userId is required."

            });

        }

        const bans =
            readJSON(
                BANS_FILE,
                {}
            );

        const existing =
            bans[
                String(userId)
            ];

        if (!existing) {

            return res.status(
                404
            ).json({

                success:
                    false,

                error:
                    "Player is not banned."

            });

        }

        existing.active =
            false;

        existing.unbannedAt =
            Date.now();

        existing.unbannedBy =
            req.adminSession.robloxUserId;

        existing.unbannedByUsername =
            req.adminSession.robloxUsername;

        existing.unbanReason =
            reason ||
            "No reason provided";

        writeJSON(
            BANS_FILE,
            bans
        );

        saveAdminLog({

            action:
                "unban",

            targetUserId:
                String(userId),

            targetUsername:
                username ||
                existing.username ||
                "Unknown",

            staffUserId:
                req.adminSession.robloxUserId,

            staffUsername:
                req.adminSession.robloxUsername,

            staffRank:
                req.adminSession.rank,

            reason:
                existing.unbanReason

        });

        await sendDiscordLog(
            "unban",
            {

                userId:
                    String(userId),

                username:
                    username ||
                    existing.username ||
                    "Unknown",

                staffUsername:
                    req.adminSession.robloxUsername,

                reason:
                    existing.unbanReason

            }
        );

        return res.json({

            success:
                true,

            ban:
                existing

        });

    }
);

/* ============================================================
   ADMIN : COMMANDS
============================================================ */

app.post(
    "/api/admin/command",
    authenticate,
    requireAdminSession,
    async (req, res) => {

        const {
            command,
            targetUserId,
            targetUsername,
            reason,
            jobId
        } = req.body;

        if (!command) {

            return res.status(
                400
            ).json({

                success:
                    false,

                error:
                    "command is required."

            });

        }

        const normalizedCommand =
            String(
                command
            )
                .trim()
                .replace(
                    /^:/,
                    ""
                )
                .toLowerCase();

        /*
            These are the first foundation
            commands. The Roblox server will
            actually execute them later.
        */

        const allowedCommands = [

            "bring",
            "goto",
            "respawn",
            "heal",
            "kill",
            "freeze",
            "unfreeze"

        ];

        if (
            !allowedCommands.includes(
                normalizedCommand
            )
        ) {

            return res.status(
                400
            ).json({

                success:
                    false,

                error:
                    "Command is not currently configured."

            });

        }

        saveAdminLog({

            action:
                `:${normalizedCommand}`,

            targetUserId:
                targetUserId
                    ? String(
                        targetUserId
                    )
                    : null,

            targetUsername:
                targetUsername ||
                null,

            staffUserId:
                req.adminSession.robloxUserId,

            staffUsername:
                req.adminSession.robloxUsername,

            staffRank:
                req.adminSession.rank,

            reason:
                reason ||
                null,

            jobId:
                jobId ||
                null

        });

        await sendDiscordLog(
            "admin",
            {

                action:
                    `:${normalizedCommand}`,

                staffUsername:
                    req.adminSession.robloxUsername,

                targetUsername:
                    targetUsername ||
                    "None",

                details:
                    reason ||
                    "Command executed.",

                jobId:
                    jobId ||
                    null

            }
        );

        return res.json({

            success:
                true,

            command:
                `:${normalizedCommand}`,

            message:
                "Command authorized. Roblox server must execute the requested action."

        });

    }
);

/* ============================================================
   ADMIN KICK
============================================================ */

app.post(
    "/api/admin/kick",
    authenticate,
    requireAdminSession,
    async (req, res) => {

        const {
            userId,
            username,
            reason,
            jobId
        } = req.body;

        if (!userId) {

            return res.status(
                400
            ).json({

                success:
                    false,

                error:
                    "userId is required."

            });

        }

        const kickReason =
            reason ||
            "Kicked by Emergency Hessen staff.";

        saveAdminLog({

            action:
                "kick",

            targetUserId:
                String(userId),

            targetUsername:
                username ||
                "Unknown",

            staffUserId:
                req.adminSession.robloxUserId,

            staffUsername:
                req.adminSession.robloxUsername,

            staffRank:
                req.adminSession.rank,

            reason:
                kickReason,

            jobId:
                jobId ||
                null

        });

        await sendDiscordLog(
            "kick",
            {

                userId:
                    String(userId),

                username:
                    username ||
                    "Unknown",

                staffUsername:
                    req.adminSession.robloxUsername,

                reason:
                    kickReason,

                jobId:
                    jobId ||
                    null

            }
        );

        return res.json({

            success:
                true,

            message:
                "Kick authorized. Roblox server must execute the kick."

        });

    }
);

/* ============================================================
   START API
============================================================ */

app.listen(
    PORT,
    () => {

        console.log(
            `🌐 Emergency Hessen API listening on port ${PORT}`
        );

    }
);

/* ============================================================
   DISCORD LOGIN
============================================================ */

if (
    !process.env.DISCORD_TOKEN
) {

    console.error(
        "❌ DISCORD_TOKEN is missing from .env"
    );

    process.exit(
        1
    );

}

client.login(
    process.env.DISCORD_TOKEN
).catch(
    error => {

        console.error(
            "❌ Discord login failed:"
        );

        console.error(
            error
        );

    }
);