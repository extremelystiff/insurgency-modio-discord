const express = require('express');
const { verifyKeyMiddleware } = require('discord-interactions');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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
        // ... rest of the conversion function remains the same ...
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

// Verify Discord requests
app.post('/interactions', verifyKeyMiddleware(process.env.DISCORD_PUBLIC_KEY), async (req, res) => {
    const interaction = req.body;

    // Handle ping
    if (interaction.type === 1) {
        return res.json({ type: 1 });
    }

    // Handle slash commands
    if (interaction.type === 2) {
        const { name, options } = interaction.data;

        try {
            if (name === 'getstate') {
                const modId = options.find(opt => opt.name === 'mod_id').value;
                
                // Defer the response since we'll need more than 3 seconds
                await res.json({
                    type: 5, // Deferred response
                });

                try {
                    const modData = await getMod(modId);
                    const convertedData = convertModioResponse(modData);
                    const jsonString = JSON.stringify(convertedData, null, 2);

                    // Send followup with file
                    await fetch(`https://discord.com/api/v10/webhooks/${process.env.DISCORD_APPLICATION_ID}/${interaction.token}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            content: `Here's the state.json for ${modData.name}:`,
                            attachments: [{
                                id: 0,
                                description: 'state.json file',
                                filename: 'state.json'
                            }]
                        })
                    });

                } catch (error) {
                    await fetch(`https://discord.com/api/v10/webhooks/${process.env.DISCORD_APPLICATION_ID}/${interaction.token}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            content: `Error: Could not fetch mod with ID ${modId}`,
                        })
                    });
                }
            }
            else if (name === 'findmod') {
                const query = options.find(opt => opt.name === 'name').value;
                
                // Defer the response
                await res.json({
                    type: 5,
                });

                try {
                    const mods = await searchMods(query);
                    if (mods.length === 0) {
                        await fetch(`https://discord.com/api/v10/webhooks/${process.env.DISCORD_APPLICATION_ID}/${interaction.token}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                content: 'No mods found matching your search.',
                            })
                        });
                        return;
                    }
                    
                    const modList = mods.slice(0, 5).map(mod => 
                        `${mod.name} (ID: ${mod.id}) - ${mod.summary.slice(0, 100)}...`
                    ).join('\n\n');
                    
                    await fetch(`https://discord.com/api/v10/webhooks/${process.env.DISCORD_APPLICATION_ID}/${interaction.token}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            content: `Found these mods:\n\n${modList}\n\nUse /getstate with the mod ID to get the state.json file.`,
                        })
                    });
                } catch (error) {
                    await fetch(`https://discord.com/api/v10/webhooks/${process.env.DISCORD_APPLICATION_ID}/${interaction.token}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            content: 'Error searching for mods.',
                        })
                    });
                }
            }
        } catch (error) {
            console.error(error);
            if (!res.headersSent) {
                res.json({
                    type: 4,
                    data: {
                        content: 'An error occurred while processing your request.',
                    },
                });
            }
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
