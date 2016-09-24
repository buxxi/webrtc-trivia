triviaApp.service('playback', function(movies, music) {
	function BlankPlayer() {
		var self = this;

		this.start = function() {
			return new Promise(function(resolve, reject) {
				resolve();
			});
		}

		this.stop = function() {}
	}

	function ImageViewer(url) {
		var self = this;

		self.start = function() {
			return new Promise(function(resolve, reject) {
				document.getElementById('content').innerHTML = '<div class="image" id="player"><img src="' + url + '"/></div>';
				resolve();
			});
		}


		self.stop = function() {}
	}

	function YoutubePlayer(videoId) {
		var self = this;
		var player = {};

		self.start = function() {
			return new Promise(function(resolve, reject) {
				document.getElementById('content').innerHTML = '<div id="player"></div>';

				player = new YT.Player('player', {
					height: '100%',
					width: '100%',
					videoId: videoId,
					playerVars : {
						autoplay : 1,
						showinfo : 0,
						controls : 0,
						hd : 1
					},
					events: {
						onStateChange: function(state) {
							if (state.data == 1) {
								resolve();
							} else {
								reject('got youtube state: ' + state.data);
							}
						}
					}
				});
			});
		}

		self.stop = function() {
			player.stopVideo();
		}
	}

	function Mp3Player(mp3) {
		var self = this;
		var player = {};

		self.start = function() {
			return new Promise(function(resolve, reject) {
				document.getElementById('content').innerHTML = '<div class="wavesurfer" id="player"></div>';
				player = WaveSurfer.create({
					container: '#player',
					waveColor: 'white',
					progressColor: '#337ab7'
				});

				player.on('ready', function () {
					player.setVolume(0.3);
					player.play();
					resolve();
				});

				player.load(mp3);
			});
		}

		self.stop = function() {
			player.stop();
			player.destroy();
		}
	}

	function QuoteText(quote) {
		var self = this;

		self.start = function() {
			return new Promise(function(resolve, reject) {
				document.getElementById('content').innerHTML = '<div class="quote" id="player"><i class="fa fa-fw fa-quote-left"></i><p>' + quote + '</p><i class="fa fa-fw fa-quote-right"></i></div>';
				resolve();
			});
		}

		self.stop = function() {
			//Do nothing
		}
	}

	function Playback() {
		var self = this;

		var players = {
			youtube : function(view) { return new YoutubePlayer(view.videoId) },
			mp3 : function(view) { return new Mp3Player(view.mp3) },
			image : function(view) { return new ImageViewer(view.url) },
			quote : function(view) { return new QuoteText(view.quote) }
		}

		self.player = function(view) {
			if (!view.player) {
				return new BlankPlayer();
			}
			return players[view.player](view);
		}
	}

	return new Playback();
});
