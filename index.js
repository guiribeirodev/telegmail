
const {google} = require("googleapis");
const fs = require('fs')
const express = require("express")
const { Telegraf } = require('telegraf');
require('dotenv').config()


const app = express();

const data = JSON.parse(fs.readFileSync('credentials.json', 'utf8'));
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const bot = new Telegraf(TELEGRAM_BOT_TOKEN);



const CLIENT_ID = data.web.client_id;
const CLIENT_SECRET = data.web.client_secret;
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';
const PORT = 3000;


const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
)

const scope = 'https://www.googleapis.com/auth/gmail.readonly'

const TOKEN_PATH = "token.json"

function loadSavedToken() {
    if (fs.existsSync(TOKEN_PATH)) {
        const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
        oauth2Client.setCredentials(token);
        console.log("✅ Token carregado com sucesso!");
        return true;
    }
    return false;
}

app.get("/", (req, res) => {
    if (loadSavedToken()) {
        return res.send("✅ Token carregado. Você já está autenticado!");
    }
    const url = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: scope,
        prompt: "consent"
    })

    res.send(`<a href="${url}">Autorizar Aplicação</a>`);
})

app.get('/oauth2callback', async (req,res) => {
    const code = req.query.code
    if (!code) {
        return res.send("Código de autorização não encontrado.");
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens)

        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
        console.log("✅ Token salvo com sucesso!");
        res.send(`Token de Acesso: ${tokens.access_token} <br> Refresh Token: ${tokens.refresh_token}`);
    } catch (error) {
        console.error("Erro ao obter o token:", error);
        res.send("Erro ao obter o token.");
    }
}
)

async function ensureAuthenticated() {
    if (!fs.existsSync(TOKEN_PATH)) {
        return false;
    }

    try {
        const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
        oauth2Client.setCredentials(token);

        if (token.expiry_date && token.expiry_date < Date.now()) {
            if (!token.refresh_token) {
                console.log("❌ O token expirou e não há refresh_token disponível.");
                return false;
            }

            console.log("🔄 Tentando renovar o token...");
            const newTokens = await oauth2Client.refreshAccessToken();
            oauth2Client.setCredentials(newTokens.credentials);
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(newTokens.credentials));
            console.log("✅ Token renovado com sucesso!");
        }

        return true;
    } catch (error) {
        console.error("❌ Erro ao validar o token:", error);
        return false;
    }
}

async function getEmails() {
    if (!(await ensureAuthenticated())) {
        return "❌ Autenticação necessária. Acesse: http://localhost:3000 para autorizar.";
    }

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const res = await gmail.users.messages.list({
    userId: 'me',
    labelIds: ['INBOX'],
    q: 'is:unread',
  });
  const messages = res.data.messages || [];
  
  if (messages.length === 0) {
    return 'Nenhum e-mail novo encontrado.';
  }

  const emailSummaries = [];
  for (const message of messages) {
    const msg = await gmail.users.messages.get({ userId: 'me', id: message.id });
    const snippet = msg.data.snippet;
    emailSummaries.push(snippet);
  }

  return emailSummaries.join('\n\n');
}

async function getProfile(){
    if (!(await ensureAuthenticated())) {
        return "❌ Autenticação necessária. Acesse: http://localhost:3000 para autorizar.";
    }
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const userProfile = await gmail.users.getProfile({ userId: 'me'})
  console.log(userProfile)

  return userProfile.data
}

bot.start((ctx) => {
  ctx.reply('Olá! Eu sou seu bot para ler e-mails. Use o comando /ler para ver seus e-mails.');
});

bot.command('ler', async (ctx) => {
  const emails = await getEmails();
  ctx.reply(emails);
});

bot.command('perfil', async (ctx) => {
    const userProfile = await getProfile()
    const message = `
Seu e-mail: ${userProfile.emailAddress}
Número de e-mails: ${userProfile.messagesTotal}
threads: Total de e-mails: ${userProfile.threadsTotal}
`
    ctx.reply(message)
})

bot.launch();


app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
