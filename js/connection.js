function Connection($rootScope) {
	var self = this;
	var mediator = { pairCode : null };
	var serverUrl = window.location.href.toString().substr(0, window.location.href.toString().indexOf(window.location.pathname));
	var peers = [];

	function dataEvent(pairCode, data) {
		var command = Object.keys(data)[0];
		var params = data[command];
		$rootScope.$broadcast('data-' + command, pairCode, params);
	}

	self.disconnect = function() {
		mediator.close();
	}

	self.host = function(joinCallback) {
		return new Promise((resolve, reject) => {
			new Fingerprint2().get((id) => {
				mediator = createPeer(id, false);

				mediator.on('error', (err) => {
					reject(err);
				});

				mediator.on('data', (data) => {
					if (data.join) {
						mediator.close();

						var peer = createPeer(data.join.pairCode, true);
						peer.on('connect', () => {
							try {
								if (peerReconnected(peer)) {
									return;
								}
								joinCallback(data.join);
								peers.push(peer);
								peer.send({
									join : true
								});
							} catch (e) {
								console.log(e);
								peer.send({
									join : e.message
								})
								peer.close();
							}
							mediator.connect();
						});
						peer.on('data', (data) => {
							dataEvent(peer.pairCode, data);
						});

						peer.on('upgrade', () => {
							$rootScope.$broadcast('connection-upgraded', peer);
						});

						peer.on('close', () => {
							$rootScope.$broadcast('connection-closed', peer);
						});

						peer.connect();
					}
				});

				sanityCheck = createPeer(id, false);
				sanityCheck.on('connect', () => {
					mediator.on('close', () => {
						setTimeout(() => {
							mediator.connect();
							resolve(id);
						}, 10);

					});
					sanityCheck.on('close', () => {
						mediator.close();
					});

					sanityCheck.close();
				});
				mediator.connect();
				sanityCheck.connect();
			});
		});
	}

	self.join = function(pairCode, name) {
		return new Promise((resolve, reject) => {
			new Fingerprint2().get((id) => {
				mediator = createPeer(pairCode, false);

				mediator.on('error', (err) => {
					reject(err);
				});

				var timeout = setTimeout(() => {
					mediator.close();
					reject("No one listening on Pair Code " + pairCode);
				}, 3000);

				mediator.on('connect', () => {
					mediator.send({
						join : { name : name, pairCode : id }
					});

					connectClient(id).then(() => {
						$rootScope.$on('data-join', (event, id, data) => {
							clearTimeout(timeout);
							if (data === true) {
								resolve();
							} else {
								reject(data);
							}
						});
					});
					mediator.close();
				});

				mediator.connect();
			});
		});
	}

	self.reconnect = function() {
		return new Promise((resolve, reject) => {
			new Fingerprint2().get((id) => {
				//TODO: timeout handling
				connectClient(id).then(resolve);
			});
		});
	}

	self.close = function(pairCode) {
		var peer = peerFromPairCode(pairCode);
		peer.close();
	}

	self.send = function(data) {
		console.log("Sending: " + JSON.stringify(data) + " to " + peers.length + " peers");
		peers.forEach((peer) => {
			peer.send(data);
		});
	}

	self.connected = function() {
		return peers.length == 1 && !!peers[0].peer;
	}

	self.usingFallback = function(pairCode) {
		try {
			return !peerFromPairCode(pairCode).rtcConnected;
		} catch (e) {
			return true;
		}
	}

	self.connectionError = function(pairCode) {
		try {
			var peer = peerFromPairCode(pairCode);
			return !peer.rtcConnected && !peer.socketConnected;
		} catch (e) {
			return true;
		}
	}

	function connectClient(id) {
		return new Promise((resolve, reject) => {
			var peer = createPeer(id, true);
			peer.on('connect', () => {
				peers = [peer];

				peer.on('data', (data) => {
					dataEvent(peer.pairCode, data);
				});

				resolve();
			});

			peer.on('close', () => {
				$rootScope.$broadcast('connection-closed', peer);
			});

			peer.connect();
		});
	}

	function peerReconnected(peer) {
		for (var i = 0; i < peers.length; i++) {
			if (peer.pairCode == peers[i].pairCode) {
				return true;
			}
		}
		return false;
	}

	function createPeer(pairCode, reconnect) {
		var peer = new SocketPeer({
			pairCode: pairCode.toLowerCase(),
			socketFallback: true,
			url: serverUrl + '/socketpeer/',
			reconnect: reconnect,
			autoconnect: false,
			serveLibrary: false,
			debug: false
		});
		peer.on('connect', () => {
			fixCloseEvent(peer);
		});
		return peer;
	}

	function fixCloseEvent(peer) { //TODO: make a bug report that this is not triggered, server also modified to actually close the connection
		var old = peer.socket.onclose;
		peer.socket.onclose = () => {
			peer.socketConnected = false;
			peer.emit('close');
			old();
		};
		return peer;
	}

	function peerFromPairCode(pairCode) {
		for (var i = 0; i < peers.length; i++) {
			if (peers[i].pairCode == pairCode) {
				return peers[i];
			}
		}
		throw new Error("No peer with Pair Code: " + pairCode);
	}
};
