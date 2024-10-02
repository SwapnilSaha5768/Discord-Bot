require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Set prefix
const prefix = ':';

// When the bot is ready
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    // Set a timer to stop the bot after 9999 minutes (599940000 milliseconds)
        setTimeout(() => {
            console.log('Time is up! Shutting down the bot...');
            client.destroy(); // This will log the bot out of Discord
        }, 599940000); // 9999 minutes in milliseconds
});

// Function to check permissions
const checkPermissions = (message, permissions) => {
    return message.member.permissions.has(permissions);
};

// Moderation commands
client.on('messageCreate', async message => {
    // Ignore messages from the bot itself or without the prefix
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    // Split the message into command and arguments
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Kick command
    if (command === 'kick') {
        if (!checkPermissions(message, 'KICK_MEMBERS')) {
            return message.channel.send("You don't have permission to use this command.");
        }

        const member = message.mentions.members.first();
        if (member) {
            member.kick().then(() => {
                message.channel.send(`${member.user.tag} has been kicked.`);
            }).catch(err => {
                message.channel.send("I do not have permission to kick this member.");
                console.error(err);
            });
        } else {
            message.channel.send('Please mention a user to kick.');
        }
    }

    // Ban command
    else if (command === 'ban') {
        if (!checkPermissions(message, 'BAN_MEMBERS')) {
            return message.channel.send("You don't have permission to use this command.");
        }

        const member = message.mentions.members.first();
        if (member) {
            member.ban().then(() => {
                message.channel.send(`${member.user.tag} has been banned.`);
            }).catch(err => {
                message.channel.send("I do not have permission to ban this member.");
                console.error(err);
            });
        } else {
            message.channel.send('Please mention a user to ban.');
        }
    }

    // Move user command
    else if (command === 'move') {
        if (!checkPermissions(message, 'MOVE_MEMBERS')) {
            return message.channel.send("You don't have permission to use this command.");
        }

        const member = message.mentions.members.first();
        const channelID = args[1]; // The ID of the target voice channel

        if (member && channelID) {
            const channel = message.guild.channels.cache.get(channelID);
            if (channel && channel.type === 2) { // 2 is the type for voice channels
                member.voice.setChannel(channel).then(() => {
                    message.channel.send(`Moved ${member.user.tag} to ${channel.name}.`);
                }).catch(err => {
                    message.channel.send("Failed to move the member.");
                    console.error(err);
                });
            } else {
                message.channel.send("Invalid voice channel ID.");
            }
        } else {
            message.channel.send("Please mention a user and provide a valid voice channel ID.");
        }
    }

    // Command to give an existing role to a user
    else if (command === 'giverole') {
        if (!checkPermissions(message, 'MANAGE_ROLES')) {
            return message.channel.send("You don't have permission to use this command.");
        }

        const member = message.mentions.members.first();
        const roleName = args.slice(1).join(' '); // Role name after the mention

        if (member && roleName) {
            const role = message.guild.roles.cache.find(r => r.name === roleName);
            if (role) {
                member.roles.add(role).then(() => {
                    message.channel.send(`${member.user.tag} has been given the ${roleName} role.`);
                }).catch(err => {
                    message.channel.send(`Failed to give the ${roleName} role.`);
                    console.error(err);
                });
            } else {
                message.channel.send(`Role ${roleName} not found.`);
            }
        } else {
            message.channel.send('Please mention a user and specify a role.');
        }
    }

    // Command to create a new role with a specific color
    else if (command === 'createrole') {
        if (!checkPermissions(message, 'MANAGE_ROLES')) {
            return message.channel.send("You don't have permission to use this command.");
        }

        const roleName = args[0]; // The first argument is the role name
        const roleColor = args[1]; // The second argument is the role color (in HEX)

        if (roleName && /^#[0-9A-F]{6}$/i.test(roleColor)) {
            message.guild.roles.create({
                name: roleName,
                color: roleColor,
            }).then(role => {
                message.channel.send(`Role ${roleName} created with color ${roleColor}.`);
            }).catch(err => {
                message.channel.send('Failed to create the role.');
                console.error(err);
            });
        } else {
            message.channel.send('Please provide a valid role name and a valid HEX color code.');
        }
    }

    // Command to update the color of an existing role
    else if (command === 'updaterolecolor') {
        if (!checkPermissions(message, 'MANAGE_ROLES')) {
            return message.channel.send("You don't have permission to use this command.");
        }

        const roleName = args[0]; // The first argument is the role name
        const newColor = args[1]; // The second argument is the new color (in HEX)

        if (roleName && /^#[0-9A-F]{6}$/i.test(newColor)) {
            const role = message.guild.roles.cache.find(r => r.name === roleName);
            if (role) {
                role.setColor(newColor).then(updated => {
                    message.channel.send(`Updated ${roleName}'s color to ${newColor}.`);
                }).catch(err => {
                    message.channel.send('Failed to update the role color.');
                    console.error(err);
                });
            } else {
                message.channel.send(`Role ${roleName} not found.`);
            }
        } else {
            message.channel.send('Please provide a valid role name and a valid HEX color code.');
        }
    }

    // Setup mute role command
    else if (command === 'setupmute') {
        if (!checkPermissions(message, 'MANAGE_ROLES')) {
            return message.channel.send("You don't have permission to use this command.");
        }

        const muteRoleName = 'Muted';

        // Check if the role already exists
        let muteRole = message.guild.roles.cache.find(role => role.name === muteRoleName);
        if (muteRole) {
            return message.channel.send(`The "Muted" role already exists.`);
        }

        // Create the Muted role
        try {
            muteRole = await message.guild.roles.create({
                name: muteRoleName,
                color: '#000000',
                reason: 'Mute role created for muting users.',
            });

            // Update channel permissions to prevent the muted role from sending messages or speaking
            message.guild.channels.cache.forEach(async (channel) => {
                await channel.permissionOverwrites.create(muteRole, {
                    SEND_MESSAGES: false,
                    ADD_REACTIONS: false,
                    SPEAK: false,
                    CONNECT: false,
                });
            });

            message.channel.send(`"Muted" role has been created and permissions have been set.`);
        } catch (error) {
            console.error(error);
            message.channel.send("An error occurred while setting up the mute role.");
        }
    }

    // Mute command to assign the mute role
    else if (command === 'mute') {
        if (!checkPermissions(message, 'TIMEOUT_MEMBERS')) {
            return message.channel.send("You don't have permission to use this command.");
        }

        const member = message.mentions.members.first();

        if (!member) {
            return message.channel.send('Please mention a user to mute.');
        }

        // Find the Muted role or create it if it doesn't exist
        let muteRole = message.guild.roles.cache.find(role => role.name === 'Muted');

        if (!muteRole) {
            return message.channel.send('The "Muted" role does not exist. Use !setupmute to create it.');
        }

        // Assign the mute role to the member
        member.roles.add(muteRole)
            .then(() => {
                message.channel.send(`${member.user.tag} has been muted.`);
            })
            .catch(err => {
                message.channel.send("I do not have permission to mute this member.");
                console.error(err);
            });
    }

    // Unmute command
    else if (command === 'unmute') {
        if (!checkPermissions(message, 'TIMEOUT_MEMBERS')) {
            return message.channel.send("You don't have permission to use this command.");
        }

        const member = message.mentions.members.first();

        if (!member) {
            return message.channel.send('Please mention a user to unmute.');
        }

        // Find the Muted role
        const muteRole = message.guild.roles.cache.find(role => role.name === 'Muted');

        if (!muteRole) {
            return message.channel.send('The "Muted" role does not exist.');
        }

        // Remove the mute role from the member
        member.roles.remove(muteRole)
            .then(() => {
                message.channel.send(`${member.user.tag} has been unmuted.`);
            })
            .catch(err => {
                message.channel.send("I do not have permission to unmute this member.");
                console.error(err);
            });
    }
});

