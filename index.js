
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');

const botAdmins = ['2348153039053', '2348135153163']; // Your bot admin numbers without '+'
const ownerNumber = '2348153039053'; // Your owner number

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
    version,
  });

  sock.ev.on('creds.update', saveCreds);

  // Check if sender is admin
  function isAdmin(sender) {
    const senderNumber = sender.split('@')[0];
    return botAdmins.includes(senderNumber);
  }

  // Check if sender is owner
  function isOwner(sender) {
    const senderNumber = sender.split('@')[0];
    return senderNumber === ownerNumber;
  }

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;

    // Extract text from message
    const messageContent = msg.message.conversation ||
      (msg.message.extendedTextMessage && msg.message.extendedTextMessage.text) || '';

    const body = messageContent.trim();

    // Auto reply example: 'die' triggers "Die peasant"
    if (body.toLowerCase() === 'die') {
      await sock.sendMessage(from, { text: 'Die peasant' }, { quoted: msg });
      return;
    }

    // Command prefix
    if (body.startsWith('-')) {
      const command = body.slice(1).split(' ')[0].toLowerCase();

      // Admin only commands list
      const adminCommands = ['kick', 'promote', 'demote', 'tagall'];

      // Owner only commands list
      const ownerCommands = ['install'];

      // Check admin access for admin commands
      if (adminCommands.includes(command)) {
        if (!isAdmin(sender)) {
          await sock.sendMessage(from, { text: "You're not a verified user of this command be warned☠️⚠️" }, { quoted: msg });
          return;
        }
      }

      // Check owner access for owner commands
      if (ownerCommands.includes(command)) {
        if (!isOwner(sender)) {
          await sock.sendMessage(from, { text: "You're not a verified user of this command be warned☠️⚠️" }, { quoted: msg });
          return;
        }
      }

      // Commands
      switch (command) {
        case 'install':
          // Send prompt message to react
          const promptMsg = await sock.sendMessage(from, {
            text: 'react with 🫡 to continue or react with 💀 to cancel'
          }, { quoted: msg });

          // Set up event listener for reactions
          const reactionListener = async (reactionUpdate) => {
            if (reactionUpdate.key.id === promptMsg.key.id && reactionUpdate.participant === sender) {
              if (reactionUpdate.reaction === '🫡') {
                await sock.sendMessage(from, { text: '✅ Commands installed/updated successfully.' });
              } else if (reactionUpdate.reaction === '💀') {
                await sock.sendMessage(from, { text: '❌ Installation cancelled.' });
              }
              sock.ev.off('messages.reaction', reactionListener);
            }
          };

          sock.ev.on('messages.reaction', reactionListener);
          break;

        case 'hi':
          await sock.sendMessage(from, { text: '𝐻𝑒𝑙𝑙𝑜 𝑉𝑒𝑡𝑒𝑟𝑖𝑛𝑎𝑟𝑖𝑎𝑛 𝐹𝑟𝑖𝑒𝑛𝑑' }, { quoted: msg });
          break;

        case 'help':
          const helpMessage = `
Basic Commands
- hi: Greet the user.
- help: Show all available commands.
- ping: Respond with “Pong!”.
- die: Respond with “Die peasant”.
- time: Send current time.
- date: Send current date.

Fun Commands
- joke: Send a random joke.
- insult: Send a random insult.
- quote: Send a random motivational quote.
- roast @tag: Roast the mentioned user.

Admin/Group Tools
- kick @user: Kick a user (admin only).
- promote @user: Promote a user to admin.
- demote @user: Demote a user from admin.
- tagall: Mention everyone in the group.

Media/Utility
- sticker: Turn an image/video into a sticker.
- img2text: Extract text from an image.
- ytmp3 [link]: Download YouTube audio.
- ytmp4 [link]: Download YouTube video.

Custom Additions
- menu: Display a button-based menu.
- status: Post or view custom bot status.
- auto-reply: Toggle auto-replies on/off.

Owner Only
- install: Install/update commands (with reaction confirmation).
          `;
          await sock.sendMessage(from, { text: helpMessage.trim() }, { quoted: msg });
          break;

        case 'ping':
          await sock.sendMessage(from, { text: 'Pong!' }, { quoted: msg });
          break;

        case 'time':
          await sock.sendMessage(from, { text: new Date().toLocaleTimeString() }, { quoted: msg });
          break;

        case 'date':
          await sock.sendMessage(from, { text: new Date().toLocaleDateString() }, { quoted: msg });
          break;

        default:
          await sock.sendMessage(from, { text: 'Unknown command. Use -help to see available commands.' }, { quoted: msg });
      }
    }
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed due to', lastDisconnect.error, ', reconnecting:', shouldReconnect);
      if (shouldReconnect) {
        startBot();
      }
    } else if (connection === 'open') {
      console.log('Connected to WhatsApp');
    }
  });
}

startBot();
