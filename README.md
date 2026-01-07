<div align="center">

# 🎵 M E L O D Y
### The Ultimate Discord Vibe Curator

![Discord](https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![SoundCloud](https://img.shields.io/badge/SoundCloud-FF5500?style=for-the-badge&logo=soundcloud&logoColor=white)
![Spotify](https://img.shields.io/badge/Spotify-1ED760?style=for-the-badge&logo=spotify&logoColor=white)

<br />

**Melody** isn't just another music bot. It's a high-fidelity, intelligent audio experience designed to bring the best of **SoundCloud** and **Spotify** directly to your voice channel. 

[Features](#-features) • [Installation](#-installation) • [Commands](#-commands)

</div>

---

## ✨ Features

### 🎧 **Universal Compatibility**
- **SoundCloud Native**: Built on `scdl-core` for robust, high-quality SoundCloud streaming.
- **Spotify Bridging**: Seamlessly plays **Spotify Playlists, Albums, and Tracks** by intelligently finding their best high-quality counterparts.

### 🧠 **Smart Search Engine**
- **Precision Matching**: Algorithms filter out bad remixes, covers, and short clips to find the *original* song you asked for.
- **Interactive Choice**: Not sure which remix you want? The bot offers a **Select Menu** with the top results.

### 💎 **Premium Experience**
- **High-Fidelity Audio**: Custom 32MB buffering ensures smooth, stutter-free playback even on poor connections.
- **Visuals Handling**: Beautiful, orange-themed embeds with **real-time progress bars**, formatted durations, and requester info.
- **Smart Queue**: Pagination support for long queues and detailed "Now Playing" insights.

---

## 🚀 Installation

1. **Clone the Repo**
   ```bash
   git clone https://github.com/SwapnilSaha5768/Discord-Bot.git
   cd Discord-Bot
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Create a `.env` file in the root directory:
   ```env
   TOKEN=your_discord_bot_token
   CLIENT_ID=your_discord_client_id
   GUILD_ID=your_guild_id
   ```

4. **Deploy Commands**
   Register the slash commands with Discord:
   ```bash
   node deploy-commands.js
   ```

5. **Start the Party**
   ```bash
   node index.js
   ```

---

## 🎮 Commands

| 🎮 **Command** | 📝 **Description** | 🛡️ **Permission** |
|:---|:---|:---|
| `🎵 /play` | **Starts the party.** Plays from SoundCloud or Spotify. | `👥 Everyone` |
| `⏸️ /pause` | Pauses the current track. | `👥 Everyone` |
| `▶️ /resume` | Resumes the music. | `👥 Everyone` |
| `⏹️ /stop` | Stops music & destroys the queue. | `👥 Everyone` |
| `⏭️ /skip` | Skips to the next song. | `👥 Everyone` |
| `🚀 /skipto` | **Jumps** to a specific song in the queue. | `👥 Everyone` |
| `📜 /queue` | Shows upcoming tracks & duration. | `👥 Everyone` |
| `👀 /nowplaying`| Shows the currently playing track. | `👥 Everyone` |
| `🧹 /clear` | Wipes the queue (keeps current song). | `👥 Everyone` |
| `🔥 /purge` | **Bulk deletes** messages to clean chat. | `👑 Admin Only` |

---

## 🛠️ Tech Stack

- **Core**: `discord.js`, `@discordjs/voice`
- **Audio Engines**: `scdl-core`, `play-dl` (bridge), `ffmpeg-static`
- **Utilities**: `spotify-url-info`, `axios`

---

<div align="center">

*Keep the vibe alive.*

</div>
