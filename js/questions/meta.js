function CurrentGameQuestions($injector, avatars) {
	var self = this;

	var types = {
		avatar : {
			title : (correct) => "What animal does " + correct.name + " have as avatar?",
			correct : randomPlayer,
			similar : otherAvatars,
			format : resolveAvatar,
			attribution : "Featured avatar"
		},
		correct : {
			title : (correct) => "Who has the most correct answers so far?",
			correct : playerWithMost((p) => p.stats.correct),
			similar : playersWithLower((p) => p.stats.correct),
			format : resolveName,
			attribution : "Most correct player"
		},
		wrong : {
			title : (correct) => "Who has the most incorrect answers so far?",
			correct : playerWithMost((p) => p.stats.wrong),
			similar : playersWithLower((p) => p.stats.wrong),
			format : resolveName,
			attribution : "Most incorrect player"
		},
		total_correct : {
			title : (correct) => "What is the total amount of correct answers so far?",
			correct : countTotal((p) => p.stats.correct),
			similar : numericAlternatives,
			format : formatValue,
			attribution : "Total correct answers"
		},
		total_wrong : {
			title : (correct) => "What is the total amount of incorrect answers so far?",
			correct : countTotal((p) => p.stats.wrong),
			similar : numericAlternatives,
			format : formatValue,
			attribution : "Total incorrect answers"
		},
		fastest : {
			title : (correct) => "Who has made the fastest correct answers so far?",
			correct : playerWithMost((p) => p.stats.fastest),
			similar : playersWithLower((p) => p.stats.fastest),
			format : resolveName,
			attribution : "Fastest player"
		},
		slowest : {
			title : (correct) => "Who has made the slowest correct answers so far?",
			correct : playerWithLeast((p) => p.stats.slowest),
			similar : playersWithHigher((p) => p.stats.slowest),
			format : resolveName,
			attribution : "Slowest player"
		}
	}

	self.describe = function() {
		return {
			type : 'game',
			name : 'Current Game',
			icon : 'fa-history',
			count : Object.keys(types).length
		};
	}

	self.preload = function(progress, cache, apikeys) {
		return new Promise((resolve, reject) => {
			self.current_game = $injector.get('game'); //This would make it have circular dependencies
			resolve();
		});
	}

	self.nextQuestion = function(selector) {
		return new Promise((resolve, reject) => {
			var type = selector.fromWeightedObject(types);
			var correct = type.correct(selector);

			resolve({
				text : type.title(correct),
				answers : selector.alternatives(type.similar(correct, selector), correct, type.format, selector.splice),
				correct : type.format(correct),
				view : {
					attribution : {
						title : type.attribution + " (at that time)",
						name : type.format(correct),
						links : []
					}
				}
			});
		});
	}

	function randomPlayer(selector) {
		return selector.fromArray(Object.values(self.current_game.players()));
	}

	function playerWithMost(func) {
		return (selector) => {
			return Object.values(self.current_game.players()).reduce((a, b) => func(a) > func(b) ? a : b);
		};
	}

	function playersWithLower(func) {
		return (player, selector) => {
			return Object.values(self.current_game.players()).filter((p) => func(p) < func(player));
		};
	}

	function playerWithLeast(func) {
		return (selector) => {
			return Object.values(self.current_game.players()).reduce((a, b) => func(a) < func(b) ? a : b);
		};
	}

	function playersWithHigher(func) {
		return (player, selector) => {
			return Object.values(self.current_game.players()).filter((p) => func(p) > func(player));
		};
	}

	function countTotal(func) {
		return (selector) => {
			return Object.values(self.current_game.players()).map((p) => func(p)).reduce((a, b) => a + b, 0);
		};
	}

	function numericAlternatives(number, selector) {
		var index = self.current_game.session().index();
		return selector.yearAlternatives(number, index);
	}

	function similarPlayers(player, selector) {
		return Object.values(self.current_game.players());
	}

	function otherAvatars(player, selector) {
		return Object.keys(avatars).map((a) => ({ avatar : a }));
	}

	function resolveName(player) {
		return player.name;
	}

	function resolveAvatar(player) {
		return player.avatar.charAt(0).toUpperCase() + player.avatar.slice(1);
	}

	function formatValue(value) {
		return value;
	}
}
