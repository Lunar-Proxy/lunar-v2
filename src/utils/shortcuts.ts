import * as BareMux from '@mercuryworkshop/bare-mux';
import ConfigAPI from './config';


document.addEventListener('DOMContentLoaded', () => {
	document.querySelectorAll('[data-short]').forEach(el => {
		el.addEventListener('click', async e => {
			const url = (el as HTMLElement).getAttribute('data-short');
			if (url) {
				e.preventDefault();
				const conn = new BareMux.BareMuxConnection('/bm/worker.js');
				await ConfigAPI.init();
				const wisp = await ConfigAPI.get('wispUrl');
				if ((await conn.getTransport()) !== '/lc/index.mjs') {
					await conn.setTransport('/lc/index.mjs', [{ wisp }]);
				}
			const input = window.parent.document.getElementById('urlbar') as HTMLInputElement | null;
			if (!input) return;
			input.value = url;
			input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
			}
		});
	});
});
