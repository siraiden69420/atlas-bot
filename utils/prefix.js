const fs = require("fs");
const path = require("path");

const configPath = path.join(
    __dirname,
    "..",
    "data",
    "config.json"
);

const DEFAULT_PREFIX = "a!";

function loadConfig() {
    try {
        return JSON.parse(
            fs.readFileSync(configPath, "utf8")
        );
    } catch {
        return {};
    }
}

function saveConfig(config) {
    fs.writeFileSync(
        configPath,
        JSON.stringify(config, null, 4)
    );
}

function getPrefix(guildId) {
    const config = loadConfig();

    return config[guildId]?.prefix || DEFAULT_PREFIX;
}

function setPrefix(guildId, prefix) {
    const config = loadConfig();

    if (!config[guildId]) {
        config[guildId] = {};
    }

    config[guildId].prefix = prefix;

    saveConfig(config);

    return prefix;
}

module.exports = {
    DEFAULT_PREFIX,
    getPrefix,
    setPrefix
};