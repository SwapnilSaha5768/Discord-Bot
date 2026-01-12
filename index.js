const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, PermissionFlagsBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, getVoiceConnection } = require('@discordjs/voice');
const play = require('play-dl');
const scdl = require('scdl-core');
const fetch = require('isomorphic-unfetch');
const { getTracks } = require('spotify-url-info')(fetch);
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
    ],
});


process.on('unhandledRejection', error => {
    console.error('Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught Exception:', error);
});

const queue = new Map();

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    try {
        console.log('Fetching SoundCloud Client ID...');
        const clientID = await play.getFreeClientID();
        scdl.SoundCloud.clientId = clientID;
        console.log(`Connected to SoundCloud with Client ID: ${clientID}`);
    } catch (err) {
        console.error('Failed to get SoundCloud Client ID:', err);
    }
    console.log('Music Bot is ready!');
});

function findBestMatch(tracks, query, targetDurationSec) {
    const q = query.toLowerCase();

    let candidates = tracks.filter(t => {
        if (!t.duration || t.duration < 30000) return false;
        if (t.policy === 'SNIP' || t.policy === 'BLOCK') return false;

        if (targetDurationSec) {
            const trackDurationSec = Math.floor(t.duration / 1000);
            const diff = Math.abs(trackDurationSec - targetDurationSec);
            if (diff > 10) return false;
        }

        return true;
    });

    if (candidates.length === 0 && targetDurationSec) {
        candidates = tracks.sort((a, b) => {
            const diffA = Math.abs((a.duration / 1000) - targetDurationSec);
            const diffB = Math.abs((b.duration / 1000) - targetDurationSec);
            return diffA - diffB;
        });
    }

    const hasVersionArgs = q.includes('remix') || q.includes('cover') || q.includes('live') || q.includes('mix') || q.includes('edit');

    if (!hasVersionArgs) {
        const cleanCandidates = candidates.filter(t => {
            const title = t.title.toLowerCase();
            return !title.includes('remix') && !title.includes('cover') && !title.includes('live') && !title.includes('reverb') && !title.includes('slowed') && !title.includes('reprised');
        });

        if (cleanCandidates.length > 0) {
            candidates = cleanCandidates;
        }
    }
    return candidates.length > 0 ? candidates[0] : (tracks.length > 0 ? tracks[0] : null);
}

const axios = require('axios');
async function getSoundCloudStream(url) {
    try {
        return await scdl.SoundCloud.download(url, {
            highWaterMark: 1 << 25
        });
    } catch (e) {
        console.warn(`[WARN] Standard download failed for ${url}: ${e}. Trying progressive fallback...`);
        try {
            const track = await scdl.SoundCloud.tracks.getTrack(url);
            const progressive = track.media.transcodings.find(t => t.format.protocol === 'progressive');

            if (progressive) {
                const clientId = scdl.SoundCloud.clientId;
                const linkUrl = `${progressive.url}?client_id=${clientId}`;

                const response = await axios.get(linkUrl, {
                    headers: { "User-Agent": "Mozilla/5.0", Accept: "*/*" }
                });
                const streamUrl = response.data.url;
                const streamRes = await axios.get(streamUrl, { responseType: 'stream' });
                return streamRes.data;
            }
        } catch (ex) {
            console.error("[ERROR] Progressive fallback failed:", ex);
        }
        throw e;
    }
}

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'play') {
            await handlePlay(interaction);
        } else if (commandName === 'stop') {
            await handleStop(interaction);
        } else if (commandName === 'skip') {
            await handleSkip(interaction);
        } else if (commandName === 'queue') {
            await handleQueue(interaction);
        } else if (commandName === 'pause') {
            await handlePause(interaction);
        } else if (commandName === 'resume') {
            await handleResume(interaction);
        } else if (commandName === 'purge') {
            await handlePurge(interaction);
        } else if (commandName === 'nowplaying') {
            await handleNowPlaying(interaction);
        } else if (commandName === 'clear') {
            await handleClear(interaction);
        } else if (commandName === 'skipto') {
            await handleSkipTo(interaction);
        } else if (commandName === 'help') {
            await handleHelp(interaction);
        } else if (commandName === 'volume') {
            await handleVolume(interaction);
        } else if (commandName === '247') {
            await handle247(interaction);
        }
    }
    else if (interaction.isButton()) {
        await handleButtons(interaction);
    }
});

