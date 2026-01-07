const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

const commands = [
    new SlashCommandBuilder()
        .setName('play')
        .setDescription('Plays a song from SoundCloud or Spotify')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('The URL or search query')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stops the music and clears the queue'),
    new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skips the current song'),
    new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Shows the current music queue'),
    new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pauses the current song'),
    new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resumes the current song'),
    new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Deletes a specified number of messages (Admin only)')
        .addIntegerOption(option =>
            option.setName('count')
                .setDescription('Number of messages to delete (1-100)')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Shows the currently playing song'),
    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clears the music queue'),
    new SlashCommandBuilder()
        .setName('skipto')
        .setDescription('Skips to a specific song in the queue')
        .addIntegerOption(option =>
            option.setName('position')
                .setDescription('The position of the song in the queue')
                .setRequired(true)),
]
    .map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        if (process.env.GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands },
            );
            console.log('Successfully reloaded application (/) commands for the guild.');
        } else {
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands },
            );
            console.log('Successfully reloaded application (/) commands globally.');
        }

    } catch (error) {
        console.error(error);
    }
})();
