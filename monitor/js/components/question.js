import CategorySpinner from '../spinner.js';

function showCategorySpinner(app, categories, correct, index, total) {
	app.state = 'loading';
	app.title = 'Selecting next question';
	app.session.update(index, total, correct);

	if (categories.length == 0) {
		return app.sound.speak(app.session.currentCategory.fullName, 3000);
	}

	let spinner = new CategorySpinner(() => app.sound.click());
	app.spinner.categories = categories;
	
	return new Promise((resolve, reject) => {
		spinner.start().then(() => {
			app.sound.speak(app.session.currentCategory.fullName, 3000).then(resolve);
		}).catch(reject);
		setTimeout(() => spinner.stop().catch(reject), 2000);
	});
}

async function displayQuestion(app, text) {
	app.state = 'pre-question';
	app.title = text;
	await app.sound.speak(text, 3000);
}

function displayError(app, message) {
	return new Promise((resolve, reject) => {
		app.playback.view = {};
		app.error = message;
		setTimeout(() => {
			app.error = undefined;
			resolve();
		}, 3000);
	});
}

async function playbackStart(app, view, answers) {
	if (!view.player) {
		view.player = 'blank';
	}
	view.answers = answers;
	app.playback.view = view;

	let playback = app.$refs[view.player];

	await playback.start();

	app.state = 'question';
	app.minimizeQuestion = playback.minimizeQuestion;

	if (playback.pauseMusic) {
		app.sound.pause();
	}
}

function playbackEnd(app, pointsThisRound, correct) {
	return new Promise((resolve, reject) => {
		let playback = app.$refs[app.playback.view.player];
		app.playback.view = {};
		playback.stop();
	
		app.timer.stop();
		app.sound.play();

		if (Object.values(pointsThisRound).some(p => p.multiplier <= -4)) {
			app.sound.trombone();
		}

		app.title = "The correct answer was";
		app.correct = correct;
		app.state = 'post-question';
		
		app.players.forEach(player => {
			player.updatePoints(pointsThisRound[player.id]);
		});

		setTimeout(() => {
			app.players.forEach((player) => player.clearChanges());
			app.players.sort((a, b) => b.totalPoints - a.totalPoints);

			resolve();
		}, 3000);
	});
}

async function timerTicked(app, timeLeft, percentageLeft, currentScore) {
	app.timer.update(timeLeft, percentageLeft, currentScore);
}

async function playerGuessed(app, id) {
	app.players.find(p => p.id == id).guessed = true;
	app.sound.beep(app.players.filter((p) => p.guessed).length);
}

async function playerConnected(app, newPlayers) {
	app.players.forEach(player => {
		player.connected = player.id in newPlayers;
	});
}

async function gameEnded(app, history, results) {
	app.connection.clearListeners();
	app.$router.push({ name: 'results', query: { gameId: app.gameId }, params: { results: results, history: history } });	
}

export default {
	data: function() { return({
		spinner : {
			categories: []
		},
		playback : {
			view : {}
		},
		timer: new TimerData(),
		session: new SessionData(),
		title: '',
		state: 'loading',
		error: undefined,
		minimizeQuestion: false,
		players : []
	})},
	props: ['gameId', 'connection', 'sound', 'passed', 'lobbyPlayers'],
	computed: {
		showPlayerName: function() { return this.timer.timeLeft % 10 >= 5; }
	},
	created: function() {
		if (!this.connection.connected()) {
			console.log(this.gameId);
			this.$router.push({ path: "/", query: { gameId: this.gameId } });
			return;
		}

		this.connection.onPlayersChange().then(newPlayers => {
			return playerConnected(this, newPlayers);
		});

		this.connection.onCategorySelect().then(data => {
			return showCategorySpinner(this, data.categories, data.correct, data.index, data.total);
		});

		this.connection.onQuestion().then(text => {
			return displayQuestion(this, text);
		});

		this.connection.onQuestionError().then(message => {
			return displayError(this, message);
		});

		this.connection.onQuestionStart().then(data => {
			return playbackStart(this, data.view, data.answers);
		});

		this.connection.onQuestionEnd().then(data => {
			return playbackEnd(this, data.pointsThisRound, data.correct);
		});

		this.connection.onPlayerGuessed().then(id => {
			return playerGuessed(this, id);
		});

		this.connection.onTimerTick().then(data => {
			return timerTicked(this, data.timeLeft, data.percentageLeft, data.currentScore);
		});

		this.connection.onGameEnd().then(data => {
			return gameEnded(this, data.history, data.results);
		});

		for (let id in this.lobbyPlayers) {
			let player = new PlayerData(id, this.lobbyPlayers[id]);
			this.players.push(player);
		}
	},
	methods: {
		isCurrentPlayback: function(expected) {
			if (!this.playback || !this.playback.view) {
				return false;
			}
			return this.playback.view.player === expected;
		},
		isLeadingPlayer: function (player) {
			let playerScoreCount = this.players.filter((p) => p.totalPoints >= player.totalPoints).length;
			return playerScoreCount == 1;
		},
		achievedPoints: function (player) {
			return player.pointChange > 0;
		},
		lostPoints: function(player) {
			return player.pointChange < 0;
		},
		isCurrentCategory: function(category) {
			if (this.session.currentCategory) {
				return category.name == this.session.currentCategory.name;
			}
			return false;
		}
	}
};

class PlayerData {
	constructor(id, player) {
		this.id = id;
		this.name = player.name;
		this.color = player.color;
		this.avatar = player.avatar;
		this.totalPoints = 0;
		this.pointChange = 0;
		this.multiplier = 1;
		this.guessed = false;
		this.connected = true;
	}

	updatePoints(pointChanges) {
		this.pointChange = pointChanges.points;
		this.multiplier += pointChanges.multiplier;
		this.guessed = false;
		this.totalPoints += pointChanges.points;
	}

	clearChanges() {
		this.pointChange = 0;
	}
}

class SessionData {
	constructor() {
		this.index = 0;
		this.total = 0;
		this.currentCategory = undefined;
	}

	update(index, total, currentCategory) {
		this.index = index;
		this.total = total;
		this.currentCategory = currentCategory;
	}
}

class TimerData {
	constructor() {
		this.running = false;
		this.score = 0;
		this.timeLeft = 0;
		this.percentageLeft = 0;
	}
	
	update(timeLeft, percentageLeft, currentScore) {
		this.running = true;
		this.score = currentScore;
		this.timeLeft = timeLeft;
		this.percentageLeft = percentageLeft;
	}

	stop() {
		this.running = false;
	}
}