async function handle247(interaction) {
    const guildId = interaction.guildId;
    let serverQueue = queue.get(guildId);

    const defaultUrl = 'https://stream.zeno.fm/zu59ykebs2zuv';

    if (!serverQueue) {
        if (!interaction.member.voice.channel) {
            return interaction.reply({ content: 'You must be in a voice channel to enable 24/7 mode!', ephemeral: true });
        }

        serverQueue = {
            connection: null,
            player: createAudioPlayer(),
            songs: [],
            playing: false,
            volume: 100,
            channel: interaction.channel,
            is247: false,
            autoplayUrl: defaultUrl
        };
        queue.set(guildId, serverQueue);
    }

    const customUrl = interaction.options.getString('url');
    if (customUrl) {
        serverQueue.autoplayUrl = customUrl;
        serverQueue.is247 = true;
    } else {
        if (!serverQueue.is247) {
            serverQueue.is247 = true;
            serverQueue.autoplayUrl = defaultUrl;
        } else {
            serverQueue.is247 = false;
        }
    }

    if (serverQueue.is247) {
        await interaction.reply(`✅ **24/7 Mode ENABLED**\nStation: ${customUrl ? 'Custom URL' : 'Bollywood Radio'}\nThe bot will play this station when the queue is empty.`);

        if (serverQueue.songs.length === 0 && !serverQueue.playing) {
            console.log('[DEBUG] 24/7 enabled and queue empty. Starting radio...');
            const dummySong = {
                title: 'Bollywood Radio 24/7',
                url: serverQueue.autoplayUrl,
                duration: '0',
                thumbnail: null,
                requester: 'Autoplay',
                source: 'arbitrary'
            };
            serverQueue.songs.push(dummySong);
            playSong(guildId, serverQueue.songs[0]);
        }

    } else {
        await interaction.reply('❌ **24/7 Mode DISABLED**\nThe bot will disconnect when the queue finishes.');
    }
}

