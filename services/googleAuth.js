import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

//se encarga exclusivamente de crear y configurar el cliente OAuth2 de Google

export const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3000/oauth2callback' // no se usa, pero debe estar definido
);

oauth2Client.setCredentials({
    access_token: process.env.GOOGLE_ACCESS_TOKEN,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN, // <--- clave
    token_type: 'Bearer',
    expiry_date: new Date(process.env.GOOGLE_TOKEN_EXPIRY).getTime()
});
