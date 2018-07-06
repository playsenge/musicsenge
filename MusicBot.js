const { Client, Util } = require('discord.js');
const { PREFIX, GOOGLE_API_KEY } = require('./config');
const YouTube = require('simple-youtube-api');
const ytdl = require('ytdl-core');

const client = new Client({ disableEveryone: true });

const youtube = new YouTube(GOOGLE_API_KEY);

const queue = new Map();

client.on('warn', console.warn);

client.on('error', console.error);

client.on('ready', () => console.log('Yo this ready!'));

client.on('disconnect', () => console.log('I just disconnected, making sure you know, I will reconnect now...'));

client.on('reconnecting', () => console.log('I am reconnecting now!'));



client.on('message', async msg => { // eslint-disable-line
	if (msg.author.bot) return undefined;
	if (!msg.content.startsWith(PREFIX)) return undefined;

	const args = msg.content.split(' ');
	const searchString = args.slice(1).join(' ');
	const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : '';
	const serverQueue = queue.get(msg.guild.id);

	let command = msg.content.toLowerCase().split(' ')[0];
	command = command.slice(PREFIX.length)

	if (command === 'odtworz') {
		const voiceChannel = msg.member.voiceChannel;
		if (!voiceChannel) return msg.channel.send('Musisz byc na kanale aby puscic muzyke!');
		const permissions = voiceChannel.permissionsFor(msg.client.user);
		if (!permissions.has('CONNECT')) {
			return msg.channel.send('Nie moge polaczyc do tego kanalu!');
		}
		if (!permissions.has('SPEAK')) {
			return msg.channel.send('I cannot speak in this voice channel, make sure I have the proper permissions!');
		}

		if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
			const playlist = await youtube.getPlaylist(url);
			const videos = await playlist.getVideos();
			for (const video of Object.values(videos)) {
				const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop
				await handleVideo(video2, msg, voiceChannel, true); // eslint-disable-line no-await-in-loop
			}
			return msg.channel.send(`âś… Playlista **${playlist.title}** zostala dodana do kolejki!`);
		} else {
			try {
				var video = await youtube.getVideo(url);
			} catch (error) {
				try {
					var videos = await youtube.searchVideos(searchString, 10);
					let index = 0;
					msg.channel.send(`
__**Wybor piosenki:**__

${videos.map(video2 => `**${++index} -** ${video2.title}`).join('\n')}

Wybierz piosenke z listy piszac tu liczbe od 1-10.
					`);
					// eslint-disable-next-line max-depth
					try {
						var response = await msg.channel.awaitMessages(msg2 => msg2.content > 0 && msg2.content < 11, {
							maxMatches: 1,
							time: 10000,
							errors: ['time']
						});
					} catch (err) {
						console.error(err);
						return msg.channel.send('Anulowanie...');
					}
					const videoIndex = parseInt(response.first().content);
					var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
				} catch (err) {
					console.error(err);
					return msg.channel.send('đź† Nic nie znalazlem z taka nazwa.');
				}
			}
			return handleVideo(video, msg, voiceChannel);
		}
	} else if (command === 'pomin') {
		if (!msg.member.voiceChannel) return msg.channel.send('Nie jestes na kanale!');
		if (!serverQueue) return msg.channel.send('Nic nie gra co moglbym pominac.');
		serverQueue.connection.dispatcher.end('Pominieto!');
		return undefined;
	} else if (command === "pomoc") {
		return msg.channel.send(`**Pomoc:**
		ms!odtworz - odtwarza podana piosenke
		ms!pomin - pomija piosenke
		ms!pomoc - wyswietla te wiadomosc
		ms!stop - stopuje bota
		ms!glosnosc - zmienia glosnosc muzyki
		ms!teraz - pokazuje aktualnie odtwarzana piosenke
		ms!kolejka - pokazuje kolejke piosenek
		ms!pauza - pauzuje muzyke
		ms!wznow - wznawia muzyke
		ms!tworca - tworca bota i kodu
		ms!polecanamuzyka - polecana przez senge1337 muzyka
		`);
	} else if (command === "tworca") {
		return msg.channel.send('Pierwotnym tworca koda jest **iCrawl**, bot nalezy do **senge1337** opublikowany na licencji MIT.');
	} else if (command === "polecanamuzyka") {
		return msg.channel.send('Polecana muzyka jest tutaj: https://www.youtube.com/playlist?list=PLmZM9zq7PSnCemE3Vx8gSJEEw7vj9USa0');
	} else if (command === 'stop') {
		if (!msg.member.voiceChannel) return msg.channel.send('Nie jestes na kanale!');
		if (!serverQueue) return msg.channel.send('Nic nie moge zatrzymac.');
		serverQueue.songs = [];
		serverQueue.connection.dispatcher.end('Zatrzymano!');
		return undefined;
	} else if (command === 'glosnosc') {
		if (!msg.member.voiceChannel) return msg.channel.send('Nie jestes na kanale!');
		if (!serverQueue) return msg.channel.send('Nic teraz nie gra.');
		if (!args[1]) return msg.channel.send(`Aktualna glosnosc to: **${serverQueue.volume}**`);
		serverQueue.volume = args[1];
		serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5);
		return msg.channel.send(`Ustawiono glosnosc na: **${args[1]}**`);
	} else if (command === 'teraz') {
		if (!serverQueue) return msg.channel.send('Nic teraz nie leci.');
		return msg.channel.send(`đźŽ¶ Teraz leci: **${serverQueue.songs[0].title}**`);
	} else if (command === 'kolejka') {
		if (!serverQueue) return msg.channel.send('Nic teraz nie leci.');
		return msg.channel.send(`
__**Kolejka piosenek:**__

${serverQueue.songs.map(song => `**-** ${song.title}`).join('\n')}

**Teraz odtwarzane:** ${serverQueue.songs[0].title}
		`);
	} else if (command === 'pauza') {
		if (serverQueue && serverQueue.playing) {
			serverQueue.playing = false;
			serverQueue.connection.dispatcher.pause();
			return msg.channel.send('âŹ¸ Zapauzowano muzyke.');
		}
		return msg.channel.send('Nic teraz nie leci.');
	} else if (command === 'wznow') {
		if (serverQueue && !serverQueue.playing) {
			serverQueue.playing = true;
			serverQueue.connection.dispatcher.resume();
			return msg.channel.send('â–¶ Wznowiono muzyke!');
		}
		return msg.channel.send('Nic teraz nie leci.');
	}

	return undefined;
});