async function handlePlay(interaction) {
    const query = interaction.options.getString('query');
    const member = interaction.member;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
        return interaction.reply({ content: 'You must be in a voice channel to play music!', ephemeral: true });
    }

    if (!voiceChannel.joinable || !voiceChannel.speakable) {
        return interaction.reply({ content: 'I need permissions to join and speak in your voice channel!', ephemeral: true });
    }

    try {
        await interaction.deferReply();
    } catch (error) {
        console.error('Error deferring reply:', error);
        return;
    }

    const guildId = interaction.guildId;
    let serverQueue = queue.get(guildId);

    if (!serverQueue) {
        serverQueue = {
            connection: null,
            player: createAudioPlayer(),
            songs: [],
            playing: false,
            volume: 100,
            channel: interaction.channel
        };
        queue.set(guildId, serverQueue);
    }

    try {
        let songsToAdd = [];

        const validation = await play.validate(query);

        if (validation === 'sp_track' || validation === 'sp_playlist' || validation === 'sp_album') {
            try {
                const spotTracks = await getTracks(query);

                for (const track of spotTracks) {
                    const searchString = `${track.name} ${track.artists ? track.artists[0].name : ''}`;
                    songsToAdd.push({
                        title: track.name,
                        artist: track.artists ? track.artists[0].name : 'Unknown Artist',
                        url: null,
                        searchQuery: searchString,
                        duration: track.duration_ms ? Math.floor(track.duration_ms / 1000).toString() : '0',
                        thumbnail: null,
                        requester: interaction.user.tag,
                        source: 'spotify_bridge'
                    });
                }

                if (validation !== 'sp_track') {
                    interaction.followUp({ content: `Queued ${spotTracks.length} tracks from Spotify!` });
                }

            } catch (e) {
                console.error('Spotify fetch failed:', e);
                return interaction.followUp({ content: 'Could not fetch Spotify data. Check if the link is valid.', ephemeral: true });
            }
        }



        if (songsToAdd.length === 0 && validation !== 'so_track' && validation !== 'so_playlist' && validation !== 'sp_track' && validation !== 'sp_playlist' && validation !== 'sp_album') {

            try {
                console.log(`[DEBUG] Searching SoundCloud for query: "${query}"`);

                const searchResults = await scdl.SoundCloud.search({
                    query: query,
                    filter: 'tracks'
                });

                let options = [];
                if (searchResults && searchResults.collection) {
                    options = searchResults.collection
                        .filter(t => t.kind === 'track')
                        .slice(0, 10);
                }

                options = options.filter(t => t.duration && t.duration > 30000);

                if (options.length === 0) {
                    return interaction.followUp({ content: 'Could not find any songs on SoundCloud with that query!', ephemeral: true });
                }

                const suggestions = options.slice(0, 6);

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('search_select')
                    .setPlaceholder('Select a song to play')
                    .addOptions(
                        suggestions.map((song, index) =>
                            new StringSelectMenuOptionBuilder()
                                .setLabel(song.title.substring(0, 100))
                                .setDescription(`By ${song.user.username} | ${Math.floor(song.duration / 1000)}s`)
                                .setValue(index.toString())
                        )
                    );

                const row = new ActionRowBuilder().addComponents(selectMenu);

                const reply = await interaction.followUp({
                    content: `**Found ${suggestions.length} results for "${query}":**\nPlease select one:`,
                    components: [row]
                });

                try {
                    const confirmation = await reply.awaitMessageComponent({ filter: i => i.user.id === interaction.user.id, time: 30000 });

                    const selectedIndex = parseInt(confirmation.values[0]);
                    const selectedTrack = suggestions[selectedIndex];
                    console.log(`[DEBUG] Selected Track URL: ${selectedTrack.permalink_url}`); // Log the chosen URL

                    await confirmation.update({ content: `Selected: **${selectedTrack.title}**`, components: [] });

                    songsToAdd.push({
                        title: selectedTrack.title,
                        url: selectedTrack.permalink_url,
                        duration: Math.floor((selectedTrack.duration || 0) / 1000).toString(),
                        thumbnail: selectedTrack.artwork_url || selectedTrack.user?.avatar_url,
                        requester: interaction.user.tag,
                        source: 'soundcloud'
                    });

                } catch (e) {
                    return interaction.editReply({ content: 'Selection timed out or cancelled.', components: [] });
                }

            } catch (e) {
                console.error('Search failed:', e);
                return interaction.followUp({ content: 'Search failed. Please try again.', ephemeral: true });
            }
        }
        else if (validation === 'so_track' || validation === 'so_playlist') {
            try {
                const searchResults = await scdl.SoundCloud.search({
                    query: query,
                    filter: 'tracks'
                });

                let track;
                if (searchResults && searchResults.collection) {
                    track = findBestMatch(searchResults.collection.filter(t => t.kind === 'track'), query);
                }

                if (track) {
                    songsToAdd.push({
                        title: track.title,
                        url: track.permalink_url,
                        duration: Math.floor((track.duration || 0) / 1000).toString(),
                        thumbnail: track.artwork_url || track.user?.avatar_url,
                        requester: interaction.user.tag,
                        source: 'soundcloud'
                    });
                } else {
                    songsToAdd.push({
                        title: 'SoundCloud Track',
                        url: query,
                        duration: '0',
                        thumbnail: null,
                        requester: interaction.user.tag,
                        source: 'soundcloud'
                    });
                }
            } catch (e) {
                console.error("SC URL Search Error:", e);
                songsToAdd.push({
                    title: 'SoundCloud Track',
                    url: query,
                    duration: '0',
                    thumbnail: null,
                    requester: interaction.user.tag,
                    source: 'soundcloud'
                });
            }

        }

        if (songsToAdd.length === 0) {
            return interaction.followUp({ content: 'No songs found.', ephemeral: true });
        }

        serverQueue.songs.push(...songsToAdd);

        if (serverQueue.playing && serverQueue.songs.length > 0 && serverQueue.songs[0].requester === 'Autoplay') {
            console.log('[DEBUG] Interrupting Autoplay for user request...');
            serverQueue.player.stop();
        }

        try {
            if (!serverQueue.connection) {
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: guildId,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                });
                serverQueue.connection = connection;

                connection.subscribe(serverQueue.player);

                connection.on(VoiceConnectionStatus.Disconnected, () => {
                    queue.delete(guildId);
                });
            }
        } catch (err) {
            console.error(err);
            queue.delete(guildId);
            return interaction.followUp('Could not join the voice channel!');
        }

        if (!serverQueue.playing) {
            await playSong(guildId, serverQueue.songs[0]);
        } else {
            if (songsToAdd.length === 1) {
                const songInfo = songsToAdd[0];
                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('Added to Queue')
                    .setDescription(`[${songInfo.title}](${songInfo.url || 'Searching on Play'})`)
                    .addFields(
                        { name: 'Requested By', value: songInfo.requester, inline: true }
                    );
                return interaction.followUp({ embeds: [embed] });
            }
        }

    } catch (error) {
        console.error(error);
        return interaction.followUp({ content: 'There was an error trying to execute that command: ' + error.message, ephemeral: true });
    }
}