// Purge command
client.on('messageCreate', async message => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    

    // !purge command for number-based, user-based, or bot-based purging
    if (command === 'purge') {
        // Only allow users with MANAGE_MESSAGES permission to use this command
        if (!message.member.permissions.has('MANAGE_MESSAGES')) {
            return message.channel.send("You don't have permission to use this command.");
        }

        const subCommand = args[0]; // e.g. user, bot, number
        let messagesToDelete = [];

        try {
            // Number-based purge (e.g., !purge 50)
            if (!isNaN(subCommand)) {
                const amount = parseInt(subCommand);

                if (amount < 1 || amount > 100) {
                    return message.channel.send('You need to input a number between 1 and 100.');
                }

                // Fetch messages and delete
                const fetchedMessages = await message.channel.messages.fetch({ limit: amount });
                messagesToDelete = fetchedMessages;

            // User-based purge (e.g., !purge user @user)
            } else if (subCommand === 'user') {
                const user = message.mentions.users.first();
                if (!user) {
                    return message.channel.send('Please mention a user.');
                }

                // Fetch messages and filter them by the user
                const fetchedMessages = await message.channel.messages.fetch({ limit: 100 });
                messagesToDelete = fetchedMessages.filter(m => m.author.id === user.id);

            // Bot-based purge (e.g., !purge bot)
            } else if (subCommand === 'bot') {
                // Fetch messages and filter them by bot users
                const fetchedMessages = await message.channel.messages.fetch({ limit: 100 });
                messagesToDelete = fetchedMessages.filter(m => m.author.bot);

            } else {
                return message.channel.send('Invalid subcommand. Use `!purge <number>`, `!purge user @user`, or `!purge bot`.');
            }

            // Ensure messages are less than 14 days old
            const filteredMessages = messagesToDelete.filter(m => (Date.now() - m.createdTimestamp) < 1209600000);

            if (filteredMessages.size === 0) {
                return message.channel.send('No messages to delete, or messages are older than 14 days.');
            }

            // Bulk delete the filtered messages
            await message.channel.bulkDelete(filteredMessages, true);
            message.channel.send(`Successfully deleted ${filteredMessages.size} messages.`).then(msg => {
                setTimeout(() => msg.delete(), 5000); // Auto-delete the success message after 5 seconds
            });

        } catch (err) {
            console.error(err);
            message.channel.send('Something went wrong while trying to purge messages.');
        }
    }

    // Say command
    else if (command === 'say') {
        const sayMessage = args.join(' '); // Join all the arguments to form the message
        if (!sayMessage) {
            return message.channel.send('Please provide a message to say.');
        }

        // Send the message to the channel
        await message.channel.send(sayMessage);

        // Delete the command message to keep the chat clean
        await message.delete().catch(err => console.error('Failed to delete message:', err));
    }

    // Help command to show all available commands
    else if (command === 'help') {
        const helpMessage = `
**Available Commands:**
\`\`\`
1. ${prefix}help - Shows this help message.
2. ${prefix}kick @user - Kicks a mentioned user from the server.
3. ${prefix}ban @user - Bans a mentioned user from the server.
4. ${prefix}mute @user - Mutes a mentioned user.
5. ${prefix}unmute @user - Unmutes a mentioned user.
6. ${prefix}move @user channelID - Moves a mentioned user to the specified voice channel.
7. ${prefix}giverole @user roleName - Gives a mentioned user an existing role.
8. ${prefix}createrole roleName #HEXCOLOR - Creates a new role with the specified name and color.
9. ${prefix}updaterolecolor roleName #HEXCOLOR - Updates the color of an existing role.
10. ${prefix}setupmute - Sets up the mute role and permissions automatically.
11. ${prefix}purge <number/user/bot> - Deletes messages based on specified criteria.
12. ${prefix}say [message] - Makes the bot say the specified message.
\`\`\`
        `;
        message.channel.send(helpMessage);
    }
});

client.login(process.env.TOKEN);