async function handleVideo(video, msg, voiceChannel, playlist = false) {
	const serverQueue = queue.get(msg.guild.id);
	console.log(video);
	const song = {
		id: video.id,
		title: Util.escapeMarkdown(video.title),
		url: `https://www.youtube.com/watch?v=${video.id}`
	};
	if (!serverQueue) {
		const queueConstruct = {
			textChannel: msg.channel,
			voiceChannel: voiceChannel,
			connection: null,
			songs: [],
			volume: 5,
			playing: true
		};
		queue.set(msg.guild.id, queueConstruct);

		queueConstruct.songs.push(song);

		try {
			var connection = await voiceChannel.join();
			queueConstruct.connection = connection;
			play(msg.guild, queueConstruct.songs[0]);
		} catch (error) {
			console.error(`I could not join the voice channel: ${error}`);
			queue.delete(msg.guild.id);
			return msg.channel.send(`I could not join the voice channel: ${error}`);
		}
	} else {
		serverQueue.songs.push(song);
		console.log(serverQueue.songs);
		if (playlist) return undefined;
		else return msg.channel.send(`âś… Film **${song.title}** zostal dodany do kolejki!`);
	}
	return undefined;
}

function play(guild, song) {
	const serverQueue = queue.get(guild.id);

	if (!song) {
		serverQueue.voiceChannel.leave();
		queue.delete(guild.id);
		return;
	}
	console.log(serverQueue.songs);

	const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
		.on('end', reason => {
			if (reason === 'Stream is not generating quickly enough.') console.log('Piosenka zakonczona.');
			else console.log(reason);
			serverQueue.songs.shift();
			play(guild, serverQueue.songs[0]);
		})
		.on('error', error => console.error(error));
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

	serverQueue.textChannel.send(`đźŽ¶ Zaczeto odtwarzanie: **${song.title}**`);
}

client.login(process.env.token);