async function playSong(guildId, song) {
    const serverQueue = queue.get(guildId);
    if (!serverQueue) return;

    if (!song) {
        serverQueue.playing = false;
        return;
    }

    console.log(`[DEBUG] Attempting to play: ${song.title}`);

    serverQueue.playing = true;

    try {
        let stream;

        if (song.source === 'spotify_bridge' && !song.url) {
            console.log(`[DEBUG] Bridging Spotify track: ${song.searchQuery}`);
            const searchResults = await scdl.SoundCloud.search({
                query: song.searchQuery,
                filter: 'tracks'
            });

            if (searchResults && searchResults.collection && searchResults.collection.length > 0) {
                const track = findBestMatch(searchResults.collection.filter(t => t.kind === 'track'), song.searchQuery, parseInt(song.duration));
                if (track) {
                    song.url = track.permalink_url;
                    song.title = track.title;
                    song.thumbnail = track.artwork_url || track.user?.avatar_url;
                    song.duration = Math.floor((track.duration || 0) / 1000).toString();
                } else {
                    console.log(`[DEBUG] Could not find bridged track: ${song.searchQuery}`);
                    throw new Error('Could not find track on SoundCloud.');
                }
            } else {
                console.log(`[DEBUG] Could not find bridged track: ${song.searchQuery}`);
                throw new Error('Could not find track on SoundCloud.');
            }
        }

        if (!song.url) throw new Error('Song URL is undefined!');

        console.log(`[DEBUG] Playing URL: ${song.url}`);

        if (song.source === 'arbitrary') {
            // Direct audio stream (Radio)
            const response = await axios.get(song.url, { responseType: 'stream' });
            stream = response.data;
        } else {
            // SoundCloud Stream
            stream = await getSoundCloudStream(song.url);
        }

        const resource = createAudioResource(stream, { inlineVolume: true });
        resource.volume.setVolumeLogarithmic(serverQueue.volume / 100);

        serverQueue.player.play(resource);

        if (serverQueue.channel) {
            sendNowPlayingEmbed(serverQueue.channel, song, serverQueue).catch(console.error);
        }

        serverQueue.player.removeAllListeners(AudioPlayerStatus.Idle);
        serverQueue.player.removeAllListeners('error');

        serverQueue.player.on(AudioPlayerStatus.Idle, () => {
            const currentQueue = queue.get(guildId);
            if (currentQueue) {
                currentQueue.songs.shift();

                if (currentQueue.songs.length > 0) {
                    playSong(guildId, currentQueue.songs[0]);
                } else if (currentQueue.is247 && currentQueue.autoplayUrl) {
                    console.log('[DEBUG] Queue empty. 24/7 Mode Active. Playing Autoplay URL.');
                    const radioSong = {
                        title: 'Bollywood Radio 24/7',
                        url: currentQueue.autoplayUrl,
                        duration: '0',
                        thumbnail: 'https://i.imgur.com/7J9o8kQ.png', // Generic Radio Icon
                        requester: 'Autoplay',
                        source: 'arbitrary'
                    };
                    currentQueue.songs.push(radioSong);
                    playSong(guildId, currentQueue.songs[0]);
                } else {
                    // Default behavior (stop/disconnect after timeout technically, but here just stop)
                    currentQueue.playing = false;
                    // Optional: disconnect
                }
            }
        });

        serverQueue.player.on('error', error => {
            console.error('Player Error:', error);
            const currentQueue = queue.get(guildId);
            if (currentQueue) {
                currentQueue.songs.shift();
                playSong(guildId, currentQueue.songs[0]);
            }
        });

    } catch (error) {
        console.error('Stream Creation Error:', error);
        const currentQueue = queue.get(guildId);
        if (currentQueue) {
            currentQueue.songs.shift();
            playSong(guildId, currentQueue.songs[0]);
        }
    }
}

