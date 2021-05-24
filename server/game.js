const avatars = require('../js/avatars.js');
const randomColor = require('randomcolor');
const Timer = require('./timer.js');
const Session = require('./session.js');

class Player {
	constructor(name, color, avatar) {
		this.name = name;
		this.color = color;
		this.avatar = avatar;
		this.score = 0;
		this.multiplier = 1;
		this.stats = new PlayerStats();
	}

	_reset() {
		this.score = 0;
		this.multiplier = 1;
		this.stats = new PlayerStats();
	}

	_updateScore(timeScore, time, maxMultiplier) {
		if (timeScore > 0) {
			this.score += timeScore * this.multiplier;
			this.multiplier = Math.min(this.multiplier + 1, maxMultiplier);
			this.stats.correct++;
			this.stats.fastest = Math.max(time, this.stats.fastest);
			this.stats.slowest = Math.min(time, this.stats.slowest);
			this.stats.mostWon = Math.max(timeScore, this.stats.mostWon);
		} else if (timeScore < 0) {
			this.score = Math.max(0, this.score + timeScore);
			this.multiplier = 1;
			this.stats.wrong++;
			this.stats.mostLost = Math.max(Math.abs(timeScore), this.stats.mostLost);
		} else {
			this.multiplier = 1;
		}
	}
}

class PlayerStats {
	constructor() {
		this.correct = 0;
		this.wrong = 0;
		this.fastest = -Infinity;
		this.slowest = Infinity;
		this.mostWon = 0;
		this.mostLost = 0;
	}
}

class Game {
	constructor(categories) {
		this._categories = categories;
		this._players = {};
		this._guesses = {};
		this._session = { history : () => [] };
		this._timer = {};
		this._config = {
			questions : 25,
			time : 30,
			pointsPerRound : 1000,
			stopOnAnswers : true,
			allowMultiplier : true,
			maxMultiplier : 5,
			sound : {
				backgroundMusic : true,
				soundEffects : true,
				text2Speech : true
			},
			categories : {},
			fullscreen : false,
			categorySpinner : true
		};
	}

	players() {
		return this._players;
	}

	config() {
		return this._config;
	}

	addPlayer(peerid, name, avatar) {
		let uniqueName = Object.values(this._players).map((player) => player.name).indexOf(name) == -1;
		if (!uniqueName) {
			throw new Error("The name " + name + " is already in use");
		}

		let color = randomColor({ luminosity: 'dark' });
		this._players[peerid] = new Player(name, color, this._selectAvatar(avatar));
	}

	removePlayer(peerid) {
		delete this._players[peerid];
	}

	configure() {
		this._categories.configure(this._config.categories);
		Object.values(this._players).forEach((player) => player._reset());
		this._session = new Session(this._config.questions);
		this._timer = new Timer(this._config.time, this._config.pointsPerRound);
	}

	hasGuessed(peerid) {
		return this._guesses[peerid];
	}

	guess(peerid, answer) {
		if (this._guesses[peerid]) {
			throw new Error("Has already guessed!");
		}
		if (!this._timer.running()) {
			throw new Error("Game isn't accepting answers at this moment");
		}
		this._guesses[peerid] = {
			answer : answer,
			time : new Date().getTime()
		};
		if (Object.keys(this._guesses).length == Object.keys(this._players).length && this._config.stopOnAnswers) {
			this._timer.stop();
		}
	}

	stats(peerid) {
		let player = this._players[peerid];
		return {
			avatar : player.avatar,
			color : player.color,
			score : player.score,
			multiplier : player.multiplier
		};
	}

	correctAnswer() {
		let question = this._session.question();
		let correct = question.correct;
		return {
			key : Object.keys(question.answers).filter((key) => question.answers[key] == correct)[0],
			answer : correct
		}
	}

	session() {
		return this._session;
	}

	startTimer(callback) {
		return new Promise((resolve, reject) => {
			this._timer.run(callback, () => {
				let pointsThisRound = this._calculatePoints();
				this._guesses = {};
				this._session.endQuestion();
				resolve(pointsThisRound);
			});
		});
	}

	hasMoreQuestions() {
		return this._session.finished();
	}

	showCategorySpinner() {
		return this._config.categorySpinner;
	}

	nextQuestion() {
		return new Promise((resolve, reject) => {
			this._categories.nextQuestion(this._session).then(resolve).catch(reject);
		});
	}

	_calculatePoints() {
		var result = {};
		Object.keys(this._players).forEach((peerid) => {
			let player = this._players[peerid];
			let timerScore = this._timer.score(this._guesses[peerid].time);
			let timeLeft = this._timer.timeLeft(this._guesses[peerid].time);
			let maxMultiplier = this._config.allowMultiplier ? this._config.maxMultiplier : 1;

			let scoreBefore = player.score;
			let multiplierBefore = player.multiplier;

			if (this.hasGuessed(peerid) && this._guesses[peerid].answer == this.correctAnswer()['key']) {
				player._updateScore(timerScore, timeLeft, maxMultiplier);
			} else if (this.hasGuessed(peerid)) {
				player._updateScore(-timerScore, timeLeft, 1);
			} else {
				player._updateScore(0, timeLeft, 1);
			}

			result[peerid] = { points: player.score - scoreBefore, multiplier: player.multiplier - multiplierBefore }; 
		});
		return result;
	}

	_selectAvatar(preferred) {
		let unusedAvatars = Object.keys(avatars).filter((avatar) => {
			return Object.values(this._players).map((player) => {
				return player.avatar;
			}).indexOf(avatar) == -1;
		});
		if (unusedAvatars.indexOf(preferred) > -1) {
			return preferred;
		}
		return unusedAvatars[unusedAvatars.length * Math.random() << 0];
	}
}

module.exports = Game;