import CategorySpinner from '../spinner.js';
import PlaybackFactory from '../playback.js';

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

function displayQuestion(app, text) {
	return new Promise((resolve, reject) => {
		app.state = 'pre-question';
		app.title = text;
		app.sound.speak(text, 3000).then(resolve);
	});
}

function displayError(app, message) {
	return new Promise((resolve, reject) => {
		app.error = message;
		setTimeout(() => {
			app.error = undefined;
			resolve();
		}, 3000);
	});
}

function playbackStart(app, view, answers) {
	let player = app.playback.load(view, answers);
	
	return new Promise(async (resolve, reject) => {
		try {
			await player.start();
	
			app.state = 'question';
			app.minimizeQuestion = player.minimizeQuestion;
			app.currentPlayer = player;

			if (player.pauseMusic) {
				app.sound.pause();
			}

			resolve();
		} catch (e) {
			reject(e);
		}
	});
}

function playbackEnd(app, pointsThisRound, correct) {
	return new Promise((resolve, reject) => {
		let player = app.currentPlayer;
		player.stop();
	
		app.sound.play();

		if (Object.values(pointsThisRound).some(p => p.multiplier <= -4)) {
			app.sound.trombone();
		}

		app.title = "The correct answer was";
		app.correct = correct;
		app.state = 'post-question';
		//TODO: show players changed points

		setTimeout(() => {
			// TODO: remove players changed points 
			resolve();
		}, 3000);
	});
}

function playerGuessed(app, id) {
	return new Promise((resolve, reject) => {
		app.players[id].guessed = true;
		app.sound.beep(Object.values(app.players).filter((p) => p.guessed).length);
		resolve();
	});
}

function playerConnected(app, newPlayers) {
	return new Promise((resolve, reject) => {
		for (let id in app.players) {
			app.players[id].connected = (id in newPlayers);
		}
		resolve();
	});
}

export default {
	data: function() { return({
		spinner : {
			categories: []
		},
		timer: new TimerData(),
		session: new SessionData(),
		title: '',
		state: 'loading',
		crownUrl: /src=\"(.*?)\"/.exec(twemoji.parse("\uD83D\uDC51"))[1],
		error: undefined,
		minimizeQuestion: false,
		playback: new PlaybackFactory(),
		players : {}
	})},
	props: ['connection', 'sound', 'passed', 'avatars', 'lobbyPlayers'],
	computed: {
		showPlayerName: function() { return this.timer.timeLeft % 10 >= 5; },
	},
	created: function() {
		if (!this.connection.connected()) {
			this.$router.push("/");
			return;
		}

		this.connection.onPlayersChange(newPlayers => {
			return playerConnected(this, newPlayers);
		});

		this.connection.onCategorySelect((categories, correct, index, total) => {
			return showCategorySpinner(this, categories, correct, index, total);
		});

		this.connection.onQuestion(text => {
			return displayQuestion(this, text);
		});

		this.connection.onQuestionError(message => {
			return displayError(this, message);
		});

		this.connection.onQuestionStart((view, answers) => {
			return playbackStart(this, view, answers);
		});

		this.connection.onQuestionEnd((pointsThisRound, correct) => {
			return playbackEnd(this, pointsThisRound, correct);
		});

		this.connection.onPlayerGuessed(id => {
			return playerGuessed(this, id);
		});

		this.connection.onGameEnd(() => {
			return new Promise((resolve, reject) => {
				this.connection.clearListeners();
				//TODO: send results as params
				this.$router.push('/results');				
			});
		});

		for (let id in this.lobbyPlayers) {
			this.$set(this.players, id, new PlayerData(this.lobbyPlayers[id]));
		}
	},
	methods: {
		isLeadingPlayer: function (player) {
			let playerScoreCount = Object.values(this.players).filter((p) => p.totalPoints >= player.totalPoints).length;
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
	constructor(player) {
		this.name = player.name;
		this.color = player.color;
		this.avatar = player.avatar;
		this.totalPoints = 0;
		this.pointChange = 0;
		this.multiplier = 1;
		this.guessed = false;
		this.connected = true;
	}

	updatePoints(pointChanges, totalPoints) {
		this.pointChange = pointChanges ? pointChanges.points : 0;
		this.multiplier = totalPoints.multiplier;
		this.guessed = false;
		this.totalPoints = totalPoints.score;
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
	
	update(timer) {
		this.running = timer.running();
		this.score = timer.score();
		this.timeLeft = timer.timeLeft();
		this.percentageLeft = timer.percentageLeft();
	}
}