async function handleStop(interaction) {
    const serverQueue = queue.get(interaction.guildId);
    if (!serverQueue) return interaction.reply({ content: 'No music is currently playing!', ephemeral: true });

    serverQueue.songs = [];
    serverQueue.player.stop();
    if (serverQueue.connection) serverQueue.connection.destroy();
    queue.delete(interaction.guildId);

    await interaction.reply({ content: '⏹️ Stopped the music and cleared the queue.' });
}

async function handleSkip(interaction) {
    const serverQueue = queue.get(interaction.guildId);
    if (!serverQueue) return interaction.reply({ content: 'No music is currently playing!', ephemeral: true });

    serverQueue.player.stop();
    await interaction.reply({ content: '⏭️ Skipped the song.' });
}

async function handlePause(interaction) {
    const serverQueue = queue.get(interaction.guildId);
    if (!serverQueue) return interaction.reply({ content: 'No music is playing!', ephemeral: true });

    if (serverQueue.player.pause()) {
        await interaction.reply({ content: '⏸️ Paused the music.' });
    } else {
        await interaction.reply({ content: 'Are you sure music is playing?', ephemeral: true });
    }
}

async function handleResume(interaction) {
    const serverQueue = queue.get(interaction.guildId);
    if (!serverQueue) return interaction.reply({ content: 'No music is playing!', ephemeral: true });

    if (serverQueue.player.unpause()) {
        await interaction.reply({ content: '▶️ Resumed the music.' });
    } else {
        await interaction.reply({ content: 'Music is probably not paused.', ephemeral: true });
    }
}

async function handleQueue(interaction) {
    const serverQueue = queue.get(interaction.guildId);
    if (!serverQueue || serverQueue.songs.length === 0) {
        return interaction.reply({ content: '❌ The queue is currently empty.', ephemeral: true });
    }

    const currentSong = serverQueue.songs[0];
    // Calculate total queue duration
    const totalDurationSeconds = serverQueue.songs.reduce((acc, song) => acc + (parseInt(song.duration) || 0), 0);
    const totalFormatted = formatDuration(totalDurationSeconds);

    const embed = new EmbedBuilder()
        .setColor('#FF5500')
        .setTitle('📜 Music Queue')
        .setDescription(`**Now Playing:**\n[${currentSong.title}](${currentSong.url || 'https://soundcloud.com'}) | \`${currentSong.duration ? formatDuration(parseInt(currentSong.duration)) : 'Live'}\`\nRequested by: ${currentSong.requester}`)
        .setFooter({ text: `Total Songs: ${serverQueue.songs.length} | Total Duration: ${totalFormatted}`, iconURL: interaction.client.user.displayAvatarURL() });

    const tracks = serverQueue.songs.slice(1);
    let playlistString = '';
    let count = 0;

    for (let i = 0; i < tracks.length; i++) {
        const song = tracks[i];
        const line = `**${i + 1}.** [${song.title.substring(0, 50)}](${song.url || 'https://soundcloud.com'}) | \`${song.duration ? formatDuration(parseInt(song.duration)) : 'Live'}\`\n`;

        if ((playlistString.length + line.length) > 1000) {
            playlistString += `... and ${tracks.length - count} more.`;
            break;
        }

        playlistString += line;
        count++;
    }

    if (playlistString.length > 0) {
        embed.addFields({ name: '🎵 Up Next', value: playlistString });
    } else {
        embed.addFields({ name: '🎵 Up Next', value: 'No other songs in queue.' });
    }

    await interaction.reply({ embeds: [embed] });
}

