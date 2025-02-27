const { google } = require("googleapis");
const fs = require('fs')

const data = JSON.parse(fs.readFileSync('credentials.json', 'utf8'));


const CLIENT_ID = data.web.client_id;
const CLIENT_SECRET = data.web.client_secret;
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';



const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
)

const scope = 'https://www.googleapis.com/auth/gmail'

const url = oauth2Client.generateAuthUrl({scope: scope})

console.log(url)