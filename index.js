// Required imports
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const fetch = require('node-fetch');
require('dotenv').config();

// Constants
const MOD_IO_GAME_ID = '254'; // Insurgency: Sandstorm game ID
const MOD_IO_API_KEY = process.env.MOD_IO_API_KEY;

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Command registration
const commands = [
    {
        name: 'getstate',
        description: 'Get state.json for a mod',
        options: [
            {
                name: 'mod_id',
                description: 'The ID of the mod from mod.io',
                type: 3, // STRING type
                required: true
            }
        ]
    },
    {
        name: 'findmod',
        description: 'Search for a mod by name',
        options: [
            {
                name: 'name',
                description: 'Name of the mod to search for',
                type: 3,
                required: true
            }
        ]
    }
];

// Convert ModIO response to game-ready format
function convertModioResponse(state) {
    return {
        iD: state.id,
        gameId: state.game_id,
        status: state.status === 1 ? "Accepted" : "Pending",
        visible: state.visible === 1 ? "Public" : "Hidden",
        submittedBy: {
            iD: state.submitted_by.id,
            nameId: state.submitted_by.name_id,
            username: state.submitted_by.username,
            dateOnline: state.submitted_by.date_online,
            avatar: {
                thumb_50x50: state.submitted_by.avatar.thumb_50x50,
                thumb_100x100: state.submitted_by.avatar.thumb_100x100,
                filename: state.submitted_by.avatar.filename,
                original: state.submitted_by.avatar.original
            },
            timezone: "",
            language: "",
            profileUrl: state.submitted_by.profile_url
        },
        dateAdded: state.date_added,
        dateUpdated: state.date_updated,
        maturityOption: "None",
        logo: {
            thumb_640x360: state.logo.thumb_640x360,
            thumb_1280x720: state.logo.thumb_1280x720,
            thumb_320x180: state.logo.thumb_320x180,
            filename: state.logo.filename,
            original: state.logo.original
        },
        homepageUrl: "",
        name: state.name,
        nameId: state.name_id,
        summary: state.summary,
        description: state.description,
        description_Plaintext: state.description_plaintext,
        metadataBlob: "",
        profileUrl: state.profile_url,
        media: {
            youtube: [],
            sketchfab: [],
            images: state.media.images || []
        },
        modfile: {
            iD: state.modfile.id,
            modId: state.modfile.mod_id,
            dateAdded: state.modfile.date_added,
            dateScanned: state.modfile.date_scanned,
            virusStatus: state.modfile.virus_status === 1 ? "ScanComplete" : "NotScanned",
            virusPositive: state.modfile.virus_positive === 0 ? false : true,
            virusTotalHash: "",
            fileSize: 0,
            filehash: {
                md5: state.modfile.filehash.md5
            },
            filename: state.modfile.filename,
            version: state.modfile.version,
            changelog: state.modfile.changelog,
            metadataBlob: state.modfile.metadata_blob,
            download: {
                binaryUrl: state.modfile.download.binary_url,
                dateExpires: state.modfile.download.date_expires
            }
        },
        stats: {
            modId: state.stats.mod_id,
            popularityRankPosition: state.stats.popularity_rank_position,
            popularityRankTotalMods: state.stats.popularity_rank_total_mods,
            downloadsTotal: state.stats.downloads_total,
            subscribersTotal: state.stats.subscribers_total,
            ratingsTotal: state.stats.ratings_total,
            ratingsPositive: state.stats.ratings_positive,
            ratingsNegative: state.stats.ratings_negative,
            ratingsPercentagePositive: state.stats.ratings_percentage_positive,
            ratingsWeightedAggregate: Number(state.stats.ratings_weighted_aggregate).toFixed(20),
            ratingsDisplayText: state.stats.ratings_display_text,
            dateExpires: state.stats.date_expires
        },
        metadataKvp: [],
        tags: state.tags.map(tag => ({
            name: tag.name,
            dateAdded: 0
        }))
    };
}

// Function to search for mods
async function searchMods(query) {
    const response = await fetch(
        `https://api.mod.io/v1/games/${MOD_IO_GAME_ID}/mods?api_key=${MOD_IO_API_KEY}&_q=${encodeURIComponent(query)}`,
        {
            headers: {
                'Accept': 'application/json'
            }
        }
    );
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data;
}

// Function to get mod by ID
async function getMod(modId) {
    const response = await fetch(
        `https://api.mod.io/v1/games/${MOD_IO_GAME_ID}/mods/${modId}?api_key=${MOD_IO_API_KEY}`,
        {
            headers: {
                'Accept': 'application/json'
            }
        }
    );
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
}

// Handle commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    try {
        if (interaction.commandName === 'getstate') {
            await interaction.deferReply();
            const modId = interaction.options.getString('mod_id');
            
            try {
                const modData = await getMod(modId);
                const convertedData = convertModioResponse(modData);
                const jsonString = JSON.stringify(convertedData, null, 2);
                
                // Create and send file
                const buffer = Buffer.from(jsonString, 'utf-8');
                await interaction.editReply({
                    content: `Here's the state.json for ${modData.name}:`,
                    files: [{
                        attachment: buffer,
                        name: 'state.json'
                    }]
                });
            } catch (error) {
                await interaction.editReply(`Error: Could not fetch mod with ID ${modId}`);
            }
        }
        else if (interaction.commandName === 'findmod') {
            await interaction.deferReply();
            const query = interaction.options.getString('name');
            
            try {
                const mods = await searchMods(query);
                if (mods.length === 0) {
                    await interaction.editReply('No mods found matching your search.');
                    return;
                }
                
                const modList = mods.slice(0, 5).map(mod => 
                    `${mod.name} (ID: ${mod.id}) - ${mod.summary.slice(0, 100)}...`
                ).join('\n\n');
                
                await interaction.editReply(
                    `Found these mods:\n\n${modList}\n\nUse /getstate with the mod ID to get the state.json file.`
                );
            } catch (error) {
                await interaction.editReply('Error searching for mods.');
            }
        }
    } catch (error) {
        console.error(error);
        await interaction.editReply('An error occurred while processing your request.');
    }
});

// Register commands when bot starts
client.once('ready', async () => {
    console.log('Bot is ready!');
    
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('Commands registered!');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

// Start the bot
client.login(process.env.DISCORD_TOKEN);