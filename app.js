const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const http = require('http');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        handleSIGINT: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

const pausedUsers = new Set();

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            const newData = JSON.parse(body);
            let db = [];
            if (fs.existsSync('database.json')) {
                const fileData = fs.readFileSync('database.json', 'utf8');
                db = fileData ? JSON.parse(fileData) : [];
            }
            const index = db.findIndex(item => item.nota === newData.nota);
            if (index !== -1) { 
                db[index] = newData; 
            } else { 
                db.push(newData); 
            }
            fs.writeFileSync('database.json', JSON.stringify(db, null, 2));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'success' }));
        });
    } else {
        res.end('Server Active');
    }
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("Server jalan di port " + PORT);
});

client.on('qr', (qr) => {
    console.log('SCAN QR CODE:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    if (!fs.existsSync('database.json')) {
        fs.writeFileSync('database.json', '[]');
    }
    console.log('Chatbot Laundry AI sudah siap melayani pelanggan!');
});

client.on('message', async (msg) => {
    const chat = await msg.getChat();
    const userMessage = msg.body.toLowerCase().trim();
    const sender = msg.from;

    if (pausedUsers.has(sender)) {
        if (userMessage === 'selesai') {
            pausedUsers.delete(sender);
            await client.sendMessage(sender, "Layanan bantuan admin ditutup. Bot diaktifkan kembali. Ketik *Menu* untuk memulai.");
        }
        return;
    }

    if (userMessage === 'menu' || userMessage === 'p') {
        const welcomeMessage = `
Selamat Datang di *Smart Laundry AI* 🧺✨
Halo Kak! Ada yang bisa kami bantu hari ini?

Silahkan balas dengan angka untuk memilih layanan:
1️⃣ *Cek Daftar Harga*
2️⃣ *Pesan Antar-Jemput*
3️⃣ *Cek Status Cucian (Input No. Nota)*
4️⃣ *Lokasi Toko*
5️⃣ *Hubungi Admin (Manusia)*

_Ketik "Menu" untuk kembali ke pilihan ini._`;
        await client.sendMessage(sender, welcomeMessage);
    }

    else if (userMessage === '1') {
        const hargaMessage = `
📋 *DAFTAR HARGA SMART LAUNDRY*
---------------------------------------
• Cuci Kering Setrika : Rp 10.000/kg
• Cuci Kering : Rp 7.000/kg
• Setrika Saja : Rp 6.000/kg
• Bedcover : Rp 25.000/pcs

*Minimal order untuk jemput adalah 3kg.*`;
        await client.sendMessage(sender, hargaMessage);
    }

    else if (userMessage === '2') {
        await client.sendMessage(sender, "Silahkan kirim format berikut:\n\n*NAMA:*\n*ALAMAT JEMPUT:*\n*BERAT ESTIMASI:*");
    }

    else if (userMessage.includes('nama:') && userMessage.includes('alamat jemput:')) {
        await client.sendMessage(sender, "✅ *Terima kasih telah mengisi formulir penjemputan.*\n\nData Anda sudah kami terima. Saya akan segera menginfokan ke Admin untuk dijadwalkan penjemputan. Mohon ditunggu ya! 😊");
    }

    else if (userMessage === '3') {
        await client.sendMessage(sender, "Silahkan masukkan *Nomor Nota* Anda.\nContoh: *nota-001*");
    }

    else if (userMessage.startsWith('nota-')) {
        const notaCari = userMessage.toLowerCase();
        await client.sendMessage(sender, `🔎 Mengecek status nota *${notaCari.toUpperCase()}*...`);
        
        if (fs.existsSync('database.json')) {
            const db = JSON.parse(fs.readFileSync('database.json', 'utf8'));
            const data = db.find(item => item.nota === notaCari);

            setTimeout(async () => {
                if (data) {
                    await client.sendMessage(sender, `✅ *STATUS CUCIAN*\n\nNota: ${data.nota.toUpperCase()}\nNama: ${data.nama}\nStatus: *${data.status}*`);
                } else {
                    await client.sendMessage(sender, `❌ Maaf, nomor nota *${notaCari.toUpperCase()}* tidak terdaftar.`);
                }
            }, 2000);
        }
    }

    else if (userMessage === '4') {
        await client.sendMessage(sender, "📍 *Lokasi Toko kami:* \nJl. Pelita Bangsa No. 123, Cikarang.\n\nLink Google Maps: http://google.com/maps/...");
    }

    else if (userMessage === '5') {
        pausedUsers.add(sender);
        await client.sendMessage(sender, "Pesan Anda diteruskan ke Admin. Bot berhenti merespon agar Kakak bisa mengobrol langsung dengan Admin kami.\n\n_Jika sudah selesai, mohon ketik *Selesai* agar bot aktif kembali._");
    }

    else {
        if (!chat.isGroup) {
            await client.sendMessage(sender, "Hai, ketik *Menu* untuk melihat opsi lainnya.");
        }
    }
});

client.initialize();
