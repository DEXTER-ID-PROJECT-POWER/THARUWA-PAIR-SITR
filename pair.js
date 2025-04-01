const express = require('express');
const fs = require('fs-extra');
const { exec } = require("child_process");
let router = express.Router();
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const MESSAGE = process.env.MESSAGE || `
*✅sᴇssɪᴏɴ ɪᴅ ɢᴇɴᴇʀᴀᴛᴇᴅ✅*
______________________________
╔════◇
║『 𝐘𝐎𝐔'𝐕𝐄 𝐂𝐇𝐎𝐒𝐄𝐍 𝗧𝗛𝗔𝗥𝗨𝗪𝗔 𝐌𝐃 』
║ You've Completed the First Step
║ to Deploy a Whatsapp Bot.
╚══════════════╝
╔═════◇
║ 『••• 𝗩𝗶𝘀𝗶𝘁 𝗙𝗼𝗿 𝗛𝗲𝗹𝗽 •••』
║❒ 𝐎𝐰𝐧𝐞𝐫: _94761180276_
║❒ 𝐖𝐚𝐂𝐡𝐚𝐧𝐧𝐞𝐥: _https://whatsapp.com/channel/0029Vb5gle1JUM2RWlaBHX2K_
║ 💜💜💜
╚══════════════╝ 
 𝗧𝗛𝗔𝗥𝗨𝗪𝗔-𝗠𝗗 𝗩𝗘𝗥𝗦𝗜𝗢𝗡 0.𝟬.1
______________________________

`;

const { upload } = require('./mega');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    DisconnectReason
} = require("@whiskeysockets/baileys");

// Ensure the directory is empty when the app starts
if (fs.existsSync('./auth_info_baileys')) {
    fs.emptyDirSync(__dirname + '/auth_info_baileys');
}

router.get('/', async (req, res) => {
    let num = req.query.number;

    async function SUHAIL() {
        const { state, saveCreds } = await useMultiFileAuthState(`./auth_info_baileys`);
        try {
            let Smd = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
            });

            if (!Smd.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await Smd.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            Smd.ev.on('creds.update', saveCreds);
            Smd.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    try {
                        await delay(15000); // Increased delay for more stable connection
                        
                        if (!fs.existsSync('./auth_info_baileys/creds.json')) {
                            throw new Error("Creds file not found");
                        }

                        const auth_path = './auth_info_baileys/';
                        let user = Smd.user?.id;
                        
                        if (!user) {
                            throw new Error("User ID not available");
                        }

                        // Generate random ID for Mega upload
                        function randomMegaId(length = 6, numberLength = 4) {
                            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                            let result = '';
                            for (let i = 0; i < length; i++) {
                                result += characters.charAt(Math.floor(Math.random() * characters.length));
                            }
                            const number = Math.floor(Math.random() * Math.pow(10, numberLength));
                            return `${result}${number}`;
                        }

                        // Upload credentials to Mega with prefix
                        try {
                            const mega_url = await upload(fs.createReadStream(auth_path + 'creds.json'), `${randomMegaId()}.json`);
                            if (!mega_url) {
                                throw new Error("Mega upload failed");
                            }

                            const Id_session = mega_url.replace('https://mega.nz/file/', '');
                            const Scan_Id = "THARUWA-MD~" + Id_session;

                            // Send formatted message with session details
                            let msgsss = await Smd.sendMessage(user, { 
                                text: `${Scan_Id}` 
                            });

                            // Send the original MESSAGE
                            await Smd.sendMessage(user, { text: MESSAGE }, { quoted: msgsss });
                            
                        } catch (uploadErr) {
                            console.error("Upload error:", uploadErr);
                            await Smd.sendMessage(user, { 
                                text: `❌ Failed to upload session to Mega\n\n` +
                                      `Please try again or contact support.`
                            });
                        }

                        await delay(1000);
                        try { 
                            await fs.emptyDirSync(__dirname + '/auth_info_baileys'); 
                        } catch (cleanErr) {
                            console.error("Cleanup error:", cleanErr);
                        }

                    } catch (e) {
                        console.error("Error during session generation:", e);
                        try {
                            if (Smd.user?.id) {
                                await Smd.sendMessage(Smd.user.id, { 
                                    text: `❌ Error generating session:\n${e.message}\n\nPlease try again.`
                                });
                            }
                        } catch (sendErr) {
                            console.error("Failed to send error message:", sendErr);
                        }
                    } finally {
                        await delay(100);
                        try {
                            await fs.emptyDirSync(__dirname + '/auth_info_baileys');
                        } catch (e) {}
                    }
                }

                // Handle connection closures
                if (connection === "close") {
                    let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                    console.log("Connection closed with reason:", reason);
                    
                    if (reason === DisconnectReason.connectionClosed || 
                        reason === DisconnectReason.connectionLost || 
                        reason === DisconnectReason.timedOut) {
                        console.log("Reconnecting...");
                        await delay(3000);
                        SUHAIL().catch(err => console.log("Reconnect error:", err));
                    } else if (reason === DisconnectReason.restartRequired) {
                        console.log("Restart Required, Restarting...");
                        await delay(5000);
                        SUHAIL().catch(err => console.log("Restart error:", err));
                    } else if (reason === DisconnectReason.loggedOut || 
                               reason === DisconnectReason.badSession) {
                        console.log("Invalid session, cleaning up...");
                        await fs.emptyDirSync(__dirname + '/auth_info_baileys');
                        await delay(5000);
                        SUHAIL().catch(err => console.log("Restart error:", err));
                    } else {
                        console.log('Unknown disconnect reason, restarting...');
                        await delay(5000);
                        exec('pm2 restart qasim');
                    }
                }
            });

        } catch (err) {
            console.error("Initial connection error:", err);
            try {
                await fs.emptyDirSync(__dirname + '/auth_info_baileys');
            } catch (e) {}
            
            if (!res.headersSent) {
                await res.status(500).send({ 
                    error: "Connection error", 
                    message: err.message 
                });
            }
            
            await delay(5000);
            exec('pm2 restart qasim');
        }
    }

    await SUHAIL();
});

module.exports = router;
