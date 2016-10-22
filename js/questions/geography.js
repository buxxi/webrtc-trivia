triviaApp.service('geography', function($http) {
	function GeographyQuestions() {
		var self = this;
		var countries = [];

		var types = {
			flags : {
				title : function(correct) { return "What country does this flag belong to?" },
				correct : randomCountry,
				similar : similarCountries,
				load : function(correct) {
					return loadImage('https://flagpedia.net/data/flags/normal/' + correct.code.toLowerCase() + '.png');
				}
			},
			shape : {
				title : function(correct) { return "What country has this shape?" },
				correct : randomCountry,
				similar : similarCountries,
				load : function(correct) {
					return loadImage('https://chart.googleapis.com/chart?cht=map&chs=590x500&chld=' + correct.code + '&chco=000000|307bbb&chf=bg,s,000000&cht=map:auto=50,50,50,50');
				}
			},
			highpopulation : {
				title : function(correct) { return "Which country has the largest population?" },
				correct : randomCountry,
				similar : similarPopulationCountries,
				load : function(correct) {
					return loadBlank();
				}
			},
			capital : {
				title : function(correct) { return "In what country is " + correct.capital + " the capital?" },
				correct : randomCountry,
				similar : similarCountries,
				load : function(correct) {
					return loadBlank();
				}
			}
		}

		self.describe = function() {
			return {
				type : 'geography',
				name : 'Geography',
				icon : 'fa-globe'
			};
		}

		self.preload = function(progress, cache) {
			return cache.get('countries', function(resolve, reject) {
				$http.get('https://restcountries.eu/rest/v1/all').then(function(response) {
					var result = response.data.map(function(country) {
						return {
							code : country.alpha2Code,
							region : country.subregion,
							name : country.name,
							population : country.population,
							capital : country.capital
						}
					});
					resolve(result);
				});
			}).then(function(data) {
				countries = data;
			});
		}

		self.nextQuestion = function(selector) {
			return new Promise(function(resolve, reject) {
				var type = selector.fromArray(Object.keys(types));

				var correct = types[type].correct(selector);
				var similar = types[type].similar(correct);
				var title = types[type].title(correct);

				console.log(similar);

				function resolveName(c) {
					return c.name;
				}

				types[type].load(correct).then(function(view) {
					resolve({
						text : title,
						answers : selector.alternatives(similar, correct, resolveName, selector.first),
						correct : resolveName(correct),
						view : view
					});
				}).catch(reject);
			});
		}

		function randomCountry(selector) {
			return selector.fromArray(countries);
		}

		function similarCountries(country) {
			return countries.filter(function(c) {
				return country.region == c.region;
			});
		}

		function similarPopulationCountries(country) {
			function populationSort(c) {
				return Math.floor(Math.log(c.population));
			}

			return countries.filter(function(c) {
				return c.population < country.population;
			}).sort(function(a, b) {
				return populationSort(b) - populationSort(a);
			});
		}

		function loadImage(url) {
			return new Promise(function(resolve, reject) {
				var img = new Image();
				img.onload = function() {
					resolve({
						player : 'image',
						url : url
					});
				};
				img.onerror = function() {
					console.log("Could not load " + img.src);
					reject();
				}
				img.src = url;
			});
		}

		function loadBlank() {
			return new Promise(function(resolve, reject) {
				resolve({});
			});
		}
	}

	return new GeographyQuestions();
});