async function handlePurge(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const count = interaction.options.getInteger('count');

    if (count < 1 || count > 100) {
        return interaction.reply({ content: 'Please provide a number between 1 and 100.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const deleted = await interaction.channel.bulkDelete(count, true);
        await interaction.editReply({ content: `🧹 Successfully deleted **${deleted.size}** messages.` });
    } catch (error) {
        console.error(error);
        await interaction.editReply({ content: 'Failed to delete messages. They might be older than 14 days or I lack permissions.' });
    }
}

async function handleNowPlaying(interaction) {
    const serverQueue = queue.get(interaction.guildId);
    if (!serverQueue || !serverQueue.playing) {
        return interaction.reply({ content: 'No music is currently playing!', ephemeral: true });
    }
    await interaction.deferReply();
    await sendNowPlayingEmbed(interaction, serverQueue.songs[0], serverQueue);
}

async function handleClear(interaction) {
    const serverQueue = queue.get(interaction.guildId);
    if (!serverQueue) {
        return interaction.reply({ content: 'No music is currently playing!', ephemeral: true });
    }

    if (serverQueue.songs.length <= 1) {
        return interaction.reply({ content: 'Queue is already empty (except for the current song).', ephemeral: true });
    }

    serverQueue.songs = [serverQueue.songs[0]]; // Keep only the playing song
    await interaction.reply({ content: '🗑️ Queue has been cleared!' });
}

async function handleSkipTo(interaction) {
    const serverQueue = queue.get(interaction.guildId);
    if (!serverQueue) {
        return interaction.reply({ content: 'No music is currently playing!', ephemeral: true });
    }

    const position = interaction.options.getInteger('position');

    if (position < 1 || position >= serverQueue.songs.length) {
        return interaction.reply({ content: `Invalid position! Please choose a number between 1 and ${serverQueue.songs.length - 1}.`, ephemeral: true });
    }

    // Remove songs between current (0) and target (position)
    serverQueue.songs.splice(1, position - 1);
    serverQueue.player.stop();

    await interaction.reply({ content: `⏭️ Skipped ${position - 1} songs! Jumping to **${serverQueue.songs[1].title}**.` });
}

async function handleHelp(interaction) {
    const embed = new EmbedBuilder()
        .setColor('#FF5500')
        .setTitle('🎶 Melody Bot - Command List')
        .setDescription('Here are all the available commands to control the vibe!')
        .addFields(
            { name: '🎵 /play <query/url>', value: 'Plays a song from SoundCloud or Spotify (Playlists supported!).', inline: false },
            { name: '⏯️ /pause & /resume', value: 'Pause or resume the playback.', inline: true },
            { name: '⏹️ /stop', value: 'Stops the music and clears the queue.', inline: true },
            { name: '⏭️ /skip', value: 'Skips the current song.', inline: true },
            { name: '🚀 /skipto <pos>', value: 'Jumps straight to a specific song in the queue.', inline: true },
            { name: '🧹 /clear', value: 'Clear all upcoming songs.', inline: true },
            { name: '👀 /nowplaying', value: 'Show the currently playing song.', inline: true },
            { name: '📜 /queue', value: 'See upcoming songs.', inline: true },
            { name: '🔥 /purge <count>', value: 'Bulk delete messages (Admin only).', inline: false },
        )
        .setFooter({ text: 'Melody Bot • Simple, Fast, Free', iconURL: interaction.client.user.displayAvatarURL() });

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleVolume(interaction) {
    const serverQueue = queue.get(interaction.guildId);
    if (!serverQueue) {
        return interaction.reply({ content: 'No music is currently playing!', ephemeral: true });
    }

    const volume = interaction.options.getInteger('level');

    serverQueue.volume = volume;
    if (serverQueue.player && serverQueue.player.state.status === AudioPlayerStatus.Playing) {
        const resource = serverQueue.player.state.resource;
        if (resource && resource.volume) {
            resource.volume.setVolumeLogarithmic(volume / 100);
        }
    }

    await interaction.reply({ content: `🔊 Volume set to **${volume}%**` });
}

async function sendNowPlayingEmbed(target, song, serverQueue) {
    const progressBar = '🔘▬▬▬▬▬▬▬▬▬▬▬▬▬';
    const duration = song.duration ? formatDuration(parseInt(song.duration)) : 'Live or Unknown';

    const embed = new EmbedBuilder()
        .setColor('#FF5500')
        .setAuthor({ name: 'Now Playing', iconURL: 'https://i.ibb.co.com/0ppXGDSG/Gemini-Generated-Image-nry3n8nry3n8nry3.png' })
        .setTitle(song.title.substring(0, 256))
        .setURL(song.url || 'https://soundcloud.com')
        .setDescription(`${progressBar}\n\n**${duration}**`)
        .addFields(
            { name: '👤 Requested By', value: song.requester, inline: true },
            { name: '⏳ Duration', value: duration, inline: true },
            { name: '📡 Source', value: song.source === 'spotify_bridge' ? 'Spotify' : 'SoundCloud', inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Melody Player', iconURL: target.client ? target.client.user.displayAvatarURL() : (target.user ? target.client.user.displayAvatarURL() : '') });

    if (song.thumbnail) {
        embed.setThumbnail(song.thumbnail);
    }

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('music_pause')
                .setLabel('Pause')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⏸️'),
            new ButtonBuilder()
                .setCustomId('music_resume')
                .setLabel('Resume')
                .setStyle(ButtonStyle.Success)
                .setEmoji('▶️'),
            new ButtonBuilder()
                .setCustomId('music_skip')
                .setLabel('Skip')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⏭️'),
            new ButtonBuilder()
                .setCustomId('music_stop')
                .setLabel('Stop')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⏹️')
        );

    try {
        if (typeof target.followUp === 'function') {
            await target.followUp({ embeds: [embed], components: [row] });
        } else {
            await target.send({ embeds: [embed], components: [row] });
        }
    } catch (err) {
        console.error('Error sending Now Playing embed:', err);
    }
}

function formatDuration(seconds) {
    if (isNaN(seconds)) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

async function handleButtons(interaction) {
    await interaction.deferUpdate();

    const serverQueue = queue.get(interaction.guildId);
    if (!serverQueue) return interaction.followUp({ content: 'No music is active!', ephemeral: true });

    switch (interaction.customId) {
        case 'music_stop':
            serverQueue.songs = [];
            serverQueue.player.stop();
            if (serverQueue.connection) serverQueue.connection.destroy();
            queue.delete(interaction.guildId);
            await interaction.channel.send('⏹️ Player stopped via button.');
            break;
        case 'music_pause':
            serverQueue.player.pause();
            await interaction.channel.send('⏸️ Paused.');
            break;
        case 'music_resume':
            serverQueue.player.unpause();
            await interaction.channel.send('▶️ Resumed.');
            break;
        case 'music_skip':
            serverQueue.player.stop();
            await interaction.channel.send('⏭️ Skipped.');
            break;
    }
}
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Melody Bot is Alive! 🎶');
});

app.listen(port, () => {
    console.log(`Web server listening on port ${port}`);
});

client.login(process.env.TOKEN);