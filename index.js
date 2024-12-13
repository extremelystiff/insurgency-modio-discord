const express = require('express');
const { verifyKeyMiddleware } = require('discord-interactions');
const fetch = require('node-fetch');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON bodies
app.use(express.json());

// Constants
const MOD_IO_GAME_ID = '254'; // Insurgency: Sandstorm game ID
const MOD_IO_API_KEY = process.env.MOD_IO_API_KEY;

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
    console.log(`Searching for mods with query: ${query}`);
    const response = await fetch(
        `https://api.mod.io/v1/games/${MOD_IO_GAME_ID}/mods?api_key=${MOD_IO_API_KEY}&_q=${encodeURIComponent(query)}`,
        {
            headers: { 'Accept': 'application/json' }
        }
    );
    
    if (!response.ok) {
        const error = await response.text();
        console.error('Mod search error:', error);
        throw new Error(`Mod.io search failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Found ${data.data.length} mods`);
    return data.data;
}

// Function to get mod by ID
async function getMod(modId) {
    console.log(`Fetching mod ID: ${modId}`);
    const response = await fetch(
        `https://api.mod.io/v1/games/${MOD_IO_GAME_ID}/mods/${modId}?api_key=${MOD_IO_API_KEY}`,
        {
            headers: { 'Accept': 'application/json' }
        }
    );
    
    if (!response.ok) {
        const error = await response.text();
        console.error('Mod fetch error:', error);
        throw new Error(`Mod.io fetch failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Mod fetched successfully');
    return data;
}

// Send file to Discord
async function sendDiscordFile(webhookUrl, content, filename, fileContent) {
    console.log('Preparing to send file to Discord');
    const form = new FormData();
    form.append('payload_json', JSON.stringify({ content }));
    form.append('files[0]', Buffer.from(fileContent), {
        filename,
        contentType: 'application/json'
    });

    const response = await fetch(webhookUrl, {
        method: 'POST',
        body: form
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('Discord file send error:', error);
        throw new Error(`Discord file send failed: ${response.status}`);
    }

    console.log('File sent successfully to Discord');
}

// Handle Discord interactions
app.post('/interactions', verifyKeyMiddleware(process.env.DISCORD_PUBLIC_KEY), async (req, res) => {
    const interaction = req.body;
    console.log('Received interaction type:', interaction.type);

    // Handle ping
    if (interaction.type === 1) {
        return res.json({ type: 1 });
    }

    // Handle commands
    if (interaction.type === 2) {
        const { name, options } = interaction.data;
        console.log('Processing command:', name);

        try {
            if (name === 'findmod') {
                const query = options.find(opt => opt.name === 'name').value;
                await res.json({ type: 5 }); // Defer response

                const mods = await searchMods(query);
                if (mods.length === 0) {
                    await sendDiscordResponse(interaction, 'No mods found matching your search.');
                    return;
                }

                const modList = mods.slice(0, 5)
                    .map(mod => `${mod.name} (ID: ${mod.id}) - ${mod.summary.slice(0, 100)}...`)
                    .join('\n\n');

                await sendDiscordResponse(interaction, 
                    `Found these mods:\n\n${modList}\n\nUse /getstate with the mod ID to get the state.json file.`
                );
            }
            else if (name === 'getstate') {
                const modId = options.find(opt => opt.name === 'mod_id').value;
                console.log('Processing getstate for mod:', modId);
                
                await res.json({ type: 5 }); // Defer response

                const modData = await getMod(modId);
                console.log('Converting mod data');
                const convertedData = convertModioResponse(modData);
                const jsonString = JSON.stringify(convertedData, null, 2);

                console.log('Sending state.json to Discord');
                const webhookUrl = `https://discord.com/api/v10/webhooks/${process.env.DISCORD_APPLICATION_ID}/${interaction.token}`;
                await sendDiscordFile(
                    webhookUrl,
                    `Here's the State.json for ${modData.name}:`,
                    'State.json',
                    jsonString
                );
            }
        } catch (error) {
            console.error('Command processing error:', error);
            const errorMessage = `Error processing command: ${error.message}`;
            
            try {
                await sendDiscordResponse(interaction, errorMessage);
            } catch (followupError) {
                console.error('Error sending error response:', followupError);
            }
        }
    }
});

// Helper function to send Discord responses
async function sendDiscordResponse(interaction, content) {
    const webhookUrl = `https://discord.com/api/v10/webhooks/${process.env.DISCORD_APPLICATION_ID}/${interaction.token}`;
    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('Discord response error:', error);
        throw new Error(`Failed to send Discord response: ${response.status}`);
    }
}

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Environment check:');
    console.log('- DISCORD_PUBLIC_KEY:', !!process.env.DISCORD_PUBLIC_KEY);
    console.log('- DISCORD_APPLICATION_ID:', !!process.env.DISCORD_APPLICATION_ID);
    console.log('- MOD_IO_API_KEY:', !!process.env.MOD_IO_API_KEY);
});
