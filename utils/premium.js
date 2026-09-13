const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const premiumPath = path.join(
    __dirname,
    "..",
    "data",
    "premium.json"
);

function loadPremium() {
    try {
        if (!fs.existsSync(premiumPath)) {
            const defaultData = {
                users: {},
                codes: {},
                servers: {}
            };

            fs.writeFileSync(
                premiumPath,
                JSON.stringify(defaultData, null, 4)
            );

            return defaultData;
        }

        const data = JSON.parse(
            fs.readFileSync(premiumPath, "utf8")
        );

        return {
            users: data.users || {},
            codes: data.codes || {},
            servers: data.servers || {}
        };
    } catch (error) {
        console.error(
            "❌ Premium database error:",
            error
        );

        return {
            users: {},
            codes: {},
            servers: {}
        };
    }
}

function savePremium(data) {
    fs.writeFileSync(
        premiumPath,
        JSON.stringify(data, null, 4)
    );
}

function generatePremiumCode() {
    const part1 = crypto
        .randomBytes(3)
        .toString("hex")
        .toUpperCase();

    const part2 = crypto
        .randomBytes(3)
        .toString("hex")
        .toUpperCase();

    const part3 = crypto
        .randomBytes(3)
        .toString("hex")
        .toUpperCase();

    return `ATLAS-${part1}-${part2}-${part3}`;
}

function createPremiumCode(userId, uses) {
    const data = loadPremium();

    let code;

    do {
        code = generatePremiumCode();
    } while (data.codes[code]);

    data.codes[code] = {
        owner: userId,
        uses: Number(uses),
        used: 0,
        activatedServers: [],
        createdAt: new Date().toISOString()
    };

    savePremium(data);

    return code;
}

/*
 * Activates Premium for a server.
 */
function activateServerPremium(
    userId,
    guildId,
    guildName,
    code
) {
    const data = loadPremium();

    code = code.toUpperCase();

    const premiumCode = data.codes[code];

    if (!premiumCode) {
        return {
            success: false,
            error: "INVALID_CODE"
        };
    }

    if (premiumCode.uses <= 0) {
        return {
            success: false,
            error: "NO_USES"
        };
    }

    /*
     * Don't allow the same server to be activated
     * multiple times.
     */
    if (data.servers[guildId]?.premium) {
        return {
            success: false,
            error: "SERVER_ALREADY_PREMIUM"
        };
    }

    premiumCode.uses--;
    premiumCode.used++;

    /*
     * Create the server Premium record.
     */
    data.servers[guildId] = {
        premium: true,
        activatedBy: userId,
        activatedAt: new Date().toISOString(),
        activatedWith: code,

        name: null,
        avatar: null,
        banner: null,
        bio: null,

        guildName: guildName || "Unknown Server"
    };

    if (!premiumCode.activatedServers) {
        premiumCode.activatedServers = [];
    }

    premiumCode.activatedServers.push({
        guildId,
        guildName: guildName || "Unknown Server",
        userId,
        activatedAt: new Date().toISOString()
    });

    /*
     * Keep track of servers activated by this user.
     */
    if (!data.users[userId]) {
        data.users[userId] = {
            premium: false,
            activatedServers: []
        };
    }

    if (!data.users[userId].activatedServers) {
        data.users[userId].activatedServers = [];
    }

    data.users[userId].activatedServers.push({
        guildId,
        guildName: guildName || "Unknown Server",
        activatedAt: new Date().toISOString()
    });

    savePremium(data);

    return {
        success: true,
        remainingUses: premiumCode.uses,
        guildId
    };
}

function isServerPremium(guildId) {
    const data = loadPremium();

    return Boolean(
        data.servers[guildId]?.premium
    );
}

function getServerPremium(guildId) {
    const data = loadPremium();

    return data.servers[guildId] || null;
}

function getUserPremiumServers(userId) {
    const data = loadPremium();

    return Object.entries(data.servers)
        .filter(
            ([, server]) =>
                server.premium &&
                server.activatedBy === userId
        )
        .map(([guildId, server]) => ({
            guildId,
            guildName:
                server.guildName ||
                "Unknown Server",
            activatedAt:
                server.activatedAt
        }));
}

/*
 * Kept for compatibility with older parts
 * of the Premium system.
 */
function hasPremium(userId) {
    const data = loadPremium();

    return Boolean(
        data.users[userId]?.premium
    );
}

function getPremiumUser(userId) {
    const data = loadPremium();

    return data.users[userId] || null;
}

function getServerProfile(guildId) {
    const data = loadPremium();

    return (
        data.servers[guildId] || {
            premium: false,
            name: null,
            avatar: null,
            banner: null,
            bio: null
        }
    );
}

function setServerProfile(guildId, profile) {
    const data = loadPremium();

    if (!data.servers[guildId]) {
        data.servers[guildId] = {
            premium: false
        };
    }

    data.servers[guildId] = {
        ...data.servers[guildId],
        ...profile
    };

    savePremium(data);

    return data.servers[guildId];
}

module.exports = {
    loadPremium,
    savePremium,
    createPremiumCode,
    activateServerPremium,
    isServerPremium,
    getServerPremium,
    getUserPremiumServers,
    hasPremium,
    getPremiumUser,
    getServerProfile,
    setServerProfile
};