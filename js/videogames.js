triviaApp.service('videogames', function($http, apikeys) {
	function VideoGameQuestions() {
		var self = this;
		var platforms = {};
		var games = [];

		self.describe = function() {
			return {
				type : 'videogames',
				name : 'Video Games',
				icon : 'fa-gamepad'
			};
		}

		self.preload = function(progress) {
			return new Promise(function(resolve, reject) {
				loadPlatforms().then(function(result) {
					platforms = result;
					var total = Object.keys(platforms).length * 50;

					progress(games.length, total);

					var promises = Object.keys(platforms).map(function(platform) {
						return loadGames(platform);
					});

					for (var i = 0; i < (promises.length - 1); i++) {
						promises[i].then(function(data) {
							games = games.concat(data);
							progress(games.length, total);
							return promises[i + 1];
						});
					}
					promises[promises.length - 1].then(function(data) {
						games = games.concat(data);
						resolve();
					});
				});
			});
		}


		self.nextQuestion = function(random) {
			return new Promise(function(resolve, reject) {
				var game = random.fromArray(games);
				var similar = similarGames(game);
				resolve({
					text : "What game is this a screenshot of?",
					answers : [
						game.name,
						similar[0].name,
						similar[1].name,
						similar[2].name
					],
					correct : game.name,
					view : {
						player : 'image',
						url : 'https://res.cloudinary.com/igdb/image/upload/t_screenshot_huge/' + game.screenshots[0] + '.jpg',
						attribution : [game.attribution]
					}
				});
			});
		}

		function loadGames(platform) {
			return new Promise(function(resolve, reject) {
				var result = localStorage.getItem('igdb-' + platform);
				if (result) {
					resolve(JSON.parse(result));
					return;
				}

				$http.get('https://igdbcom-internet-game-database-v1.p.mashape.com/games/', {
					params : {
						fields : 'name,url,first_release_date,release_dates,screenshots',
						limit : 50,
						offset : 0,
						order : 'aggregated_rating:desc',
						'filter[screenshots][exists]' : '',
						'filter[release_dates.platform][eq]' : platform
					},
					headers : {
						'X-Mashape-Key' : apikeys.mashape
					}
				}).then(function(response) {
					var games = response.data.map(function(game) {
						return {
							name : game.name,
							release_date : new Date(game.first_release_date).toISOString(),
							screenshots : game.screenshots.map(function(ss) { return ss.cloudinary_id; }),
							platforms : game.release_dates.map(function(rd) { return platforms[rd.platform] ? platforms[rd.platform].name : null; }).filter(function(p) { return p != null; }),
							attribution : game.url
						};
					});
					localStorage.setItem('igdb-' + platform, JSON.stringify(games));
					resolve(games);
				});
			});
		}

		function loadPlatforms() {
			var loadPage = function(offset) {
				return $http.get('https://igdbcom-internet-game-database-v1.p.mashape.com/platforms/', {
					params : {
						fields : 'name,generation,games',
						limit : 50,
						offset : offset
					},
					headers : {
						'X-Mashape-Key' : apikeys.mashape
					}
				})
			};

			return new Promise(function(resolve, reject) {
				var result = localStorage.getItem('igdb-platforms');
				if (result) {
					resolve(JSON.parse(result));
					return;
				}

				result = [];
				var callback = function(response) {
					result = result.concat(response.data);

					if (response.data.length == 50) {
						loadPage(result.length).then(callback);
					} else {
						var object = {};
						result.forEach(function(platform) {
							if (!platform.games || platform.games.length < 50) {
								return;
							}
							object[platform.id] = {
								name : platform.name,
								generation : platform.generation,
								games : platform.games ? platform.games.length : 0
							}
						});
						localStorage.setItem('igdb-platforms', JSON.stringify(object));
						resolve(object);
					}
				};

				loadPage(0).then(callback);
			});
		}

		function similarGames(game) {
			var titleWords = wordsFromString(game.name);
			var tmp = games.filter(function(g) {
				return g.name != game.name;
			}).map(function(g) {
				return {
					game : g,
					score : levenshteinDistance(titleWords, wordsFromString(g.name)) + dateDistance(game.release_date, g.release_date)
				};
			});
			tmp.sort(function(a, b) {
				return a.score - b.score;
			});

			var result = [];
			var i = 0;
			while (result.length < 3) {
				var candidate = tmp[i++].game;
				var found = false;
				for (var j = 0; j < result.length; j++) {
					found = found | result[j].name == candidate.name;
				}
				if (!found) {
					result.push(candidate);
				}
			}
			return result;
		}

		function wordsFromString(s) {
			return s.split(/[^a-zA-Z0-9]/).filter(function(s) { return s.length > 0 }).map(function(s) { return s.toLowerCase(); });
		}

		function dateDistance(a, b) {
			var dist = Math.abs(new Date(Date.parse(a)).getFullYear() - new Date(Date.parse(b)).getFullYear());
			return Math.floor(Math.log(Math.max(dist, 1)));
		}

		function levenshteinDistance(a, b) { //copied from and modified to use array instead: https://gist.github.com/andrei-m/982927
			if(!a || !b) {
				return (a || b).length;
			}
			var m = [];
			for(var i = 0; i <= b.length; i++){
				m[i] = [i];
				if(i === 0) {
					continue;
				}
				for(var j = 0; j <= a.length; j++){
					m[0][j] = j;
					if(j === 0) {
						continue;
					}
					m[i][j] = b[i - 1] == a[j - 1] ? m[i - 1][j - 1] : Math.min(
						m[i-1][j-1] + 1,
						m[i][j-1] + 1,
						m[i-1][j] + 1
					);
				}
			}
			return m[b.length][a.length];
		}
	}

	return new VideoGameQuestions();
});

