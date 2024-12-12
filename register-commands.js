// register-commands.js
const fetch = require('node-fetch');
require('dotenv').config();

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

// Function to register commands
async function registerCommands() {
    const response = await fetch(
        `https://discord.com/api/v10/applications/${process.env.DISCORD_APPLICATION_ID}/commands`,
        {
            method: 'PUT',
            headers: {
                'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(commands),
        }
    );

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Error registering commands: ${text}`);
    }

    console.log('Commands registered successfully!');
}

registerCommands().catch(console.error);
