import Lobby from '../components/lobby.js';
import Question from '../components/question.js';
import Results from '../components/results.js';
import SoundController from '../sound.js';
import Playback from '../playback.js';
import MonitorToServerConnection from '../connection.js';

function loadTemplate(url, component) {
	return (resolve, reject) => {
		fetch(url).then((response) => response.text()).then((data) => {
			component.template = data;
			resolve(component);
		});
	};
}

const sound = new SoundController();
const playback = new Playback();
const connection = new MonitorToServerConnection();

const routes = [
  	{ 
		path: '/',
		component: loadTemplate('./pages/lobby.html', Lobby),
		props: (route) => ({ 
				connection: connection,
				sound: sound,
				fakePlayers: route.query.fakePlayers,
				forcePairCode : route.query.forcePairCode
		}) 
	},
	{
		path: '/game',
		component: loadTemplate('./pages/game-server.html', Question),
		props: (route) => ({ 
			connection: connection,
			playback: playback,
			sound: sound
		})		 
	},
	{
		path: '/results',
		component: loadTemplate('./pages/results.html', Results),
		props: (route) => ({ 
			sound: sound
		})		 
	},
];

const router = new VueRouter({
  routes
});

const app = new Vue({
  router
}).$mount('#main');